# Special Bets: futures (outright) markets from PointsBet (AU) -> data\futures.json. Bookmaker prices only, as published.
# The same public JSON the pointsbet.com.au site reads (the app's existing price source); no login.
# Every competition, event, market and selection keeps PointsBet's own id. A market that was listed before and has gone
# from PointsBet is kept as "closed" (with its last prices) for 30 days, so it can never look open; a market PointsBet
# shows as not open for betting is "suspended". Nothing is estimated: a market with no price is left out.
$ErrorActionPreference = 'Stop'
$B = 'https://api.au.pointsbet.com/api'; $dst = Join-Path $PSScriptRoot 'data\futures.json'
# our competition key, sport, display name, PointsBet futures competition id
$FC = @(
  @('nba', 'basketball', 'NBA', 9237), @('nfl', 'football', 'NFL', 14649),
  @('epl', 'soccer', 'Premier League', 14094), @('ucl', 'soccer', 'Champions League', 16093), @('uel', 'soccer', 'Europa League', 37518),
  @('fac', 'soccer', 'FA Cup', 14425), @('lgc', 'soccer', 'Carabao Cup', 182998), @('uecl', 'soccer', 'Conference League', 253749),
  @('laliga', 'soccer', 'La Liga', 14108), @('seriea', 'soccer', 'Serie A', 14107), @('bund', 'soccer', 'Bundesliga', 14095),
  @('ligue1', 'soccer', 'Ligue 1', 14194), @('spl', 'soccer', 'Scottish Premiership', 86597), @('wc', 'soccer', 'FIFA World Cup', 12151))
function Fetch([string[]]$urls) {
  $pool = [runspacefactory]::CreateRunspacePool(1, 8); $pool.Open()
  $jobs = foreach ($u in ($urls | Select-Object -Unique)) { $ps = [powershell]::Create(); $ps.RunspacePool = $pool
    [void]$ps.AddScript({ param($u) for ($i = 0; $i -lt 3; $i++) { try { return (Invoke-WebRequest -UseBasicParsing -TimeoutSec 60 $u).Content } catch { Start-Sleep -Milliseconds 800 } }; $null }).AddArgument($u)
    [pscustomobject]@{ u = $u; ps = $ps; h = $ps.BeginInvoke() } }
  $r = @{}; foreach ($j in $jobs) { $o = $j.ps.EndInvoke($j.h); $r[$j.u] = if ($o.Count) { $o[0] } else { $null }; $j.ps.Dispose() }; $pool.Close(); $pool.Dispose(); $r
}
# market type, for the filters: who wins it / an award / a statistical leader / where a team finishes / anything else
function Kind([string]$n) {
  if ($n -match 'MVP|Player of the Year|Rookie of the Year|Coach of the Year|Sixth Man|6th Man|Most Improved|Comeback|Golden Boot|Ballon|Manager of') { 'award' }
  elseif ($n -match 'Top Goalscorer|Top Scorer|Leading|Most .*(Yards|Touchdowns|Sacks|Interceptions|Points|Rebounds|Assists|Goals)|Passing Yards|Rushing Yards|Receiving Yards') { 'leader' }
  elseif ($n -match 'Top \d|Relegat|Finish|Make the Playoffs|Make Playoffs|Win Total|Regular Season Wins|Bottom|Without') { 'finish' }
  elseif ($n -match 'Winner|Champion|Outright|To Win|Super Bowl|Conference|Division|Pennant|Group') { 'champion' }
  else { 'other' } }
$now = (Get-Date).ToUniversalTime(); $stamp = $now.ToString('yyyy-MM-ddTHH:mm:ssZ')
$lr = Fetch @($FC | % { "$B/v2/competitions/$($_[3])/events/featured?includeLive=false" })
$evs = @(); foreach ($c in $FC) { $raw = $lr["$B/v2/competitions/$($c[3])/events/featured?includeLive=false"]; if (-not $raw) { Write-Warning "no futures list for $($c[2])"; continue }
  foreach ($e in @(($raw | ConvertFrom-Json).events)) { if ($e.key) { $evs += [pscustomobject]@{ c = $c; key = [string]$e.key; name = $e.name; ends = $e.startsAt } } } }
$dr = Fetch @($evs | % { "$B/mes/v3/events/$($_.key)" })
$comps = [ordered]@{}; $nm = 0; $ns = 0
foreach ($ev in $evs) { $raw = $dr["$B/mes/v3/events/$($ev.key)"]; if (-not $raw) { Write-Warning "no detail for $($ev.name)"; continue }; $d = $raw | ConvertFrom-Json
  $mk = @(); foreach ($m in @($d.fixedOddsMarkets)) { if ($m.isHidden) { continue }
    $sel = @($m.outcomes | ? { -not $_.isHidden -and [double]$_.price -gt 1 } | % { [ordered]@{ id = [string]$(if ($_.fixedMarketId) { $_.fixedMarketId } else { "$($m.key)/$($_.key)" }); n = [string]$_.name; p = [double]$_.price; st = $(if ($_.isOpenForBetting) { 'open' } else { 'suspended' }); upd = [string]$_.priceLastUpdated } })
    if (-not $sel.Count) { continue }
    $mn = [string]$m.eventName; $mk += [ordered]@{ id = [string]$m.key; n = $mn; k = (Kind $mn); st = $(if ($m.isOpenForBetting) { 'open' } else { 'suspended' }); sel = @($sel | Sort-Object { $_.p }) }; $nm++; $ns += $sel.Count }
  if (-not $mk.Count) { continue }
  $ck = $ev.c[0]; if (-not $comps.Contains($ck)) { $comps[$ck] = [ordered]@{ id = $ck; sport = $ev.c[1]; n = $ev.c[2]; pb = $ev.c[3]; events = [Collections.Generic.List[object]]::new() } }
  $comps[$ck].events.Add([ordered]@{ id = $ev.key; n = [string]$ev.name; ends = [string]$ev.ends; markets = $mk }) }
if (-not $nm) { throw 'PointsBet returned no futures markets; keeping the previous futures.json' }
# markets listed last time but gone now: kept as closed (last prices) for 30 days
$prevN = 0; if (Test-Path $dst) { try { $prev = [IO.File]::ReadAllText($dst) | ConvertFrom-Json
  $have = @{}; foreach ($c in $comps.Values) { foreach ($e in $c.events) { foreach ($m in $e.markets) { $have[$m.id] = 1 } } }
  foreach ($c in @($prev.comps)) { foreach ($e in @($c.events)) { foreach ($m in @($e.markets)) { if ($have[[string]$m.id]) { continue }
    $since = if ($m.st -eq 'closed' -and $m.closed) { [datetime]::Parse([string]$m.closed).ToUniversalTime() } else { $now }; if (($now - $since).TotalDays -gt 30) { continue }
    if (-not $comps.Contains($c.id)) { $comps[$c.id] = [ordered]@{ id = $c.id; sport = $c.sport; n = $c.n; pb = $c.pb; events = [Collections.Generic.List[object]]::new() } }
    $te = @($comps[$c.id].events | ? { $_.id -eq [string]$e.id })[0]; if (-not $te) { $te = [ordered]@{ id = [string]$e.id; n = $e.n; ends = $e.ends; markets = @() }; $comps[$c.id].events.Add($te) }
    $cm = [ordered]@{ id = [string]$m.id; n = $m.n; k = $m.k; st = 'closed'; closed = $since.ToString('yyyy-MM-ddTHH:mm:ssZ'); sel = @($m.sel) }; $te.markets = @($te.markets) + @($cm); $prevN++ } } } } catch { Write-Warning "previous futures.json unreadable: $_" } }
$out = [ordered]@{ v = 1; src = 'PointsBet (AU)'; fetched = $stamp; comps = @($comps.Values | % { [ordered]@{ id = $_.id; sport = $_.sport; n = $_.n; pb = $_.pb; events = @($_.events) } }) }
$json = $out | ConvertTo-Json -Depth 8 -Compress
[IO.File]::WriteAllText("$dst.tmp", $json, [Text.UTF8Encoding]::new($false)); Move-Item -Force "$dst.tmp" $dst
"FUTURES_OK comps=$($comps.Count) markets=$nm selections=$ns closed-kept=$prevN size=$([int]($json.Length/1KB))KB"
