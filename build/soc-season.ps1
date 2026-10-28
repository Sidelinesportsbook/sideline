# Premier League and Champions League season analytics from ESPN's official match summaries.
# Every finished match since the season began is read once and cached in data\soc-cache.json (read again while it is under
# 36 hours old, at most every 2 hours, so ESPN's corrections replace the first version). Writes data\pa\s<athlete id>.json
# (each player's matches, with minutes worked out from ESPN's substitution times, and every shot with its pitch position)
# and data\pa\st<team id>.json (each match's team statistics for both sides, goals by minute and every shot for and against).
$ErrorActionPreference = 'Stop'
$START = [datetime]'2026-08-01'; $EB = 'https://site.api.espn.com/apis/site/v2/sports/soccer/'; $COMPS = 'eng.1', 'uefa.champions', 'eng.fa', 'eng.league_cup', 'uefa.europa'
$cacheF = Join-Path $PSScriptRoot 'data\soc-cache.json'; $paD = Join-Path $PSScriptRoot 'data\pa'; New-Item -ItemType Directory -Force $paD | Out-Null
function Num($x) { $n = 0.0; if ([double]::TryParse([string]$x, [ref]$n)) { $n } else { 0 } }
function Fetch([string[]]$urls) {
  # in batches of 200, so a few thousand requests (the first xG run) never run out of threads
  $all = @($urls | Select-Object -Unique); if ($all.Count -gt 200) { $res = @{}; for ($i = 0; $i -lt $all.Count; $i += 200) { $part = Fetch $all[$i..([math]::Min($i + 199, $all.Count - 1))]; foreach ($k in $part.Keys) { $res[$k] = $part[$k] } }; return $res }
  $pool = [runspacefactory]::CreateRunspacePool(1, $(if ($env:SL_THREADS) { [int]$env:SL_THREADS } else { 10 })); $pool.Open()
  $jobs = foreach ($u in $all) { $ps = [powershell]::Create(); $ps.RunspacePool = $pool
    [void]$ps.AddScript({ param($u) for ($i = 0; $i -lt 3; $i++) { try { return (Invoke-WebRequest -UseBasicParsing -TimeoutSec 25 $u).Content } catch { Start-Sleep -Milliseconds (500 * ($i + 1)) } }; $null }).AddArgument($u)
    [pscustomobject]@{ u = $u; ps = $ps; h = $ps.BeginInvoke() } }
  $r = @{}; foreach ($j in $jobs) { $o = $j.ps.EndInvoke($j.h); $r[$j.u] = if ($o.Count) { $o[0] } else { $null }; $j.ps.Dispose() }; $pool.Close(); $pool.Dispose(); $r
}
# "45'+2'" -> 47; "90'+4'" -> 94 (minutes played); shot and goal times keep the half: "45+2"
function Mins($s) { $m = [regex]::Matches([string]$s, '\d+'); if (-not $m.Count) { return $null }; $v = 0; foreach ($x in $m) { $v += [int]$x.Value }; $v }
$cache = @{}; if (Test-Path $cacheF) { ([IO.File]::ReadAllText($cacheF) | ConvertFrom-Json).PSObject.Properties | % { $cache[$_.Name] = $_.Value } }
$now = (Get-Date).ToUniversalTime(); $nd = [int]($now.Date - $START).TotalDays
$sbu = @(foreach ($c in $COMPS) { 0..$nd | % { "$EB$c/scoreboard?dates=$($START.AddDays($_).ToString('yyyyMMdd'))" } }); $sbr = Fetch $sbu
$need = @{}; $ISO = @{}   # each match's exact kick-off (UTC), so the site shows dates in the viewer's own timezone
foreach ($u in $sbu) { if (-not $sbr[$u]) { continue }; $sj = $sbr[$u] | ConvertFrom-Json; $comp = @($COMPS | ? { $u -like "*/$_/*" })[0]
  foreach ($ev in $sj.events) { $tt = $ev.status.type; $id = [string]$ev.id; $ISO[$id] = [string]$ev.date; if ($tt.state -ne 'post' -or $tt.name -match 'POSTPONED|CANCELED|ABANDONED') { continue }
    $c = $cache[$id]; $old = $c -and ($now - [datetime]::Parse([string]$ev.date).ToUniversalTime()).TotalHours -lt 36 -and ($now - [datetime]::Parse([string]$c.at).ToUniversalTime()).TotalHours -ge 2
    if (-not $c -or $old) { $need[$id] = "$EB$comp/summary?event=$id|$comp" } } }
$smr = if ($need.Count) { Fetch @($need.Values | % { ($_ -split '\|')[0] }) } else { @{} }
$TSK = 'possessionPct', 'totalShots', 'shotsOnTarget', 'blockedShots', 'wonCorners', 'foulsCommitted', 'yellowCards', 'redCards', 'offsides', 'saves', 'accuratePasses', 'totalPasses', 'accurateCrosses', 'totalCrosses', 'effectiveTackles', 'totalTackles', 'interceptions', 'effectiveClearance'
$PSK = 'totalGoals', 'goalAssists', 'totalShots', 'shotsOnTarget', 'foulsCommitted', 'foulsSuffered', 'yellowCards', 'redCards', 'saves', 'offsides', 'ownGoals'
$added = 0
foreach ($id in @($need.Keys)) { $u, $comp = $need[$id] -split '\|'; if (-not $smr[$u]) { continue }; $sm = $smr[$u] | ConvertFrom-Json
  $cp = $sm.header.competitions[0]; if (-not $cp -or -not $sm.rosters) { continue }; $T = @{}; $NM = @{}
  foreach ($cc in $cp.competitors) { $s = if ($cc.homeAway -eq 'home') { 'h' } else { 'a' }; $ls = @($cc.linescores | % { [int](Num $_.displayValue) })
    $T[$s] = [ordered]@{ id = [string]$cc.team.id; n = $cc.team.displayName; ab = $cc.team.abbreviation; sc = [int](Num $cc.score); ht = $(if ($ls.Count) { $ls[0] } else { $null }) }
    foreach ($x in @($cc.team.displayName, $cc.team.shortDisplayName, $cc.team.name)) { if ($x) { $NM[$x] = $s } } }
  if (-not $T.h -or -not $T.a) { continue }
  $ts = @{}; foreach ($bt in $sm.boxscore.teams) { $s = @('h', 'a' | ? { $T[$_].id -eq [string]$bt.team.id })[0]; if (-not $s) { continue }; $st = @{}; foreach ($q in $bt.statistics) { $st[$q.name] = [string]$q.displayValue }; $ts[$s] = @($TSK | % { $st[$_] }) }
  # players: minutes from ESPN's substitution times (a starter plays from 0, a substitute from the minute he came on, until he went off or 90)
  $pl = [Collections.Generic.List[string]]::new(); $byName = @{}; $red = @{}
  foreach ($e in @($sm.keyEvents)) { if ([string]$e.type.text -match 'Red Card' -and $e.participants) { $red[[string]$e.participants[0].athlete.id] = Mins $e.clock.displayValue } }
  foreach ($r in $sm.rosters) { $s = if ($r.homeAway -eq 'home') { 'h' } else { 'a' }
    foreach ($a in $r.roster) { $aid = [string]$a.athlete.id; $byName["$s|$($a.athlete.displayName)"] = $aid; if (-not $a.starter -and -not $a.subbedIn) { continue }
      $x = @{}; foreach ($q in $a.stats) { $x[$q.name] = $q.value }; $sub = @($a.plays | ? { $_.substitution } | % { Mins $_.clock.displayValue })
      $on = if ($a.starter) { 0 } else { [int](@($sub)[0]) }; $off = if ($a.subbedOut) { [int](@($sub)[-1]) } elseif ($red.ContainsKey($aid)) { [int]$red[$aid] } else { 90 }
      if ($a.subbedIn -and $a.subbedOut -and $sub.Count -lt 2) { $off = 90 }
      $pl.Add((@($aid, $s, $(if ($a.starter) { 1 } else { 0 }), $on, $off, [math]::Max(0, [math]::Min(90, $off) - [math]::Min(90, $on))) + @($PSK | % { [int](Num $x[$_]) }) + @($a.position.abbreviation) -join '|')) } }
  # shots (with pitch position: x 0-100 towards the goal, y 0-100 across) and goals, from the match feed
  $sh = [Collections.Generic.List[string]]::new(); $gl = [Collections.Generic.List[string]]::new()
  foreach ($c in @($sm.commentary)) { $p = $c.play; if (-not $p -or -not $p.type) { continue }; $ty = [string]$p.type.text; $s = if ($p.team) { $NM[[string]$p.team.displayName] } else { $null }; if (-not $s) { continue }
    $mn = ([string]$c.time.displayValue) -replace "[^0-9+]", ""; $who = if ($p.participants) { [string]$p.participants[0].athlete.displayName } else { '' }; $aid = $byName["$s|$who"]; if (-not $aid) { $o = if ($s -eq 'h') { 'a' } else { 'h' }; $aid = $byName["$o|$who"] }
    if ($ty -match '^Own Goal') { $gl.Add("$mn|$s|$aid|og"); continue }
    if ($ty -notmatch 'Shot|^Goal|Penalty - (Scored|Saved|Missed)') { continue }
    $k = if ($p.scoringPlay -or $ty -match '^Goal|Penalty - Scored') { 'g' } elseif ($ty -match 'On Target|Saved') { 'o' } elseif ($ty -match 'Blocked') { 'b' } elseif ($ty -match 'Woodwork') { 'w' } else { 'x' }
    $pen = if ($ty -match 'Penalty' -or $c.text -match 'penalty') { 1 } else { 0 }; $hd = if ($c.text -match '\bheader\b') { 'h' } elseif ($c.text -match 'left footed') { 'l' } elseif ($c.text -match 'right footed') { 'r' } else { '' }
    if ($k -eq 'g') { $gl.Add("$mn|$s|$aid|$(if ($pen) { 'p' } else { 'g' })") }
    $sh.Add((@($s, $aid, $mn, $(if ($null -ne $p.fieldPositionX) { [math]::Round([double]$p.fieldPositionX, 1) } else { '' }), $(if ($null -ne $p.fieldPositionY) { [math]::Round([double]$p.fieldPositionY, 1) } else { '' }), $k, $pen, $hd) -join '|')) }
  $cache[$id] = [ordered]@{ at = $now.ToString('yyyy-MM-ddTHH:mm:ssZ'); d = ([string]$cp.date).Substring(0, 10); c = $comp; h = $T.h; a = $T.a; ts = [ordered]@{ h = @($ts.h); a = @($ts.a) }; pl = [string[]]@($pl); sh = [string[]]@($sh); gl = [string[]]@($gl) }
  $added++ }
$cj = [ordered]@{}; foreach ($k in ($cache.Keys | Sort-Object)) { $cj[$k] = $cache[$k] }
[IO.File]::WriteAllText("$cacheF.tmp", ($cj | ConvertTo-Json -Depth 6 -Compress), [Text.UTF8Encoding]::new($false)); Move-Item -Force "$cacheF.tmp" $cacheF
# ---------- expected goals and the finer stats, from ESPN's detailed match statistics ----------
# per team: xG, xG on target, xA, non-penalty xG, big chances created, touches in the opposition box; per player: official
# minutes, xG, xA, xG on target, passes, accurate passes, shot assists (chances created), tackles won, touches; per shot: its
# xG and xG on target (matched to the match feed's shot by its exact pitch position, the same ESPN source). Cached by match in
# data\soc-xg-cache.json and read again whenever the match itself is.
$xgF = Join-Path $PSScriptRoot 'data\soc-xg-cache.json'; $XG = @{}; if (Test-Path $xgF) { ([IO.File]::ReadAllText($xgF) | ConvertFrom-Json).PSObject.Properties | % { $XG[$_.Name] = $_.Value } }
$CB = 'https://sports.core.api.espn.com/v2/sports/soccer/leagues/'
$TX = 'expectedGoals', 'expectedGoalsOnTarget', 'expectedAssists', 'expectedGoalsNonPenalty', 'bigChanceCreated', 'touchesInOppBox'
$PX = 'minutes', 'expectedGoals', 'expectedAssists', 'expectedGoalsOnTarget', 'totalPasses', 'accuratePasses', 'shotAssists', 'effectiveTackles', 'touches'
function StatMap($raw) { $m = @{}; if (-not $raw) { return $m }; $j = $raw | ConvertFrom-Json; foreach ($c in @($j.splits.categories)) { foreach ($s in @($c.stats)) { $m[[string]$s.name] = $s.value } }; $m }
function Pick($m, $keys) { ($keys | % { if ($m.ContainsKey($_) -and $null -ne $m[$_]) { [math]::Round([double]$m[$_], 3) } else { '' } }) -join '|' }
$todo = @($cache.Keys | ? { $x = $XG[$_]; -not $x -or [string]$x.at -ne [string]$cache[$_].at })
$u1 = @{}; foreach ($id in $todo) { $m = $cache[$id]; $base = "$CB$($m.c)/events/$id/competitions/$id"; $u1["$id|h"] = "$base/competitors/$($m.h.id)/statistics"; $u1["$id|a"] = "$base/competitors/$($m.a.id)/statistics"; $u1["$id|p1"] = "$base/plays?limit=1000&page=1" }
$r1 = if ($u1.Count) { Fetch @($u1.Values) } else { @{} }
$u2 = @{}; foreach ($id in $todo) { $raw = $r1[$u1["$id|p1"]]; if (-not $raw) { continue }; $pc = [int](($raw | ConvertFrom-Json).pageCount); for ($pp = 2; $pp -le $pc; $pp++) { $u2["$id|p$pp"] = $u1["$id|p1"] -replace 'page=1$', "page=$pp" } }
$r2 = if ($u2.Count) { Fetch @($u2.Values) } else { @{} }
$u3 = @{}; foreach ($id in $todo) { $m = $cache[$id]; $base = "$CB$($m.c)/events/$id/competitions/$id"; foreach ($x in @($m.pl)) { if (-not $x) { continue }; $f = $x -split '\|'; $tid = if ($f[1] -eq 'h') { $m.h.id } else { $m.a.id }; $u3["$id|$($f[0])"] = "$base/competitors/$tid/roster/$($f[0])/statistics/0" } }
$r3 = if ($u3.Count) { Fetch @($u3.Values) } else { @{} }
$xgN = 0; foreach ($id in $todo) { $m = $cache[$id]; $th = $r1[$u1["$id|h"]]; $ta = $r1[$u1["$id|a"]]; if (-not $th -or -not $ta) { continue }
  $sx = [ordered]@{}; $pages = @($r1[$u1["$id|p1"]]) + @($u2.Keys | ? { $_ -like "$id|p*" } | % { $r2[$u2[$_]] })
  foreach ($pg in $pages) { if (-not $pg) { continue }; foreach ($p in @(($pg | ConvertFrom-Json).items)) { if ($null -eq $p.expectedGoals -or $null -eq $p.fieldPositionX) { continue }
    $sx["$([math]::Round([double]$p.fieldPositionX, 1))|$([math]::Round([double]$p.fieldPositionY, 1))"] = "$([math]::Round([double]$p.expectedGoals, 3))|$(if ($null -ne $p.expectedGoalsOnTarget) { [math]::Round([double]$p.expectedGoalsOnTarget, 3) })" } }
  $plx = [ordered]@{}; foreach ($k in @($u3.Keys | ? { $_ -like "$id|*" })) { $raw = $r3[$u3[$k]]; if ($raw) { $plx[$k.Split('|')[1]] = Pick (StatMap $raw) $PX } }
  $XG[$id] = [ordered]@{ at = [string]$m.at; h = (Pick (StatMap $th) $TX); a = (Pick (StatMap $ta) $TX); sh = $sx; pl = $plx }; $xgN++ }
$xj = [ordered]@{}; foreach ($k in ($XG.Keys | Sort-Object)) { $xj[$k] = $XG[$k] }
[IO.File]::WriteAllText("$xgF.tmp", ($xj | ConvertTo-Json -Depth 5 -Compress), [Text.UTF8Encoding]::new($false)); Move-Item -Force "$xgF.tmp" $xgF
$XS = { param($id, $f3, $f4) $x = $XG[$id]; if (-not $x -or -not $x.sh) { return '|' }; $v = $x.sh."$f3|$f4"; if ($v) { [string]$v } else { '|' } }
$XP = { param($id, $aid) $x = $XG[$id]; $v = if ($x -and $x.pl) { $x.pl."$aid" }; if ($v) { [string]$v } else { '||||||||' } }
$XT = { param($id, $s) $x = $XG[$id]; if ($x -and $x.$s) { @(([string]$x.$s) -split '\|') } else { @() } }
# per player and per team
$P = @{}; $PS = @{}; $TG = @{}; $TSH = @{}; $stamp = $now.ToString('yyyy-MM-ddTHH:mm:ssZ')
foreach ($id in $cache.Keys) { $m = $cache[$id]
  foreach ($s in 'h', 'a') { $o = if ($s -eq 'h') { 'a' } else { 'h' }; $me = $m.$s; $op = $m.$o; $res = "$(if ($me.sc -gt $op.sc) { 'W' } elseif ($me.sc -lt $op.sc) { 'L' } else { 'D' }) $($me.sc)-$($op.sc)"
    if (-not $TG.ContainsKey($me.id)) { $TG[$me.id] = [Collections.Generic.List[object]]::new(); $TSH[$me.id] = [Collections.Generic.List[string]]::new() }
    $kick = if ($ISO[$id]) { $ISO[$id] } else { [string]$m.d }
    $TG[$me.id].Add([ordered]@{ e = $id; d = $m.d; iso = $kick; c = $m.c; o = $op.ab; on = $op.n; oid = $op.id; ha = $(if ($s -eq 'h') { 'vs' } else { '@' }); gf = $me.sc; ga = $op.sc; ht = @($me.ht, $op.ht); s = @($m.ts.$s); os = @($m.ts.$o); x = [string[]]@(& $XT $id $s); ox = [string[]]@(& $XT $id $o)
      gl = [string[]]@(@($m.gl) | ? { $_ } | % { $f = $_ -split '\|'; "$($f[0])|$(if ($f[1] -eq $s) { 1 } else { 0 })|$($f[2])|$($f[3])" }) })
    foreach ($x in @($m.sh)) { if (-not $x) { continue }; $f = $x -split '\|'; $TSH[$me.id].Add((@($id, $(if ($f[0] -eq $s) { 1 } else { 0 })) + $f[1..7] + @(& $XS $id $f[3] $f[4])) -join '|') }
    foreach ($x in @($m.pl)) { if (-not $x) { continue }; $f = $x -split '\|'; if ($f[1] -ne $s) { continue }; if (-not $P.ContainsKey($f[0])) { $P[$f[0]] = [Collections.Generic.List[string]]::new() }
      $P[$f[0]].Add((@($id, $m.d, $m.c, $op.ab, $op.n, $(if ($s -eq 'h') { 'vs' } else { '@' }), $res) + $f[2..17] + @($kick) + @(& $XP $id $f[0])) -join '|') } }
  foreach ($x in @($m.sh)) { if (-not $x) { continue }; $f = $x -split '\|'; if (-not $f[1]) { continue }; if (-not $PS.ContainsKey($f[1])) { $PS[$f[1]] = [Collections.Generic.List[string]]::new() }; $PS[$f[1]].Add((@($id) + $f[2..7] + @(& $XS $id $f[3] $f[4])) -join '|') } }
$wf = { param($n, $o) [IO.File]::WriteAllText((Join-Path $paD "$n.json"), ($o | ConvertTo-Json -Depth 5 -Compress), [Text.UTF8Encoding]::new($false)) }
foreach ($k in $P.Keys) { $rows = [string[]]@($P[$k] | Sort-Object { ($_ -split '\|')[23] } -Descending); $sh = [string[]]@(); if ($PS.ContainsKey($k)) { $sh = [string[]]$PS[$k].ToArray() }
  & $wf "s$k" ([ordered]@{ v = 1; id = $k; at = $stamp; rows = $rows; sh = $sh }) }
foreach ($k in $TG.Keys) { & $wf "st$k" ([ordered]@{ v = 1; id = $k; at = $stamp; cols = $TSK; g = [object[]]@($TG[$k] | Sort-Object { $_.iso } -Descending); sh = [string[]]$TSH[$k].ToArray() }) }
"SOC_SEASON matches=$($cache.Count) new=$added xg-new=$xgN players=$($P.Count) teams=$($TG.Count)"
