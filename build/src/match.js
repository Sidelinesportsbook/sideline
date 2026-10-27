/* ---------- match centre: the full page for a finished game, on the same game page used for upcoming and live games ----------
   Everything comes from ESPN's summary for that exact event id: line score, team stats, full box score (starters, bench, DNP),
   play-by-play (NBA) or match events (soccer), lineups and formations. Finished games are cached on this device, so they open
   instantly the next time. Anything ESPN doesn't publish is shown as unavailable, never estimated. */
const MC={},MCERR={};let MTAB="ov",MFROM=null,MQ=0;
try{Object.assign(MC,JSON.parse(localStorage.getItem("sl_mc")||"{}"))}catch(e){}
function mcSave(){try{const ids=Object.keys(MC).filter(k=>MC[k].fin).sort((a,b)=>(MC[b].at||0)-(MC[a].at||0)).slice(0,12),o={};ids.forEach(k=>{o[k]={...MC[k],pbp:undefined,com:undefined}});localStorage.setItem("sl_mc",JSON.stringify(o))}catch(e){}}
const evOf=g=>g&&(EVM[g.eid]||(ALIAS[g.id]&&EVM[ALIAS[g.id].g.slice(1)])||(String(g.id)[0]==="e"&&EVM[String(g.id).slice(1)]));
const mPath=m=>m.path||ESP[m.sp];
function parseMatch(m,j){const comp=(((j.header||{}).competitions)||[])[0]||{},cs=comp.competitors||[],SID={};cs.forEach(c=>{SID[String(c.id||(c.team||{}).id)]=c.homeAway==="home"?"h":"a"});
 const side=id=>SID[String(id)]||"a",o={id:m.id,sp:m.sp,at:Date.now(),fin:!!(((comp.status||{}).type||{}).completed),lines:{h:[],a:[]},teams:{h:[],a:[]},players:{},pbp:[],events:[],rosters:{},info:{}};
 cs.forEach(c=>{const s=c.homeAway==="home"?"h":"a";o.lines[s]=(c.linescores||[]).map(x=>x.displayValue!=null?x.displayValue:x.value);const t=c.team||{};
  const cur=m[s]||(m[s]={});if(!cur.logo)cur.logo=(t.logos&&t.logos[0]&&t.logos[0].href)||t.logo||"";if(!cur.id)cur.id=String(t.id||c.id||"");if(!cur.ab)cur.ab=t.abbreviation||"";if(c.score!=null)cur.sc=NV(c.score)});
 ((j.boxscore||{}).teams||[]).forEach(t=>{o.teams[side((t.team||{}).id)]=(t.statistics||[]).map(s=>[s.label||s.abbreviation||s.name,s.displayValue!=null?s.displayValue:s.value,s.name])});
 const gi=j.gameInfo||{};o.info={venue:gi.venue&&gi.venue.fullName,att:gi.attendance,league:((j.header||{}).league||{}).name};
 if(m.sp==="nba"){((j.boxscore||{}).players||[]).forEach(t=>{const st=(t.statistics||[])[0];if(!st)return;o.players[side((t.team||{}).id)]={lab:st.labels||[],tot:st.totals||[],rows:(st.athletes||[]).map(a=>({n:plById((a.athlete||{}).id)||PN[pkey((a.athlete||{}).displayName||"")]||(a.athlete||{}).displayName,id:(a.athlete||{}).id,pos:((a.athlete||{}).position||{}).abbreviation||"",st:!!a.starter,dnp:!!a.didNotPlay||!(a.stats&&a.stats.length),why:a.reason||"",s:a.stats||[]}))}});
  /* every play keeps ESPN's own id, so a refresh replaces plays (corrections included) instead of adding duplicates. The order is ESPN's
     own (chronological): a play ESPN adds or corrects later gets a higher sequence number but sits in its real place in the list */
  o.pbp=(j.plays||[]).map(p=>{const c=p.coordinate||{},ty=(p.type||{}).text||"",tx=p.text||"",v=+p.pointsAttempted||(p.shootingPlay?(/^Free Throw/.test(ty)?1:/three point/.test(tx)?3:2):0),ok=p.shootingPlay&&v>1&&c.x>=-2&&c.x<=52&&c.y>=-2&&c.y<=94,a0=p.participants&&p.participants[0]&&p.participants[0].athlete,d=(tx.match(/(\d+)-foot/)||[])[1];
   return{id:p.id,s:+p.sequenceNumber||0,q:(p.period||{}).number,c:(p.clock||{}).displayValue||"",t:tx,ty,sc:!!p.scoringPlay,v,shp:!!p.shootingPlay,pid:a0?String(a0.id):"",x:ok?c.x:null,y:ok?c.y:null,d:d==null?null:+d,h:p.homeScore,a:p.awayScore,tm:p.team?side(p.team.id):""}});
  const seen=new Set();o.pbp=o.pbp.filter(p=>!p.id||!seen.has(p.id)&&seen.add(p.id))}
 else{o.events=(j.keyEvents||[]).map(e=>({min:(e.clock||{}).displayValue||"",type:(e.type||{}).text||"",t:e.text||e.shortText||"",tm:e.team?side(e.team.id):"",sc:!!e.scoringPlay})).filter(e=>e.type&&!/^(Kickoff|Start|End|Halftime)/i.test(e.type)||e.sc);
  /* the full match feed (shots, fouls, corners, offsides, cards, subs, goals) with each shot's position, matched to a side by team name */
  const NM={};cs.forEach(c=>{const t=c.team||{},s=c.homeAway==="home"?"h":"a";[t.displayName,t.shortDisplayName,t.name].forEach(x=>{if(x)NM[x]=s})});const seen=new Set();
  o.com=(j.commentary||[]).map((c,i)=>{const p=c.play||{},ty=(p.type||{}).text||"";return{id:p.id||"c"+(c.sequence??i),s:+(c.sequence??i),min:(c.time||{}).displayValue||(p.clock||{}).displayValue||"",ty,t:c.text||p.text||"",tm:p.team?NM[p.team.displayName]||"":"",sc:!!p.scoringPlay||/^Goal|^Own Goal|Penalty - Scored/i.test(ty),x:p.fieldPositionX??null,y:p.fieldPositionY??null}}).filter(e=>!seen.has(e.id)&&seen.add(e.id));
  (j.rosters||[]).forEach(r=>{const s=r.homeAway==="home"?"h":r.homeAway==="away"?"a":side((r.team||{}).id);o.rosters[s]={form:r.formation||"",rows:(r.roster||[]).map(a=>{const x={};(a.stats||[]).forEach(q=>{x[q.name]=q.value});return{n:plById((a.athlete||{}).id)||PN[pkey((a.athlete||{}).displayName||"")]||(a.athlete||{}).displayName,id:(a.athlete||{}).id,pos:(a.position||{}).abbreviation||"",j:a.jersey||"",st:!!a.starter,on:!!a.subbedIn,off:!!a.subbedOut,x}})}})}
 return o}
async function loadMatch(m,force){if(!force&&MC[m.id]&&(MC[m.id].fin||Date.now()-MC[m.id].at<6e4))return MC[m.id];
 const j=await jget(EB+mPath(m)+"/summary?event="+m.id);MC[m.id]=parseMatch(m,j);delete MCERR[m.id];if(MC[m.id].fin)mcSave();return MC[m.id]}
/* opening a finished game: from Past games, bet history, profiles, or any game card */
function openMatch(gid,from){const g=GM[gid];if(!g)return;MFROM=from||null;if(from==="past")MQ=scrollY;$("#psw").innerHTML="";SHEET=null;NAV=[];pg="bets";view=gid;dtab="main";MTAB="ov";render();scrollTo(0,0)}
async function openMatchById(id,path,sp){if(!EVM[id]){try{const j=await jget(EB+path+"/summary?event="+id),c=((((j.header||{}).competitions)||[])[0])||{},cs=c.competitors||[],H=cs.find(x=>x.homeAway==="home"),A=cs.find(x=>x.homeAway==="away"),t=(c.status||{}).type||{};
  if(!H||!A)throw 0;const sd=x=>({n:(x.team||{}).displayName,ab:(x.team||{}).abbreviation||"",logo:((x.team||{}).logos||[{}])[0].href||"",sc:NV(x.score),id:String((x.team||{}).id)});
  EVM[id]={id:String(id),sp:sp||"soc",path,iso:c.date,ts:Date.parse(c.date),state:t.state,stn:t.name,det:t.shortDetail||t.detail||"",h:sd(H),a:sd(A),at:Date.now(),old:1};MC[id]=parseMatch(EVM[id],j)}catch(e){toast("Couldn't load that match from ESPN right now.");return}}
 const g=gameFor(EVM[id]);openMatch(g.id,"profile")}
/* the page itself */
const _renderDetail0=renderDetail;renderDetail=function(){const g=GM[view],m=evOf(g);if(!g||!m||(m.state!=="post"&&!(m.state==="in"&&(LIVE[g.id]||RES[g.id]))))return _renderDetail0();keepScroll(()=>renderMatch(g,m))};
/* re-rendering keeps where you were: table side-scroll and the play-by-play list */
function keepScroll(fn){const tw=[...document.querySelectorAll("#games .tw")].map(t=>t.scrollLeft),pb=($("#games .mpbp")||{}).scrollTop||0;fn();document.querySelectorAll("#games .tw").forEach((t,i)=>{if(tw[i])t.scrollLeft=tw[i]});const p=$("#games .mpbp");if(p&&pb)p.scrollTop=pb}
const MCF={};let LREF=0;
function liveRefresh(g,m){if(LREF||Date.now()-((MC[m.id]||{}).at||0)<2e4)return;LREF=1;loadMatch(m,1).then(()=>{delete MCF[m.id]},()=>{MCF[m.id]=Date.now()}).finally(()=>{LREF=0;if(view===g.id&&pg==="bets")renderGames()})}
const mLogo=(s,z)=>tmLogo(s,z);
const tName=s=>SAL0[s.n]||s.n;
function mBets(m,g){const ids=new Set([g.id,"e"+m.id]);for(const k in ALIAS)if(ALIAS[k].g==="e"+m.id)ids.add(k);return S.bets.map((b,i)=>[b,i]).filter(([b])=>b.legs.some(l=>ids.has(l.g)))}
function renderMatch(g,m){const mc=MC[m.id],err=MCERR[m.id],bs=mBets(m,g),soc=m.sp!=="nba";
 if(mc&&(soc?!mc.com&&(MTAB==="tl"||MTAB==="map"):!mc.pbp&&(MTAB==="pbp"||MTAB==="shots"||MTAB==="ov"))&&!MCERR["l"+m.id]){MCERR["l"+m.id]=1;loadMatch(m,1).catch(()=>{}).finally(()=>{delete MCERR["l"+m.id];if(view===g.id)renderGames()})}
 if(!mc&&!err&&!MCERR["l"+m.id]){MCERR["l"+m.id]=1;loadMatch(m).catch(()=>{MCERR[m.id]=1}).finally(()=>{delete MCERR["l"+m.id];if(view===g.id&&pg==="bets")renderGames()})}
 const tabs=[["ov","Overview"],["box",soc?"Player stats":"Box score"],["team","Team stats"],[soc?"tl":"pbp",soc?"Timeline":"Play-by-play"],soc?["map","Shot map"]:["shots","Shot chart"],...(soc?[["line","Lineups"]]:[]),["bets",`Your bets${bs.length?" ("+bs.length+")":""}`]];
 if(!tabs.some(t=>t[0]===MTAB))MTAB="ov";
 const order=soc?["h","a"]:["a","h"],fin=finalOf(m)||[m.h.sc,m.a.sc],e=endAt(m),live=m.state==="in",lv=LIVE[g.id];
 if(live&&lv&&g.id==="e"+m.id){m.h.sc=lv.h;m.a.sc=lv.a}
 if(live&&mc&&!MCERR["l"+m.id])liveRefresh(g,m);
 const hero=`<div class="card mh"><div class="mhs">${order.map(k=>{const s=m[k],w=k==="h"?m.h.sc>m.a.sc:m.a.sc>m.h.sc;return`<div class="mht${w?" w":""}"><button class="tnm" data-team="${esc(tName(s))}">${mLogo(s,44)}</button><button class="tnm mhn" data-team="${esc(tName(s))}">${esc(tName(s))}</button><b>${s.sc}</b></div>`}).join(`<div class="mhm">${live?`<span class="lvb"><i></i>LIVE</span><b class="mhq">${esc(liveQ(lv||m))}</b>`:`<span>${esc(m.det||"Final")}</span>`}<small>${esc(LGN[m.sp]||(mc&&mc.info.league)||"")}</small></div>`)}</div>
  <div class="mhi"><span>${fmt(m.ts)}</span>${live?`<span>${mc?"Box score updated "+new Date(mc.at).toLocaleTimeString([],{hour:"numeric",minute:"2-digit",second:"2-digit"}):"Loading live box score…"}${MCF[m.id]?" · ESPN slow to respond, retrying":""}</span>`:""}${!live&&e.ok?`<span>Finished ${new Date(e.t).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}</span>`:""}${mc&&mc.info.venue?`<span>${esc(mc.info.venue)}</span>`:""}${isAET(m)&&m.reg?`<span>90 min: ${m.reg[0]} – ${m.reg[1]}</span>`:""}</div></div>`;
 const back=MFROM==="past"?`<button class="back" data-pback="1">‹ Back to Past games</button>`:`<button class="back" data-back="1">‹ Back</button>`;
 let body;
 if(!mc&&!err)body=skel([20,"30%"],96,[20,"24%"],200,120)+`<div class="tm note">Loading the full match from ESPN…</div>`;
 else if(MTAB==="bets")body=mBetsTab(m,g,bs);
 else if(!mc)body=`<div class="card"><div class="msg">Couldn't reach ESPN for the full box score (offline or blocked). ${live?"Live player stats from the shared feed":"The final score and saved player stats"} are below.</div></div>${boxTable(m,RP[g.id]||LRP[g.id]||(lv&&lv.p)||{})}`;
 else if(MTAB==="ov")body=mOverview(m,mc,g,bs);
 else if(MTAB==="box")body=soc?mSocPlayers(m,mc):mNbaBox(m,mc);
 else if(MTAB==="team")body=mTeamStats(m,mc);
 else if(MTAB==="pbp")body=mPbp2(m,mc);
 else if(MTAB==="shots")body=mShots(m,mc);
 else if(MTAB==="map")body=mShotMap(m,mc);
 else if(MTAB==="tl")body=mTimeline2(m,mc);
 else body=mLineups(m,mc);
 $("#games").innerHTML=`${back}${hero}<div class="tabs mtabs">${tabs.map(([k,l])=>`<button data-mt="${k}" class="${MTAB===k?"on":""}">${l}</button>`).join("")}</div><div class="mbody">${body}</div><div class="tm note">Source: ESPN, event ${esc(m.id)}. Statistics ESPN doesn't publish for this game are shown as unavailable.</div>`}
function lineScore(m,mc){const n=Math.max(mc.lines.h.length,mc.lines.a.length);if(!n)return`<div class="cempty" style="height:56px">Scoring by period not published</div>`;
 const soc=m.sp!=="nba",hd=i=>soc?(i<2?(i?"2H":"1H"):i<4?"ET"+(i-1):"Pens"):(i<4?"Q"+(i+1):"OT"+(i>4?i-3:""));
 return`<div class="tw"><table class="tb mls"><thead><tr><th></th>${Array.from({length:n},(_,i)=>`<th>${hd(i)}</th>`).join("")}<th>${soc?"FT":"T"}</th></tr></thead><tbody>${(soc?["h","a"]:["a","h"]).map(k=>`<tr><td>${mLogo(m[k],18)} ${esc(m[k].ab||tName(m[k]))}</td>${Array.from({length:n},(_,i)=>`<td>${mc.lines[k][i]??"–"}</td>`).join("")}<td><b>${m[k].sc}</b></td></tr>`).join("")}</tbody></table></div>`}
const plink=(n,id)=>{const k=plName(n,id);return k?`<button class="pnm" data-ply="${esc(k)}">${esc(n)}</button>`:esc(n)};
function mOverview(m,mc,g,bs){const soc=m.sp!=="nba";let lead="";
 if(!soc){const L=(k,stat)=>{const p=mc.players[k];if(!p)return null;const ix=p.lab.indexOf(stat);if(ix<0)return null;const r=p.rows.filter(x=>!x.dnp).sort((a,b)=>NV(b.s[ix])-NV(a.s[ix]))[0];return r?[r.n,r.s[ix],r.id]:null};
  lead=`<h2>Team leaders</h2><div class="mlead">${["a","h"].map(k=>`<div class="card"><div class="pn">${mLogo(m[k],20)} <b>${esc(tName(m[k]))}</b></div>${[["PTS","Points"],["REB","Rebounds"],["AST","Assists"]].map(([s,l])=>{const x=L(k,s);return`<div class="kv"><span>${l}</span><span class="bxp">${x?avatar(x[0],x[2],"nba",22)+plink(x[0],x[2])+` <b>${x[1]}</b>`:"–"}</span></div>`}).join("")}</div>`).join("")}</div>`}
 else{const ev=mc.events.filter(e=>e.sc||/card/i.test(e.type));lead=`<h2>Goals and cards</h2>${ev.length?`<div class="card">${ev.map(evRow(m)).join("")}</div>`:'<div class="cempty" style="height:56px">No goals or cards recorded</div>'}`}
 const key=soc?["possessionPct","totalShots","shotsOnTarget","wonCorners"]:["fieldGoalPct","threePointFieldGoalPct","totalRebounds","assists"];
 const kt=key.map(k=>{const a=(mc.teams.a.find(x=>x[2]===k)||[]),h=(mc.teams.h.find(x=>x[2]===k)||[]);return a[1]==null&&h[1]==null?"":cmpRow(a[0]||h[0],soc?h[1]:a[1],soc?a[1]:h[1])}).join("");
 const mine=bs.length?`<h2>Your bets on this game</h2>${bs.slice(0,3).map(([b,i])=>legCompare(b,g)).join("")}${bs.length>3?`<button class="more" data-mt="bets">All ${bs.length} bets ›</button>`:""}`:"";
 return`<h2>Score by ${soc?"half":"quarter"}</h2>${lineScore(m,mc)}${soc?"":gameFlow(m,mc)}${lead}${kt?`<h2>Key stats</h2><div class="card">${cmpHead(m)}${kt}</div>`:""}${mine}`}
const cmpHead=m=>{const o=m.sp!=="nba"?["h","a"]:["a","h"];return`<div class="cmh"><span>${mLogo(m[o[0]],18)} ${esc(m[o[0]].ab||"")}</span><span></span><span>${esc(m[o[1]].ab||"")} ${mLogo(m[o[1]],18)}</span></div>`};
function cmpRow(lab,l,r){const a=parseFloat(l),b=parseFloat(r),ok=!isNaN(a)&&!isNaN(b)&&a+b>0,pl=ok?a/(a+b)*100:50;
 return`<div class="cmr"><b class="${ok&&a>b?"lead":""}">${l??"–"}</b><span>${esc(lab)}</span><b class="${ok&&b>a?"lead":""}">${r??"–"}</b><div class="cmb"><i style="width:${pl}%"></i><i style="width:${100-pl}%"></i></div></div>`}
function mTeamStats(m,mc){const o=m.sp!=="nba"?["h","a"]:["a","h"],L=mc.teams[o[0]],R=mc.teams[o[1]];if(!L.length&&!R.length)return`<div class="cempty">ESPN hasn't published team statistics for this game.</div>`;
 const names=[...new Set([...L,...R].map(x=>x[2]))];return`<div class="card">${cmpHead(m)}${names.map(k=>{const a=L.find(x=>x[2]===k)||[],b=R.find(x=>x[2]===k)||[];return cmpRow(a[0]||b[0],a[1],b[1])}).join("")}</div>`}
function mNbaBox(m,mc){return["a","h"].map(k=>{const p=mc.players[k];if(!p)return`<div class="cempty">Box score not published for ${esc(tName(m[k]))}.</div>`;
 const row=r=>r.dnp?`<tr class="dnp"><td><span class="bxp">${avatar(r.n,r.id,"nba",24)}${plink(r.n,r.id)}<small> ${esc(r.pos)}</small></span></td><td colspan="${p.lab.length}">DNP${r.why?" · "+esc(r.why):""}</td></tr>`:`<tr><td><span class="bxp">${avatar(r.n,r.id,"nba",24)}${plink(r.n,r.id)}<small> ${esc(r.pos)}</small></span></td>${r.s.map((v,i)=>`<td class="${p.lab[i]==="PTS"?"bx":""}">${esc(v)}</td>`).join("")}</tr>`;
 const st=p.rows.filter(r=>r.st),bn=p.rows.filter(r=>!r.st&&!r.dnp),dn=p.rows.filter(r=>!r.st&&r.dnp);
 return`<h2 class="mbh">${mLogo(m[k],20)} ${esc(tName(m[k]))}</h2><div class="tw"><table class="tb mbx"><thead><tr><th>Starters</th>${p.lab.map(l=>`<th>${esc(l)}</th>`).join("")}</tr></thead><tbody>${st.map(row).join("")}
 ${bn.length?`<tr class="sec"><td colspan="${p.lab.length+1}">Bench</td></tr>${bn.map(row).join("")}`:""}${dn.length?`<tr class="sec"><td colspan="${p.lab.length+1}">Did not play</td></tr>${dn.map(row).join("")}`:""}
 ${p.tot&&p.tot.length?`<tr class="tot"><td>Team</td>${p.tot.map(v=>`<td>${esc(v)}</td>`).join("")}</tr>`:""}</tbody></table></div>`}).join("")}
function mSocPlayers(m,mc){const cols=[["totalGoals","G"],["goalAssists","A"],["totalShots","SH"],["shotsOnTarget","SOT"],["foulsCommitted","FC"],["foulsSuffered","FS"],["yellowCards","YC"],["redCards","RC"],["saves","SV"]];
 return["h","a"].map(k=>{const r=mc.rosters[k];if(!r||!r.rows.length)return`<div class="cempty">Player statistics not published for ${esc(tName(m[k]))}.</div>`;const used=cols.filter(([c])=>r.rows.some(p=>p.x[c]!=null));
  const pl=r.rows.filter(p=>p.st||p.on);return`<h2 class="mbh">${mLogo(m[k],20)} ${esc(tName(m[k]))}</h2><div class="tw"><table class="tb mbx"><thead><tr><th>Player</th>${used.map(([,l])=>`<th>${l}</th>`).join("")}</tr></thead><tbody>${pl.map(p=>`<tr><td><span class="bxp">${avatar(p.n,p.id,"soc",24)}${plink(p.n,p.id)}<small> ${esc(p.pos)}${p.on?" · sub":""}</small></span></td>${used.map(([c])=>`<td class="${c==="totalGoals"&&p.x[c]>0?"bx":""}">${p.x[c]??"–"}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`}).join("")+`<div class="tm note">Player ratings, passes and tackles aren't published by ESPN for these matches.</div>`}
const evIcon=e=>/goal|penalty - scored/i.test(e.type)?"⚽":/yellow/i.test(e.type)?"🟨":/red/i.test(e.type)?"🟥":/sub/i.test(e.type)?"⇄":"•";
const evRow=m=>e=>`<div class="mev ${e.tm}"><span class="mmin">${esc(e.min)}</span><span class="mic">${evIcon(e)}</span><span>${esc(e.t||e.type)}</span>${e.tm?mLogo(m[e.tm],16):""}</div>`;
function mTimeline(m,mc){return mc.events.length?`<div class="card">${mc.events.map(evRow(m)).join("")}</div>`:`<div class="cempty">ESPN hasn't published match events for this game.</div>`}
let PBQ=0;
function mPbp(m,mc){if(!mc.pbp||!mc.pbp.length)return`<div class="cempty">${mc.fin&&!mc.pbp?"Play-by-play loads from ESPN; reconnect to view it.":"Play-by-play not published for this game."}</div>`;
 const qs=[...new Set(mc.pbp.map(p=>p.q))].filter(Boolean),q=PBQ&&qs.includes(PBQ)?PBQ:qs[qs.length-1],rows=mc.pbp.filter(p=>p.q===q).slice().reverse();
 return`<div class="gbf">${qs.map(x=>`<button data-pbq="${x}" class="${x===q?"on":""}">${x<=4?"Q"+x:"OT"+(x-4)}</button>`).join("")}<button data-pbq="-1" class="${PBQ===-1?"on":""}">Scoring only</button></div>
 <div class="card mpbp">${(PBQ===-1?mc.pbp.filter(p=>p.sc).slice().reverse():rows).map(p=>`<div class="mpr${p.sc?" sc":""}"><span class="mmin">${PBQ===-1?(p.q<=4?"Q"+p.q:"OT")+" ":""}${esc(p.c)}</span>${p.tm?mLogo(m[p.tm],16):"<span></span>"}<span>${esc(p.t)}</span><b>${p.a??""}–${p.h??""}</b></div>`).join("")}</div>`}
function mLineups(m,mc){return`<div class="mlu">${["h","a"].map(k=>{const r=mc.rosters[k];if(!r)return`<div class="cempty">Lineup not published.</div>`;const st=r.rows.filter(p=>p.st),sb=r.rows.filter(p=>!p.st);
 return`<div class="card"><div class="pn">${mLogo(m[k],20)} <b>${esc(tName(m[k]))}</b><small class="tm" style="margin-left:auto">${r.form?"Formation "+esc(r.form):"Formation not published"}</small></div><h2>Starting XI</h2>${st.map(p=>`<div class="kv"><span class="bxp"><small class="tm">${esc(p.j)}</small>${avatar(p.n,p.id,"soc",24)}${plink(p.n,p.id)}</span><small class="tm">${esc(p.pos)}${p.off?" · off":""}</small></div>`).join("")||'<div class="tm">Not published</div>'}
 <h2>Substitutes</h2>${sb.map(p=>`<div class="kv"><span class="bxp"><small class="tm">${esc(p.j)}</small>${avatar(p.n,p.id,"soc",24)}${plink(p.n,p.id)}</span><small class="tm">${esc(p.pos)}${p.on?" · came on":" · unused"}</small></div>`).join("")||'<div class="tm">Not published</div>'}</div>`}).join("")}</div>`}
/* bets: every leg against what actually happened */
function legCompare(b,g){const nm={open:"PENDING",won:"WON",lost:"LOST",ref:"REFUNDED",void:"VOID",cash:"CASHED OUT"}[b.st],pay=b.st==="won"?b.stake*b.odds:b.st==="cash"&&b.co?b.co.amt:b.st==="ref"||b.st==="void"?b.stake:0,pl=b.st==="open"?null:pay-b.stake;
 return`<div class="card mbet"><div class="bh"><span><span class="chip c-${b.st}">${nm}</span>${b.ins?'<span class="chip">MISS-1</span>':""}</span><span class="tm">${b.legs.length>1?"Multi · "+b.legs.length+" legs":"Single"} · ${fmt(b.t)}</span></div>
 ${b.legs.map(l=>{const p=legProg(l),r=l.r==="w"?"hit":l.r==="l"?"miss":l.r==="v"?"void":"pend";return`<div class="mleg ${r}"><span class="mlm">${r==="hit"?"✓":r==="miss"?"✕":r==="void"?"–":"•"}</span><div><b>${legD(l)}</b><small>@${f2(l.odds)}${l.vr?" · void: "+esc(l.vr):""}</small><small class="mlt">${esc(p.txt||"")}</small></div><span class="mlr">${r==="hit"?"Hit":r==="miss"?"Missed":r==="void"?"Void":"Pending"}</span></div>`}).join("")}
 <div class="bf"><div><small>Stake</small><b>${$$(b.stake)}</b></div><div><small>Odds</small><b>${f2(b.odds)}</b></div><div><small>${b.st==="cash"?"Cashed out":b.st==="open"?"To win":"Returned"}</small><b>${$$(b.st==="open"?b.stake*b.odds:pay)}</b></div><div><small>Profit / loss</small><b class="${pl>0?"won":pl<0?"lost":""}">${pl==null?"–":sgn(pl)}</b></div></div></div>`}
function mBetsTab(m,g,bs){return bs.length?bs.map(([b])=>legCompare(b,g)).join(""):`<div class="cempty">You had no bets on this game.</div>`}
/* clicks: Past games cards open the match page; tabs; back keeps Past games filters and scroll */
document.addEventListener("click",e=>{const t=e.target;if(!t||!t.closest)return;
 const c=t.closest("[data-pgm]");if(c&&!t.closest("[data-team],[data-ply]")){e.stopPropagation();const m=EVM[c.dataset.pgm];if(m){const g=gameFor(m);openMatch(g.id,"past")}return}
 const mt=t.closest("[data-mt]");if(mt){e.stopPropagation();MTAB=mt.dataset.mt;renderGames();return}
 const q=t.closest("[data-pbq]");if(q){e.stopPropagation();PBQ=+q.dataset.pbq;renderGames();return}
 if(t.closest("[data-pback]")){e.stopPropagation();view=null;MFROM=null;pg="past";render();navRestore();return}
 const mx=t.closest("[data-mx]");if(mx){e.stopPropagation();openMatchById(mx.dataset.mx,mx.dataset.mp,mx.dataset.ms);return}
 const ob=t.closest(".bc [data-open]");if(ob){e.stopPropagation();openMatch(ob.dataset.open,"bets");return}
 const op=t.closest("[data-open]");if(op&&MFROM&&!t.closest("#psw")){MFROM=null}},true);
/* bet history: every finished game in a bet links to its match page */
const _betDetail0=betDetail;betDetail=function(b){let h=_betDetail0(b);[...new Set(b.legs.map(l=>l.g))].filter(id=>GM[id]&&RES[id]).forEach(id=>{const g=GM[id];h=h.replace(`<span>${g.a} @ ${g.h}</span>`,`<span>${g.a} @ ${g.h} <button class="more" data-open="${id}">Match centre ›</button></span>`)});return h};
