# Runs on GitHub's servers (GitHub Actions, Windows runner) so the public site stays current with this computer off.
# Same scripts and the same checks as the local refresh jobs; a failed check publishes nothing (the site keeps its last version).
#   quick: standings + NBA season stats + PointsBet prices + live feed        full (-Full): the whole ESPN build first
param([switch]$Full)
$ErrorActionPreference = 'Stop'; $R = $PSScriptRoot; Set-Location $R
function Step($name, $file) { Write-Host "== $name"; & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $R $file); if ($LASTEXITCODE) { Write-Warning "$name failed (exit $LASTEXITCODE); keeping the last good data" } }
New-Item -ItemType Directory -Force (Join-Path $R 'data') | Out-Null
if ($Full) { Step 'ESPN build (rosters, squads, logs, fixtures, lines)' 'build-data.ps1' } else { Step 'Team data' 'team-data.ps1'; Step 'NBA season stats' 'nba-season.ps1' }
Step 'Soccer season (Premier League, Champions League)' 'soc-season.ps1'
Step 'PointsBet prices' 'pb-data.ps1'
# Special Bets: PointsBet futures, then the official results for the markets the app takes bets on (checked against last season's results first)
Step 'Futures prices' 'futures-data.ps1'
if ($Full) { Write-Host '== Futures settlement tests'; & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $R 'futures-settle.ps1') -Test 1; if ($LASTEXITCODE) { throw 'Futures settlement tests failed; not publishing' } }
Step 'Futures results' 'futures-settle.ps1'
# the results archive the leaderboard checks bets against: caught up on the last 3 weeks the first time, then every run adds its finals
if (-not (Test-Path "$R\data\results-archive.done")) { Write-Host '== Results archive (last 3 weeks)'; & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $R 'live-feed.ps1') -Days 21; if (-not $LASTEXITCODE) { [IO.File]::WriteAllText("$R\data\results-archive.done", (Get-Date).ToString('o')) } }
Step 'Live feed snapshot' 'live-feed.ps1'
# leaderboard: opted-in players' bets checked against the archive (node is on every GitHub runner); a failure keeps the last one
# the leaderboard and profile rules are tested first (lbcore.test.js); a failure stops the publish and the site keeps its last version
Write-Host '== Leaderboard rule tests'; & node (Join-Path $R 'src\lbcore.test.js'); if ($LASTEXITCODE) { throw 'Leaderboard rule tests failed; not publishing' }
Write-Host '== Leaderboard'; try { & node (Join-Path $R 'src\lb-agg.js'); if ($LASTEXITCODE) { Write-Warning "Leaderboard not updated (exit $LASTEXITCODE); keeping the last one" } } catch { Write-Warning "Leaderboard not updated: $_" }
# sanity checks before publishing
$d = [IO.File]::ReadAllText("$R\data\sideline-data.json") | ConvertFrom-Json
if (@($d.games).Count -lt 10 -or @($d.pl).Count -lt 400 -or @($d.soc).Count -lt 1000) { throw "Data check failed (games $(@($d.games).Count), NBA players $(@($d.pl).Count), soccer players $(@($d.soc).Count)); not publishing" }
$t = [IO.File]::ReadAllText("$R\data\teams.json") | ConvertFrom-Json
if (@($t.nba.PSObject.Properties).Count -lt 30 -or @($t.soc.PSObject.Properties).Count -lt 50) { throw 'Team data check failed; not publishing' }
& powershell -NoProfile -ExecutionPolicy Bypass -File "$R\assemble.ps1"; if ($LASTEXITCODE) { throw 'assemble failed' }
# the published site: the page, its version file, Google's verification file and the sitemap
$site = Join-Path (Split-Path $R) '_site'; New-Item -ItemType Directory -Force $site | Out-Null
Copy-Item "$R\netlify\index.html", "$R\netlify\version.json" $site -Force
Get-ChildItem (Split-Path $R) -File | ? { $_.Name -like 'google*.html' -or $_.Name -eq 'sitemap.xml' } | Copy-Item -Destination $site -Force
# the live ranking on the page uses the same results archive and the server's memory of each bet (lb-reg.json)
foreach ($x in 'results-archive.json', 'lb-reg.json', 'futures.json', 'futures-results.json') { if (Test-Path "$R\data\$x") { Copy-Item "$R\data\$x" $site -Force } }
if (Test-Path "$R\data\leaderboard.json") { Copy-Item "$R\data\leaderboard.json" $site -Force } else { [IO.File]::WriteAllText("$site\leaderboard.json", ('{"at":"' + (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ') + '","v":1,"users":[]}')) }
# player and team analytics files (full season logs, shot locations), loaded when a profile opens
if (Test-Path "$R\data\pa") { New-Item -ItemType Directory -Force "$site\pa" | Out-Null; Copy-Item "$R\data\pa\*.json" "$site\pa" -Force }
[IO.File]::WriteAllText("$site\.nojekyll", '')
Write-Host ("Built: {0} games, {1} NBA players, {2} soccer players, synced {3}" -f @($d.games).Count, @($d.pl).Count, @($d.soc).Count, $d.synced)
