# Sideline data build: pulls schedules, sportsbook lines, NBA rosters, contracts,
# injuries, season averages, game logs and career team history from ESPN's public API
# and writes data/sideline-data.json. Re-run any time to refresh the baked snapshot:
#   powershell -ExecutionPolicy Bypass -File build-data.ps1
param([int]$Days = 14)
$ErrorActionPreference = 'Stop'
$out = Join-Path $PSScriptRoot 'data'
New-Item -ItemType Directory -Force $out | Out-Null

$SEASON = '2026-27'       # the one season identifier used everywhere
$SY = 2027                # ESPN's year for 2026-27 (season ending year)
$PREV = 2026              # 2025-26

function Get-Many([string[]]$urls, [int]$tries = 3) {
  $pool = [runspacefactory]::CreateRunspacePool(1, 14); $pool.Open()
  $jobs = foreach ($u in ($urls | Select-Object -Unique)) {
    $ps = [powershell]::Create(); $ps.RunspacePool = $pool
    [void]$ps.AddScript({ param($u, $tries)
      for ($i = 0; $i -lt $tries; $i++) {
        try { return (Invoke-WebRequest -UseBasicParsing -TimeoutSec 25 $u).Content } catch { Start-Sleep -Milliseconds (400 * ($i + 1)) }
      }
      return $null }).AddArgument($u).AddArgument($tries)
    [pscustomobject]@{ u = $u; ps = $ps; h = $ps.BeginInvoke() }
  }
  $res = @{}
  foreach ($j in $jobs) { $r = $j.ps.EndInvoke($j.h); $res[$j.u] = if ($r.Count) { $r[0] } else { $null }; $j.ps.Dispose() }
  $pool.Close(); return $res
}
function J($s) { if ($s) { $s | ConvertFrom-Json } else { $null } }
function Num($x) { $n = 0.0; if ([double]::TryParse([string]$x, [ref]$n)) { [math]::Round($n, 2) } else { 0 } }
$EB = 'https://site.api.espn.com/apis/site/v2/sports/'
$EW = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/'

# ---------- schedule + DraftKings lines ----------
$today = (Get-Date).ToUniversalTime().Date
$LG = [ordered]@{ nba = 'basketball/nba'; nfl = 'football/nfl'; epl = 'soccer/eng.1'; ucl = 'soccer/uefa.champions' }
# the scoreboard takes one day per request (ranges return 400)
# start a day early: ESPN dates US evening games by the US day, so a game in play can carry "yesterday's" date in UTC terms
$sbUrls = @{}; foreach ($k in $LG.Keys) { $sbUrls[$k] = @(-1..$Days | % { "$EB$($LG[$k])/scoreboard?dates=$($today.AddDays($_).ToString('yyyyMMdd'))" }) }
$sb = Get-Many ($sbUrls.Values | % { $_ })
function Am($o) { if ($o -and $o -ne 'OFF' -and $o -ne 'EVEN') { [int]($o -replace '\+', '') } elseif ($o -eq 'EVEN') { 100 } else { $null } }
$games = @(); $seen = @{}
foreach ($k in $LG.Keys) {
  $evs = @($sbUrls[$k] | % { $d = J $sb[$_]; if (-not $d) { Write-Warning "no scoreboard: $_" } else { $d.events } })
  foreach ($ev in $evs) {
    if ($seen[$ev.id]) { continue }; $seen[$ev.id] = 1
    $c = $ev.competitions[0]; if ($ev.status.type.state -eq 'post') { continue }
    $H = $c.competitors | ? homeAway -eq 'home'; $A = $c.competitors | ? homeAway -eq 'away'
    $g = [ordered]@{ sp = $k; id = $ev.id; h = $H.team.displayName; a = $A.team.displayName; hid = $H.team.id; aid = $A.team.id; iso = $ev.date; st = $ev.status.type.state }
    $o = @($c.odds)[0]
    if ($o -and $o.moneyline) {
      $ln = [ordered]@{ src = $o.provider.name }
      $mh = Am $o.moneyline.home.close.odds; $ma = Am $o.moneyline.away.close.odds
      if ($mh -and $ma) { $ln.ml = @($mh, $ma) }
      if ($o.moneyline.draw) { $md = Am $o.moneyline.draw.close.odds; if ($md) { $ln.dr = $md } }
      if ($o.pointSpread -and $o.pointSpread.home.close.line) { $ln.sp = @((Num $o.pointSpread.home.close.line), (Am $o.pointSpread.home.close.odds), (Am $o.pointSpread.away.close.odds)) }
      if ($o.total -and $o.total.over.close.line) { $ln.t = @((Num ($o.total.over.close.line -replace '[ou]', '')), (Am $o.total.over.close.odds), (Am $o.total.under.close.odds)) }
      if ($ln.Count -gt 1) { $g.ln = $ln }
    }
    $games += [pscustomobject]$g
  }
}
Write-Host "games: $($games.Count) (with sportsbook lines: $(@($games | ? ln).Count))"
# ESPN win projections for games without a sportsbook price
$pu = @{}; foreach ($g in $games) { $pu[$g.id] = "$EB$($LG[$g.sp])/summary?event=$($g.id)" }
$pr = Get-Many $pu.Values
foreach ($g in $games) {
  $s = J $pr[$pu[$g.id]]; if (-not $s) { continue }
  $hp = $s.predictor.homeTeam.gameProjection; $ap = $s.predictor.awayTeam.gameProjection
  if ($hp) { $g | Add-Member ph ([math]::Round((Num $hp) / 100, 3)) }
  if ($ap -and $hp -and $g.sp -in 'epl', 'ucl') { $g | Add-Member pd ([math]::Round([math]::Max(0, 1 - (Num $hp) / 100 - (Num $ap) / 100), 3)) }
}

# ---------- soccer squads + per-player season stats (domestic league roster) ----------
function SocStats($ath) {   # stat name -> value, from statistics.splits.categories[].stats[]
  $m = @{}
  if ($ath.statistics -and $ath.statistics.splits) {
    foreach ($c in @($ath.statistics.splits.categories)) { foreach ($s in @($c.stats)) { if ($s.name) { $m[[string]$s.name] = [double]$s.value } } }
  }
  return $m
}
function RosterOk($r) {
  if (-not $r -or -not $r.athletes) { return $false }
  foreach ($ath in @($r.athletes)) { if ((SocStats $ath).ContainsKey('appearances')) { return $true } }
  return $false
}
function SocPos($p) {
  $ab = ([string]$p.abbreviation).ToUpper(); $nm = ([string]$p.name).ToLower()
  if ($ab -match '^(G|GK)$' -or $nm -match 'goalkeep') { return 'G' }
  if ($ab -match '^(D|CD|CB|LB|RB|SW|WB|LWB|RWB|CD-[LR]?)$' -or $nm -match 'defen|back') { return 'D' }
  if ($ab -match '^(F|FW|ST|CF|LW|RW|SS|W|A|AF)$' -or $nm -match 'forward|striker|winger|attack') { return 'F' }
  return 'M'
}
function Rt([double]$v, [double]$gp, [int]$d) { if ($gp -gt 0) { return [math]::Round($v / $gp, $d) } else { return 0 } }

$socTeams = [ordered]@{}   # team id -> @{ n = displayName as in the game; epl = plays in an epl game }
foreach ($g in $games) {
  if ($g.sp -notin 'epl', 'ucl') { continue }
  foreach ($pair in @(@($g.hid, $g.h), @($g.aid, $g.a))) {
    $tid = [string]$pair[0]; if (-not $tid) { continue }
    if (-not $socTeams.Contains($tid)) { $socTeams[$tid] = @{ n = $pair[1]; epl = $false } }
    if ($g.sp -eq 'epl') { $socTeams[$tid].epl = $true }
  }
}
# every club in the big five leagues, so their players exist even without an upcoming fixture here
$BIG5 = 'eng.1', 'esp.1', 'ita.1', 'ger.1', 'fra.1'
$b5r = Get-Many @($BIG5 | % { "${EB}soccer/$_/teams" })
foreach ($lg5 in $BIG5) { $tj5 = J $b5r["${EB}soccer/$lg5/teams"]; if (-not $tj5) { Write-Warning "no team list for $lg5"; continue }
  foreach ($tw in @($tj5.sports[0].leagues[0].teams)) { $tid = [string]$tw.team.id; if (-not $socTeams.Contains($tid)) { $socTeams[$tid] = @{ n = $tw.team.displayName; epl = ($lg5 -eq 'eng.1'); home = $lg5 } } else { $socTeams[$tid].home = $lg5 } } }
$COMMON = 'esp.1', 'ger.1', 'ita.1', 'fra.1', 'por.1', 'ned.1', 'tur.1', 'bel.1', 'aut.1', 'nor.1', 'sco.1', 'gre.1', 'cze.1', 'svk.1', 'aze.1',
  'den.1', 'sui.1', 'cro.1', 'srb.1', 'isr.1', 'kaz.1', 'swe.1', 'pol.1', 'ukr.1', 'bul.1', 'cyp.1', 'hun.1', 'rou.1'
$tmRes = Get-Many (@($socTeams.Keys | % { "${EB}soccer/teams/$_" }))
foreach ($tid in @($socTeams.Keys)) {
  $dl = ''; try { $tj = J $tmRes["${EB}soccer/teams/$tid"]; if ($tj) { $dl = ([string]$tj.team.defaultLeague.midsizeName).ToLower() } } catch { }
  $cand = @(); if ($socTeams[$tid].home) { $cand += $socTeams[$tid].home }; if ($socTeams[$tid].epl) { $cand += 'eng.1' }
  if ($dl -match '^[a-z]{3}\.1$') { $cand += $dl }
  $cand += $COMMON; $cand += 'uefa.champions'   # last resort: the 3-game Champions League numbers
  $socTeams[$tid].cand = @($cand | Select-Object -Unique)
}
$socRoster = @{}
for ($round = 0; $round -lt 40; $round++) {
  $pend = @($socTeams.Keys | ? { -not $socRoster.ContainsKey($_) -and $round -lt $socTeams[$_].cand.Count })
  if (-not $pend.Count) { break }
  $ru = @{}; foreach ($tid in $pend) { $ru[$tid] = "${EB}soccer/$($socTeams[$tid].cand[$round])/teams/$tid/roster" }
  $rres = Get-Many @($ru.Values) 2
  foreach ($tid in $pend) {
    $rj = $null; try { $rj = J $rres[$ru[$tid]] } catch { }
    if (RosterOk $rj) { $socRoster[$tid] = @{ slug = $socTeams[$tid].cand[$round]; r = $rj } }
  }
}
$soc = @(); $socFallback = 0
foreach ($tid in $socTeams.Keys) {
  $e = $socRoster[$tid]; if (-not $e) { Write-Warning "no squad for $($socTeams[$tid].n) ($tid)"; continue }
  if ($e.slug -eq 'uefa.champions') { $socFallback++; Write-Host "fallback to uefa.champions: $($socTeams[$tid].n)" }
  foreach ($ath in @($e.r.athletes)) {
    $m = SocStats $ath; $gpn = [double]$m['appearances']
    # per-appearance rates from published totals; a stat the provider doesn't publish stays null, never 0
    $R = { param($k) if ($m.ContainsKey($k)) { Rt $m[$k] $gpn 3 } else { $null } }
    $T = { param($k) if ($m.ContainsKey($k)) { [int]$m[$k] } else { $null } }
    $soc += [ordered]@{ id = [string]$ath.id; n = $ath.displayName; tm = $socTeams[$tid].n; tid = $tid; pos = (SocPos $ath.position); j = $ath.jersey; gp = [int]$gpn
      gs = $(if ($m.ContainsKey('subIns')) { [int]([math]::Max(0, $gpn - $m['subIns'])) } else { $null })
      g = (& $R 'totalGoals'); sa = (& $R 'goalAssists'); ss = (& $R 'totalShots'); sot = (& $R 'shotsOnTarget')
      ft = (& $R 'foulsCommitted'); fw = (& $R 'foulsSuffered'); yc = (& $R 'yellowCards'); rc = (& $T 'redCards'); src = $e.slug }
  }
}
Write-Host "soccer squads: $($socRoster.Count) of $($socTeams.Count) teams, $($soc.Count) players, $socFallback on fallback"

# last 10 matches per player, all competitions (one gamelog call per player with gp >= 1, in batches)
# stat order comes from the gamelog's own names[]; "started" is not exposed by this feed, so it is 0
function SocLogs($g) {
  if (-not $g -or -not $g.names) { return @() }
  $L = @($g.names); $six = @{}; for ($i = 0; $i -lt $L.Count; $i++) { $six[[string]$L[$i]] = $i }
  $seenE = @{}; $rows = @()
  foreach ($stype in @($g.seasonTypes)) { foreach ($cat in @($stype.categories)) { foreach ($e in @($cat.events)) {
    if ($seenE.ContainsKey([string]$e.eventId)) { continue }
    $m = $g.events.($e.eventId); if (-not $m) { continue }; $seenE[[string]$e.eventId] = 1
    $s = $e.stats
    $sv = { param($nm) $n = 0.0; if ($six.ContainsKey($nm) -and $s) { [void][double]::TryParse([string]$s[$six[$nm]], [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$n) }; [int]$n }
    $rows += (@(([string]$m.gameDate).Substring(0, 10), $m.opponent.abbreviation, $m.atVs, ("$($m.gameResult) $($m.score)"), 0,
      (& $sv totalGoals), (& $sv goalAssists), (& $sv totalShots), (& $sv shotsOnTarget), (& $sv foulsCommitted), (& $sv foulsSuffered), (& $sv yellowCards), [string]$e.eventId) -join '|')
  } } }
  return $rows
}
$socP = @($soc | ? { $_.gp -ge 1 -and $_.id })
$socLogN = 0
for ($i0 = 0; $i0 -lt $socP.Count; $i0 += 150) {
  $batch = $socP[$i0..([math]::Min($i0 + 149, $socP.Count - 1))]
  $glr = Get-Many @($batch | % { "https://site.web.api.espn.com/apis/common/v3/sports/soccer/athletes/$($_.id)/gamelog" })
  foreach ($sp in $batch) {
    $rl = $null; try { $rl = J $glr["https://site.web.api.espn.com/apis/common/v3/sports/soccer/athletes/$($sp.id)/gamelog"] } catch { }
    $lgs = @(SocLogs $rl | Sort-Object -Descending | Select-Object -First 10)
    if ($lgs.Count) { $sp.lg = $lgs; $socLogN++ }
  }
  $glr = $null; [GC]::Collect()
}
Write-Host "soccer game logs: $socLogN of $($socP.Count) players with appearances"

# real starting XIs: each club's most recent match, from the match summary's rosters (starter flag + formation)
$lastEv = @{}
foreach ($sp in $socP) { foreach ($row in @($sp.lg)) { if (-not $row) { continue }; $f13 = $row -split '\|'; if ($f13.Count -lt 13) { continue }
  $kk = "$($sp.tid)"; $cur = $lastEv[$kk]; if (-not $cur -or $f13[0] -gt $cur.d) { $lastEv[$kk] = @{ d = $f13[0]; e = $f13[12] } } } }
$xu = @{}; foreach ($kk in $lastEv.Keys) { $xu[$kk] = "${EB}soccer/all/summary?event=$($lastEv[$kk].e)" }
$xr = Get-Many @($xu.Values | Select-Object -Unique)
$xi = [ordered]@{}; $started = @{}
foreach ($kk in $lastEv.Keys) { $sj = J $xr[$xu[$kk]]; if (-not $sj) { continue }
  $ro = @($sj.rosters) | ? { [string]$_.team.id -eq $kk } | Select-Object -First 1; if (-not $ro) { continue }
  $op = @($sj.rosters) | ? { [string]$_.team.id -ne $kk } | Select-Object -First 1
  $st11 = @($ro.roster | ? starter | % { $started["$($_.athlete.id)|$($lastEv[$kk].e)"] = 1; @([string]$_.athlete.id, $_.athlete.displayName, [string]$_.position.abbreviation) -join '|' })
  if ($st11.Count) { $xi[$socTeams[$kk].n] = [ordered]@{ e = $lastEv[$kk].e; d = $lastEv[$kk].d; opp = $op.team.displayName; ha = $ro.homeAway; fm = $ro.formation; st = $st11 } } }
# mark field 4 (started) on the log rows we can confirm
foreach ($sp in $socP) { if (-not $sp.lg) { continue }; $sp.lg = @($sp.lg | % { $f13 = $_ -split '\|'; if ($f13.Count -ge 13 -and $started["$($sp.id)|$($f13[12])"]) { $f13[4] = '1' }; $f13 -join '|' }) }
Write-Host "starting XIs: $($xi.Count) clubs"

# ---------- NBA teams + rosters ----------
$tu = "${EB}basketball/nba/teams"; $tr = Get-Many @($tu); $teams = @((J $tr[$tu]).sports[0].leagues[0].teams | % { $_.team })
$TMAP = [ordered]@{}; foreach ($t in $teams) { $TMAP[$t.id] = [ordered]@{ n = $t.displayName; ab = $t.abbreviation; c = $t.color; c2 = $t.alternateColor } }
$rUrls = $teams | % { "${EB}basketball/nba/teams/$($_.id)/roster" }
$rr = Get-Many $rUrls
$players = [ordered]@{}; $provSeason = $null
foreach ($t in $teams) {
  $r = J $rr["${EB}basketball/nba/teams/$($t.id)/roster"]; if (-not $r) { throw "roster failed for $($t.displayName)" }
  $provSeason = $r.season.displayName
  foreach ($a in $r.athletes) {
    $inj = @($a.injuries)[0]
    $p = [ordered]@{ id = $a.id; n = $a.displayName; t = $t.id; pos = $a.position.abbreviation; j = $a.jersey; age = $a.age; exp = $a.experience.years; ht = $a.displayHeight }
    if ($a.contract) { $p.sal = $a.contract.salary; $p.yrs = $a.contract.yearsRemaining; if ($a.contract.optionType) { $p.opt = $a.contract.optionType } }
    if ($a.status -and $a.status.name -ne 'Active') { $p.rs = $a.status.name }
    if ($inj) { $p.inj = $inj.status; if ($inj.details.returnDate) { $p.ret = $inj.details.returnDate }; if ($inj.details.type) { $p.injt = $inj.details.type } }
    $players[$a.id] = $p
  }
}
if ($provSeason -ne $SEASON) { Write-Warning "provider season is $provSeason, expected $SEASON" }
Write-Host "rostered players: $($players.Count) on $($TMAP.Count) teams (provider season $provSeason)"

# ---------- season averages (all players, one call per season) ----------
function Byath($yr) {
  $u = "${EW}statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=false&page=1&limit=1000&sort=offensive.avgPoints%3Adesc&season=$yr&seasontype=2"
  $br = Get-Many @($u); $b = J $br[$u]; $ix = @{}
  foreach ($c in $b.categories) { for ($i = 0; $i -lt $c.names.Count; $i++) { $ix["$($c.name).$($c.names[$i])"] = $i } }
  $m = @{}
  foreach ($a in $b.athletes) {
    $v = @{}; foreach ($c in $a.categories) { $v[$c.name] = $c.values }
    $g = { param($cat, $nm) Num $v[$cat][$ix["$cat.$nm"]] }
    $gp = & $g general gamesPlayed; if ($gp -lt 1) { continue }
    $m[$a.athlete.id] = [ordered]@{ gp = $gp; min = & $g general avgMinutes; pts = & $g offensive avgPoints; reb = & $g general avgRebounds; ast = & $g offensive avgAssists
      tpm = & $g offensive avgThreePointFieldGoalsMade; stl = & $g defensive avgSteals; blk = & $g defensive avgBlocks; to = & $g offensive avgTurnovers
      dd = & $g general doubleDouble; td = & $g general tripleDouble; nm = $a.athlete.displayName; tm = $a.athlete.teamShortName }
  }
  return $m
}
$A27 = Byath $SY; $A26 = Byath $PREV
Write-Host "averages: $SEASON $($A27.Count) players, 2025-26 $($A26.Count) players"

# ---------- per-player game logs + career history ----------
$ids = @($players.Keys | ? { $A27[$_] -or $A26[$_] })
$gl = @{}; foreach ($id in $ids) { $gl[$id] = @("${EW}athletes/$id/gamelog", "${EW}athletes/$id/gamelog?season=$PREV", "${EW}athletes/$id/stats") }
$all = @{}   # fetched in batches of 40 players inside the loop below (keeps memory bounded)
function Logs($g) {
  if (-not $g) { return @() }
  $L = $g.labels; $ix = @{}; for ($i = 0; $i -lt $L.Count; $i++) { $ix[$L[$i]] = $i }
  $rows = @()
  foreach ($stype in $g.seasonTypes) {
    if ($stype.displayName -notmatch 'Regular Season') { continue }
    foreach ($cat in $stype.categories) { foreach ($e in $cat.events) {
      $m = $g.events.($e.eventId); if (-not $m) { continue }
      $s = $e.stats
      # pipe-joined rows: PS 5.1 mangles nested arrays in ConvertTo-Json
      $rows += (@($m.gameDate.Substring(0, 10), $m.opponent.abbreviation, $m.atVs, ("$($m.gameResult) $($m.score)"), (Num $s[$ix.MIN]), (Num $s[$ix.PTS]), (Num $s[$ix.REB]), (Num $s[$ix.AST]), (Num ($s[$ix['3PT']] -split '-')[0]), (Num $s[$ix.STL]), (Num $s[$ix.BLK])) -join '|')
    } }
  }
  return $rows
}
function Pick($x) { $o = [ordered]@{}; foreach ($k in 'gp', 'min', 'pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'to', 'dd', 'td') { $o[$k] = $x[$k] }; $o }
foreach ($id in $ids) {
  if (-not $all.ContainsKey($gl[$id][0])) { $i0 = $ids.IndexOf($id); $all = Get-Many ($ids[$i0..([math]::Min($i0 + 39, $ids.Count - 1))] | % { $gl[$_] } | % { $_ }); [GC]::Collect() }
  $u = $gl[$id]; $cur =Logs (J $all[$u[0]]); $old = Logs (J $all[$u[1]]); $all.Remove($u[0]); $all.Remove($u[1])
  # de-duplicate on date+opponent (the current and previous-season feeds overlap), newest first, keep 10
  $glog = @(); $seenG = @{}
  foreach ($row in @(@($cur) + @($old) | Sort-Object -Descending)) {
    $rp = ([string]$row).Split('|'); $gk = "$($rp[0])|$($rp[1])"
    if ($seenG.ContainsKey($gk)) { continue }; $seenG[$gk] = 1
    $glog += $row; if ($glog.Count -ge 10) { break }
  }
  if ($glog.Count) { $players[$id].lg = $glog }
  $st = J $all[$u[2]]
  if ($st) {
    $slug = @{}; foreach ($p in $st.teams.PSObject.Properties) { $slug[$p.Name] = $p.Value.abbreviation }
    $avg = $st.categories | ? name -eq 'averages'
    if ($avg) {
      $L = $avg.labels; $gi = [array]::IndexOf($L, 'GP'); $pi = [array]::IndexOf($L, 'PTS')
      $players[$id].h = @($avg.statistics | ? { $slug[$_.teamSlug] } | % { @($_.season.displayName, $slug[$_.teamSlug], (Num $_.stats[$gi]), (Num $_.stats[$pi])) -join '|' })
    }
  }
  $all.Remove($u[2]); if (($ids.IndexOf($id) % 50) -eq 0) { [GC]::Collect() }
  if ($A27[$id]) { $players[$id].a27 = Pick $A27[$id] }
  if ($A26[$id]) { $players[$id].a26 = Pick $A26[$id] }
}

# ---------- unsigned: played in 2025-26 but on no 2026-27 roster ----------
$fa = @()
foreach ($id in $A26.Keys) {
  if ($players[$id]) { continue }
  $x = $A26[$id]; if ($x.gp -lt 10) { continue }
  $fa += [ordered]@{ id = $id; n = $x.nm; last = $x.tm; gp = $x.gp; min = $x.min; pts = $x.pts; reb = $x.reb; ast = $x.ast }
}
$fa = @($fa | Sort-Object { - $_.pts })
Write-Host "unsigned 2025-26 players (10+ games): $($fa.Count)"

# ---------- recent finals + box scores, so bets on finished games settle ----------
$rUrl = @(); foreach ($k in $LG.Keys) { foreach ($dd in -3..0) { $rUrl += "$EB$($LG[$k])/scoreboard?dates=$($today.AddDays($dd).ToString('yyyyMMdd'))" } }
$rs = Get-Many $rUrl; $fin = @(); $seen2 = @{}
Write-Host "result days: $($rUrl.Count) urls, $(@($rs.Values | ? { $_ }).Count) fetched"
foreach ($u in $rUrl) {
  $d = J $rs[$u]; if (-not $d) { continue }; $k = @($LG.Keys | ? { $u -like "*$($LG[$_])/*" })[0]
  foreach ($ev in $d.events) {
    if ($ev.status.type.state -ne 'post' -or $seen2[$ev.id]) { continue }; $seen2[$ev.id] = 1
    $c = $ev.competitions[0]; $H = $c.competitors | ? homeAway -eq 'home'; $A = $c.competitors | ? homeAway -eq 'away'
    $fin += [ordered]@{ sp = $k; id = $ev.id; h = $H.team.displayName; a = $A.team.displayName; iso = $ev.date; sc = @((Num $H.score), (Num $A.score)); pp = ($ev.status.type.name -match 'POSTPONED|CANCELED') }
  }
}
$bu = @{}; foreach ($f in $fin) { if ($f.sp -ne 'nfl') { $bu[$f.id] = "$EB$($LG[$f.sp])/summary?event=$($f.id)" } }
$bx = Get-Many $bu.Values
foreach ($f in $fin) {
  if (-not $bu[$f.id]) { continue }   # nfl finals have no box score fetch
  if (-not $bu[$f.id]) { continue }; $s = J $bx[$bu[$f.id]]; if (-not $s) { continue }; $box = [ordered]@{}
  if ($f.sp -eq 'nba') {
    foreach ($tm in $s.boxscore.players) { $st = $tm.statistics[0]; $L = @($st.labels)
      foreach ($a in $st.athletes) { if ($a.didNotPlay -or -not $a.stats) { continue }; $v = $a.stats
        $box[$a.athlete.displayName] = @((Num $v[[array]::IndexOf($L, 'PTS')]), (Num $v[[array]::IndexOf($L, 'REB')]), (Num $v[[array]::IndexOf($L, 'AST')]), (Num $v[[array]::IndexOf($L, 'STL')]), (Num $v[[array]::IndexOf($L, 'BLK')]), (Num ($v[[array]::IndexOf($L, '3PT')] -split '-')[0]), (Num $v[[array]::IndexOf($L, 'MIN')])) -join '|' } }
  } else {
    foreach ($tm in $s.rosters) { foreach ($a in $tm.roster) { if (-not $a.athlete -or -not $a.stats) { continue }; $m = @{}; foreach ($x in $a.stats) { $m[$x.name] = Num $x.value }
      if (-not $a.starter -and -not $m.subIns -and -not $m.appearances) { continue }
      $box[$a.athlete.displayName] = @($m.totalGoals, $m.goalAssists, $m.totalShots, $m.shotsOnTarget, $m.foulsCommitted, $m.foulsSuffered, $m.yellowCards) -join '|' } }
  }
  $f.box = $box
}
Write-Host "finished games with results: $($fin.Count)"

$data = [ordered]@{ season = $SEASON; res = $fin; target = '2027-28'; synced = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'); src = 'ESPN public API (DraftKings lines via ESPN)'
  teams = $TMAP; pl = @($players.Values); fa = $fa; games = $games; soc = @($soc); xi = $xi }
$json = $data | ConvertTo-Json -Depth 8 -Compress
# atomic: write a temp file, then swap it in, so a reader never sees a half-written file
$dst = Join-Path $out 'sideline-data.json'; [IO.File]::WriteAllText("$dst.tmp", $json, [Text.UTF8Encoding]::new($false)); Move-Item -Force "$dst.tmp" $dst
Write-Host ("wrote data/sideline-data.json ({0:N0} KB)" -f ($json.Length / 1KB))

# NBA current season from official box scores (player game logs lag); patches the file written above
& (Join-Path $PSScriptRoot 'nba-season.ps1')
# team standings, records, results and fixtures
& (Join-Path $PSScriptRoot 'team-data.ps1')
# soccer photos (Wikidata/Commons, verified by ESPN id or name + current club): refreshed weekly
$spf = Join-Path $PSScriptRoot 'data\soc-photos.json'; if (-not (Test-Path $spf) -or ((Get-Date) - (Get-Item $spf).LastWriteTime).TotalDays -gt 7) { try { & (Join-Path $PSScriptRoot 'soc-photos.ps1') } catch { "soc-photos skipped: $($_.Exception.Message)" } }
