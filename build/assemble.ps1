# Builds sideline.html = new shell (src/head.html) + baked data + betting engine (src/old.html script) + new modules.
$ErrorActionPreference = 'Stop'; $R = $PSScriptRoot
$O = [IO.File]::ReadAllLines("$R\src\old.html")
function L([int]$a, [int]$b) { $O[($a - 1)..($b - 1)] }
function Rep([string]$s, [string]$from, [string]$to) { if (-not $s.Contains($from)) { throw "pattern not found: $($from.Substring(0,[math]::Min(60,$from.Length)))" }; $s.Replace($from, $to) }
$src = { param($f) [IO.File]::ReadAllText("$R\src\$f") }

$bd = 'Object.values(TM).forEach(t=>CODES[t.n]=t.ab);const lum=h=>{const n=parseInt(h,16);return((n>>16)*299+((n>>8&255)*587)+(n&255)*114)/1000};
const bd=(n,z=28)=>{const u=logoUrl(n);return u?`<span class="tlg${logoOk(u)?" ok":""}" style="width:${z}px;height:${z}px">${bd0(n,z)}<img src="${u}" data-n="${String(n).replace(/[&<>"]/g,"")}" alt="" width="${z}" height="${z}" decoding="async"></span>`:bd0(n,z)};const bd0=(n,z=28)=>{const t=TBY[n]||socCol(n),h=hue(n),f=t?"#"+t.c:`hsl(${h} 55% 36%)`,s=t?"#"+(t.c2||"ffffff"):`hsl(${h} 70% 68%)`,tx=t&&lum(t.c)>170?"#111":"#fff";return`<svg class="lg" width="${z}" height="${z}" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 2 36 8v12c0 10-7 16-16 19C11 36 4 30 4 20V8z" fill="${f}" stroke="${s}" stroke-width="2"/><text x="20" y="25" text-anchor="middle" font-size="12" font-weight="800" fill="${tx}" font-family="system-ui">${CODES[n]||sh(n).slice(0,3).toUpperCase()}</text></svg>`};'
$ddp = 'const ddp=(p,t)=>{const a=pge("pts",p.mu.pts,10),b=pge("reb",p.mu.reb,10),c=pge("ast",p.mu.ast,10),m=t?a*b*c:a*b+a*c+b*c-2*a*b*c,r=t?p.mu.tdr:p.mu.ddr;return r==null?m:Math.min(.97,Math.max(.004,.7*r+.3*m))};'
$gof = 'const GM=Object.fromEntries(G.map(g=>[g.id,g])),gOf=tm=>G.filter(g=>!g.leg&&(g.h===tm||g.a===tm)&&!RES[g.id]&&Date.now()-g.ts<36e5*5).sort((a,b)=>a.ts-b.ts)[0];'
$tabs = 'function renderTabs(){$("#tabs").style.display=view?"none":"";const ks=liveSports();if(ks.length&&!ks.includes(cur))cur=ks[0];$("#tabs").innerHTML=hero()+`<input id="qs" placeholder="Search a team or player" aria-label="Search a team or player" value="${esc(window.__q||"")}">`+`<div class="tm" id="feedupd">${liveStatus()}</div>`+''<div class="tabs">''+ks.map(k=>`<button data-tab="${k}" class="${k===cur?"on":""}">${SP[k].n}<i>${G.filter(g=>g.sp===k&&!g.leg&&!lock(g)).length}</i></button>`).join("")+"</div>"+("")}'
$stats = 'const statsTab=(tp,g)=>[g.a,g.h].map(tm=>{const ps=tp.filter(x=>x.p.tm===tm);return`<div class="card"><div class="pn">${bd(tm,24)}${tlink(tm)}</div>${ps.length?ps.map(({p})=>`<div class="kv"><span>${(NBAP[p.n]||SOCP[p.n])?`<button class="pnm" data-ply="${esc(p.n)}">${p.n}</button>`:`<b>${p.n}</b>`} <small class="tm">${p.pos}${INJ[p.n]?" · "+INJ[p.n].toUpperCase():""}</small></span><span class="tm" style="text-align:right">${statSum(p)}</span></div>`).join(""):`<div class=''tm''>No player markets until the ${sh(tm)} play their first game this season. Team bets (result, line and totals) are open now.</div>`}</div>`}).join("");'

$js = [System.Collections.Generic.List[string]]::new()
$js.Add((& $src 'pre.js'))
$LV = [IO.File]::ReadAllLines("$R\src\live-lines.txt")
$js.AddRange([string[]](L 168 168)); $js.Add($LV[0]); $js.Add('const sh=n=>SHN[n]||(/ (Town|City|United|Albion|Hotspur|Rovers|Wanderers|County|Athletic|FC|AFC)$/.test(n)&&!/^Manchester/.test(n)?n.replace(/ \S+$/,""):n.split(" ").pop());'); $js.AddRange([string[]](L 170 171)); $js.Add($bd); $js.AddRange([string[]](L 173 179)); $js.Add($ddp)
$js.AddRange([string[]](L 181 389)); $js.Add((& $src 'nba.js')); $js.AddRange([string[]]((L 392 411) | % { $_.Replace('if(m.g!==undefined){m.ss=m.ss??','if(m.g!==undefined&&!m._r){m.ss=m.ss??') }))
$js.Add((& $src 'games.js')); $js.Add((L 424 424)); $js.Add($gof)
$rest = (L 426 773) -join "`n"
$rest = Rep $rest ((L 449 449)) $tabs
$rest = Rep $rest ((L 462 462)) $stats
$rest = Rep $rest 'if(dtab!=="main"&&dtab!=="stats"&&' 'if(dtab!=="main"&&dtab!=="stats"&&dtab!=="ros"&&'
$rest = Rep $rest '<button data-dt="stats" class="${dtab==="stats"?"on":""}">Player stats</button>' '<button data-dt="stats" class="${dtab==="stats"?"on":""}">Player stats</button>${g.sp==="nba"?`<button data-dt="ros" class="${dtab==="ros"?"on":""}">Rosters</button>`:SP[g.sp].m==="soc"?`<button data-dt="ros" class="${dtab==="ros"?"on":""}">Squads</button>`:""}'
$rest = Rep $rest 'if(dtab==="stats")body=statsTab(tp,g);else if(dtab==="main"){' 'if(dtab==="stats")body=statsTab(tp,g);else if(dtab==="ros")body=g.sp==="nba"?rosTab(g):socTab(g);else if(dtab==="main"){'
$rest = Rep $rest 'map(k=>p.mu[k]+" "+SH[k]).join(" · ")+" — matchup projection: "' 'map(k=>f1(p.mu[k])+" "+SH[k]).join(" · ")+" · matchup projection "'
$rest = Rep $rest 'Season baseline (est.): ${base}' '${statLine(p,dtab,m)}'
$rest = Rep $rest '<span>${p.n}</span><small class="tm">${p.pos} · ${sh(p.tm)}' '${(NBAP[p.n]||SOCP[p.n])?`<button class="pnm" data-ply="${esc(p.n)}">${p.n}</button>`:`<span>${p.n}</span>`}<small class="tm">${p.pos} · ${sh(p.tm)}'
$rest = Rep $rest 'gs=G.filter(g=>g.sp===cur&&' 'gs=G.filter(g=>!g.leg&&g.sp===cur&&Date.now()-g.ts<36e5*5&&'
$rest = Rep $rest '$("#games").innerHTML=gs.map(' '$("#games").innerHTML=plSearch(ql)+(gs.map('
$rest = Rep $rest '${g.bk?" · bookmaker lines":""}' '${g.bk?" · "+(g.src||"DraftKings")+" line":""}'
$rest = Rep $rest '.join("")||"<div class=''card''>No upcoming games.</div>"}' '.join("")||"<div class=''card''>No upcoming games.</div>")}'
$rest = Rep $rest 'if(f.inj)INJ=f.inj;if(f.bkp)Object.assign(BKP,f.bkp);' 'if(f.inj&&FEEDAT>Date.parse(DATA.synced))Object.assign(INJ,f.inj);'
$rest = Rep $rest 'c.doc("feed/roster").onSnapshot(q=>{if(q.exists){RO=q.data();syncRost();try{render()}catch(e){}}},()=>{});c.doc("feed/soccer").onSnapshot(q=>{if(q.exists){SO=q.data();syncRost();try{render()}catch(e){}}},()=>{})' ''
$rest = [regex]::new('nba:\{[^}]*\}').Replace($rest, 'nba:{}', 1)
$rest = [regex]::new('soc:\{[^}]*\}').Replace($rest, 'soc:{}', 1)
$rest = Rep $rest 'settleAll();render();
setInterval' 'settleAll();
setInterval'
$rest = Rep $rest 'const SEASON={current:"2026-27",target:"2027-28",targetPublished:false};' ''
$rest = Rep $rest ((L 435 435)) $LV[1]
# daily spin: once used, the button closes the wheel and says when the next spin unlocks
$rest = Rep $rest '<button class="go" id="dospin"${can?"":" disabled"}>${can?"Spin – it’’s free":"Come back tomorrow"}</button>' '${can?`<button class="go" id="dospin">Spin – it’’s free</button>`:`<button class="go" data-close="1">Come back tomorrow · next spin in ${untilTomorrow()}</button>`}'
$rest = Rep $rest 'if(b)b.textContent="Come back tomorrow";render()' 'if(b){b.disabled=false;b.removeAttribute("id");b.dataset.close="1";b.textContent="Come back tomorrow · next spin in "+untilTomorrow()}render()'
$rest = Rep $rest '${BKP[p.n+"|"+dtab]?" · book":""}' '${BKP[p.n+"|"+dtab]?" · PointsBet":""}'
# cash out: a settled state of its own ("cash"), paid out at the accepted offer
$rest = Rep $rest 'pay=b.st==="won"?b.stake*b.odds:b.st==="ref"||b.st==="void"?b.stake:0,nm={open:"LIVE",won:"WON",lost:"LOST",ref:"REFUNDED",void:"VOID"}[b.st];' 'pay=b.st==="won"?b.stake*b.odds:b.st==="cash"?b.co.amt:b.st==="ref"||b.st==="void"?b.stake:0,nm={open:"LIVE",won:"WON",lost:"LOST",ref:"REFUNDED",void:"VOID",cash:"CASHED OUT"}[b.st];'
$rest = Rep $rest 'b.st==="lost"?"Paid out":"Refunded"' 'b.st==="lost"?"Paid out":b.st==="cash"?"Cashed out":"Refunded"'
$rest = Rep $rest '<div class="hint">${OB.has(i)?"Hide tracking"' '${coRow(b,i)}<div class="hint">${OB.has(i)?"Hide tracking"'
$rest = Rep $rest ':b.st==="ref"?`<div class="tm" style="font-size:11px;margin-top:6px">Missed by one leg – stake refunded</div>`:""}</div>`}' ':b.st==="ref"?`<div class="tm" style="font-size:11px;margin-top:6px">Missed by one leg – stake refunded</div>`:b.st==="cash"?`<div class="tm" style="font-size:11px;margin-top:6px">Cashed out for ${$$(b.co.amt)} on ${fmt(b.co.t)} · <b class="${b.co.amt-b.stake>=0?"won":"lost"}">${sgn(b.co.amt-b.stake)}</b></div>`:""}</div>`}'
$rest = Rep $rest 'pr=b.st==="won"?b.stake*b.odds-b.stake:b.st==="lost"?-b.stake:0;' 'pr=b.st==="won"?b.stake*b.odds-b.stake:b.st==="cash"?b.co.amt-b.stake:b.st==="lost"?-b.stake:0;'
$rest = Rep $rest 'if(b.st==="won"||b.st==="lost"){o.np+=pr;o.pl.push(pr);o.plt.push((b.legs.length>1?"Multi":"Single")+" · "+(b.st==="won"?"won +"+$$(pr):"lost "+$$(-pr))' 'if(b.st==="won"||b.st==="lost"||b.st==="cash"){o.np+=pr;o.pl.push(pr);o.plt.push((b.legs.length>1?"Multi":"Single")+" · "+(b.st==="cash"?"cashed out "+sgn(pr):b.st==="won"?"won +"+$$(pr):"lost "+$$(-pr))'
# settlement: a leg is void only for a real reason (postponed/cancelled game, or a player who did not play once the box score exists);
# a game that is merely missing from the fixture list, or a final without a box score yet, stays pending
$rest = Rep $rest 'if(!GM[l.g]||(PPD&&PPD[l.g])){l.r="v";ch=true;return}' 'if(PPD&&PPD[l.g]){l.r="v";l.vr=typeof PPD[l.g]==="string"?PPD[l.g]:"postponed or cancelled";ch=true;return}if(!GM[l.g]&&!RES[l.g]&&!LIVE[l.g])return;'
$rest = Rep $rest 'if(x===undefined||isNaN(x)){l.r="v";ch=true;return}' 'if(!RP[l.g]||!Object.keys(RP[l.g]).length)return;if(x===undefined||isNaN(x)){l.r="v";l.vr="player did not play";ch=true;return}'
$rest = Rep $rest 'if(!g)return{st:"void",lab:"Void",pct:0,txt:"This game is no longer listed."};' 'if(!g)return{st:l.r==="v"?"void":"idle",lab:l.r==="v"?"Void":"Pending",pct:0,txt:l.r==="v"?"Void"+(l.vr?": "+l.vr:""):"Waiting for the final result."};'
$rest = Rep $rest 'if(l.m==="p"&&INJ[l.pl]==="out"&&!r){l.r="v";ch=true;return}' 'if(l.m==="p"&&INJ[l.pl]==="out"&&!r&&!lv){l.r="v";l.vr="player ruled out";ch=true;return}'
# profile record: Won / Lost / Refunded / Cashed out / Void. Cash-outs are their own count, never "void"
$rest = Rep $rest 'ref:0,vd:0,open:0' 'ref:0,vd:0,co:0,open:0'
$rest = Rep $rest 'else if(b.st==="ref")o.ref++;else o.vd++;' 'else if(b.st==="ref")o.ref++;else if(b.st==="cash")o.co++;else o.vd++;'
$rest = Rep $rest '["Refunded",o.ref],["Void",o.vd]' '["Refunded",o.ref],["Cashed out",o.co],["Void",o.vd]'
# no username editor on the profile page (usernames are chosen once at sign-up)
$rest = Rep $rest '<div class="card"><h2>Username</h2><input id="nn" value="${S.name||""}" maxlength="16"><button class="go" id="svn">Save username</button><div class="msg" id="nmsg"></div></div>`}' '${(!DB||window.SL_NETLIFY)?`<div class="card"><h2>Account</h2><div class="kv"><span><b>${esc(dn(S.name))}</b><small class="tm" style="display:block">${window.SL_NETLIFY&&DB?"Log back in on any device with your username and PIN.":"Saved on this device. Log back in here with the same username to pick up where you left off."}</small></span><button class="lob" data-logout="1">Log out</button></div></div>`:""}`}'
# sign-up: Google (via Claude account, syncs devices) or a username saved in this browser
$rest = Rep $rest ((L 588 588)) ([IO.File]::ReadAllText("$R\src\gate.txt"))
$rest = Rep $rest ' · ${DB?"Synced to your account":"Saved on this browser"}' ''
$rest = Rep $rest '$("#np").textContent=S.name?dn(S.name):"Profile";' '$("#np").textContent="Profile";'
# team names open team profiles: game list rows and the game page header
$rest = Rep $rest '<div class="tr">${bd(g.a)}${g.a}${sc?' '<div class="tr">${bd(g.a)}${tlink(g.a)}${sc?'
$rest = Rep $rest '<div class="tr">${bd(g.h)}${g.h}${sc?' '<div class="tr">${bd(g.h)}${tlink(g.h)}${sc?'
$rest = Rep $rest '<div>${bd(g.a,56)}<br>${g.a}</div>' '<div><button class="tbig" data-team="${esc(g.a)}">${bd(g.a,56)}<br>${g.a}</button></div>'
$rest = Rep $rest '<div>${bd(g.h,56)}<br>${g.h}</div>' '<div><button class="tbig" data-team="${esc(g.h)}">${bd(g.h,56)}<br>${g.h}</button></div>'
# player names in bet cards, tracking and the slip open the player page
$rest = Rep $rest '<div><b>${l.d}</b><small class="tm" style="display:block">' '<div><b>${legD(l)}</b><small class="tm" style="display:block">'
$rest = Rep $rest '<div class="ldh"><b>${l.d}</b>' '<div class="ldh"><b>${legD(l)}</b>'
$rest = Rep $rest '<div class="leg"><div><b>${x.d}</b>' '<div class="leg"><div><b>${legD(x)}</b>'
$rest = Rep $rest '<span class="lm">${l.r==="w"?"✓"' '<span class="lm ${l.r==="w"?"lw":l.r==="l"?"ll":""}">${l.r==="w"?"✓"'
# profile: six clear KPIs, then the redrawn charts; the old stretched SVG charts are no longer used
$rest = Rep $rest ((L 574 574)) '${sec("Overview",[["Balance",$$(S.bal)],["Profit / loss",sgn(o.np),o.np>0?"won":o.np<0?"lost":""],["ROI",st?(roi>=0?"+":"")+roi.toFixed(1)+"%":"–",st&&roi>0?"won":st&&roi<0?"lost":""],["Win rate",st?Math.round(o.w/st*100)+"%":"–"],["Staked",$$(o.stake)],["Returned",$$(S.bets.filter(b=>b.st!=="open").reduce((q,b)=>q+b.stake,0)+o.np)]])}
<h2 style="margin-top:14px">Performance</h2>${plCharts(o)}'
$rest = Rep $rest (((L 579 581)) -join "`n") ''
# ranks follow winning bets, with a hint for the next rank
$rest = Rep $rest '<span class="chip c-open">${o.n>=100?"LEGEND":o.n>=25?"PRO":o.n>=5?"REGULAR":"ROOKIE"}</span>' '<span class="chip c-open">${o.w>=250?"LEGEND":o.w>=75?"PRO":o.w>=15?"REGULAR":"ROOKIE"}</span>${(()=>{const t=[[15,"Regular"],[75,"Pro"],[250,"Legend"]].find(x=>o.w<x[0]);return t?`<span class="tm" style="font:500 12px var(--fb);margin-left:4px">${t[0]-o.w} more winning bet${t[0]-o.w===1?"":"s"} to ${t[1]}</span>`:""})()}'
# settled legs read as final results, not "now"
$rest = Rep $rest 'txt:`${x} ${unit} now · ${under?"stay under "+l.line:"needs "+need+(l.s==="k"?"+":" or more")}${under||x>=need?"":" · "+(need-x)+" to go"}`' 'txt:r||fin?`${x} ${unit} final · ${under?"line was under "+l.line:"needed "+need+(l.s==="k"?"+":" or more")}`:`${x} ${unit} now · ${under?"stay under "+l.line:"needs "+need+(l.s==="k"?"+":" or more")}${under||x>=need?"":" · "+(need-x)+" to go"}`'
$rest = Rep $rest 'txt:`${tn} ${d>0?"leading by "+d:d===0?"level":"trailing by "+(-d)}`' 'txt:`${tn} ${r||fin?(d>0?"won by "+d:d===0?"drew":"lost by "+(-d)):(d>0?"leading by "+d:d===0?"level":"trailing by "+(-d))}`'
$rest = Rep $rest '${d>0?"Covering by "+d.toFixed(1):"Needs "+(-d+.5).toFixed(1)+" more"} (score' '${d>0?(r||fin?"Covered by ":"Covering by ")+d.toFixed(1):r||fin?"Missed by "+(-d).toFixed(1):"Needs "+(-d+.5).toFixed(1)+" more"} (score'
$rest = Rep $rest 'else if(d.tab){cur=d.tab;view=null;renderTabs();renderGames()}' 'else if(d.tab){cur=d.tab;view=null;window.__q="";renderTabs();renderGames()}'
$js.Add($rest); $js.Add((& $src 'soc.js')); $js.Add((& $src 'charts.js')); $js.Add((& $src 'team.js')); $js.Add((& $src 'cashout.js')); $js.Add((& $src 'ui.js')); $js.Add((& $src 'results.js')); $js.Add((& $src 'gchart.js')); $js.Add((& $src 'version.js')); $js.Add((& $src 'match.js')); $js.Add((& $src 'profiles.js')); $js.Add((& $src 'live.js')); $js.Add((& $src 'slip.js')); $js.Add((& $src 'pricing.js')); $js.Add((& $src 'polish.js')); $js.Add((& $src 'auth.js'))

$data = [IO.File]::ReadAllText("$R\data\sideline-data.json").Replace('</', '<\/')
$pbj = if (Test-Path "$R\data\pb.json") { [IO.File]::ReadAllText("$R\data\pb.json").Replace('</', '<\/') } else { '{"events":[]}' }
$fdj = if (Test-Path "$R\data\feed.json") { [IO.File]::ReadAllText("$R\data\feed.json").Replace('</', '<\/') } else { 'null' }
$tmj = if (Test-Path "$R\data\teams.json") { [IO.File]::ReadAllText("$R\data\teams.json").Replace('</', '<\/') } else { '{"nba":{},"soc":{},"tables":{}}' }
# code fingerprint: changes only when the page code changes (not on data refreshes), so the "new version" bar means a real update
$code = (& $src 'head.html') + ($js -join "`n")
$BUILD = -join ([Security.Cryptography.SHA1]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($code)) | Select-Object -First 6 | % { $_.ToString('x2') })
$sph = if (Test-Path "$R\data\soc-photos.json") { [IO.File]::ReadAllText("$R\data\soc-photos.json").Replace('</', '<\/') } else { '{}' }
# the "what's new" list travels with the code (build\changelog.json in the cloud build), so new fixes always announce themselves
$chf = if (Test-Path "$R\changelog.json") { "$R\changelog.json" } else { "$R\data\changelog.json" }
$scf = if (Test-Path "$R\soc-colors.json") { "$R\soc-colors.json" } else { "$R\data\soc-colors.json" }
$scj = if (Test-Path $scf) { [IO.File]::ReadAllText($scf).Replace('</', '<\/') } else { '{}' }
$chj = if (Test-Path $chf) { [IO.File]::ReadAllText($chf).Replace('</', '<\/') } else { '[]' }
$html = (& $src 'head.html') + "`n<script id=""bld"" type=""text/plain"">$BUILD</script>`n<script id=""chg"" type=""application/json"">$chj</script>`n<script id=""scol"" type=""application/json"">$scj</script>`n<script id=""sph"" type=""application/json"">$sph</script>`n<script id=""seed"" type=""application/json"">$data</script>`n<script id=""tmd"" type=""application/json"">$tmj</script>`n<script id=""pbd"" type=""application/json"">$pbj</script>`n<script id=""fdd"" type=""application/json"">$fdj</script>`n<script>`n" + ($js -join "`n") + "`n</script>`n"
[IO.File]::WriteAllText("$R\sideline.html", $html, ([Text.UTF8Encoding]::new($false)))
New-Item -ItemType Directory -Force "$R\netlify" | Out-Null
# Netlify only: Firebase Google sign-in when data\firebase-config.json exists (public web config, safe in frontend code)
$fbHead = ""; $fbCfg = Join-Path $R 'data\firebase-config.json'
$fbTail = ""
if (Test-Path $fbCfg) { $fbHead = "<script src=""https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js""></script><script src=""https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js""></script>`n<script>window.FIREBASE_CONFIG=" + [IO.File]::ReadAllText($fbCfg).Trim() + ";`n" + [IO.File]::ReadAllText("$R\src\netlify-acct-head.js") + "</script>`n"
  $fbTail = "<script>`n" + [IO.File]::ReadAllText("$R\src\netlify-acct-tail.js") + "</script>`n" }
$full = "<!doctype html>`n<html lang=""en""><head><meta charset=""utf-8""><meta name=""viewport"" content=""width=device-width,initial-scale=1,viewport-fit=cover"">`n<meta name=""description"" content=""Sideline Sportsbook: free play-money betting on the NBA, Premier League and Champions League with real odds, live scores, box scores and player stats."">`n<link rel=""canonical"" href=""https://sidelinesportsbook.github.io/sideline/"">`n<meta property=""og:title"" content=""Sideline Sportsbook - Play Money Betting"">`n<meta property=""og:description"" content=""Free play-money sportsbook for the NBA, Premier League and Champions League. Real odds, live scores and player stats."">`n<meta property=""og:url"" content=""https://sidelinesportsbook.github.io/sideline/"">`n<meta property=""og:type"" content=""website"">`n<meta name=""twitter:card"" content=""summary"">`n" + $fbHead + $html.Replace("<header>", "</head><body>`n<header>") + $fbTail + "</body></html>`n"
[IO.File]::WriteAllText("$R\netlify\index.html", $full, ([Text.UTF8Encoding]::new($false)))
$fix = try { (ConvertFrom-Json $chj)[0].t } catch { "" }
[IO.File]::WriteAllText("$R\netlify\version.json", (@{ v = $BUILD; fix = $fix } | ConvertTo-Json -Compress), ([Text.UTF8Encoding]::new($false)))
"sideline.html {0:N0} KB, netlify/index.html written" -f ($html.Length / 1KB)
