# Soccer player photos (ESPN publishes none for soccer). Source: Wikimedia Commons images linked from Wikidata.
# A photo is only used when the Wikidata entry is verifiably the same person:
#   1. its ESPN FC player id (P3681) equals our ESPN athlete id, or
#   2. it is a footballer with exactly our player's name AND a current club (member of sports team, no end date) matching ours.
# Writes data\soc-photos.json  { "<espn id>": "<Commons file name>" } atomically. Prints PHOTOS <count> of <players>.
$ErrorActionPreference = 'Stop'
$UA = @{ 'User-Agent' = 'SidelineSportsbook/1.0 (overover416@gmail.com)' }
function Sparql([string]$q) { for ($i = 0; $i -lt 3; $i++) { try {
      $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 120 -Method Post -Headers $UA -ContentType 'application/x-www-form-urlencoded' -Body ('format=json&query=' + [uri]::EscapeDataString($q)) 'https://query.wikidata.org/sparql'
      return ([Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json).results.bindings } catch { Start-Sleep -Seconds (3 * ($i + 1)) } }; @() }
function File($u) { [uri]::UnescapeDataString(($u -split 'Special:FilePath/')[1]) }
function Norm($s) { $s = ([string]$s).ToLowerInvariant().Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', ''; ($s -replace '\b(f\.?c\.?|a\.?f\.?c\.?|c\.?f\.?|s\.?c\.?|club|de|cf|fc|afc|calcio|1907|1909|1899|1904|1910|1913|ssc|ac|as|us|sv|vfb|vfl|tsg|rc|ogc|stade|olympique)\b', ' ' -replace '[^a-z0-9 ]', ' ' -replace '\s+', ' ').Trim() }
function SameClub($a, $b) { $x = Norm $a; $y = Norm $b; if (-not $x -or -not $y) { return $false }; if ($x -eq $y -or $x.Contains($y) -or $y.Contains($x)) { return $true }
  $wa = $x -split ' ' | ? { $_.Length -gt 3 -and $_ -notin 'united', 'city', 'real', 'athletic', 'sporting', 'borussia', 'inter' }; $wb = $y -split ' '; [bool]($wa | ? { $wb -contains $_ }) }
$data = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'data\sideline-data.json')) | ConvertFrom-Json
$pl = @($data.soc | ? { $_.id }); $out = [ordered]@{}
# 1. by ESPN id
foreach ($b in (Sparql 'SELECT ?espn ?img WHERE { ?p wdt:P3681 ?espn ; wdt:P18 ?img . }')) { $out[[string]$b.espn.value] = File $b.img.value }
$byId = @{}; foreach ($p in $pl) { if ($out.Contains([string]$p.id)) { $byId[[string]$p.id] = $out[[string]$p.id] } }
$res = [ordered]@{}; foreach ($k in $byId.Keys) { $res[$k] = $byId[$k] }
# 2. by exact name + current club, in batches
$todo = @($pl | ? { -not $res.Contains([string]$_.id) }); $seen = @{}
for ($i = 0; $i -lt $todo.Count; $i += 150) {
  $chunk = $todo[$i..([math]::Min($i + 149, $todo.Count - 1))]
  $vals = ($chunk | % { '"' + ($_.n -replace '\\', '' -replace '"', '') + '"@en' } | Select-Object -Unique) -join ' '
  $q = "SELECT ?name ?img ?club WHERE { VALUES ?name { $vals } { ?p rdfs:label ?name } UNION { ?p skos:altLabel ?name } ?p wdt:P106 wd:Q937857 ; wdt:P18 ?img . ?p p:P54 ?st . ?st ps:P54 ?t . FILTER NOT EXISTS { ?st pq:P582 ?end } ?t rdfs:label ?club . FILTER(LANG(?club) = 'en') }"
  $rows = Sparql $q; $byName = @{}
  foreach ($b in $rows) { $n = $b.name.value; if (-not $byName.ContainsKey($n)) { $byName[$n] = [Collections.Generic.List[object]]::new() }; $byName[$n].Add(@((File $b.img.value), $b.club.value)) }
  foreach ($p in $chunk) { $c = $byName[$p.n]; if (-not $c) { continue }
    $club = if ($p.tm) { $p.tm } else { '' }; $ok = @($c | ? { SameClub $_[1] $club } | % { $_[0] } | Select-Object -Unique)
    if ($ok.Count -eq 1) { $res[[string]$p.id] = $ok[0] } }
  Start-Sleep -Milliseconds 400
}
$f = Join-Path $PSScriptRoot 'data\soc-photos.json'
[IO.File]::WriteAllText("$f.tmp", ($res | ConvertTo-Json -Compress), [Text.UTF8Encoding]::new($false)); Move-Item -Force "$f.tmp" $f
"PHOTOS $($res.Count) of $($pl.Count) (by ESPN id $($byId.Count))"
