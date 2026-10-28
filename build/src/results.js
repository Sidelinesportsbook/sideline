/* a competition's badge beside its name (LEAGUE_LOGO is set in polish.js, later in the page: before that, no badge) */
function lgBadge(sp,z){let u='';try{u=LEAGUE_LOGO[sp]||''}catch(e){}const th=document.documentElement.dataset.theme,dk=th?th==='dark':!matchMedia('(prefers-color-scheme: light)').matches;if(dk)u=u.replace('/leaguelogos/soccer/500/','/leaguelogos/soccer/500-dark/');return u?`<img class="lgb" src="${u}" alt="" width="${z}" height="${z}" loading="lazy">`:''}
/* ---------- results: live scores, finals and the last 24 hours of games in every league, straight from ESPN ----------
   Every game ESPN reports is tracked, not only games still on the fixture list, so a bet always finds its game.
   Two sources feed the same store: the browser asks ESPN directly (public site), and the shared feed (feed/current, refreshed
   every few minutes) covers pages where direct requests are blocked. Completion times are ESPN's own play-by-play clock. */
/* small diagnostics log (window.__slog) so status and cash-out problems can be traced if they recur */
function slog(k,msg){try{const L=window.__slog||(window.__slog=[]);L.push([new Date().toISOString(),k,msg]);if(L.length>200)L.shift()}catch(e){}}
const LGN={nba:"NBA",epl:"Premier League",ucl:"Champions League",fac:"FA Cup",lgc:"Carabao Cup",uel:"Europa League"},EVM={},ALIAS={},DUR={nba:2.6*36e5,epl:1.95*36e5,ucl:1.95*36e5,fac:2.2*36e5,lgc:2.2*36e5,uel:1.95*36e5};   /* cup ties can go to extra time and penalties */
let EVAT=0,PASTAT=0,PGF={sp:"",q:"",bo:""};
const ymd=t=>new Date(t).toISOString().slice(0,10).replace(/-/g,"");
const isAET=m=>/AET|PEN/.test(m.stn||"");
try{const c=JSON.parse(localStorage.getItem("sl_ev")||"null");if(c&&c.m){Object.assign(EVM,c.m);EVAT=c.t||0}}catch(e){}
function evSave(){try{const k={};for(const id in EVM)if(Date.now()-EVM[id].ts<3*864e5)k[id]=EVM[id];localStorage.setItem("sl_ev",JSON.stringify({t:EVAT,m:k}))}catch(e){}}
function evFrom(sp,ev){const c=(ev.competitions||[])[0],t=ev.status&&ev.status.type;if(!c||!t)return null;
 const H=c.competitors.find(x=>x.homeAway==="home"),A=c.competitors.find(x=>x.homeAway==="away");if(!H||!A)return null;
 const side=x=>({n:x.team.displayName,ab:x.team.abbreviation||"",logo:x.team.logo||"",sc:NV(x.score),id:String(x.team.id),ls:(x.linescores||[]).map(q=>q.displayValue!=null?q.displayValue:q.value)}),v=/POSTPONED|CANCELED|ABANDONED/.test(t.name),hid=String(H.team.id);
 /* soccer: goals and cards as ESPN lists them on the scoreboard */
 const evs=(c.details||[]).filter(d=>d.type&&/goal|card|penalty/i.test(d.type.text||"")).map(d=>({min:(d.clock||{}).displayValue||"",type:d.type.text,tm:String((d.team||{}).id)===hid?"h":"a",who:((d.athletesInvolved||[])[0]||{}).displayName||"",sc:!!d.scoringPlay}));
 return Object.assign(EVM[ev.id]||{},{id:String(ev.id),sp,iso:ev.date,ts:Date.parse(ev.date),state:v?"void":t.state,stn:t.name,det:t.shortDetail||t.detail||"",h:side(H),a:side(A),at:Date.now(),
  evs,period:(ev.status||{}).period||0,clock:(ev.status||{}).displayClock||"",why:v?t.name.replace("STATUS_","").toLowerCase():"",q:t.name==="STATUS_DELAYED"?"Delayed":t.name==="STATUS_SUSPENDED"?"Suspended":(t.shortDetail||t.detail||"Live").replace(/ - /g," ")})}
/* the game a result belongs to: the fixture-list game, or an unlisted one made from ESPN's own data */
function gameFor(m){const gid="e"+m.id,H=SAL0[m.h.n]||m.h.n,A=SAL0[m.a.n]||m.a.n;let g=GM[gid];
 if(!g){g={id:gid,eid:m.id,sp:m.sp,h:H,a:A,iso:m.iso,ts:m.ts,leg:true,p:.5,pd:0};G.push(g);GM[gid]=g}EVID[gid]=m.id;
 /* games saved by older versions of the fixture list carry their own ids: point them at the same ESPN event */
 G.forEach(x=>{if(x===g||x.eid||ALIAS[x.id]||x.sp!==m.sp||Math.abs(x.ts-m.ts)>20*36e5)return;
  if(teq(x.h,H)&&teq(x.a,A))ALIAS[x.id]={g:gid,sw:0};else if(teq(x.h,A)&&teq(x.a,H))ALIAS[x.id]={g:gid,sw:1}});
 return g}
const finalOf=m=>m.state==="post"&&(!isAET(m)||m.reg)?(m.reg||[m.h.sc,m.a.sc]):null;   /* soccer after extra time settles on the 90-minute score */
async function sumOf(m){const j=await jget(EB+ESP[m.sp]+"/summary?event="+m.id),p={},nm=a=>(typeof plById==="function"&&plById(a.id))||PN[pkey(a.displayName)]||a.displayName,sd=t=>String(t&&t.id)===m.h.id?"h":"a";
 if(m.sp==="nba"){(j.boxscore&&j.boxscore.players||[]).forEach(t=>{const st=(t.statistics||[])[0],side=sd(t.team);if(!st)return;const L=st.labels||[],ix=k=>L.indexOf(k);
   (st.athletes||[]).forEach(a=>{if(!a.athlete||a.didNotPlay||!a.stats||!a.stats.length)return;const v=k=>ix(k)<0?0:NV(a.stats[ix(k)]),pr=k=>ix(k)<0?"0-0":String(a.stats[ix(k)]);
    p[nm(a.athlete)]={pts:v("PTS"),reb:v("REB"),ast:v("AST"),stl:v("STL"),blk:v("BLK"),tpm:NV(pr("3PT").split("-")[0]),fgm:NV(pr("FG").split("-")[0]),ftm:NV(pr("FT").split("-")[0]),to:v("TO"),min:v("MIN"),tm:side}})});
  const w=(j.plays||[]).map(x=>x.wallclock).filter(Boolean).sort();if(w.length&&m.state==="post")m.end=w[w.length-1]}
 else{(j.rosters||[]).forEach(t=>{const side=sd(t.team);(t.roster||[]).forEach(a=>{if(!a.athlete||!a.stats||(!a.starter&&!a.subbedIn))return;const s={};a.stats.forEach(x=>{s[x.name]=NV(x.value)});
   p[nm(a.athlete)]={g:s.totalGoals||0,sa:s.goalAssists||0,ss:s.totalShots||0,sot:s.shotsOnTarget||0,ft:s.foulsCommitted||0,fw:s.foulsSuffered||0,yc:s.yellowCards||0,tm:side}})});
  const w=(j.keyEvents||[]).map(x=>x.wallclock).filter(Boolean).sort();if(w.length&&m.state==="post")m.end=w[w.length-1];
  if(isAET(m)){const cs=(((j.header||{}).competitions||[])[0]||{}).competitors||[],ls=x=>(x&&x.linescores||[]).map(q=>NV(q.displayValue)),h=ls(cs.find(x=>x.homeAway==="home")),a=ls(cs.find(x=>x.homeAway==="away"));
   if(h.length>=2&&a.length>=2)m.reg=[h[0]+h[1],a[0]+a[1]]}}
 return p}
/* every league, every game: a full sweep of the last two ESPN days every 5 minutes, and only the leagues with games in play in between */
cycle=async function(){if(POLL.busy)return 6e4;POLL.busy=true;let wait=3e5;
 try{const now=Date.now(),full=now-PASTAT>3e5,act=new Set();
  Object.values(EVM).forEach(m=>{if(m.state==="in")act.add(m.sp)});G.forEach(g=>{if(LGN[g.sp]&&!RES[g.id]&&g.ts<now+36e5&&now-g.ts<4*36e5)act.add(g.sp)});
  const sps=full?Object.keys(LGN):[...act],pairs=[];sps.forEach(sp=>(full?[-2,-1,0]:[-1,0]).forEach(d=>pairs.push([sp,ymd(now+d*864e5)])));
  if(!pairs.length){POLL.state="idle";POLL.at=now;POLL.live=0;return Math.max(3e4,PASTAT+3e5-now)}
  const R=await Promise.allSettled(pairs.map(([sp,d])=>jget(EB+ESP[sp]+"/scoreboard?dates="+d)));
  if(!R.some(x=>x.status==="fulfilled"))throw R[0].reason||new Error("offline");
  if(full&&R.every(x=>x.status==="fulfilled"))PASTAT=now;
  const nl={},seen=new Set(),jobs=[];
  R.forEach((x,i)=>{if(x.status!=="fulfilled")return;const sp=pairs[i][0];
   (x.value.events||[]).forEach(ev=>{if(seen.has(ev.id))return;seen.add(ev.id);const m=evFrom(sp,ev);if(!m)return;EVM[m.id]=m;const g=gameFor(m),gid=g.id;
    if(m.state==="void"){PPD[gid]=m.why;return}if(m.state==="pre")return;
    if(m.state==="in")jobs.push(sumOf(m).then(p=>{nl[gid]={q:m.q,h:m.h.sc,a:m.a.sc,p}},()=>{nl[gid]={q:m.q,h:m.h.sc,a:m.a.sc,p:(LL[gid]||{}).p||{}}}));
    else if(m.state==="post"){if(!DONE[gid])jobs.push(sumOf(m).then(p=>{LRP[gid]=p;DONE[gid]=1},()=>{}));   /* retried every cycle until the box score arrives */
     delete LL[gid]}})});
  await Promise.allSettled(jobs);
  /* finals are written only after the summary: an extra-time game needs its 90-minute score first */
  seen.forEach(id=>{const m=EVM[id],f=m&&finalOf(m);if(f)LR["e"+id]=f});
  for(const k in LL)if(!nl[k]&&(full||act.has((GM[k]||{}).sp)))delete LL[k];Object.assign(LL,nl);
  POLL.live=Object.keys(LL).length;POLL.state="ok";POLL.fails=0;POLL.at=now;EVAT=now;evSave();
  try{localStorage.setItem("sl_live",JSON.stringify({t:now,LL,LR,LRP}))}catch(e){}
  try{await settleOld()}catch(e){}
  mergeLive();const sig2=JSON.stringify([LL,LR,LRP,PPD]);if(sig2!==lastSig){lastSig=sig2;settleAll();render()}
  const pend=S.bets.some(b=>b.st==="open"&&b.legs.some(l=>!l.r&&GM[l.g]&&GM[l.g].ts<now));
  wait=POLL.live?3e4:pend||act.size?6e4:Math.max(3e4,PASTAT+3e5-now)}
 catch(e){POLL.fails++;POLL.state="err";POLL.at=Date.now();POLL.msg=e&&e.name==="AbortError"?"timed out":e&&e.http?"HTTP "+e.http:"network blocked or offline";wait=Math.min(3e5,2e4*Math.pow(2,POLL.fails-1))}
 finally{POLL.busy=false;showStatus()}
 return wait+Math.floor(Math.random()*2000)};
/* open bets on games that finished outside the live window (older than ~1-2 days): fetch that exact game's final result
   and box score from ESPN once, so the bet settles on verified figures instead of staying pending */
const OLDT={};
async function settleOld(){const now=Date.now(),todo=new Map();
 S.bets.forEach(b=>{if(b.st==="void")return;b.legs.forEach(l=>{if(l.r)return;const g=GM[l.g];if(!g||!LGN[g.sp]||PPD[l.g]||now-g.ts<3*36e5)return;if(RES[l.g]&&(l.m!=="p"||(RP[l.g]&&Object.keys(RP[l.g]).length)))return;if(RES[l.g])DONE[l.g]=0;if(OLDT[g.id]&&now-OLDT[g.id]<6e5)return;todo.set(g.id,g)})});
 for(const g of [...todo.values()].slice(0,4)){OLDT[g.id]=now;try{
  let id=g.eid||(ALIAS[g.id]&&ALIAS[g.id].g.slice(1))||(String(g.id)[0]==="e"?String(g.id).slice(1):null);
  if(!id){for(const dd of [0,-1,1]){const sb=await jget(EB+ESP[g.sp]+"/scoreboard?dates="+ymd(g.ts+dd*864e5));const ev=(sb.events||[]).map(e=>evFrom(g.sp,e)).find(m=>m&&Math.abs(m.ts-g.ts)<20*36e5&&((teq(g.h,SAL0[m.h.n]||m.h.n)&&teq(g.a,SAL0[m.a.n]||m.a.n))||(teq(g.h,SAL0[m.a.n]||m.a.n)&&teq(g.a,SAL0[m.h.n]||m.h.n))));if(ev){EVM[ev.id]=ev;id=ev.id;break}}}
  if(!id)continue;let m=EVM[id];
  if(!m||m.state!=="post"){const j=await jget(EB+ESP[g.sp]+"/summary?event="+id),c=((((j.header||{}).competitions)||[])[0])||{},cs=c.competitors||[],H=cs.find(x=>x.homeAway==="home"),A=cs.find(x=>x.homeAway==="away"),t=(c.status||{}).type||{};if(!H||!A)continue;
   const sd=x=>({n:(x.team||{}).displayName,ab:(x.team||{}).abbreviation||"",logo:(((x.team||{}).logos||[])[0]||{}).href||"",sc:NV(x.score),id:String((x.team||{}).id)});
   m=EVM[id]=Object.assign(EVM[id]||{},{id:String(id),sp:g.sp,iso:c.date,ts:Date.parse(c.date),state:/POSTPONED|CANCELED|ABANDONED/.test(t.name||"")?"void":t.state,stn:t.name,det:t.shortDetail||t.detail||"",h:sd(H),a:sd(A),at:Date.now()})}
  const gg=gameFor(m),gid=gg.id;if(m.state==="void"){PPD[gid]=m.why||"postponed";continue}if(m.state!=="post")continue;
  if(!DONE[gid]){LRP[gid]=await sumOf(m);DONE[gid]=1}const f=finalOf(m);if(f)LR[gid]=f;slog("settle",`fetched final for ${g.a} @ ${g.h} (${id})`)}catch(e){slog("settle",`final for ${g.id} not available yet: ${e&&e.message||e}`)}}}
/* old fixture ids get the same live scores, finals, box scores and postponements as their ESPN event */
const _mergeLive0=mergeLive;mergeLive=function(){_mergeLive0();
 /* one status per game: a final score, or ESPN saying the game is over, always beats an older "live" entry (feed snapshots, saved state) */
 for(const id in LIVE){const m=String(id)[0]==="e"&&EVM[String(id).slice(1)];if(RES[id]||(m&&(m.state==="post"||m.state==="void"))){delete LIVE[id];slog("status",id+" final, removed from live")}}
 for(const id in ALIAS){const{g,sw}=ALIAS[id],r=RES[g],v=LIVE[g];if(r)RES[id]=sw?[r[1],r[0]]:r;if(v)LIVE[id]=sw?{...v,h:v.a,a:v.h}:v;if(RP[g])RP[id]=RP[g];if(PPD[g])PPD[id]=PPD[g]}};
/* the shared feed carries the same event details (teams, logos, completion time, 90-minute scores, postponements) */
const _applyFeed0=applyFeed;applyFeed=function(f){if(f&&f.ev){const at=Date.parse(f.at||0)||0;
  for(const id in f.ev){const x=f.ev[id],o=EVM[id];if(o&&(o.at||0)>at)continue;
   const m=EVM[id]=Object.assign(o||{},x,{id:String(id),ts:Date.parse(x.iso),at,why:x.state==="void"?(f.ppd||{})["e"+id]||"postponed":""});gameFor(m)}
  for(const k in f.ppd||{})PPD[k]=f.ppd[k];if(at>EVAT)EVAT=at;evSave()}
 _applyFeed0(f)};
/* tracker text says exactly what a pending leg is waiting for */
const _lp2=legProg;legProg=function(l){const r=_lp2(l);if(l.r)return r;const g=GM[l.g];
 if(!g)return{st:"idle",lab:"Pending",pct:0,txt:"Waiting for this game's details from ESPN"};
 const v=LIVE[l.g],m=EVM[g.eid||(ALIAS[g.id]||{g:"e"}).g.slice(1)];
 if(v&&/Suspend|Delay/.test(v.q))return{...r,txt:v.q+" · settles when play resumes or the result is made official"};
 if(m&&m.state==="post"&&!RES[l.g])return{st:"idle",lab:"Final",pct:0,txt:"Finished after extra time · waiting for the verified 90-minute score"};
 if(RES[l.g]&&l.m==="p"&&!(RP[l.g]&&Object.keys(RP[l.g]).length))return{st:"idle",lab:"Final",pct:0,txt:"Game finished · waiting for ESPN's verified box score to settle this leg"};
 return r};

/* ---------- Past games: everything that finished in the last 24 hours (rolling), every league ---------- */
const endAt=m=>m.end?{t:Date.parse(m.end),ok:1}:{t:m.ts+(DUR[m.sp]||2*36e5),ok:0};
function pastGames(now){return Object.values(EVM).filter(m=>m.state==="post").map(m=>({m,...endAt(m)})).filter(x=>x.t<=now&&now-x.t<=864e5).sort((a,b)=>b.t-a.t)}
function betsOn(m){const gid="e"+m.id,ids=new Set([gid]);for(const k in ALIAS)if(ALIAS[k].g===gid)ids.add(k);return S.bets.map((b,i)=>[b,i]).filter(([b])=>b.legs.some(l=>ids.has(l.g)))}
const tz=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||"local time"}catch(e){return"local time"}};
const tmLogo=(s,z)=>{const n=SAL0[s.n]||s.n;if(s.logo){const L=logoMap();if(!L[n])L[n]=s.logo}return bd(n,z)};
const BLAB={won:"won",lost:"lost",ref:"refunded",void:"void",open:"pending",cash:"cashed out"};
function betChips(bs){const c={};bs.forEach(([b])=>{c[b.st]=(c[b.st]||0)+1});return Object.keys(c).map(k=>`<span class="chip c-${k}">${c[k]} ${BLAB[k]||k}</span>`).join("")}
function pastCard({m,t,ok},bs){const f=finalOf(m)||[m.h.sc,m.a.sc],hw=m.h.sc>m.a.sc,aw=m.a.sc>m.h.sc,first=m.sp==="nba"?["a","h"]:["h","a"];
 const row=k=>{const s=m[k],w=k==="h"?hw:aw;return`<div class="pgt${w?" w":""}">${tmLogo(s,26)}<span class="pgn">${esc(SAL0[s.n]||s.n)}</span><b>${s.sc}</b></div>`};
 return`<button class="pgc" data-pgm="${m.id}"><div class="pgtop"><span>${lgBadge(m.sp,14)}${LGN[m.sp]} · ${esc(m.det||"Final")}</span><span>Ended ${fmt(t)}${ok?"":" (approx.)"}</span></div>${first.map(row).join("")}
 ${isAET(m)&&m.reg?`<div class="tm pgs">90 minutes: ${m.reg[0]} – ${m.reg[1]}</div>`:""}<div class="pgbot"><span class="tm">Started ${fmt(m.ts)}</span><span>${betChips(bs)}</span></div></button>`}
function renderPast(){const el=$("#past");if(!el)return;const now=Date.now(),q=PGF.q.trim().toLowerCase(),ae=document.activeElement,foc=ae&&ae.id==="pgq"?ae.selectionStart:null;
 const rows=pastGames(now).filter(({m})=>(!PGF.sp||m.sp===PGF.sp)&&(!q||[m.h.n,m.a.n,m.h.ab,m.a.ab,SAL0[m.h.n],SAL0[m.a.n]].join(" ").toLowerCase().includes(q)))
  .map(x=>({x,bs:betsOn(x.m)})).filter(({bs})=>!PGF.bo||(PGF.bo==="mine"?bs.length:bs.some(([b])=>PGF.bo==="ref"?b.st==="ref"||b.st==="void":b.st===PGF.bo)));
 const upd=EVAT?new Date(EVAT).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}):"",stale=!EVAT||now-EVAT>15*6e4;
 const chip=(k,l)=>`<button data-pgs="${k}" class="${PGF.sp===k?"on":""}">${l}</button>`,opt=(k,l)=>`<option value="${k}"${PGF.bo===k?" selected":""}>${l}</option>`;
 el.innerHTML=`<div class="pgh"><h2>Past games</h2><div class="tm">Finished in the last 24 hours · your time zone (${esc(tz())})${upd?` · results from ESPN, updated ${upd}`:""}${stale&&upd?' · <b class="lost">ESPN not reachable right now, showing the last saved results</b>':""}</div></div>
 <div class="pst">${chip("","All")}${Object.keys(LGN).map(k=>chip(k,LGN[k])).join("")}</div>
 <div class="pgf"><input id="pgq" placeholder="Search a team" value="${esc(PGF.q)}" autocomplete="off"><select id="pgb">${opt("","All games")}${opt("mine","Games I bet on")}${opt("won","Bets won")}${opt("lost","Bets lost")}${opt("open","Bets pending")}${opt("ref","Refunded or void")}${opt("cash","Cashed out")}</select></div>
 <div class="pgl">${rows.map(({x,bs})=>pastCard(x,bs)).join("")||(EVAT||Object.keys(EVM).length?`<div class="card cempty pge">No games match these filters in the last 24 hours.</div>`:skel(118,118,118,118)+`<div class="tm note">Loading results from ESPN…</div>`)}</div>
 <div class="tm pgnote">Completion times are ESPN's official game clock (last play or final whistle). Where ESPN hasn't published one yet, the end is estimated from the start time and marked approx.</div>`;
 const qi=$("#pgq");qi.oninput=()=>{PGF.q=qi.value;renderPast()};$("#pgb").onchange=e=>{PGF.bo=e.target.value;renderPast()};
 if(foc!==null){const n=$("#pgq");n.focus();n.setSelectionRange(foc,foc)}}
function boxTable(m,box){const ks=Object.keys(box||{});if(!ks.length)return`<div class="cempty" style="height:64px">${m.sp==="nba"?"Box score":"Player stats"} not published by ESPN yet</div>`;
 const pl=n=>`<span class="bxp">${avatar(n,null,m.sp==="nba"?"nba":"soc",22)}${NBAP[n]||SOCP[n]?`<button class="pnm" data-ply="${esc(n)}">${esc(n)}</button>`:esc(n)}</span>`;
 const sides=ks.some(n=>box[n].tm)?["h","a"]:[null];
 return sides.map(sd=>{const ns=ks.filter(n=>!sd||box[n].tm===sd),t=sd?m[sd]:null;
  if(m.sp==="nba"){ns.sort((a,b)=>box[b].pts-box[a].pts||box[b].min-box[a].min);
   return`<div class="pgbx">${t?`<h3>${tmLogo(t,20)} ${esc(SAL0[t.n]||t.n)}</h3>`:""}<table><thead><tr><th>Player</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>3PM</th></tr></thead><tbody>${ns.map(n=>{const s=box[n];return`<tr><td>${pl(n)}</td><td>${s.min||0}</td><td><b>${s.pts}</b></td><td>${s.reb}</td><td>${s.ast}</td><td>${s.tpm||0}</td></tr>`}).join("")}</tbody></table></div>`}
  const act=ns.filter(n=>box[n].g||box[n].sa||box[n].ss||box[n].yc).sort((a,b)=>box[b].g-box[a].g||box[b].sa-box[a].sa||box[b].sot-box[a].sot||box[b].ss-box[a].ss),sum=k=>ns.reduce((q,n)=>q+(box[n][k]||0),0);
  return`<div class="pgbx">${t?`<h3>${tmLogo(t,20)} ${esc(SAL0[t.n]||t.n)} <small class="tm">${sum("ss")} shots · ${sum("sot")} on target · ${sum("yc")} yellow</small></h3>`:""}<table><thead><tr><th>Player</th><th>G</th><th>A</th><th>SH</th><th>SOT</th><th>YC</th></tr></thead><tbody>${act.map(n=>{const s=box[n];return`<tr><td>${pl(n)}</td><td><b>${s.g}</b></td><td>${s.sa}</td><td>${s.ss}</td><td>${s.sot}</td><td>${s.yc||0}</td></tr>`}).join("")||'<tr><td colspan="6" class="tm">No goals, assists or shots recorded</td></tr>'}</tbody></table></div>`}).join("")}
function openPast(id){const m=EVM[id];if(!m)return;const e=endAt(m),gid="e"+id,box=RP[gid]||LRP[gid]||{},bs=betsOn(m);
 const row=k=>{const s=m[k],w=k==="h"?m.h.sc>m.a.sc:m.a.sc>m.h.sc;return`<div class="pgt big${w?" w":""}">${tmLogo(s,34)}<span class="pgn">${tlink(SAL0[s.n]||s.n)}</span><b>${s.sc}</b></div>`};
 $("#psw").innerHTML=`<div class="mod sheet" id="pso"><div class="mc ps" role="dialog" aria-label="Game details"><button class="x cls" data-psx="1" aria-label="Close">×</button>
 <div class="tm">${lgBadge(m.sp,16)}${LGN[m.sp]} · ${esc(m.det||"Final")}</div>${(m.sp==="nba"?["a","h"]:["h","a"]).map(row).join("")}
 ${isAET(m)&&m.reg?`<div class="tm">Score after 90 minutes: ${m.reg[0]} – ${m.reg[1]} (soccer markets settle on this)</div>`:""}
 <div class="kv"><span>Started</span><b>${fmt(m.ts)}</b></div><div class="kv"><span>Finished</span><b>${fmt(e.t)}${e.ok?"":" (approx.)"}</b></div>
 <h2 style="margin-top:16px">${m.sp==="nba"?"Box score":"Player stats"}</h2>${boxTable(m,box)}
 <h2 style="margin-top:16px">Your bets on this game</h2>${bs.length?bs.map(([b,i])=>betCard(b,i)).join(""):'<div class="tm">You had no bets on this game.</div>'}
 <div class="tm" style="font-size:11px;margin-top:10px">Source: ESPN. Times in ${esc(tz())}.</div></div></div>`}
document.addEventListener("click",e=>{const t=e.target;if(!t||!t.closest)return;const s=t.closest("[data-pgs]");if(s){PGF.sp=s.dataset.pgs;renderPast();return}
 const c=t.closest("[data-pgm]");if(c){openPast(c.dataset.pgm)}});
document.addEventListener("error",e=>{const t=e.target;if(t&&t.tagName==="IMG"&&t.parentNode&&t.parentNode.classList&&(t.parentNode.classList.contains("pglg")||t.parentNode.classList.contains("phs")))t.remove()},true);
/* page wiring: a Past games tab on desktop and mobile */
(()=>{const nb=$("#nb");if(nb&&!$("#npg"))nb.insertAdjacentHTML("afterend",'<button id="npg" data-pg="past">Past games</button>');
 const bb=$("#bb");if(bb&&!$("#bpg"))bb.insertAdjacentHTML("afterend",'<button data-pg="past" id="bpg">Past games</button>');
 const pf=$("#pf");if(pf&&!$("#past"))pf.insertAdjacentHTML("afterend",'<section id="past" style="display:none"></section>')})();
const _render0=render;render=function(m){_render0(m);const on=pg==="past",el=$("#past");if(el){el.style.display=on?"block":"none";if(on){$("main").style.display="none";renderPast()}}
 ["#npg","#bpg"].forEach(q=>{const b=$(q);if(b)b.className=on?"on":""})};
setInterval(()=>{if(pg==="past"&&!document.hidden)renderPast()},6e4);   /* the 24-hour window rolls on by itself */
/* boot: saved ESPN results, the hourly build's finals, and the feed snapshot baked into this page */
(DATA.res||[]).forEach(r=>{if(EVM[r.id]||!LGN[r.sp])return;const ts=Date.parse(r.iso);EVM[r.id]={id:String(r.id),sp:r.sp,iso:r.iso,ts,state:r.pp?"void":"post",stn:"",det:"Final",at:0,h:{n:r.h,sc:r.sc[0]},a:{n:r.a,sc:r.sc[1]}}});
try{const f=JSON.parse((document.getElementById("fdd")||{}).textContent||"null");if(f&&f.ev&&Date.now()-Date.parse(f.at)<36*36e5&&!Object.keys(FB.res||{}).length)applyFeed({...f,live:{},inj:{}})}catch(e){}
Object.values(EVM).forEach(m=>{if(!LGN[m.sp])return;const g=gameFor(m),f=finalOf(m);if(m.state==="void")PPD[g.id]=m.why||"postponed";if(f&&!LR[g.id])LR[g.id]=f;if(LRP[g.id]&&Object.keys(LRP[g.id]).length&&m.end)DONE[g.id]=1});
mergeLive();settleAll();
