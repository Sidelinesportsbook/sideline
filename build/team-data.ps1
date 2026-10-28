# Team pages data: NBA (standings + schedule) and 111 soccer clubs (league/UCL standings + all-competition results & fixtures).
# Real ESPN data only; anything unavailable is null. Writes data\teams.json (atomically).
$ErrorActionPreference = 'Stop'
$sw = [Diagnostics.Stopwatch]::StartNew()
$V2 = 'https://site.api.espn.com/apis/v2/sports/'; $S2 = 'https://site.api.espn.com/apis/site/v2/sports/'
$dataF = Join-Path $PSScriptRoot 'data\sideline-data.json'; $outF = Join-Path $PSScriptRoot 'data\teams.json'
$LEAGUES = 'eng.1', 'esp.1', 'ita.1', 'ger.1', 'fra.1'; $UCL = 'uefa.champions'
function Fetch([string[]]$urls) {
  $pool = [runspacefactory]::CreateRunspacePool(1, 10); $pool.Open()
  $jobs = foreach ($u in ($urls | Select-Object -Unique)) { $ps = [powershell]::Create(); $ps.RunspacePool = $pool
    [void]$ps.AddScript({ param($u) for ($i = 0; $i -lt 3; $i++) { try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 30 $u; return [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) } catch { Start-Sleep -Milliseconds (500 * ($i + 1)) } }; $null }).AddArgument($u)
    [pscustomobject]@{ u = $u; ps = $ps; h = $ps.BeginInvoke() } }
  $r = @{}; foreach ($j in $jobs) { $o = $j.ps.EndInvoke($j.h); $r[$j.u] = if ($o.Count) { $o[0] } else { $null }; $j.ps.Dispose() }; $pool.Close(); $r
}
function Js($s) { if ($s) { $s | ConvertFrom-Json } else { $null } }
function StX($e, $name) { foreach ($s in $e.stats) { if ($s.name -eq $name -or $s.type -eq $name) { return $s } }; $null }
function StV($e, $name) { $s = StX $e $name; if ($s -and $null -ne $s.value -and "$($s.value)" -ne '') { [double]$s.value } else { $null } }
function StD($e, $name) { $s = StX $e $name; if ($s -and "$($s.displayValue)" -ne '') { [string]$s.displayValue } else { $null } }
function StI($e, $name) { $v = StV $e $name; if ($null -eq $v) { $null } else { [int]$v } }
function Score($c) { $s = $c.score; if ($null -eq $s) { return $null }
  $t = if ($s -is [string] -or $s -is [ValueType]) { [string]$s } elseif ($null -ne $s.displayValue) { [string]$s.displayValue } else { [string]$s.value }
  $n = 0.0; if ([double]::TryParse($t, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$n)) { [int]$n } else { $null } }
function Mine($comp, $tid) { $m = $null; $o = $null; foreach ($c in $comp.competitors) { if ([string]$c.team.id -eq $tid) { $m = $c } else { $o = $c } }; @($m, $o) }
function Wdl($ms, $os) { if ($ms -gt $os) { 'W' } elseif ($ms -lt $os) { 'L' } else { 'D' } }

$sd = [IO.File]::ReadAllText($dataF) | ConvertFrom-Json
$nbaIds = @($sd.teams.PSObject.Properties.Name)
$tidLg = [ordered]@{}; foreach ($x in $sd.soc) { $t = [string]$x.tid; if (-not $tidLg.Contains($t) -or ($tidLg[$t] -eq $UCL -and $x.src -ne $UCL)) { $tidLg[$t] = [string]$x.src } }

# ---- fetch everything in parallel
$urls = [Collections.Generic.List[string]]::new()
$urls.Add("${V2}basketball/nba/standings?level=3")
foreach ($id in $nbaIds) { $urls.Add("${S2}basketball/nba/teams/$id/schedule") }
$ALL = @($LEAGUES + $UCL + @($tidLg.Values | ? { $_ -and (($LEAGUES + $UCL) -notcontains $_) } | Select-Object -Unique))   # extra leagues: standings used only for a club's pos/pts/lgName
foreach ($lg in $ALL) { $urls.Add("${V2}soccer/$lg/standings") }
foreach ($t in $tidLg.Keys) { $urls.Add("${S2}soccer/all/teams/$t/schedule"); $urls.Add("${S2}soccer/all/teams/$t/schedule?fixture=true") }
$R = Fetch @($urls)
"fetched $($urls.Count) urls, failed: $(@($urls | ? { -not $R[$_] }).Count) in $([int]$sw.Elapsed.TotalSeconds)s"

# ---- NBA
$nba = [ordered]@{}; $nbaTab = @{ 'Eastern Conference' = [Collections.Generic.List[object]]::new(); 'Western Conference' = [Collections.Generic.List[object]]::new() }
$st = Js $R[$urls[0]]
if (-not $st) { throw 'NBA standings failed' }
foreach ($conf in $st.children) {
  foreach ($dv in $conf.children) { foreach ($e in $dv.standings.entries) {
    $id = [string]$e.team.id; $w = StI $e 'wins'; $l = StI $e 'losses'; $gp = if ($null -ne $w -and $null -ne $l) { $w + $l } else { $null }
    $nba[$id] = [ordered]@{ id = $id; n = [string]$e.team.displayName; ab = [string]$e.team.abbreviation; conf = [string]$conf.name; div = [string]$dv.name
      w = $w; l = $l; pct = StV $e 'winPercent'; seed = StI $e 'playoffSeed'; gb = StV $e 'gamesBehind'
      ppg = $(if ($gp) { StV $e 'avgPointsFor' } else { $null }); oppg = $(if ($gp) { StV $e 'avgPointsAgainst' } else { $null }); diff = $(if ($gp) { StV $e 'differential' } else { $null })
      streak = StD $e 'streak'; home = StD $e 'Home'; road = StD $e 'Road'; l10 = StD $e 'Last Ten Games'; res = $null; fx = $null }
    $nbaTab[[string]$conf.name].Add([pscustomobject]@{ seed = StI $e 'playoffSeed'; row = $e; id = $id })
  } } }
foreach ($id in $nbaIds) {
  if (-not $nba.Contains($id)) { continue }
  $sj = Js $R["${S2}basketball/nba/teams/$id/schedule"]; if (-not $sj) { continue }
  $res = [Collections.Generic.List[object]]::new(); $fx = [Collections.Generic.List[object]]::new()
  foreach ($ev in $sj.events) {
    if ([string]$ev.seasonType.id -ne '2') { continue }
    $comp = $ev.competitions[0]; $mo = Mine $comp $id; if (-not $mo[0] -or -not $mo[1]) { continue }
    $ha = if ($mo[0].homeAway -eq 'home') { 'vs' } else { '@' }; $opp = [string]$mo[1].team.abbreviation; $state = [string]$comp.status.type.state
    if ($state -eq 'post' -and $comp.status.type.name -notmatch 'POSTPONED|CANCELED') {
      $ms = Score $mo[0]; $os = Score $mo[1]; if ($null -eq $ms -or $null -eq $os) { continue }
      $res.Add([pscustomobject]@{ d = [string]$ev.date; s = "$(([string]$ev.date).Substring(0,10))|$opp|$ha|$(if ($ms -gt $os) { 'W' } else { 'L' }) $([math]::Max($ms,$os))-$([math]::Min($ms,$os))|$($ev.date)" })   # last field: exact tip-off, for local dates
    } elseif ($state -eq 'pre') { $fx.Add([pscustomobject]@{ d = [string]$ev.date; s = "$($ev.date)|$opp|$ha" }) }
  }
  $nba[$id].res = @($res | Sort-Object d -Descending | % { $_.s }); $nba[$id].fx = @($fx | Sort-Object d | Select-Object -First 5 | % { $_.s })
}
$tables = [ordered]@{}
foreach ($pair in @(@('nba-East', 'Eastern Conference'), @('nba-West', 'Western Conference'))) {
  $tables[$pair[0]] = @($nbaTab[$pair[1]] | Sort-Object { if ($null -eq $_.seed) { 99 } else { $_.seed } } | % { $e = $_.row
    "$($_.seed)|$($_.id)|$($e.team.abbreviation)|$(StI $e 'wins')|$(StI $e 'losses')|$(StD $e 'winPercent')|$(StD $e 'gamesBehind')" })
}

# ---- soccer standings
$lgName = @{}; $tabE = @{}; $lgEnt = @{}   # lgEnt[lg][teamId] = entry
foreach ($lg in $ALL) {
  $sj = Js $R["${V2}soccer/$lg/standings"]; $lgEnt[$lg] = @{}; $list = [Collections.Generic.List[object]]::new()
  if ($sj) { $lgName[$lg] = [string]$sj.name; foreach ($ch in $sj.children) { foreach ($e in $ch.standings.entries) { $lgEnt[$lg][[string]$e.team.id] = $e; $list.Add($e) } } }
  $tabE[$lg] = @($list | Sort-Object { $rk = StV $_ 'rank'; if ($null -eq $rk) { 999 } else { $rk } })
  if (($LEAGUES + $UCL) -notcontains $lg) { continue }
  $tables[$lg] = @($tabE[$lg] | % { "$(StI $_ 'rank')|$($_.team.id)|$($_.team.displayName)|$(StI $_ 'gamesPlayed')|$(StI $_ 'wins')|$(StI $_ 'ties')|$(StI $_ 'losses')|$(StI $_ 'pointsFor')|$(StI $_ 'pointsAgainst')|$(StI $_ 'pointDifferential')|$(StI $_ 'points')" })
}

# ---- soccer clubs
$soc = [ordered]@{}
foreach ($t in $tidLg.Keys) {
  $lg = $tidLg[$t]; $e = $lgEnt[$lg]; $e = if ($e) { $e[$t] } else { $null }
  $ru = "${S2}soccer/all/teams/$t/schedule"; $rj = Js $R[$ru]; $fj = Js $R["${ru}?fixture=true"]
  $nm = if ($e) { [string]$e.team.displayName } elseif ($rj -and $rj.team) { [string]$rj.team.displayName } else { $null }
  $ab = if ($e) { [string]$e.team.abbreviation } elseif ($rj -and $rj.team) { [string]$rj.team.abbreviation } else { $null }
  $o = [ordered]@{ id = $t; n = $nm; ab = $ab; lg = $lg; lgName = $lgName[$lg]
    pos = $null; pts = $null; gp = $null; w = $null; d = $null; l = $null; gf = $null; ga = $null; gd = $null; form = $null; res = $null; fx = $null; ucl = $null }
  if ($e) { $o.pos = StI $e 'rank'; $o.pts = StI $e 'points'; $o.gp = StI $e 'gamesPlayed'; $o.w = StI $e 'wins'; $o.d = StI $e 'ties'; $o.l = StI $e 'losses'; $o.gf = StI $e 'pointsFor'; $o.ga = StI $e 'pointsAgainst'; $o.gd = StI $e 'pointDifferential' }
  $u = $lgEnt[$UCL][$t]
  if ($u) { $o.ucl = [ordered]@{ pos = StI $u 'rank'; pts = StI $u 'points'; gp = StI $u 'gamesPlayed'; w = StI $u 'wins'; d = StI $u 'ties'; l = StI $u 'losses'; gf = StI $u 'pointsFor'; ga = StI $u 'pointsAgainst'; gd = StI $u 'pointDifferential' } }
  if ($rj) {
    $rows = [Collections.Generic.List[object]]::new()
    foreach ($ev in $rj.events) {
      $comp = $ev.competitions[0]; $slug = [string]$ev.league.slug; if ($slug -eq 'club.friendly') { continue }
      if ([string]$comp.status.type.state -ne 'post') { continue }
      $mo = Mine $comp $t; if (-not $mo[0] -or -not $mo[1]) { continue }
      $ms = Score $mo[0]; $os = Score $mo[1]; if ($null -eq $ms -or $null -eq $os) { continue }
      $ha = if ($mo[0].homeAway -eq 'home') { 'vs' } else { '@' }; $wd = Wdl $ms $os
      $rows.Add([pscustomobject]@{ d = [string]$ev.date; slug = $slug; wd = $wd
        s = "$(([string]$ev.date).Substring(0,10))|$($mo[1].team.displayName)|$ha|$wd $([math]::Max($ms,$os))-$([math]::Min($ms,$os))|$(if ($ev.league.abbreviation) { $ev.league.abbreviation } else { $ev.league.name })|$($ev.date)" })
    }
    $sorted = @($rows | Sort-Object d -Descending)
    $o.res = @($sorted | Select-Object -First 10 | % { $_.s })
    $lgm = @($sorted | ? { $_.slug -eq $lg } | Select-Object -First 5)
    if ($lgm.Count) { [array]::Reverse($lgm); $o.form = ($lgm | % { $_.wd }) -join '' }
  }
  if ($fj) {
    $rows = [Collections.Generic.List[object]]::new()
    foreach ($ev in $fj.events) {
      $comp = $ev.competitions[0]; if ([string]$ev.league.slug -eq 'club.friendly' -or [string]$comp.status.type.state -ne 'pre') { continue }
      $mo = Mine $comp $t; if (-not $mo[0] -or -not $mo[1]) { continue }
      $ha = if ($mo[0].homeAway -eq 'home') { 'vs' } else { '@' }
      $rows.Add([pscustomobject]@{ d = [string]$ev.date; s = "$($ev.date)|$($mo[1].team.displayName)|$ha|$(if ($ev.league.abbreviation) { $ev.league.abbreviation } else { $ev.league.name })" })
    }
    $o.fx = @($rows | Sort-Object d | Select-Object -First 5 | % { $_.s })
  }
  $soc[$t] = $o
}

$out = [ordered]@{ at = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'); nba = $nba; soc = $soc; tables = $tables }
$json = $out | ConvertTo-Json -Depth 8 -Compress
[IO.File]::WriteAllText("$outF.tmp", $json, [Text.UTF8Encoding]::new($false)); Move-Item -Force "$outF.tmp" $outF
"TEAM_DATA nba=$($nba.Count) soc=$($soc.Count) bytes=$($json.Length) secs=$([int]$sw.Elapsed.TotalSeconds)"
