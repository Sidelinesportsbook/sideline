/* ---------- Today's summary: the top of Home ----------
   Everything here comes from data the page already holds, in the viewer's own timezone:
     - games: ESPN's scoreboard (live scores, finals, kick-off times) for today's local date, plus scheduled games from the
       betting list that ESPN hasn't listed yet
     - performances: ESPN box scores (final, or live while a game is in progress, and labelled LIVE); compared with the
       player's season average from the same ESPN data; "Season high" only when the player's whole season is on hand
     - my day: the account's own bet records, through the same rules as the Profile and the Leaderboard (lbcore fromBet):
       a bet counts on the day it settled; open bets are listed apart and never counted; a cash-out counts at the amount
       taken (never an offer that wasn't taken)
   It is redrawn with Home on every live update (in place, so nothing moves). */
var DSF="all",DSX={};
function dsToday(t){const d=new Date(t),n=new Date();return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&d.getDate()===n.getDate()}
function dsGames(){const out=[],seen=new Set();
 Object.values(EVM).forEach(m=>{if(!m||!m.ts||!LGN[m.sp]||m.state==="void"||!dsToday(m.ts))return;const g=gameFor(m);seen.add(g.id);
  const lv=LIVE[g.id],live=m.state==="in",fin=m.state==="post";out.push({m,g,id:g.id,sp:m.sp,ts:m.ts,st:live?"in":fin?"post":"pre",h:m.h,a:m.a,hs:live&&lv?lv.h:m.h.sc,as:live&&lv?lv.a:m.a.sc,q:live?liveQ(lv||m):fin?(m.det||"Final"):""})});
 G.forEach(g=>{if(g.leg||seen.has(g.id)||!LGN[g.sp]||!dsToday(g.ts))return;out.push({g,id:g.id,sp:g.sp,ts:g.ts,st:"pre",h:{n:g.h},a:{n:g.a}})});
 return out.sort((x,y)=>({in:0,post:1,pre:2}[x.st]-{in:0,post:1,pre:2}[y.st])||(x.st==="post"?y.ts-x.ts:x.ts-y.ts))}
/* the box score for a game: final (RP / LRP) or, while it's on, the live one */
function dsBox(x){return x.st==="post"?(RP[x.id]||LRP[x.id]||null):x.st==="in"?((LIVE[x.id]||{}).p||null):null}
function dsPerf(games){const P=[];games.forEach(x=>{const b=dsBox(x);if(!b)return;for(const n in b){const s=b[n];if(!s)continue;
  if(x.sp==="nba"){if(s.pts==null)continue;const pl=NBAP[n],a=pl&&pl.c27,score=s.pts+1.2*(s.reb||0)+1.5*(s.ast||0)+2*((s.stl||0)+(s.blk||0));
   const tens=["pts","reb","ast","stl","blk"].filter(k=>(s[k]||0)>=10).length;let hi=false;
   if(x.st==="post"&&pl&&a&&a.gp){const rows=uniqLog(pl.lg).filter(r=>nbaSeasonOf(r[0])===SEASON.current&&r[17]!==String(x.id).slice(1));if(rows.length>=a.gp-1&&rows.length>=5)hi=s.pts>Math.max(...rows.map(r=>+r[5]))}   /* only with 5+ earlier games on hand: a "season high" after two games means little */
   P.push({x,n,s,sp:"nba",score,tens,hi,avg:a&&a.gp?a.pts:null,tm:s.tm})}
  else if((s.g||0)+(s.sa||0)>0)P.push({x,n,s,sp:"soc",score:(s.g||0)*10+(s.sa||0)*6+(s.sot||0),tm:s.tm})}});
 return P.sort((a,b)=>b.score-a.score)}
function dsMine(){let R=[];try{R=myRecs()}catch(e){}const set=R.filter(r=>r.x&&dsToday(r.s)),cnt=k=>set.filter(r=>r.x===k).length,counted=set.filter(r=>r.x!=="v");
 const staked=counted.reduce((a,r)=>a+r.k,0),ret=counted.reduce((a,r)=>a+r.r,0),open=S.bets.filter(b=>b.st==="open"),placed=S.bets.filter(b=>b.t&&dsToday(b.t)).length;
 return{set,w:cnt("w"),l:cnt("l"),c:cnt("c"),r:cnt("r"),v:cnt("v"),staked:Math.round(staked*100)/100,ret:Math.round(ret*100)/100,net:Math.round((ret-staked)*100)/100,open:open.length,openStake:Math.round(open.reduce((a,b)=>a+b.stake,0)*100)/100,placed}}
const dsLogo=(t,z)=>t&&t.n?mLogo(t,z):"";   /* the same official logos as the match pages (drawn crest until the image loads) */
function dsGameRow(x){const nba=x.sp==="nba",L=nba?x.a:x.h,R=nba?x.h:x.a,ls=nba?x.as:x.hs,rs=nba?x.hs:x.as,sc=x.st!=="pre",lw=sc&&ls>rs,rw=sc&&rs>ls;
 const chip=x.st==="in"?`<span class="dsch lv"><i></i>${esc(x.q||"Live")}</span>`:x.st==="post"?`<span class="dsch fn">${esc(/^Final/.test(x.q)?x.q.replace("Final","FT"):x.q||"FT")}</span>`:`<span class="dsch up">${new Date(x.ts).toLocaleTimeString("en-AU",{hour:"numeric",minute:"2-digit"})}</span>`;
 const top=x.st==="pre"?[]:dsPerf([x]).slice(0,3),open=x.st==="pre"?`data-open="${x.id}"`:`data-dsm="${esc(x.m?x.m.id:"")}"`;
 return`<details class="dsgm"${DSX["g"+x.id]?" open":""} data-dsx="g${x.id}"><summary>${chip}<span class="dst ${lw?"w":""}">${dsLogo(L,18)}<b>${esc(L.ab||tName(L))}</b>${sc?`<em>${ls}</em>`:""}</span><span class="dst ${rw?"w":""}">${dsLogo(R,18)}<b>${esc(R.ab||tName(R))}</b>${sc?`<em>${rs}</em>`:""}</span><i class="dscv" aria-hidden="true">›</i></summary>
 <div class="dsgx">${top.length?top.map(dsPerfRow).join(""):`<div class="tm">${x.st==="pre"?"Starts "+fmt(x.ts)+".":"Player stats appear once ESPN publishes the box score."}</div>`}<button class="more" ${open}>${x.st==="pre"?"Bet on this game ›":x.st==="in"?"Live match centre ›":"Match centre ›"}</button></div></details>`}
function dsLine(p){const s=p.s;if(p.sp==="nba")return[`<b>${s.pts}</b> PTS`,`${s.reb||0} REB`,`${s.ast||0} AST`,...(s.tpm?[`${s.tpm} 3PM`]:[]),...((s.stl||0)+(s.blk||0)>=3?[`${s.stl||0} STL · ${s.blk||0} BLK`]:[])].join(" · ");
 return[(s.g?`<b>${s.g}</b> goal${s.g>1?"s":""}`:""),(s.sa?`${s.sa} assist${s.sa>1?"s":""}`:""),(s.ss?`${s.ss} shot${s.ss>1?"s":""} (${s.sot||0} on target)`:"")].filter(Boolean).join(" · ")}
function dsPerfRow(p){const k=plName(p.n),team=p.x[p.tm]||{},tag=p.x.st==="in"?'<span class="dsb lv">LIVE</span>':"",
 badge=(p.hi?'<span class="dsb hi">Season high</span>':"")+(p.tens>=3?'<span class="dsb">Triple-double</span>':p.tens===2?'<span class="dsb">Double-double</span>':""),
 vs=p.sp==="nba"&&p.avg!=null&&p.x.st==="post"?`<small class="${p.s.pts>p.avg?"won":p.s.pts<p.avg?"lost":""}">${p.s.pts>=p.avg?"+":""}${f1(p.s.pts-p.avg)} vs season avg ${f1(p.avg)}</small>`:"";
 return`<div class="dspf">${avatar(p.n,null,p.sp,30)}<span class="dspn">${k?`<button class="pnm" data-ply="${esc(k)}">${esc(p.n)}</button>`:`<b>${esc(p.n)}</b>`} ${dsLogo(team,14)} ${tag}${badge}<small>${dsLine(p)}</small>${vs}</span></div>`}
function dailySummary(){if(view)return"";const all=dsGames(),sps=[...new Set(all.map(x=>x.sp))],f=sps.includes(DSF)?DSF:"all",games=all.filter(x=>f==="all"||x.sp===f);
 const n=k=>games.filter(x=>x.st===k).length,perf=dsPerf(games),M=dsMine(),now=new Date();
 const upd=typeof POLL!=="undefined"&&POLL.at?POLL.at:0,stale=typeof POLL!=="undefined"&&POLL.state==="err",any=n("in")>0;
 const when=upd?`${stale?'<b class="lost">Live scores delayed</b> · last update ':"Updated "}${new Date(upd).toLocaleTimeString("en-AU",{hour:"numeric",minute:"2-digit"})}`:"Connecting to live scores…";
 const tabs=sps.length>1?`<div class="gbf dsf">${[["all","All"],...sps.map(s=>[s,LGN[s]])].map(([k,l])=>`<button data-dsf="${k}" class="${f===k?"on":""}">${esc(l)}</button>`).join("")}</div>`:"";
 const GL=DSX.allg?games:games.slice(0,5),PL=DSX.allp?perf.slice(0,10):perf.slice(0,4);
 const gamesBox=`<div class="dsbx"><div class="dsbh"><h3>Games today</h3><span class="tm">${n("in")?`<b class="lvt">${n("in")} live</b> · `:""}${n("post")} final · ${n("pre")} to come</span></div>
  ${games.length?GL.map(dsGameRow).join("")+(games.length>5?`<button class="dsmore" data-dsall="g">${DSX.allg?"Show fewer":"Show all "+games.length+" games"}</button>`:""):`<div class="dsem">No games today${f!=="all"?" in "+esc(LGN[f]):""}. ${(()=>{const nx=G.filter(g=>!g.leg&&g.ts>Date.now()&&(f==="all"||g.sp===f)).sort((a,b)=>a.ts-b.ts)[0];return nx?"Next: "+esc(nx.a)+" @ "+esc(nx.h)+", "+fmt(nx.ts)+".":""})()}</div>`}
  <button class="dslink" data-pg="past">View all results ›</button></div>`;
 const perfBox=`<div class="dsbx"><div class="dsbh"><h3>Top performances</h3><span class="tm">${perf.some(p=>p.x.st==="in")?"includes live games":"from final box scores"}</span></div>
  ${perf.length?PL.map(dsPerfRow).join("")+(perf.length>4?`<button class="dsmore" data-dsall="p">${DSX.allp?"Show fewer":"Show more"}</button>`:""):`<div class="dsem">${n("in")+n("post")?"Waiting for ESPN's box scores.":"Performances appear once today's games start."}</div>`}</div>`;
 const mine=`<div class="dsbx dsme"><div class="dsbh"><h3>My day</h3><button class="dslink" data-pg="mb">My bets ›</button></div>
  ${M.set.length?`<div class="dsnet"><b class="${M.net>0?"won":M.net<0?"lost":""}">${sgn(M.net)}</b><small>net from ${M.set.length-M.v} bet${M.set.length-M.v===1?"":"s"} settled today</small></div>
  <div class="dsrec"><span class="won">${M.w} won</span><span class="lost">${M.l} lost</span>${M.c?`<span>${M.c} cashed out</span>`:""}${M.r?`<span>${M.r} refunded</span>`:""}${M.v?`<span>${M.v} void</span>`:""}</div>
  <div class="dskv"><span>Staked <b>${$$(M.staked)}</b></span><span>Returned <b>${$$(M.ret)}</b></span></div>`:`<div class="dsem">No bets settled today.</div>`}
  <div class="dsopen">${M.open?`<b>${M.open}</b> open bet${M.open===1?"":"s"} (${$$(M.openStake)} staked) still to settle; not counted above.`:"No open bets."}${M.placed?` ${M.placed} placed today.`:""}</div></div>`;
 return`<section class="dsum" aria-label="Today's summary"><div class="dshd"><div><h2 class="dsti">Today's summary</h2><small>${now.toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"long"})} · ${when}${any?' <span class="lvb"><i></i>LIVE</span>':""}</small></div>${tabs}</div>
 <div class="dsgr">${gamesBox}${perfBox}${mine}</div></section>`}
const _heroDS=hero;hero=function(){return _heroDS()+dailySummary()};
/* open state of a game row is remembered, so a live update never collapses it */
document.addEventListener("toggle",e=>{const d=e.target;if(d&&d.matches&&d.matches("details[data-dsx]"))DSX[d.dataset.dsx]=d.open},true);
document.addEventListener("click",e=>{const t=e.target;if(!t||!t.closest)return;
 const f=t.closest("[data-dsf]");if(f){e.stopPropagation();DSF=f.dataset.dsf;renderTabs();return}
 const a=t.closest("[data-dsall]");if(a){e.stopPropagation();const k="all"+a.dataset.dsall;DSX[k]=!DSX[k];renderTabs();return}
 const m=t.closest("[data-dsm]");if(m){e.stopPropagation();const ev=EVM[m.dataset.dsm];if(ev)openMatch(gameFor(ev).id,"home");return}},true);
