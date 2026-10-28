# FA Cup, Carabao Cup and Europa League fixtures between full rebuilds (the 30-minute refresh), so a newly drawn round shows up
# within half an hour instead of waiting for build-data.ps1 (every 3 hours). Same ESPN scoreboards and the same game fields as
# build-data.ps1's schedule section (keep the two in step): ESPN's sportsbook line where it has one, else ESPN's win projection.
# Patches data\sideline-data.json in place (atomically): that competition's not-yet-finished games are replaced with today's list.
param([int]$Days = 14)
$ErrorActionPreference = 'Stop'
$dataF = Join-Path $PSScriptRoot 'data\sideline-data.json'
$EB = 'https://site.api.espn.com/apis/site/v2/sports/'
$LG = [ordered]@{ fac = 'soccer/eng.fa'; lgc = 'soccer/eng.league_cup'; uel = 'soccer/uefa.europa' }
function Num($x) { $n = 0.0; if ([double]::TryParse([string]$x, [ref]$n)) { [math]::Round($n, 2) } else { 0 } }
function Am($o) { if ($o -and $o -ne 'OFF' -and $o -ne 'EVEN') { [int]($o -replace '\+', '') } elseif ($o -eq 'EVEN') { 100 } else { $null } }
function Fetch([string[]]$urls) {
  $pool = [runspacefactory]::CreateRunspacePool(1, $(if ($env:SL_THREADS) { [int]$env:SL_THREADS } else { 8 })); $pool.Open()
  $jobs = foreach ($u in ($urls | Select-Object -Unique)) { $ps = [powershell]::Create(); $ps.RunspacePool = $pool
    [void]$ps.AddScript({ param($u) for ($i = 0; $i -lt 3; $i++) { try { return (Invoke-WebRequest -UseBasicParsing -TimeoutSec 25 $u).Content } catch { Start-Sleep -Milliseconds (500 * ($i + 1)) } }; $null }).AddArgument($u)
    [pscustomobject]@{ u = $u; ps = $ps; h = $ps.BeginInvoke() } }
  $r = @{}; foreach ($j in $jobs) { $o = $j.ps.EndInvoke($j.h); $r[$j.u] = if ($o.Count) { $o[0] } else { $null }; $j.ps.Dispose() }; $pool.Close(); $pool.Dispose(); $r
}
$today = (Get-Date).ToUniversalTime().Date
$sbU = @{}; foreach ($k in $LG.Keys) { $sbU[$k] = @(-1..$Days | % { "$EB$($LG[$k])/scoreboard?dates=$($today.AddDays($_).ToString('yyyyMMdd'))" }) }
$sb = Fetch @($sbU.Values | % { $_ })
$new = @{}; $ok = @{}; $seen = @{}
foreach ($k in $LG.Keys) {
  $got = 0; $list = [Collections.Generic.List[object]]::new()
  foreach ($u in $sbU[$k]) { $raw = $sb[$u]; if (-not $raw) { continue }; $got++
    foreach ($ev in @(($raw | ConvertFrom-Json).events)) { if (-not $ev -or $seen[$ev.id]) { continue }; $seen[$ev.id] = 1
      $c = $ev.competitions[0]; if ($ev.status.type.state -eq 'post') { continue }
      $H = $c.competitors | ? homeAway -eq 'home'; $A = $c.competitors | ? homeAway -eq 'away'
      $g = [ordered]@{ sp = $k; id = $ev.id; h = $H.team.displayName; a = $A.team.displayName; hid = $H.team.id; aid = $A.team.id; iso = $ev.date; st = $ev.status.type.state }
      $o = @($c.odds)[0]
      if ($o -and $o.moneyline) { $ln = [ordered]@{ src = $o.provider.name }
        $mh = Am $o.moneyline.home.close.odds; $ma = Am $o.moneyline.away.close.odds; if ($mh -and $ma) { $ln.ml = @($mh, $ma) }
        if ($o.moneyline.draw) { $md = Am $o.moneyline.draw.close.odds; if ($md) { $ln.dr = $md } }
        if ($o.pointSpread -and $o.pointSpread.home.close.line) { $ln.sp = @((Num $o.pointSpread.home.close.line), (Am $o.pointSpread.home.close.odds), (Am $o.pointSpread.away.close.odds)) }
        if ($o.total -and $o.total.over.close.line) { $ln.t = @((Num ($o.total.over.close.line -replace '[ou]', '')), (Am $o.total.over.close.odds), (Am $o.total.under.close.odds)) }
        if ($ln.Count -gt 1) { $g.ln = $ln } }
      $list.Add($g) } }
  # a competition whose scoreboards didn't all load keeps the games it had (a partial list would drop real fixtures)
  if ($got -eq $sbU[$k].Count) { $ok[$k] = 1; $new[$k] = $list } else { Write-Warning "$k : $got of $($sbU[$k].Count) scoreboards loaded; keeping its current fixtures" }
}
# ESPN's win projection for each new game (home, away; the draw is what's left)
$pu = @{}; foreach ($k in $new.Keys) { foreach ($g in $new[$k]) { $pu[$g.id] = "$EB$($LG[$k])/summary?event=$($g.id)" } }
$pr = if ($pu.Count) { Fetch @($pu.Values) } else { @{} }
foreach ($k in $new.Keys) { foreach ($g in $new[$k]) { $raw = $pr[$pu[$g.id]]; if (-not $raw) { continue }; $s = $raw | ConvertFrom-Json
    $hp = $s.predictor.homeTeam.gameProjection; $ap = $s.predictor.awayTeam.gameProjection
    if ($hp) { $g.ph = [math]::Round((Num $hp) / 100, 3) }; if ($hp -and $ap) { $g.pd = [math]::Round([math]::Max(0, 1 - (Num $hp) / 100 - (Num $ap) / 100), 3) } } }
$data = [IO.File]::ReadAllText($dataF) | ConvertFrom-Json
$keep = @($data.games | ? { -not $ok[[string]$_.sp] }); $add = @($new.Keys | % { $new[$_] } | % { [pscustomobject]$_ })
$data.games = @($keep + $add)
[IO.File]::WriteAllText("$dataF.tmp", ($data | ConvertTo-Json -Depth 8 -Compress), [Text.UTF8Encoding]::new($false)); Move-Item -Force "$dataF.tmp" $dataF
"CUP_FIXTURES " + (($LG.Keys | % { "$_=$(if ($ok[$_]) { $new[$_].Count } else { 'kept' })" }) -join ' ') + " games=$(@($data.games).Count)"
