# Special Bets: official results for the futures markets the app takes bets on -> data\futures-results.json.
# A market is settled only from ESPN's official data, and only when it is certain:
#   league winner / top 4 / relegated   ESPN's final table, once every club has played every game
#   cup or European competition winner  the winner of the competition's final (extra time and penalties included)
#   NBA champion / conference winner    the team that won the NBA Finals / East or West Finals series
#   Super Bowl / AFC / NFC champion     the winner of that game
# Each winner is matched to exactly one PointsBet selection by name; if any winner matches none or more than one, the market
# is left unsettled rather than guessed. Settled results are kept for good. Other markets (awards, top scorer and so on)
# aren't settled automatically, so the app doesn't take bets on them.
param([string]$Test)
$ErrorActionPreference = 'Stop'; $EB = 'https://site.api.espn.com/apis/site/v2/sports/'
$fF = Join-Path $PSScriptRoot 'data\futures.json'; $rF = Join-Path $PSScriptRoot 'data\futures-results.json'
$LEAGUE = @{ epl = 'eng.1'; laliga = 'esp.1'; seriea = 'ita.1'; bund = 'ger.1'; ligue1 = 'fra.1' }
$CUP = @{ ucl = 'uefa.champions'; uel = 'uefa.europa'; uecl = 'uefa.europa.conf'; fac = 'eng.fa'; lgc = 'eng.league_cup'; wc = 'fifa.world' }
# how (and whether) a market settles: returns @{ how; slug; need } or $null. Shared rules with the app (futures.js FSETTLE).
function Method($comp, [string]$mn) {
  if ($LEAGUE.ContainsKey($comp)) { if ($mn -eq 'Outright Winner') { return @{ how = 'table'; slug = $LEAGUE[$comp]; top = 1 } }
    if ($comp -eq 'epl' -and $mn -eq 'To Finish Top 4') { return @{ how = 'table'; slug = 'eng.1'; top = 4 } }
    if ($comp -eq 'epl' -and $mn -eq 'To Be Relegated') { return @{ how = 'table'; slug = 'eng.1'; bottom = 3 } } }
  if ($CUP.ContainsKey($comp) -and $mn -eq 'Outright Winner') { return @{ how = 'final'; slug = $CUP[$comp] } }
  if ($comp -eq 'nba') { if ($mn -eq 'Outright Winner') { return @{ how = 'series'; slug = 'basketball/nba'; pat = '^NBA Finals' } }
    if ($mn -eq 'Eastern Conference Winner') { return @{ how = 'series'; slug = 'basketball/nba'; pat = '^East Finals' } }
    if ($mn -eq 'Western Conference Winner') { return @{ how = 'series'; slug = 'basketball/nba'; pat = '^West Finals' } } }
  if ($comp -eq 'nfl') { if ($mn -match '^Super Bowl') { return @{ how = 'game'; slug = 'football/nfl'; pat = '^Super Bowl' } }
    if ($mn -eq 'AFC Championship Winner') { return @{ how = 'game'; slug = 'football/nfl'; pat = '^AFC Championship' } }
    if ($mn -eq 'NFC Championship Winner') { return @{ how = 'game'; slug = 'football/nfl'; pat = '^NFC Championship' } } }
  return $null }
# names: lower case, accents off, "&" -> and, common short forms written out, club suffixes dropped
function Nz([string]$s) { $s = $s.Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', ''; $s = $s.ToLower() -replace '&', ' and ' -replace '[^a-z0-9 ]', ' '
  $s = " $s " -replace ' man ', ' manchester ' -replace ' utd ', ' united ' -replace ' st ', ' saint ' -replace ' psg ', ' paris saint germain ' -replace ' (fc|afc|cf|sc|ac|club|de|the|calcio) ', ' '
  ($s -replace '\s+', ' ').Trim() }
function Names($t) { @($t.displayName, $t.shortDisplayName, $t.name, $t.location, $t.nickname, "$($t.location) $($t.name)") | ? { $_ } | % { Nz $_ } | Select-Object -Unique }
# the PointsBet selections that are this ESPN team: equal to one of its names, or all of a selection's words inside its full name
function Match($team, $sel) { $tn = Names $team; $full = Nz $team.displayName
  @($sel | ? { $n = Nz $_.n; ($tn -contains $n) -or (($n -split ' ' | ? { $_ }) | % { " $full " -like "* $_ *" }) -notcontains $false }) }
function Day($u) { try { Invoke-RestMethod -TimeoutSec 30 $u } catch { $null } }
function Settle($comp, $m, [datetime]$ends) { $Meth = Method $comp $m.n; if (-not $Meth) { return $null }; $winners = @()
  if ($Meth.how -eq 'table') { $season = $ends.AddMonths(-6).Year; $st = Day "https://site.api.espn.com/apis/v2/sports/soccer/$($Meth.slug)/standings?season=$season"; if (-not $st) { return $null }
    $en = @($st.children[0].standings.entries); if ($en.Count -lt 10) { return $null }; $full = 2 * ($en.Count - 1)
    if (@($en | ? { [int](($_.stats | ? name -eq 'gamesPlayed').value) -lt $full }).Count) { return $null }   # not every club has played every game
    $ord = @($en | Sort-Object { [int](($_.stats | ? name -eq 'rank').value) })
    $winners = if ($Meth.top) { @($ord | Select-Object -First $Meth.top) } else { @($ord | Select-Object -Last $Meth.bottom) }; $winners = @($winners | % { $_.team })
    $how = "ESPN final table $season-$(($season + 1) % 100)" }
  else { $found = $null; for ($d = $ends.AddDays(-30); $d -le $ends.AddDays(10) -and -not $found; $d = $d.AddDays(1)) { $sb = Day "$EB$(if ($Meth.slug -match '/') { $Meth.slug } else { 'soccer/' + $Meth.slug })/scoreboard?dates=$($d.ToString('yyyyMMdd'))"; if (-not $sb) { continue }
      foreach ($e in @($sb.events)) { $c = $e.competitions[0]; if ($e.status.type.state -ne 'post') { continue }; $note = (@($c.notes) | % { $_.headline }) -join ' '
        $ok = switch ($Meth.how) { 'final' { $e.season.slug -eq 'final' } 'series' { $note -match $Meth.pat -and [string]$c.series.summary -match 'wins series' } 'game' { $note -match $Meth.pat } }
        if ($ok) { $w = @($c.competitors | ? winner); if ($w.Count -eq 1) { $found = @{ t = $w[0].team; e = $e } } } } }
    if (-not $found) { return $null }; $winners = @($found.t); $how = "ESPN: $($found.e.name), $(([string]$found.e.date).Substring(0,10))" }
  $win = @(); foreach ($t in $winners) { $hit = @(Match $t $m.sel); if ($hit.Count -ne 1) { Write-Warning "$comp $($m.n): '$($t.displayName)' matches $($hit.Count) selections; left unsettled"; return $null }; $win += $hit[0] }
  [ordered]@{ win = @($win | % { [string]$_.id }); names = @($win | % { $_.n }); how = $how; at = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ') } }
# checks against last season's real results (pwsh futures-settle.ps1 -Test 1): every one must come out as known
if ($Test) { $ok = 0; $bad = 0; $T = @(
  @('epl', 'Outright Winner', '2026-05-24', @('Arsenal', 'Man City', 'Liverpool', 'Man Utd'), 'Arsenal'),
  @('epl', 'To Finish Top 4', '2026-05-24', @('Arsenal', 'Man City', 'Man Utd', 'Aston Villa', 'Liverpool', 'Chelsea', 'Newcastle'), ''),
  @('fac', 'Outright Winner', '2026-05-16', @('Chelsea', 'Man City', 'Arsenal'), 'Man City'),
  @('ucl', 'Outright Winner', '2026-05-30', @('Arsenal', 'Paris Saint-Germain', 'Bayern Munich'), 'Paris Saint-Germain'),
  @('nba', 'Outright Winner', '2026-06-14', @('New York Knicks', 'San Antonio Spurs', 'Oklahoma City Thunder'), 'New York Knicks'),
  @('nba', 'Eastern Conference Winner', '2026-05-26', @('New York Knicks', 'Cleveland Cavaliers'), 'New York Knicks'),
  @('nba', 'Western Conference Winner', '2026-05-31', @('San Antonio Spurs', 'Oklahoma City Thunder'), 'San Antonio Spurs'),
  @('nfl', 'Super Bowl LX', '2026-02-08', @('Seattle Seahawks', 'New England Patriots'), 'Seattle Seahawks'),
  @('nfl', 'AFC Championship Winner', '2026-01-25', @('New England Patriots', 'Denver Broncos'), 'New England Patriots'),
  @('nfl', 'NFC Championship Winner', '2026-01-25', @('Seattle Seahawks', 'Los Angeles Rams'), 'Seattle Seahawks'))
  foreach ($c in $T) { $i = 0; $m = @{ n = $c[1]; sel = @($c[3] | % { $i++; @{ id = "s$i"; n = $_ } }) }; $r = Settle $c[0] $m ([datetime]$c[2])
    $got = if ($r) { $r.names -join ', ' } else { '(unsettled)' }; $pass = if ($c[4]) { $got -eq $c[4] } else { $r -and $r.names.Count -eq 4 }
    if ($pass) { $ok++ } else { $bad++ }; "$(if ($pass) { 'PASS' } else { 'FAIL' }) $($c[0]) $($c[1]) -> $got$(if ($r) { '  [' + $r.how + ']' })" }
  "SETTLE_TESTS $ok/$($T.Count) passed"; if ($bad) { exit 1 }; exit 0 }
# the run: every market with a settlement method whose expected end is within 30 days (or past), not yet settled
$F = [IO.File]::ReadAllText($fF) | ConvertFrom-Json; $Res = [ordered]@{}; if (Test-Path $rF) { (([IO.File]::ReadAllText($rF) | ConvertFrom-Json).res).PSObject.Properties | % { $Res[$_.Name] = $_.Value } }
$now = (Get-Date).ToUniversalTime(); $tried = 0; $new = 0
foreach ($c in $F.comps) { foreach ($e in $c.events) { $ends = [datetime]::Parse([string]$e.ends).ToUniversalTime(); if (($ends - $now).TotalDays -gt 30) { continue }
  foreach ($m in $e.markets) { if ($Res.Contains([string]$m.id) -or -not (Method $c.id $m.n)) { continue }; $tried++
    $r = Settle $c.id $m $ends; if ($r) { $r.comp = $c.id; $r.mn = $m.n; $r.ends = $e.ends; $Res[[string]$m.id] = $r; $new++ } } } }
$out = [ordered]@{ v = 1; at = $now.ToString('yyyy-MM-ddTHH:mm:ssZ'); res = $Res }
[IO.File]::WriteAllText("$rF.tmp", ($out | ConvertTo-Json -Depth 6 -Compress), [Text.UTF8Encoding]::new($false)); Move-Item -Force "$rF.tmp" $rF
"FUTURES_SETTLE checked=$tried newly-settled=$new total-settled=$($Res.Count)"
