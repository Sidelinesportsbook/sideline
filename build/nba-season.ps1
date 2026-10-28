# NBA current-season stats from official box scores (ESPN's per-player game logs lag by days).
# Every finished game since opening night is read once and cached in data\nba-box-cache.json; later runs only fetch new games.
# Patches data\sideline-data.json in place (atomically): each rostered player's a27 averages and current-season log rows.
$ErrorActionPreference = 'Stop'
$SEASON_START = [datetime]'2026-10-20'   # 2026-27 opening night
$EB = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/'
$dataF = Join-Path $PSScriptRoot 'data\sideline-data.json'; $cacheF = Join-Path $PSScriptRoot 'data\nba-box-cache.json'
function Num($x) { $n = 0.0; if ([double]::TryParse([string]$x, [ref]$n)) { $n } else { 0 } }
function Fetch([string[]]$urls) {
  $pool = [runspacefactory]::CreateRunspacePool(1, $(if ($env:SL_THREADS) { [int]$env:SL_THREADS } else { 10 })); $pool.Open()
  $jobs = foreach ($u in ($urls | Select-Object -Unique)) { $ps = [powershell]::Create(); $ps.RunspacePool = $pool
    [void]$ps.AddScript({ param($u) for ($i = 0; $i -lt 3; $i++) { try { return (Invoke-WebRequest -UseBasicParsing -TimeoutSec 25 $u).Content } catch { Start-Sleep -Milliseconds (500 * ($i + 1)) } }; $null }).AddArgument($u)
    [pscustomobject]@{ u = $u; ps = $ps; h = $ps.BeginInvoke() } }
  $r = @{}; foreach ($j in $jobs) { $o = $j.ps.EndInvoke($j.h); $r[$j.u] = if ($o.Count) { $o[0] } else { $null }; $j.ps.Dispose() }; $pool.Close(); $pool.Dispose(); $r
}
$cache = @{}
# rows carry shooting splits and the event id (19 fields); older cached games are fetched once more to add them
if (Test-Path $cacheF) { ([IO.File]::ReadAllText($cacheF) | ConvertFrom-Json).PSObject.Properties | % { $v = @($_.Value); if ($v.Count -and ($v[0] -split '\|').Count -ge 19) { $cache[$_.Name] = $v } } }
$today = (Get-Date).ToUniversalTime().Date; $nd = [int]($today - $SEASON_START).TotalDays
$sbu = @(0..$nd | % { "${EB}scoreboard?dates=$($SEASON_START.AddDays($_).ToString('yyyyMMdd'))" })
$sbr = Fetch $sbu; $need = [Collections.Generic.List[string]]::new()
# each game's exact start time (UTC), so the site shows every date in the viewer's own timezone (a 23:30 UTC tip-off is the
# next morning in Australia); rows keep their UTC date for sorting and add this as their last field
$ISO = @{}; foreach ($u in $sbu) { if ($sbr[$u]) { foreach ($ev in ($sbr[$u] | ConvertFrom-Json).events) { $ISO[[string]$ev.id] = [string]$ev.date } } }
foreach ($u in $sbu) { if (-not $sbr[$u]) { continue }; $sj = $sbr[$u] | ConvertFrom-Json
  foreach ($ev in $sj.events) { $tt = $ev.status.type; if ($tt.state -eq 'post' -and $tt.name -notmatch 'POSTPONED|CANCELED' -and -not $cache.ContainsKey([string]$ev.id)) { $need.Add([string]$ev.id) } } }
# play-by-play cache (data\nba-pbp-cache.json): every shot with its court location and each team's line score and box totals,
# from the same official summary. A game is read again while it is under 36 hours old (at most every 2 hours), so ESPN's
# stat corrections replace the first version; the box score rows above are refreshed from that same read.
$pbpF = Join-Path $PSScriptRoot 'data\nba-pbp-cache.json'; $pbp = @{}
if (Test-Path $pbpF) { ([IO.File]::ReadAllText($pbpF) | ConvertFrom-Json).PSObject.Properties | % { $pbp[$_.Name] = $_.Value } }
$now = (Get-Date).ToUniversalTime()
foreach ($u in $sbu) { if (-not $sbr[$u]) { continue }; $sj = $sbr[$u] | ConvertFrom-Json
  foreach ($ev in $sj.events) { $tt = $ev.status.type; $id = [string]$ev.id; if ($tt.state -ne 'post' -or $tt.name -match 'POSTPONED|CANCELED' -or $need.Contains($id)) { continue }
    $c = $pbp[$id]; $old = $c -and ($now - [datetime]::Parse([string]$ev.date).ToUniversalTime()).TotalHours -lt 36 -and ($now - [datetime]::Parse([string]$c.at).ToUniversalTime()).TotalHours -ge 2
    if (-not $c -or $old) { $need.Add($id) } } }
$bxu = @{}; foreach ($id in $need) { $bxu[$id] = "${EB}summary?event=$id" }
$bxr = if ($need.Count) { Fetch @($bxu.Values) } else { @{} }
$added = 0
$tsn = 'fieldGoalsMade-fieldGoalsAttempted', 'threePointFieldGoalsMade-threePointFieldGoalsAttempted', 'freeThrowsMade-freeThrowsAttempted', 'totalRebounds', 'offensiveRebounds', 'assists', 'steals', 'blocks', 'turnovers', 'pointsInPaint', 'fastBreakPoints', 'fouls'
foreach ($id in $need) {
  if (-not $bxr[$bxu[$id]]) { continue }; $sm = $bxr[$bxu[$id]] | ConvertFrom-Json; if (-not $sm.boxscore.players) { continue }
  # shots: shooter = first participant; ESPN's court coordinates (feet: x across 0-50, y from the rim) only where it sends real ones
  $cp0 = $sm.header.competitions[0]; $sh = [Collections.Generic.List[string]]::new()
  foreach ($pl in @($sm.plays)) { if (-not $pl.shootingPlay -or -not $pl.participants) { continue }
    $x = $pl.coordinate.x; $y = $pl.coordinate.y; $ok = $null -ne $x -and $x -ge -2 -and $x -le 52 -and $y -ge -2 -and $y -le 94
    $v = [int]$pl.pointsAttempted; if (-not $v) { $v = if ([string]$pl.type.text -like 'Free Throw*') { 1 } elseif ($pl.text -match 'three point') { 3 } else { 2 } }
    $d = if ($pl.text -match '(\d+)-foot') { $matches[1] } else { '' }
    $ty = if ($v -eq 1) { 'Free throw' } else { ([string]$pl.type.text) -replace '\|', '' }
    $sh.Add((@([string]$pl.participants[0].athlete.id, [string]$pl.team.id, [string]$pl.period.number, [string]$pl.clock.displayValue, $(if ($ok -and $v -gt 1) { $x } else { '' }), $(if ($ok -and $v -gt 1) { $y } else { '' }), $(if ($pl.scoringPlay) { 1 } else { 0 }), $v, $d, $ty) -join '|')) }
  $tl = [Collections.Generic.List[string]]::new()
  foreach ($cc in $cp0.competitors) { $bt = @($sm.boxscore.teams | ? { [string]$_.team.id -eq [string]$cc.team.id })[0]; $st = @{}; if ($bt) { foreach ($s in $bt.statistics) { $st[$s.name] = [string]$s.displayValue } }
    $tl.Add((@([string]$cc.team.id, $cc.homeAway, $cc.team.abbreviation, [string]$cc.score, ((@($cc.linescores) | % { $_.displayValue }) -join ',')) + @($tsn | % { $st[$_] }) -join '|')) }
  $pbp[$id] = [ordered]@{ at = $now.ToString('yyyy-MM-ddTHH:mm:ssZ'); gd = ([string]$cp0.date).Substring(0, 10); t = @($tl); s = @($sh) }
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
$pj = [ordered]@{}; foreach ($k in ($pbp.Keys | Sort-Object)) { $pj[$k] = $pbp[$k] }
[IO.File]::WriteAllText("$pbpF.tmp", ($pj | ConvertTo-Json -Depth 5 -Compress), [Text.UTF8Encoding]::new($false)); Move-Item -Force "$pbpF.tmp" $pbpF
# per player, current season only
$byP = @{}; foreach ($k in $cache.Keys) { foreach ($r in $cache[$k]) { $f = $r -split '\|'; if (-not $byP.ContainsKey($f[0])) { $byP[$f[0]] = [Collections.Generic.List[object]]::new() }; $byP[$f[0]].Add($f) } }
$data = [IO.File]::ReadAllText($dataF) | ConvertFrom-Json; $patched = 0
foreach ($p in $data.pl) {
  $g = $byP[[string]$p.id]; if (-not $g) { continue }
  $sorted = @($g | Sort-Object { if ($ISO[[string]$_[18]]) { $ISO[[string]$_[18]] } else { $_[1] } } -Descending); $n = $sorted.Count
  $avg = { param($i) [math]::Round((($sorted | % { [double]$_[$i] }) | Measure-Object -Sum).Sum / $n, 2) }
  $c10 = { param($f) @(6, 7, 8, 10, 11 | ? { [double]$f[$_] -ge 10 }).Count }
  $sum = { param($i) ($sorted | % { [double]$_[$i] } | Measure-Object -Sum).Sum }; $pct = { param($m, $a) $t = & $sum $a; if ($t) { [math]::Round((& $sum $m) / $t * 100, 1) } else { $null } }
  $fgp = & $pct 13 14; $tpp = & $pct 9 15; $ftp = & $pct 16 17
  $a27 = [ordered]@{ gp = $n; min = (& $avg 5); pts = (& $avg 6); reb = (& $avg 7); ast = (& $avg 8); tpm = (& $avg 9); stl = (& $avg 10); blk = (& $avg 11); to = (& $avg 12); fgp = $fgp; tpp = $tpp; ftp = $ftp
    dd = @($sorted | ? { (& $c10 $_) -ge 2 }).Count; td = @($sorted | ? { (& $c10 $_) -ge 3 }).Count }
  $cur = @($sorted | % { @($_[1], $_[2], $_[3], $_[4], $_[5], $_[6], $_[7], $_[8], $_[9], $_[10], $_[11], $_[12], $_[13], $_[14], $_[15], $_[16], $_[17], $_[18], $ISO[[string]$_[18]]) -join '|' })
  $old = @(@($p.lg) | ? { $_ -and $_ -lt '2026-10-01' })
  $lg = @(@($cur) + @($old) | Select-Object -First 10)
  $p | Add-Member -Force -NotePropertyName a27 -NotePropertyValue $a27; $p | Add-Member -Force -NotePropertyName lg -NotePropertyValue $lg; $patched++
}
# analytics files the site loads when a profile opens (data\pa, published as pa/): each player's full season log and every
# shot, and each team's games (line scores, box totals for both sides) and shots. Nothing here is estimated.
$paD = Join-Path $PSScriptRoot 'data\pa'; New-Item -ItemType Directory -Force $paD | Out-Null
$stamp = $now.ToString('yyyy-MM-ddTHH:mm:ssZ'); $shP = @{}; $tG = @{}; $tS = @{}
# court zones, the same rules as the site (analytics.js): ESPN puts the rim at x 25, y 1 (feet); the 3-point arc meets the corner lines at y 9.95
function Zone($f) { $x = [double]$f[4]; $y = [double]$f[5]; if ($f[7] -eq '3') { if ($y -le 9.95) { 'c3' } else { 'ab3' } } elseif ([math]::Sqrt(($x - 25) * ($x - 25) + ($y - 1) * ($y - 1)) -le 4) { 'ra' } elseif ($x -ge 17 -and $x -le 33 -and $y -le 14.75) { 'pt' } else { 'mid' } }
$LZ = [ordered]@{ ra = @(0, 0); pt = @(0, 0); mid = @(0, 0); c3 = @(0, 0); ab3 = @(0, 0) }
foreach ($eid in $pbp.Keys) { $e = $pbp[$eid]; $tt = @($e.t | % { , ($_ -split '\|') }); if ($tt.Count -ne 2) { continue }
  foreach ($s in $e.s) { $f = $s -split '\|'; if (-not $shP.ContainsKey($f[0])) { $shP[$f[0]] = [Collections.Generic.List[string]]::new() }; $shP[$f[0]].Add((@($eid) + $f[2..9]) -join '|')
    if ($f[4] -ne '' -and $f[9] -notmatch 'Heave') { $zn = Zone $f; $LZ[$zn][1]++; if ($f[6] -eq '1') { $LZ[$zn][0]++ }; if (-not $tS.ContainsKey($f[1])) { $tS[$f[1]] = [Collections.Generic.List[string]]::new() }; $tS[$f[1]].Add((@($eid, $f[0], $f[2], $f[4], $f[5], $f[6], $f[7], $f[8]) -join '|')) } }
  for ($i = 0; $i -lt 2; $i++) { $me = $tt[$i]; $op = $tt[1 - $i]; if (-not $tG.ContainsKey($me[0])) { $tG[$me[0]] = [Collections.Generic.List[object]]::new() }
    $tG[$me[0]].Add([ordered]@{ e = $eid; d = $e.gd; iso = $ISO[[string]$eid]; o = $op[2]; oid = $op[0]; ha = $(if ($me[1] -eq 'home') { 'vs' } else { '@' }); pf = [int](Num $me[3]); pa = [int](Num $op[3]); q = @($me[4] -split ',' | ? { $_ -ne '' } | % { [int](Num $_) }); oq = @($op[4] -split ',' | ? { $_ -ne '' } | % { [int](Num $_) }); s = @($me[5..16]); os = @($op[5..16]) }) } }
$wf = { param($n, $o) [IO.File]::WriteAllText((Join-Path $paD "$n.json"), ($o | ConvertTo-Json -Depth 5 -Compress), [Text.UTF8Encoding]::new($false)) }
$np = 0; foreach ($plid in $byP.Keys) { $rows = @($byP[$plid] | Sort-Object { if ($ISO[[string]$_[18]]) { $ISO[[string]$_[18]] } else { $_[1] } } -Descending | % { (@($_[1..18]) + @($ISO[[string]$_[18]])) -join '|' }); $sh = [string[]]@(); if ($shP.ContainsKey($plid)) { $sh = [string[]]$shP[$plid].ToArray() }
  & $wf $plid ([ordered]@{ v = 1; id = $plid; at = $stamp; season = $data.season; lg = $rows; sh = $sh }); $np++ }
& $wf 'league' ([ordered]@{ v = 1; at = $stamp; season = $data.season; games = $pbp.Count; z = $LZ })
foreach ($tid in $tG.Keys) { & $wf "t$tid" ([ordered]@{ v = 1; id = $tid; at = $stamp; season = $data.season; cols = $tsn; g = [object[]]@($tG[$tid] | Sort-Object { if ($_.iso) { $_.iso } else { $_.d } } -Descending); sh = $(if ($tS.ContainsKey($tid)) { [string[]]$tS[$tid].ToArray() } else { [string[]]@() }) }) }
$data | Add-Member -Force -NotePropertyName nbaBox -NotePropertyValue ([ordered]@{ games = $cache.Count; at = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'); pa = $np })
[IO.File]::WriteAllText("$dataF.tmp", ($data | ConvertTo-Json -Depth 8 -Compress), [Text.UTF8Encoding]::new($false)); Move-Item -Force "$dataF.tmp" $dataF
"NBA_SEASON games=$($cache.Count) new=$added players=$patched"
