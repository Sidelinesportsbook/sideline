# Runs on GitHub's servers (GitHub Actions, Windows runner) so the public site stays current with this computer off.
# Same scripts and the same checks as the local refresh jobs; a failed check publishes nothing (the site keeps its last version).
#   quick: standings + NBA season stats + PointsBet prices + live feed        full (-Full): the whole ESPN build first
param([switch]$Full)
$ErrorActionPreference = 'Stop'; $R = $PSScriptRoot; Set-Location $R
function Step($name, $file) { Write-Host "== $name"; & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $R $file); if ($LASTEXITCODE) { Write-Warning "$name failed (exit $LASTEXITCODE); keeping the last good data" } }
New-Item -ItemType Directory -Force (Join-Path $R 'data') | Out-Null
if ($Full) { Step 'ESPN build (rosters, squads, logs, fixtures, lines)' 'build-data.ps1' } else { Step 'Team data' 'team-data.ps1'; Step 'NBA season stats' 'nba-season.ps1' }
Step 'PointsBet prices' 'pb-data.ps1'
Step 'Live feed snapshot' 'live-feed.ps1'
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
[IO.File]::WriteAllText("$site\.nojekyll", '')
Write-Host ("Built: {0} games, {1} NBA players, {2} soccer players, synced {3}" -f @($d.games).Count, @($d.pl).Count, @($d.soc).Count, $d.synced)
