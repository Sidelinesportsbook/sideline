# Live scores, finals and box scores for the page's shared feed (feed/current). Small and fast, safe to run every few minutes.
# Covers every supported league (NBA, Premier League, Champions League): games in play, and games that finished in the last 36 hours,
# with team names, logos, the real completion time (ESPN play-by-play wallclock) and, for soccer games that went to extra time or
# penalties, the 90-minute score that soccer markets settle on.
# Writes data\feed.json atomically and prints one of: NO_GAMES (nothing in play or recently finished) or FEED_READY <live> <final>.
# Every final also goes into data\results-archive.json (kept for good), which the leaderboard checks bets against.
# -Days N: catch the archive up on the last N days only (feed.json is left alone).
param([int]$Days = 0)
$ErrorActionPreference = 'Stop'
$EB = 'https://site.api.espn.com/apis/site/v2/sports/'
$LG = [ordered]@{ nba = 'basketball/nba'; epl = 'soccer/eng.1'; ucl = 'soccer/uefa.champions'; fac = 'soccer/eng.fa'; lgc = 'soccer/eng.league_cup'; uel = 'soccer/uefa.europa' }
function Get-Json($u) { for ($i = 0; $i -lt 3; $i++) { try { return Invoke-RestMethod -TimeoutSec 20 $u } catch { Start-Sleep -Seconds (2 * ($i + 1)) } }; $null }
function Num($x) { $n = 0.0; if ([double]::TryParse([string]$x, [ref]$n)) { $n } else { 0 } }
function Side($cp) { [ordered]@{ n = $cp.team.displayName; ab = $cp.team.abbreviation; logo = [string]$cp.team.logo; sc = Num $cp.score; id = [string]$cp.team.id } }
$now = (Get-Date).ToUniversalTime(); $live = [ordered]@{}; $res = [ordered]@{}; $rp = [ordered]@{}; $ev = [ordered]@{}; $ppd = [ordered]@{}
foreach ($k in $LG.Keys) {
  $seen = @{}
  # ESPN dates follow the US day, so two days back covers every game that can have finished in the last 24 hours
  foreach ($dd in $(if ($Days) { -$Days } else { -2 })..0) {
    $sb = Get-Json "$EB$($LG[$k])/scoreboard?dates=$($now.AddDays($dd).ToString('yyyyMMdd'))"; if (-not $sb) { continue }
    foreach ($e in $sb.events) {
      if ($seen[$e.id]) { continue }; $seen[$e.id] = 1
      $st = $e.status.type; if ($st.state -eq 'pre' -and $st.name -notmatch 'POSTPONED|CANCELED') { continue }
      if (-not $Days -and ($now - [datetime]$e.date).TotalHours -gt 36) { continue }
      $c = $e.competitions[0]; $HOMEC = $c.competitors | ? homeAway -eq 'home'; $AWAYC = $c.competitors | ? homeAway -eq 'away'
      $gid = "e$($e.id)"
      $m = [ordered]@{ sp = $k; iso = $e.date; state = $st.state; stn = $st.name; det = [string]$st.shortDetail; done = [bool]$st.completed; h = Side $HOMEC; a = Side $AWAYC }
      if ($st.name -match 'POSTPONED|CANCELED|ABANDONED') { $ppd[$gid] = ($st.name -replace 'STATUS_', '').ToLower(); $m.state = 'void'; $ev[$e.id] = $m; continue }
      $box = [ordered]@{}; $end = $null; $reg = $null
      $s = Get-Json "$EB$($LG[$k])/summary?event=$($e.id)"
      if ($s -and $k -eq 'nba') {
        foreach ($tm in $s.boxscore.players) { $side = if ([string]$tm.team.id -eq [string]$HOMEC.team.id) { 'h' } else { 'a' }; $t0 = $tm.statistics[0]; $L = @($t0.labels)
          foreach ($a in $t0.athletes) { if ($a.didNotPlay -or -not $a.stats) { continue }; $v = $a.stats; $ix = { param($n) [array]::IndexOf($L, $n) }
            $box[$a.athlete.displayName] = [ordered]@{ pts = Num $v[(& $ix 'PTS')]; reb = Num $v[(& $ix 'REB')]; ast = Num $v[(& $ix 'AST')]; stl = Num $v[(& $ix 'STL')]; blk = Num $v[(& $ix 'BLK')]
              tpm = Num ([string]$v[(& $ix '3PT')] -split '-')[0]; min = Num $v[(& $ix 'MIN')]; tm = $side } } }
        $w = @($s.plays | ? { $_.wallclock } | % { $_.wallclock }); if ($w.Count) { $end = ($w | Sort-Object)[-1] }
      } elseif ($s) {
        foreach ($tm in $s.rosters) { $side = if ([string]$tm.team.id -eq [string]$HOMEC.team.id) { 'h' } else { 'a' }
          foreach ($a in $tm.roster) { if (-not $a.athlete -or -not $a.stats) { continue }; $mm = @{}; foreach ($x in $a.stats) { $mm[$x.name] = Num $x.value }
            if (-not $a.starter -and -not $a.subbedIn) { continue }
            $box[$a.athlete.displayName] = [ordered]@{ g = $mm.totalGoals; sa = $mm.goalAssists; ss = $mm.totalShots; sot = $mm.shotsOnTarget; ft = $mm.foulsCommitted; fw = $mm.foulsSuffered; yc = $mm.yellowCards; tm = $side } } }
        $w = @($s.keyEvents | ? { $_.wallclock } | % { $_.wallclock }); if ($w.Count) { $end = ($w | Sort-Object)[-1] }
        # extra time / penalties: soccer markets settle on the 90-minute score (first two halves of the official line score)
        if ($st.name -match 'AET|PEN') { $hc = $s.header.competitions[0].competitors | ? homeAway -eq 'home'; $ac = $s.header.competitions[0].competitors | ? homeAway -eq 'away'
          if (@($hc.linescores).Count -ge 2 -and @($ac.linescores).Count -ge 2) { $reg = @((Num $hc.linescores[0].displayValue) + (Num $hc.linescores[1].displayValue), (Num $ac.linescores[0].displayValue) + (Num $ac.linescores[1].displayValue)) } }
      }
      $hsc = Num $HOMEC.score; $asc = Num $AWAYC.score
      if ($st.state -eq 'in') { $live[$gid] = [ordered]@{ q = (($st.shortDetail, $st.detail, 'Live') | ? { $_ } | Select-Object -First 1) -replace ' - ', ' '; h = $hsc; a = $asc; p = $box } }
      elseif ($st.state -eq 'post') {
        if ($end) { $m.end = $end }; if ($reg) { $m.reg = $reg }
        # a soccer game decided after extra time only settles once its 90-minute score is confirmed
        if ($st.name -notmatch 'AET|PEN' -or $reg) { $res[$gid] = if ($reg) { $reg } else { @($hsc, $asc) } }
        if ($s) { $rp[$gid] = $box }
      }
      $ev[$e.id] = $m
    }
  }
}
# the results archive: every final and box score, by game, for checking leaderboard bets (never trimmed)
$ap = Join-Path $PSScriptRoot 'data\results-archive.json'; $arc = @{ res = @{}; rp = @{}; ppd = @{}; ev = @{} }
if (Test-Path $ap) { try { $o = [IO.File]::ReadAllText($ap) | ConvertFrom-Json; foreach ($k in 'res', 'rp', 'ppd', 'ev') { if ($o.$k) { foreach ($p in $o.$k.PSObject.Properties) { $arc[$k][$p.Name] = $p.Value } } } } catch { Write-Warning 'results archive unreadable; starting it again' } }
foreach ($id in @($ev.Keys)) { $m = $ev[$id]; $gid = "e$id"; if ($m.state -ne 'post' -and $m.state -ne 'void') { continue }
  $x = [ordered]@{ sp = $m.sp; iso = $m.iso }; if ($m.end) { $x.end = $m.end }; $arc.ev[$gid] = $x
  if ($res.Contains($gid)) { $arc.res[$gid] = $res[$gid] }; if ($rp.Contains($gid) -and $rp[$gid].Count) { $arc.rp[$gid] = $rp[$gid] }; if ($ppd.Contains($gid)) { $arc.ppd[$gid] = $ppd[$gid] } }
[IO.File]::WriteAllText("$ap.tmp", ($arc | ConvertTo-Json -Depth 7 -Compress), [Text.UTF8Encoding]::new($false)); Move-Item -Force "$ap.tmp" $ap
if ($Days) { "ARCHIVE_READY $($arc.res.Count) games"; exit 0 }
if (-not $live.Count -and -not $res.Count -and -not $ppd.Count) { 'NO_GAMES'; exit 0 }
$feed = [ordered]@{ at = $now.ToString('yyyy-MM-ddTHH:mm:ssZ'); upd = 'Live scores from ESPN'; inj = [ordered]@{}; live = $live; res = $res; rp = $rp; ev = $ev; ppd = $ppd }
$out = Join-Path $PSScriptRoot 'data\feed.json'; $tmp = "$out.tmp"
[IO.File]::WriteAllText($tmp, ($feed | ConvertTo-Json -Depth 7 -Compress), [Text.UTF8Encoding]::new($false)); Move-Item -Force $tmp $out
"FEED_READY $($live.Count) $($res.Count)"
