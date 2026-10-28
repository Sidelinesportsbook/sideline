/* ---------- rosters, squads and player pages (NBA + soccer) ---------- */
G.forEach(g=>{if(g.eid)EVID[g.id]=g.eid});
/* baked finals + box scores settle bets even where live fetches are blocked */
(DATA.res||[]).forEach(r=>{const h=SAL0[r.h]||r.h,a=SAL0[r.a]||r.a,t=Date.parse(r.iso);let g=G.find(x=>x.sp[0]===String(r.sp)[0]&&Math.abs(x.ts-t)<20*36e5&&(x.eid===r.id||(teq(x.h,h)&&teq(x.a,a))));
 /* a finished game that has dropped off the fixture list stays known (unlisted), so bets on it settle against its real result */
 if(!g){const sp=SP[r.sp]?String(r.sp):["nba","nfl","epl","ucl"].find(s=>s[0]===String(r.sp)[0]&&(s!=="nfl"||String(r.sp)==="nfl"))||String(r.sp);   /* an exact competition code first: "uel" must never become "ucl" */g={id:"e"+r.id,eid:r.id,sp,h,a,iso:r.iso,ts:t,leg:true,p:.5,pd:0};G.push(g);GM[g.id]=g}
 if(LR[g.id])return;
 if(r.pp){PPD[g.id]=1;return}LR[g.id]=[r.sc[0],r.sc[1]];const bx={};
 Object.entries(r.box||{}).forEach(([n,v])=>{const s=String(v).split("|").map(Number),k=PN[pkey(n)]||n;bx[k]=r.sp==="nba"?{pts:s[0],reb:s[1],ast:s[2],stl:s[3],blk:s[4],tpm:s[5],min:s[6]}:{g:s[0],sa:s[1],ss:s[2],sot:s[3],ft:s[4],fw:s[5],yc:s[6]}});
 LRP[g.id]=bx;DONE[g.id]=1});
/* one-off audit: re-settle legs that were voided only because their game had dropped off the fixture list.
   Each corrected bet keeps an audit entry (previous status, amount reversed, time) and is never corrected twice. */
const legPaid=b=>b.st==="won"?r2(b.stake*b.legs.reduce((q,l)=>l.r==="w"?q*l.odds:q,1)*(b.bx||1)):b.st==="ref"||b.st==="void"?b.stake:0;
function fixVoids(){let ch=false;S.bets.forEach(b=>{if(b.fixV1||!["void","ref","won"].includes(b.st))return;
 const bad=b.legs.filter(l=>l.r==="v"&&!l.vr);if(!bad.length){b.fixV1=1;return}
 if(!bad.every(l=>GM[l.g]||RES[l.g]||LIVE[l.g]))return;   /* only once the game is known again (listed, in play or final); until then nothing changes */
 const paid=legPaid(b);(b.audit=b.audit||[]).push({t:Date.now(),was:b.st,reversed:paid,legs:bad.map(l=>l.d),note:"Legs had been voided because their game dropped off the fixture list; re-settled against the final result."});
 bad.forEach(l=>{l.r=null});b.odds=r2(b.legs.reduce((q,l)=>q*l.odds,1)*(b.bx||1));b.st="open";b.fixV1=1;S.bal=r2(S.bal-paid);ch=true});
 if(ch)save();return ch}
const _settle0=settleAll;settleAll=function(){fixVoids();_settle0()};
const _betCard0=betCard;betCard=function(b,i){const h=_betCard0(b,i);if(!b.audit||!b.audit.length)return h;const a=b.audit[b.audit.length-1];
 return h.replace(/<\/div>\s*$/,`<div class="tm" style="font-size:11px;margin-top:6px">Corrected ${new Date(a.t).toLocaleDateString()}: this bet was wrongly ${a.was==="won"?"settled":"voided"} (${$$(a.reversed)} reversed) and reopened to settle on the real result.</div></div>`)};
mergeLive();settleAll();
/* PointsBet prices replace modelled player prices wherever PointsBet publishes that exact selection */
const _pleg0=pleg;pleg=function(i,st,s,l,gid){const x=_pleg0(i,st,s,l,gid),g=GM[x.g],p=PLY[i],pr=g&&g.pb?pbPx(g,p.n,st,s,l):null;if(pr){x.odds=r2(pr);x.src="PointsBet"}
 else if((st==="dd"||st==="td")&&PBDD[p.n]&&PBDD[p.n][st]){x.odds=r2(PBDD[p.n][st]);x.src="PointsBet"}else if(BKP[p.n+"|"+st]&&BKP[p.n+"|"+st][0]===l&&(s==="o"||s==="u"))x.src="PointsBet";return x};
/* season per competition: European club seasons run 2026-27; calendar-year leagues are "2026" */
const CAL=new Set(["nor.1","swe.1","fin.1","isl.1","irl.1","usa.1","bra.1","arg.1","jpn.1","kor.1","chn.1","kaz.1","aze.1"]);
const socSeason=src=>CAL.has(src)?"2026":SEASON.current,nbaSeasonOf=d=>d>="2026-10-01"?SEASON.current:"2025-26";
function statSum(p){const nb=NBAP[p.n];if(nb){const c=nb.c27;return c?`${c.gp} GP · ${f1(c.pts)} pts · ${f1(c.reb)} reb · ${f1(c.ast)} ast`:"No games played this season"}
 const x=SOCP[p.n];if(x)return x.gp?`${x.gp} apps · ${x.g!=null?Math.round(x.g*x.gp):"–"} G · ${x.sa!=null?Math.round(x.sa*x.gp):"–"} A · ${f1(x.ss)} shots/g`:"No games played this season";return""}
function statLine(p,st,m){const s=statSum(p);return`${s}${s?" · ":""}line projection ${m.toFixed(st==="g"||st==="tpm"||st==="sot"||st==="ptd"||st==="atd"?2:1)} ${SH[st]||SL[st].toLowerCase()}`}
/* provenance: season, source and last successful update; flagged when older than 36 hours */
const STALE=36*36e5,isStale=()=>Date.now()-Date.parse(DATA.synced)>STALE;
const srcNote=(src,ssn)=>`<div class="tm note">Season ${ssn||SEASON.current} · Source: ${esc(src)} · Updated ${synced()}${isStale()?' · <b class="lost">Stale: these stats may be out of date</b>':""}</div>`;
function syncLine(){return`Stats updated ${synced()}${isStale()?' · <b class="lost">stale</b>':""}${FEEDAT?` · Scores ${fmt(FEEDAT)}${Date.now()-FEEDAT>6*36e5?' <b class="lost">(may be out of date)</b>':""}`:""}${PBD.fetched?` · PointsBet prices ${fmt(Date.parse(PBD.fetched))}`:""}`}
function untilTomorrow(){const n=new Date(),m=new Date(n.getFullYear(),n.getMonth(),n.getDate()+1)-n,h=Math.floor(m/36e5),mi=Math.ceil(m%36e5/6e4);return h?`${h}h ${mi}m`:`${mi}m`}
function legD(l){const n=l&&l.m==="p"&&l.pl;if(!n||!(NBAP[n]||SOCP[n])||!String(l.d).includes(n))return l.d;return String(l.d).replace(n,`<button class="pnm" data-ply="${esc(n)}">${esc(n)}</button>`)}
function plSearch(q){const ts=teamSearch(q);if(!q||q.length<3)return ts;const hit=n=>n.toLowerCase().includes(q),inc=new Set(G.filter(g=>g.sp===cur&&!g.leg).flatMap(g=>[g.h,g.a])),inSp=p=>cur==="epl"?p.src==="eng.1":SP[cur]&&SP[cur].m==="soc"?inc.has(SAL0[p.tm]||p.tm):false,   /* a cup or European competition: players of the clubs in its fixtures */
 nb=cur==="nba"?Object.values(NBAP).filter(p=>hit(p.n)||hit(TM[p.t].n)).slice(0,12):[],sc=cur==="nba"?[]:Object.values(SOCP).filter(p=>inSp(p)&&(hit(p.n)||hit(p.tm))).sort((a,b)=>b.gp-a.gp).slice(0,12);
 if(!nb.length&&!sc.length)return ts;const row=(n,sub,stat)=>`<button class="rr" data-ply="${esc(n)}"><span class="rj"></span><span class="rn"><b>${esc(n)}</b><small>${sub}</small></span><span class="ra">${stat}</span></button>`;
 return ts+`<div class="card"><h2 style="margin-top:0">Players</h2>${nb.map(p=>{const a=p.c27;return row(p.n,`NBA · ${esc(TM[p.t].n)}`,a?`${f1(a.pts)}<small> pts</small>`:"<small>No games this season</small>")}).join("")}${sc.map(p=>row(p.n,`${esc(compN(p.src))} · ${esc(SAL0[p.tm]||p.tm)} · ${POS4[p.pos]||""}`,`${p.gp}<small> apps</small>${p.g!=null?Math.round(p.g*p.gp):"–"}<small> G</small>`)).join("")}</div>`}
const synced=()=>fmt(Date.parse(DATA.synced));
const abTeam=ab=>(Object.values(TM).find(x=>x.ab===ab)||{}).n||ab;
const HIDE=new Set(["nfl"]);
/* the competitions always in the menu, games or not (a section with no fixtures says when its next round is) */
const PERM=["nba","epl","ucl","fac","lgc","uel"];
function liveSports(){return Object.keys(SP).filter(k=>!HIDE.has(k)&&(PERM.includes(k)||G.some(g=>g.sp===k&&!g.leg&&!(lock(g)&&!LIVE[g.id]&&Date.now()-g.ts>36e5*4))))}
const uniqLog=lg=>{const s=new Set();return(lg||[]).filter(r=>{const k=r.split("|").slice(0,2).join("|");if(s.has(k))return false;s.add(k);return true}).slice(0,10).map(r=>r.split("|"))};
function rosTab(g){return[g.a,g.h].map(tm=>{const t=TBY[tm],ps=DATA.pl.filter(p=>TM[p.t]===t).sort((x,y)=>((y.c27||y.a26||{}).min||0)-((x.c27||x.a26||{}).min||0));
 return`<div class="card"><div class="pn">${bd(tm,24)}${tlink(tm)}<small class="tm" style="margin-left:auto">${ps.length} players</small></div>${ps.map(p=>{const a=p.c27;
  return`<button class="rr" data-ply="${esc(p.n)}"><span class="rj">${esc(p.j||"–")}</span><span class="rn"><b>${esc(p.n)}</b><small>${esc(p.pos||"")}${p.inj?` · <em class="bad">${esc(p.inj)}</em>`:""}</small></span><span class="ra">${a?`${f1(a.pts)}<small> pts</small>${f1(a.reb)}<small> reb</small>${f1(a.ast)}<small> ast</small>`:'<small>No games played this season</small>'}</span></button>`}).join("")}</div>`}).join("")
 +`<div class="tm note">Rosters from ESPN, ${SEASON.current} season, synced ${synced()}. Averages are ${SEASON.current} regular-season games only. Tap a player for game logs and history.</div>`}
function stints(h){const out=[];(h||[]).map(r=>r.split("|")).forEach(([s,t,gp])=>{const l=out[out.length-1];if(l&&l.t===t){l.to=s;l.gp+=+gp}else out.push({t,from:s,to:s,gp:+gp})});return out.reverse()}

/* one stat at a time: bars and table cells go green over the line, red under it */
let SHEET=null;
function logView(rows,cols,sel,ln,hdr,sub){const c=cols.find(x=>x.k===sel)||cols[0],v=r=>c.f?c.f(r):+r[c.i],mx=Math.max(ln||0,1,...rows.map(v))*1.15,cls=x=>ln==null?"":x>ln?"ov":"un";
 const chart=`<div class="spark" role="img" aria-label="${c.lab} in the last ${rows.length} games">${rows.slice().reverse().map(r=>`<i class="${cls(v(r))}" style="height:${Math.max(4,v(r)/mx*100)}%" title="${r[0]} ${r[2]==="@"?"@":"vs"} ${r[1]}: ${v(r)} ${c.lab}"><em>${v(r)}</em></i>`).join("")}${ln!=null?`<b style="bottom:${ln/mx*100}%"><span>Line ${ln}</span></b>`:""}</div>`;
 const hit=ln==null?"":(()=>{const o=rows.filter(r=>v(r)>ln).length;return`<span class="hitr"><b class="won">${o} over</b> · <b class="lost">${rows.length-o} under</b> ${rows.length===1?"":" in the last "+rows.length}</span>`})();
 return`<h2>${rows.length===1?"Last game":"Last "+rows.length+" games"}${sub?` <span class="tm" style="text-transform:none;letter-spacing:0;font:500 12px var(--fb)">· ${esc(sub)}</span>`:""}</h2><div class="pst">${cols.map(x=>`<button data-pst="${x.k}" class="${x.k===c.k?"on":""}">${x.lab}</button>`).join("")}</div>${hit}${chart}
 <div class="tw"><table class="tb"><thead><tr><th>Date</th><th>Opp</th><th>Result</th>${hdr.map(h=>`<th class="${h.k===c.k?"selc":""}">${h.lab}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr><td>${fd(gTime(r[0],r[18]))}</td><td>${r[2]==="@"?"@":"vs"} ${esc(r[1])}</td><td class="${r[3][0]==="W"?"won":r[3][0]==="L"?"lost":""}">${esc(r[3])}</td>${hdr.map(h=>{const x=h.f?h.f(r):+r[h.i];return`<td class="${h.k===c.k?"selc "+cls(x):""}">${h.k===c.k?`<b>${x}</b>`:x}</td>`}).join("")}</tr>`).join("")}</tbody></table></div>`}
let NAV=[];
const sheetWrap=(n,inner)=>`<div class="mod sheet" id="pso"><div class="mc ps" role="dialog" aria-label="${esc(n)}"><button class="x cls" data-psx="1" aria-label="Close">×</button>${NAV.length?`<button class="back sbk" data-sback="1">‹ Back to ${esc(NAV[NAV.length-1].n)}</button>`:""}${inner}</div></div>`;
const nextBtn=g=>g?`<button class="nxt" data-open="${g.id}"><span><small>Next game</small><b>${esc(g.a)} @ ${esc(g.h)}</b><small>${fmt(g.ts)}</small></span><span class="more">Bet on this game ›</span></button>`:"";
const lineCards=(pl,g,sts)=>`<h2>Lines for the next game</h2><div class="pl3">${sts.map(st=>{const i=PLY.indexOf(pl),m=mu(pl,st,g),ln=st==="g"?.5:lnOf(st,m),x=st==="g"?pleg(i,"g","k",1,g.id):pleg(i,st,"o",ln,g.id);return`<button class="sc lc${SHEET.st===st?" on":""}" data-pst="${st}"><small>${SL[st]}</small><b>${st==="g"?"Anytime":"Over "+ln}</b><small>${f2(x.odds)}${x.src?" · PointsBet":""} · proj ${m.toFixed(st==="tpm"||st==="sot"||st==="g"?2:1)}</small></button>`}).join("")}</div>`;

const NBC=[{k:"pts",lab:"PTS",i:5},{k:"reb",lab:"REB",i:6},{k:"ast",lab:"AST",i:7},{k:"tpm",lab:"3PM",i:8},{k:"pra",lab:"PRA",f:r=>+r[5]+ +r[6]+ +r[7]}];
function openNBA(n){const p=NBAP[n],tn=TM[p.t].n,g=gOf(tn),pl=PLY.find(x=>x.n===n&&x.tm===tn),rows=(paGet(String(p.id)),paRows(p))||uniqLog(p.lg).filter(r=>nbaSeasonOf(r[0])===SEASON.current),st=SHEET.st=SHEET.st||"pts",ok=pl&&g;
 const avg=(lab,a)=>a?`<tr><th>${lab}</th><td>${a.gp}</td><td>${f1(a.min)}</td><td>${f1(a.pts)}</td><td>${f1(a.reb)}</td><td>${f1(a.ast)}</td><td>${f1(a.tpm)}</td><td>${f1(a.stl)}</td><td>${f1(a.blk)}</td></tr>`:"";
 const ln=ok&&hasS(pl,st)?lnOf(st,mu(pl,st,g)):null;
 const pt=SHEET.pt||"ov",head=`<div class="psh">${headshot("nba",p.id,tn)}<div><div class="psn">${esc(n)}</div><div class="tm tli">#${esc(p.j||"–")} · ${esc(p.pos||"")} · ${bd(tn,18)}${tlink(tn)}</div><div class="tm">${p.age?"Age "+p.age:""}${p.ht?" · "+esc(p.ht):""}${p.c27?` · ${p.c27.gp} GP, ${f1(p.c27.min)} min`:` · No games played this season`}</div></div></div>
 <div class="chips2"><span class="chip ${p.inj?"c-lost":"c-won"}">${p.inj?esc(p.inj)+(p.injt?" · "+esc(p.injt):""):"Active"}</span></div>`;
 if(pt!=="ov")return sheetWrap(n,head+plTabs(pt)+nbaAnalytics(n,p,pt)+srcNote("ESPN, NBA regular season"));
 return sheetWrap(n,head+plTabs(pt)+`${nextBtn(g)}
 ${ok?lineCards(pl,g,["pts","reb","ast","tpm","pra"].filter(s=>hasS(pl,s)))+propHits(pl,g,rows,NBC,["pts","reb","ast","tpm","pra"].filter(s=>hasS(pl,s))):`<div class="tm" style="margin-top:12px">No betting lines for ${esc(n)}: ${!p.c27?"no games played this season":!g?"no upcoming game":"not enough minutes this season"}.</div>`}
 <h2>${SEASON.current} season averages</h2>${p.c27?gbRow([["GP",p.c27.gp],["MIN",f1(p.c27.min)],["PTS",f1(p.c27.pts)],["REB",f1(p.c27.reb)],["AST",f1(p.c27.ast)],["3PM",f1(p.c27.tpm)],["STL",f1(p.c27.stl)],["BLK",f1(p.c27.blk)],["TO",f1(p.c27.to)],["FG%",p.c27.fgp!=null?f1(p.c27.fgp):null],["3P%",p.c27.tpp!=null?f1(p.c27.tpp):null],["FT%",p.c27.ftp!=null?f1(p.c27.ftp):null]]):'<div class="cempty" style="height:64px">No games played this season</div>'}
 ${rows.length?gbView(rows,NBC,st,ln,[{k:"min",lab:"MIN",i:4},...NBC,{k:"stl",lab:"STL",i:9},{k:"blk",lab:"BLK",i:10},{k:"to",lab:"TO",i:11},{k:"fg",lab:"FG",f:r=>r[12]!=null&&r[13]!=null?r[12]+"-"+r[13]:""},{k:"3p",lab:"3PT",f:r=>r[14]!=null?r[8]+"-"+r[14]:""},{k:"ft",lab:"FT",f:r=>r[15]!=null&&r[16]!=null?r[15]+"-"+r[16]:""}],{sub:SEASON.current+" regular season · game by game",mx:r=>r[17]?` class="mxr" data-mx="${esc(r[17])}" data-mp="basketball/nba" data-ms="nba" title="Open match centre"`:""}):`<h2>Game by game</h2><div class="cempty">No games played this season yet.</div>`}
 ${upcoming((TMD.nba[p.t]||{}).fx,"nba")}${p.h&&p.h.length?`<h2>Team history</h2><div>${stints(p.h).map(s=>`<div class="kv"><span style="display:flex;align-items:center;gap:8px">${bd(abTeam(s.t),24)}<b>${esc(abTeam(s.t))}</b></span><span class="tm">${s.from===s.to?s.from:s.from+" to "+s.to} · ${s.gp} games</span></div>`).join("")}</div>`:""}
 ${srcNote("ESPN, NBA regular season")}`)}

const SCC=[{k:"ss",lab:"Shots",i:7},{k:"sot",lab:"On target",i:8},{k:"g",lab:"Goals",i:5},{k:"sa",lab:"Assists",i:6},{k:"ft",lab:"Fouls",i:9}],POS4={G:"Goalkeeper",D:"Defender",M:"Midfielder",F:"Forward"};
/* a soccer player's matches: the full season (every competition soc-season.ps1 reads) once its file has loaded, plus any other
   match ESPN's game log lists (cups); before that, the last 10 shipped with the page. Same row layout either way. */
function socLogRows(p){const d=paGet("s"+p.id),emb=uniqLog(p.lg);if(!d||!d.rows||d.fb)return emb;
 const full=d.rows.map(x=>{const r=x.split("|");return[r[1],r[3],r[5],r[6],r[7],r[11],r[12],r[13],r[14],r[15],r[16],r[17],r[0],r[23]||"",r[2]]}),have=new Set(full.map(r=>r[12]));
 return full.concat(emb.filter(r=>!have.has(r[12]))).sort((a,b)=>gTime(b[0],rowIso(b))-gTime(a[0],rowIso(a)))}
function openSoc(n){const p=SOCP[n],tm=SAL0[p.tm]||p.tm,g=gOf(tm),pl=PLY.find(x=>x.n===n&&x.tm===tm),rows=socLogRows(p),st=SHEET.st=SHEET.st||"ss",ok=pl&&g;
 const ln=ok&&hasS(pl,st)?(st==="g"?.5:lnOf(st,mu(pl,st,g))):(st==="g"?.5:null),T=k=>p[k]==null?"–":Math.round(p[k]*p.gp);
 const pt=SHEET.pt||"ov",head=`<div class="psh">${headshot("soccer",p.id,tm)}<div><div class="psn">${esc(n)}</div><div class="tm tli">${p.j?"#"+esc(p.j)+" · ":""}${POS4[p.pos]||esc(p.pos||"")} · ${bd(tm,18)}${tlink(tm)}</div><div class="tm">${esc(compN(p.src))}</div></div></div>`;
 if(pt!=="ov")return sheetWrap(n,head+plTabs(pt,1)+socAnalytics(n,p,pt)+photoCredit(p.id));
 return sheetWrap(n,head+plTabs(pt,1)+`${nextBtn(g)}
 ${ok?lineCards(pl,g,["g","ss","sot","sa","ft"].filter(s=>hasS(pl,s)&&pl.mu[s]>0))+propHits(pl,g,rows,SCC,["g","ss","sot","sa","ft"].filter(s=>hasS(pl,s)&&pl.mu[s]>0)):`<div class="tm" style="margin-top:12px">No betting lines for ${esc(n)}${g?" in the next game":": no upcoming game"}.</div>`}
 <h2>${socSeason(p.src)} season · ${esc(compN(p.src))}</h2>${p.gp?"":'<div class="cempty" style="height:64px">No games played this season</div>'}${p.gp?`${gbRow([["Apps",p.gp],["Starts",p.gs??"–"],["Goals",T("g")],["Assists",T("sa")],["Shots/g",f1(p.ss)],["On tgt/g",f1(p.sot)],["Fouls/g",f1(p.ft)],["Yellow",T("yc")],["Red",p.rc??"–"]])}<div class="tm" style="margin-top:6px">Totals as published by ESPN for ${esc(compN(p.src))}. Per-game figures are totals divided by appearances. ESPN doesn't publish xG, xA or minutes for these players, so they're not shown.</div>`:""}
 ${rows.length?gbView(rows,SCC,st,ln,[{k:"st",lab:"Started",f:r=>r[4]==="1"?"Yes":"–"},...SCC],{sub:rows.some(r=>r[14])?`This season, ${scompList([...new Set(rows.filter(r=>r[14]).map(r=>r[2]))])||"all competitions"} · game by game`:`${compN(p.src)} ${socSeason(p.src)} · game by game`,mx:r=>{const c=r[14]||p.src;return r[12]?` class="mxr" data-mx="${esc(r[12])}" data-mp="soccer/${esc(c)}" data-ms="${c==="eng.1"?"epl":c==="uefa.champions"?"ucl":"soc"}" title="Open match centre"`:""}}):'<div class="tm" style="margin-top:12px">No match log published for this player yet.</div>'}
 ${upcoming(((TMD.soc||{})[p.tid]||{}).fx,"soc")}${photoCredit(p.id)}${srcNote("ESPN, "+compN(p.src)+" league matches only (no cups or European games)",socSeason(p.src))}${g&&g.pb?`<div class="tm note">Prices: PointsBet (AU), updated ${fmt(Date.parse(PBD.fetched))}${Date.now()-Date.parse(PBD.fetched)>STALE?' · <b class="lost">may be out of date</b>':""}.</div>`:""}`)}

function openPlayer(n,st){if(!SHEET||SHEET.kind==="team"||SHEET.n!==n)SHEET={kind:"player",n,st:st||null};else if(st)SHEET.st=st;
 const html=sheetCol(NBAP[n]?openNBA(n):SOCP[n]?openSoc(n):"",NBAP[n]?(TM[NBAP[n].t]||{}).n:SOCP[n]?SAL0[SOCP[n].tm]||SOCP[n].tm:"");if(!html)return;const old=$("#pso .ps"),y=old?old.scrollTop:0;$("#psw").innerHTML=html;if(old){const m=$("#pso .ps");m.style.animation="none";$("#pso").style.animation="none";m.scrollTop=y}}
document.addEventListener("click",e=>{const t=e.target;if(!t||!t.closest)return;
 const s=t.closest("[data-pst]");if(s&&SHEET){e.stopPropagation();openPlayer(SHEET.n,s.dataset.pst);return}
 const tt=t.closest("[data-tt]");if(tt&&SHEET&&SHEET.kind==="team"){e.stopPropagation();openTeam(SHEET.n,tt.dataset.tt);return}
 const push=()=>{if($("#pso")&&SHEET)NAV.push(Object.assign({},SHEET));else NAV=[]};
 const y=t.closest("[data-ply]");if(y){e.stopPropagation();push();SHEET=null;openPlayer(y.dataset.ply);return}
 const tm=t.closest("[data-team]");if(tm){e.stopPropagation();if(SHEET&&SHEET.kind==="team"&&SHEET.n===tm.dataset.team&&$("#pso"))return;push();openTeam(tm.dataset.team);return}
 if(t.closest("[data-sback]")){e.stopPropagation();const pv=NAV.pop();SHEET=null;if(pv.kind==="team")openTeam(pv.n,pv.tab);else openPlayer(pv.n,pv.st);return}
 if(t.closest("[data-psx]")||t.id==="pso"){e.stopPropagation();$("#psw").innerHTML="";SHEET=null;NAV=[];return}
 if(t.closest("#psw [data-open]")){const id=t.closest("[data-open]").dataset.open;e.stopPropagation();$("#psw").innerHTML="";SHEET=null;NAV=[];pg="bets";view=id;dtab="main";render();scrollTo(0,0)}},true);
/* usernames: one per account. A signed-in player claims a name in names/<their account id>; a name another account holds is refused.
   Username-only players (not signed in) have no server storage, so their name lives in this browser. */
async function claimName(n){if(!DB||!UID)return"";const lc=n.toLowerCase();
 try{const q=await DB.collection("names").where("lc","==",lc).get();if(q.docs.some(d=>d.id!==UID))return"That username is taken. If it's yours, sign in with the Google account you used to create it.";
  await DB.doc("names/"+UID).set({name:n,lc,t:Date.now()});return""}catch(e){return"Couldn't check that username right now. Try again in a moment."}}
/* log out keeps each profile on this device, keyed by username, so the same username logs straight back into it */
const profs=()=>{try{return JSON.parse(localStorage.getItem("sl_profiles")||"{}")}catch(e){return{}}};
function logOut(){try{const p=profs();if(S.name)p[S.name.toLowerCase()]=JSON.parse(JSON.stringify(S));localStorage.setItem("sl_profiles",JSON.stringify(p));localStorage.removeItem("sl2");localStorage.removeItem("sl_key")}catch(e){}location.reload()}
mkProfile=async function(){const n=($("#un").value||"").trim(),er=nameErr(n);if(er){$("#gm").textContent=er;return}
 const back=profs()[n.toLowerCase()];if(back&&!DB){S=back;norm();save();$("#gate").innerHTML="";render();toast("Welcome back, "+dn(S.name));return}
 const b=$("#mkp");if(b)b.disabled=true;const c=await claimName(n);if(b)b.disabled=false;if(c){$("#gm").textContent=c;return}S.name=n;save();$("#gate").innerHTML="";render()};
document.addEventListener("click",e=>{if(e.target&&e.target.closest&&e.target.closest("[data-logout]")){e.preventDefault();e.stopImmediatePropagation();logOut()}},true);
saveName=async function(){const n=($("#nn").value||"").trim(),er=nameErr(n);if(er){$("#nmsg").textContent=er;return}if(n===S.name)return;const c=await claimName(n);if(c){$("#nmsg").textContent=c;return}S.name=n;save();render()};
/* accounts created before the names list existed claim their current name once */
(()=>{let k=0;const tm=setInterval(()=>{if(++k>30){clearInterval(tm);return}if(DB&&UID&&S.name){clearInterval(tm);DB.doc("names/"+UID).get().then(d=>{if(!d.exists)claimName(S.name)}).catch(()=>{})}},1000)})();
/* log in part-way through: a guest signs in with Google; on reload their guest balance, bets and username move to the new account */
function openLogin(){const has=S.bets.length||S.bal!==100;$("#psw").innerHTML=`<div class="mod" id="pso"><div class="mc"><button class="x cls" data-psx="1" aria-label="Close">×</button><div class="logo" style="justify-content:center">Sideline</div><h2 style="margin-top:14px">Log in</h2><div class="tm">Keep ${has?`your ${$$(S.bal)} balance, ${S.bets.length} bet${S.bets.length===1?"":"s"} and`:"your"} username “${esc(dn(S.name))}” on every device.</div>
 <a class="gbtn" href="https://claude.ai/login" target="_blank" rel="noopener">${GLOGO}<span>Continue with Google</span></a>
 <ol class="lsteps"><li>Sign in with Google in the tab that opens.</li><li>Come back and press <b>I've logged in</b>.</li><li>Your guest progress moves to your account.</li></ol>
 <button class="go" data-gs="reload">I've logged in</button><div class="tm" style="font-size:11px;margin-top:10px">Already have an account? Logging in opens that account instead of this guest progress.</div></div></div>`}
function updLogin(){const b=$("#lgn");if(b)b.hidden=!!DB||!S.name}
(()=>{let k=0;const tm=setInterval(()=>{updLogin();if(++k>20)clearInterval(tm)},1000)})();
document.addEventListener("click",e=>{const b=e.target&&e.target.closest&&e.target.closest("[data-login]");if(!b)return;e.preventDefault();e.stopPropagation();openLogin()},true);
/* cards fade in only when the list itself changes (sport, game, back), never on background refreshes, so nothing blinks */
document.addEventListener("click",e=>{if(e.target&&e.target.closest&&e.target.closest("[data-tab],[data-open],[data-back]")){const gm=$("#games");if(gm){gm.classList.add("anim");clearTimeout(gm._t);gm._t=setTimeout(()=>gm.classList.remove("anim"),500)}}},true);
/* first-run choice: Google sign-in (syncs devices) or username only */
document.addEventListener("click",e=>{const b=e.target&&e.target.closest&&e.target.closest("[data-gs]");if(!b)return;const v=b.dataset.gs;if(v==="reload"){location.reload();return}if(b.tagName!=="A")e.preventDefault();setTimeout(()=>{window.__gs=v;showGate();const i=$("#un");if(i)i.focus()},v==="google"?60:0)},true);
document.addEventListener("keydown",e=>{if(e.key==="Escape"){$("#psw").innerHTML="";SHEET=null;NAV=[]}});
/* keep the viewer's place when a new version is delivered: tab, sport, open game, open player, search and scroll */
const hotState=()=>({pg,cur,view,dtab,bt,q:window.__q||"",ply:SHEET&&SHEET.kind!=="team"&&SHEET.n,pst:SHEET&&SHEET.st,team:SHEET&&SHEET.kind==="team"&&SHEET.n,ttab:SHEET&&SHEET.tab,y:scrollY});
try{window.claude?.hot?.snapshot?.(hotState)}catch(e){}
function bootHot(d){d=d||{};if(d.pg){pg=d.pg;cur=d.cur||cur;view=d.view&&GM[d.view]?d.view:null;dtab=d.dtab||"main";bt=d.bt||bt;window.__q=d.q||""}render();if(d.ply&&(NBAP[d.ply]||SOCP[d.ply])){SHEET=null;openPlayer(d.ply,d.pst)}else if(d.team&&teamKey(d.team))openTeam(d.team,d.ttab);if(d.y)setTimeout(()=>scrollTo(0,d.y),60)}
try{window.claude?.hot?.ready?window.claude.hot.ready(bootHot):bootHot(window.claude?.hot?.data)}catch(e){bootHot()}
