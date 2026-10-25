# NBA current-season stats from official box scores (ESPN's per-player game logs lag by days).
# Every finished game since opening night is read once and cached in data\nba-box-cache.json; later runs only fetch new games.
# Patches data\sideline-data.json in place (atomically): each rostered player's a27 averages and current-season log rows.
$ErrorActionPreference = 'Stop'
$SEASON_START = [datetime]'2026-10-20'   # 2026-27 opening night
$EB = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/'
$dataF = Join-Path $PSScriptRoot 'data\sideline-data.json'; $cacheF = Join-Path $PSScriptRoot 'data\nba-box-cache.json'
function Num($x) { $n = 0.0; if ([double]::TryParse([string]$x, [ref]$n)) { $n } else { 0 } }
function Fetch([string[]]$urls) {
  $pool = [runspacefactory]::CreateRunspacePool(1, 10); $pool.Open()
  $jobs = foreach ($u in ($urls | Select-Object -Unique)) { $ps = [powershell]::Create(); $ps.RunspacePool = $pool
    [void]$ps.AddScript({ param($u) for ($i = 0; $i -lt 3; $i++) { try { return (Invoke-WebRequest -UseBasicParsing -TimeoutSec 25 $u).Content } catch { Start-Sleep -Milliseconds (500 * ($i + 1)) } }; $null }).AddArgument($u)
    [pscustomobject]@{ u = $u; ps = $ps; h = $ps.BeginInvoke() } }
  $r = @{}; foreach ($j in $jobs) { $o = $j.ps.EndInvoke($j.h); $r[$j.u] = if ($o.Count) { $o[0] } else { $null }; $j.ps.Dispose() }; $pool.Close(); $r
}
$cache = @{}
# rows carry shooting splits and the event id (19 fields); older cached games are fetched once more to add them
if (Test-Path $cacheF) { ([IO.File]::ReadAllText($cacheF) | ConvertFrom-Json).PSObject.Properties | % { $v = @($_.Value); if ($v.Count -and ($v[0] -split '\|').Count -ge 19) { $cache[$_.Name] = $v } } }
$today = (Get-Date).ToUniversalTime().Date; $nd = [int]($today - $SEASON_START).TotalDays
$sbu = @(0..$nd | % { "${EB}scoreboard?dates=$($SEASON_START.AddDays($_).ToString('yyyyMMdd'))" })
$sbr = Fetch $sbu; $need = [Collections.Generic.List[string]]::new()
foreach ($u in $sbu) { if (-not $sbr[$u]) { continue }; $sj = $sbr[$u] | ConvertFrom-Json
  foreach ($ev in $sj.events) { $tt = $ev.status.type; if ($tt.state -eq 'post' -and $tt.name -notmatch 'POSTPONED|CANCELED' -and -not $cache.ContainsKey([string]$ev.id)) { $need.Add([string]$ev.id) } } }
$bxu = @{}; foreach ($id in $need) { $bxu[$id] = "${EB}summary?event=$id" }
$bxr = if ($need.Count) { Fetch @($bxu.Values) } else { @{} }
$added = 0
foreach ($id in $need) {
  if (-not $bxr[$bxu[$id]]) { continue }; $sm = $bxr[$bxu[$id]] | ConvertFrom-Json; if (-not $sm.boxscore.players) { continue }
  $cp = $sm.header.competitions[0]; $gd = ([string]$cp.date).Substring(0, 10); $tms = @{}
  foreach ($cc in $cp.competitors) { $tms[[string]$cc.team.id] = @{ ab = $cc.team.abbreviation; ha = $cc.homeAway; sc = [int](Num $cc.score) } }
  $rows = [Collections.Generic.List[string]]::new()
  foreach ($tb in $sm.boxscore.players) {
    $tid = [string]$tb.team.id; $mine = $tms[$tid]; $opp = @($tms.Keys | ? { $_ -ne $tid } | % { $tms[$_] })[0]; if (-not $mine -or -not $opp) { continue }
    $rs = "$(if ($mine.sc -gt $opp.sc) { 'W' } else { 'L' }) $([math]::Max($mine.sc, $opp.sc))-$([math]::Min($mine.sc, $opp.sc))"
    $sx = $tb.statistics[0]; $lb = @($sx.labels)
    foreach ($ath in $sx.athletes) { if ($ath.didNotPlay -or -not $ath.stats -or -not @($ath.stats).Count) { continue }; $v = $ath.stats
      $q = { param($n) $k = [array]::IndexOf($lb, $n); if ($k -lt 0) { 0 } else { Num $v[$k] } }
      $ma = { param($n) $k = [array]::IndexOf($lb, $n); if ($k -lt 0) { @(0, 0) } else { $x = ([string]$v[$k]) -split '-'; @((Num $x[0]), (Num $x[1])) } }
      $fg = & $ma 'FG'; $tp3 = & $ma '3PT'; $ft = & $ma 'FT'; $t3 = $tp3[0]
      $rows.Add((@([string]$ath.athlete.id, $gd, $opp.ab, $(if ($mine.ha -eq 'home') { 'vs' } else { '@' }), $rs, (& $q 'MIN'), (& $q 'PTS'), (& $q 'REB'), (& $q 'AST'), $t3, (& $q 'STL'), (& $q 'BLK'), (& $q 'TO'), $fg[0], $fg[1], $tp3[1], $ft[0], $ft[1], $id) -join '|')) } }
  if ($rows.Count) { $cache[$id] = @($rows); $added++ }
}
# cache first (atomic), so finished games are never fetched twice
$cj = [ordered]@{}; foreach ($k in ($cache.Keys | Sort-Object)) { $cj[$k] = @($cache[$k]) }
[IO.File]::WriteAllText("$cacheF.tmp", ($cj | ConvertTo-Json -Depth 4 -Compress), [Text.UTF8Encoding]::new($false)); Move-Item -Force "$cacheF.tmp" $cacheF
# per player, current season only
$byP = @{}; foreach ($k in $cache.Keys) { foreach ($r in $cache[$k]) { $f = $r -split '\|'; if (-not $byP.ContainsKey($f[0])) { $byP[$f[0]] = [Collections.Generic.List[object]]::new() }; $byP[$f[0]].Add($f) } }
$data = [IO.File]::ReadAllText($dataF) | ConvertFrom-Json; $patched = 0
foreach ($p in $data.pl) {
  $g = $byP[[string]$p.id]; if (-not $g) { continue }
  $sorted = @($g | Sort-Object { $_[1] } -Descending); $n = $sorted.Count
  $avg = { param($i) [math]::Round((($sorted | % { [double]$_[$i] }) | Measure-Object -Sum).Sum / $n, 2) }
  $c10 = { param($f) @(6, 7, 8, 10, 11 | ? { [double]$f[$_] -ge 10 }).Count }
  $sum = { param($i) ($sorted | % { [double]$_[$i] } | Measure-Object -Sum).Sum }; $pct = { param($m, $a) $t = & $sum $a; if ($t) { [math]::Round((& $sum $m) / $t * 100, 1) } else { $null } }
  $fgp = & $pct 13 14; $tpp = & $pct 9 15; $ftp = & $pct 16 17
  $a27 = [ordered]@{ gp = $n; min = (& $avg 5); pts = (& $avg 6); reb = (& $avg 7); ast = (& $avg 8); tpm = (& $avg 9); stl = (& $avg 10); blk = (& $avg 11); to = (& $avg 12); fgp = $fgp; tpp = $tpp; ftp = $ftp
    dd = @($sorted | ? { (& $c10 $_) -ge 2 }).Count; td = @($sorted | ? { (& $c10 $_) -ge 3 }).Count }
  $cur = @($sorted | % { @($_[1], $_[2], $_[3], $_[4], $_[5], $_[6], $_[7], $_[8], $_[9], $_[10], $_[11], $_[12], $_[13], $_[14], $_[15], $_[16], $_[17], $_[18]) -join '|' })
  $old = @(@($p.lg) | ? { $_ -and $_ -lt '2026-10-01' })
  $lg = @(@($cur) + @($old) | Select-Object -First 10)
  $p | Add-Member -Force -NotePropertyName a27 -NotePropertyValue $a27; $p | Add-Member -Force -NotePropertyName lg -NotePropertyValue $lg; $patched++
}
$data | Add-Member -Force -NotePropertyName nbaBox -NotePropertyValue ([ordered]@{ games = $cache.Count; at = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ') })
[IO.File]::WriteAllText("$dataF.tmp", ($data | ConvertTo-Json -Depth 8 -Compress), [Text.UTF8Encoding]::new($false)); Move-Item -Force "$dataF.tmp" $dataF
"NBA_SEASON games=$($cache.Count) new=$added players=$patched"
