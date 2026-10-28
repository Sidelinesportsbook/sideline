# PointsBet (AU) NBA + soccer markets -> data/pb.json. Bookmaker prices only; kept apart from player stats.
# Public JSON the pointsbet.com.au site reads; no login. Re-run to refresh:  powershell -ExecutionPolicy Bypass -File pb-data.ps1
$ErrorActionPreference = 'Stop'
$B = 'https://api.au.pointsbet.com/api'
$COMP = [ordered]@{ nba = 7176; epl = 136535; ucl = 155246; lgc = 156281; uel = 130330 }   # lgc = EFL (Carabao) Cup, uel = Europa League
# the FA Cup's match competition only appears on PointsBet once a round is priced: found by its exact name each run
try { $sc = Invoke-RestMethod -TimeoutSec 30 "$B/v2/sports/soccer/competitions"; $fa = @($sc.locales | % { $_.competitions } | ? { $_.name -eq 'English FA Cup' })[0]; if ($fa) { $COMP['fac'] = [int]$fa.key } } catch { Write-Warning "PointsBet competition list unavailable: $_" }
function Fetch([string[]]$urls) {
  $pool = [runspacefactory]::CreateRunspacePool(1, 8); $pool.Open()
  $jobs = foreach ($u in $urls) { $ps = [powershell]::Create(); $ps.RunspacePool = $pool
    [void]$ps.AddScript({ param($u) for ($i = 0; $i -lt 3; $i++) { try { return (Invoke-WebRequest -UseBasicParsing -TimeoutSec 60 $u).Content } catch { Start-Sleep -Milliseconds 700 } }; $null }).AddArgument($u)
    [pscustomobject]@{ u = $u; ps = $ps; h = $ps.BeginInvoke() } }
  $r = @{}; foreach ($j in $jobs) { $o = $j.ps.EndInvoke($j.h); $r[$j.u] = if ($o.Count) { $o[0] } else { $null }; $j.ps.Dispose() }; $pool.Close(); $pool.Dispose(); $r
}
$fu = @{}; foreach ($k in $COMP.Keys) { $fu[$k] = "$B/v2/competitions/$($COMP[$k])/events/featured?includeLive=false" }
$fr = Fetch $fu.Values
$evs = @(); foreach ($k in $COMP.Keys) { $j = $fr[$fu[$k]] | ConvertFrom-Json; foreach ($e in $j.events) { $evs += [pscustomobject]@{ comp = $k; key = $e.key } } }
Write-Host "PointsBet events: $($evs.Count)"
$du = @{}; foreach ($e in $evs) { $du[$e.key] = "$B/mes/v3/events/$($e.key)" }
$dr = Fetch $du.Values
$out = @()
foreach ($ev in $evs) {
  $raw = $dr[$du[$ev.key]]; if (-not $raw) { Write-Warning "no detail for $($ev.key)"; continue }
  $e = $raw | ConvertFrom-Json; $BYN = @{}; foreach ($m in $e.fixedOddsMarkets) { if (-not $BYN[$m.eventName]) { $BYN[$m.eventName] = $m } }
  $open = { param($o) $o.isOpenForBetting -and -not $o.isHidden -and $o.price -gt 1 }
  $mk = [ordered]@{}
  $res = $BYN['Match Result']; if ($res) { $h = $res.outcomes | ? side -eq 'Home'; $a = $res.outcomes | ? side -eq 'Away'; $d = $res.outcomes | ? { $_.side -ne 'Home' -and $_.side -ne 'Away' }; if ($h -and $a -and $d) { $mk.res = @($h.price, $d.price, $a.price) } }
  $tg = $BYN['Total Goals']; if ($tg -and @($tg.outcomes).Count -eq 2) { $ov = $tg.outcomes | ? name -match 'Over'; $un = $tg.outcomes | ? name -match 'Under'; if ($ov -and $un) { $mk.tot = @([double]$ov.points, $ov.price, $un.price) } }
  $bt = $BYN['Both Teams to Score']; if ($bt) { $y = $bt.outcomes | ? name -match '^Yes'; $n = $bt.outcomes | ? name -match '^No'; if ($y -and $n) { $mk.btts = @($y.price, $n.price) } }
  $pp = @{}
  if ($ev.comp -eq 'nba') {
    # team markets: moneyline, line, total (decimal prices)
    $ml = $BYN['Moneyline']; if ($ml) { $hh = $ml.outcomes | ? side -eq 'Home'; $aa = $ml.outcomes | ? side -eq 'Away'; if ($hh -and $aa) { $mk.ml = @($hh.price, $aa.price) } }
    $ps2 = $BYN['Point Spread']; if ($ps2) { $hh = $ps2.outcomes | ? side -eq 'Home'; $aa = $ps2.outcomes | ? side -eq 'Away'; if ($hh -and $aa) { $mk.sp = @([double]$hh.points, $hh.price, $aa.price) } }
    $tt = $BYN['Total']; if ($tt) { $ov = $tt.outcomes | ? name -match '^Over'; $un = $tt.outcomes | ? name -match '^Under'; if ($ov -and $un) { $mk.tot = @([double]$ov.points, $ov.price, $un.price) } }
    # alternate spreads ("Pick Your Own Line"): home line, home price, away price; only lines priced on both sides
    $al = @(); $po = @($BYN['Pick Your Own Line'].outcomes | ? { $_ -and (& $open $_) })
    foreach ($hh in @($po | ? side -eq 'Home')) { $aa = $po | ? { $_.side -eq 'Away' -and [double]$_.points -eq -[double]$hh.points } | Select-Object -First 1; if ($aa) { $al += , @([double]$hh.points, $hh.price, $aa.price) } }
    if ($al.Count) { $mk.altsp = @($al | Sort-Object { $_[0] }) }
    $at = @(); $ao = @($BYN['Alternate Totals'].outcomes | ? { $_ -and (& $open $_) })
    foreach ($ov in @($ao | ? name -match '^Over')) { $un = $ao | ? { $_.name -match '^Under' -and [double]$_.points -eq [double]$ov.points } | Select-Object -First 1; if ($un) { $at += , @([double]$ov.points, $ov.price, $un.price) } }
    if ($at.Count) { $mk.alttot = @($at | Sort-Object { $_[0] }) }
    # team totals: "<Team> Total" over/under
    foreach ($side in @(@('h', $e.homeTeam), @('a', $e.awayTeam))) { $tm = $BYN["$($side[1]) Total"]; if (-not $tm) { continue }
      $tl = @(); $oo = @($tm.outcomes | ? { $_ -and (& $open $_) }); foreach ($ov in @($oo | ? name -match '^Over')) { $un = $oo | ? { $_.name -match '^Under' -and [double]$_.points -eq [double]$ov.points } | Select-Object -First 1; if ($un) { $tl += , @([double]$ov.points, $ov.price, $un.price) } }
      if ($tl.Count) { $mk["tt$($side[0])"] = @($tl | Sort-Object { $_[0] }) } }
    # player over/under lines: name -> stat -> [line, over, under]; double/triple-double -> price
    $PM = [ordered]@{ 'Player Points Over/Under' = 'pts'; 'Player Rebounds Over/Under' = 'reb'; 'Player Assists Over/Under' = 'ast'; 'Player 3-Pointers Made' = 'tpm'
      'Player Pts + Rebs + Asts Over/Under' = 'pra'; 'Player Points + Rebounds Over/Under' = 'pr'; 'Player Points + Assists Over/Under' = 'pa'; 'Player Assists + Rebounds Over/Under' = 'ra' }
    foreach ($mn in $PM.Keys) { $sk = $PM[$mn]
      foreach ($o in @($BYN[$mn].outcomes)) { if (-not $o -or -not (& $open $o)) { continue }; if ($o.name -notmatch '^(.*)\s+(Over|Under)\s+([\d.]+)$') { continue }
        $nm = $Matches[1].Trim(); $ln = [double]$Matches[3]; $isO = $Matches[2] -eq 'Over'
        if (-not $pp[$nm]) { $pp[$nm] = [ordered]@{} }; if (-not $pp[$nm][$sk]) { $pp[$nm][$sk] = @($ln, $null, $null) }
        if ($pp[$nm][$sk][0] -ne $ln) { continue }; if ($isO) { $pp[$nm][$sk][1] = $o.price } else { $pp[$nm][$sk][2] = $o.price } } }
    # alternate player lines ("Alternate Points", "Alternate Rebounds", ...): "<Player> To Score 15+ Points" -> ladder[stat][15] = price
    $SW = @{ 'points' = 'pts'; 'rebounds' = 'reb'; 'assists' = 'ast'; 'threes' = 'tpm'; '3-pointers' = 'tpm'; '3 pointers' = 'tpm'; 'three pointers' = 'tpm'; 'steals' = 'stl'; 'blocks' = 'blk'
      'pts + rebs + asts' = 'pra'; 'points + rebounds + assists' = 'pra'; 'points + rebounds' = 'pr'; 'points + assists' = 'pa'; 'rebounds + assists' = 'ra'; 'assists + rebounds' = 'ra' }
    foreach ($mn in @($BYN.Keys | ? { $_ -match '^Alternate ' -and $_ -ne 'Alternate Totals' })) {
      foreach ($o in @($BYN[$mn].outcomes)) { if (-not $o -or -not (& $open $o)) { continue }
        if ($o.name -notmatch '^(.*?)\s+To\s+(?:Score|Record|Get|Make|Have|Hit)\s+(\d+)\+\s+(.+)$') { continue }
        $nm = $Matches[1].Trim(); $nn = [string][int]$Matches[2]; $sk = $SW[$Matches[3].Trim().ToLower()]; if (-not $sk) { continue }
        if (-not $pp[$nm]) { $pp[$nm] = [ordered]@{} }; if (-not $pp[$nm]['lad']) { $pp[$nm]['lad'] = [ordered]@{} }; if (-not $pp[$nm]['lad'][$sk]) { $pp[$nm]['lad'][$sk] = [ordered]@{} }
        $pp[$nm]['lad'][$sk][$nn] = $o.price } }    foreach ($pair in @(@('Player To Record A Double Double', 'dd'), @('Player To Record A Triple Double', 'td'))) {
      foreach ($o in @($BYN[$pair[0]].outcomes)) { if ($o -and (& $open $o)) { if (-not $pp[$o.name]) { $pp[$o.name] = [ordered]@{} }; $pp[$o.name][$pair[1]] = $o.price } } }
    $out += [ordered]@{ comp = $ev.comp; key = $ev.key; h = $e.homeTeam; a = $e.awayTeam; iso = $e.startsAt; mk = $mk; pp = $pp }; continue
  }
  # soccer match markets beyond the result: double chance, handicap lines, alternative totals, team totals
  $dcm = $BYN['Double Chance']; if ($dcm) { $hn = $e.homeTeam; $an = $e.awayTeam; $x = @{}
    foreach ($o in @($dcm.outcomes | ? { $_ -and (& $open $_) })) { $t = $o.name; if ($t -match 'Draw') { if ($t -match [regex]::Escape($hn)) { $x['1x'] = $o.price } elseif ($t -match [regex]::Escape($an)) { $x['x2'] = $o.price } } else { $x['12'] = $o.price } }
    if ($x.Count -eq 3) { $mk.dc = @($x['1x'], $x['12'], $x['x2']) } }
  $hl = @(); foreach ($nmk in 'Spread', 'Alternate Spread') { $po = @($BYN[$nmk].outcomes | ? { $_ -and (& $open $_) })
    foreach ($hh in @($po | ? { $_.name -like "$($e.homeTeam)*" })) { $aa = $po | ? { $_.name -like "$($e.awayTeam)*" -and [double]$_.points -eq -[double]$hh.points } | Select-Object -First 1; if ($aa -and -not ($hl | ? { $_[0] -eq [double]$hh.points })) { $hl += , @([double]$hh.points, $hh.price, $aa.price) } } }
  if ($hl.Count) { $mk.altsp = @($hl | Sort-Object { $_[0] }) }
  $at = @(); foreach ($nmk in 'Total Goals', 'Alternative Total Goals') { $ao = @($BYN[$nmk].outcomes | ? { $_ -and (& $open $_) })
    foreach ($ov in @($ao | ? name -match '^Over')) { $un = $ao | ? { $_.name -match '^Under' -and [double]$_.points -eq [double]$ov.points } | Select-Object -First 1; if ($un -and -not ($at | ? { $_[0] -eq [double]$ov.points })) { $at += , @([double]$ov.points, $ov.price, $un.price) } } }
  if ($at.Count) { $mk.alttot = @($at | Sort-Object { $_[0] }) }
  foreach ($side in @(@('h', $e.homeTeam), @('a', $e.awayTeam))) { $tm = $BYN["$($side[1]) Total"]; if (-not $tm) { continue }
    $tl = @(); $oo = @($tm.outcomes | ? { $_ -and (& $open $_) }); foreach ($ov in @($oo | ? name -match '^Over')) { $un = $oo | ? { $_.name -match '^Under' -and [double]$_.points -eq [double]$ov.points } | Select-Object -First 1; if ($un) { $tl += , @([double]$ov.points, $ov.price, $un.price) } }
    if ($tl.Count) { $mk["tt$($side[0])"] = @($tl | Sort-Object { $_[0] }) } }  function Put($nm, $k, $v) { if (-not $pp[$nm]) { $pp[$nm] = [ordered]@{} }; $pp[$nm][$k] = $v }
  foreach ($o in @($BYN['Anytime Goalscorer'].outcomes)) { if ($o -and (& $open $o) -and $o.name -notmatch 'No Goalscorer') { Put $o.name 'g' $o.price } }
  foreach ($o in @($BYN['To Score 2+ Goals'].outcomes)) { if ($o -and (& $open $o)) { Put $o.name 'g2' $o.price } }
  foreach ($o in @($BYN['To Be Shown A Card'].outcomes)) { if ($o -and (& $open $o)) { Put $o.name 'yc' $o.price } }
  foreach ($pair in @(@('Player Total Shots', 'ss'), @('Player Total Shots On Target', 'sot'), @('Player Total Assists', 'sa'))) {
    foreach ($o in @($BYN[$pair[0]].outcomes)) { if (-not $o -or -not (& $open $o)) { continue }
      $nm = ($o.name -replace '\s+\d+\+$', '').Trim(); $kk = [string][int]$o.points
      if (-not $pp[$nm]) { $pp[$nm] = [ordered]@{} }; if (-not $pp[$nm][$pair[1]]) { $pp[$nm][$pair[1]] = [ordered]@{} }; $pp[$nm][$pair[1]][$kk] = $o.price } }
  $out += [ordered]@{ comp = $ev.comp; key = $ev.key; h = $e.homeTeam; a = $e.awayTeam; iso = $e.startsAt; mk = $mk; pp = $pp }
}
$data = [ordered]@{ src = 'PointsBet (AU)'; fetched = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'); events = $out }
$json = $data | ConvertTo-Json -Depth 8 -Compress
# PowerShell 5.1 wraps sorted nested arrays as {"value":[..],"Count":n}; unwrap them to plain arrays
$json = [regex]::Replace($json, '\{"value":(\[[^\[\]]*\]),"Count":\d+\}', '$1')
$dst = Join-Path $PSScriptRoot 'data\pb.json'; if (-not $out.Count) { throw 'PointsBet returned no events; keeping the previous pb.json' }
[IO.File]::WriteAllText("$dst.tmp", $json, [Text.UTF8Encoding]::new($false)); Move-Item -Force "$dst.tmp" $dst
Write-Host ("pb.json: {0} events, {1} with player props, {2:N0} KB" -f $out.Count, @($out | ? { $_.pp.Count }).Count, ($json.Length / 1KB))
