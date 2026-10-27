/* ---------- Leaderboard ----------
   Every account is on the leaderboard, always (told at sign-up and once in the app); there is no leaving. Players can only
   hide their bet history, which keeps them ranked on their totals. This device keeps a public copy
   of the account's bets in lb/<account id> (Firestore rules: anyone may read it, only that signed-in account may write it,
   under its own username). Every 30 minutes GitHub's servers check those bets against the official results and publish
   leaderboard.json (lb-agg.js + lbcore.js); between checks this page ranks live from the records themselves (below) with the same engine, so the rankings, public
   profiles and your own profile all use the same rules. Leaving deletes the public copy. Hiding your profile keeps you
   ranked with your totals, without your bet history. */
const LB={data:null,at:0,err:"",busy:false,all:false,open:null,myId:"",pub:"",f:{period:"all",metric:"net",sport:"all",type:"all",min:10}};
const LB_SITE=()=>!!window.SL_CLOUD&&!!window.SL_FS,LB_ART=()=>!!window.claude&&!window.SL_CLOUD;   /* LB_ART: the Claude version, which has no leaderboard of its own */
const lbSet=()=>{const s=S.lb||(S.lb={prof:true});s.on=true;delete s.out;if(s.prof===undefined)s.prof=true;return s};
/* settled-at times: stamped when a bet settles, so period filters use when it was decided, not when it was placed */
const _settleLB=settleAll;settleAll=function(){const open=S.bets.filter(b=>b.st==="open");_settleLB();let ch=false;
 open.forEach(b=>{if(b.st!=="open"&&!b.sat){b.sat=b.co&&b.co.t||Date.now();ch=true}});if(ch)save()};
const lbSp=g=>(GM[g]&&GM[g].sp)||((typeof EVM!=="undefined"&&EVM[String(g).slice(1)])||{}).sp||"";
const lbEnd=legs=>{const t=legs.map(l=>{const e=typeof EVM!=="undefined"&&EVM[String(l.g).slice(1)];return e&&e.end?Date.parse(e.end):GM[l.g]?GM[l.g].ts+3*36e5:0}).filter(Boolean);return t.length?Math.min(Date.now(),Math.max(...t)):0};
const myRecs=()=>S.bets.map(b=>LBC.fromBet(b,lbSp,lbEnd));
/* the public copy: only what's needed to check each bet (no balance, slip, email or password) */
const lbRaw=b=>({t:b.t,st:b.st,stake:b.stake,odds:b.odds,ins:b.ins?1:0,bx:b.bx||1,sat:b.sat||null,co:b.co?{amt:b.co.amt,t:b.co.t}:null,
 legs:b.legs.map(l=>({g:l.g,m:l.m,s:l.s,line:l.line,pl:l.pl||"",st:l.st||"",odds:l.odds,r:l.r||"",d:l.d||""}))});
let LBSIG="";
async function lbSync(force){if(!LB_SITE()||!UID||!S.name||!lbSet().on)return;
 let bs=S.bets.slice(-1500),j=JSON.stringify(bs.map(lbRaw));while(j.length>850000&&bs.length>50){bs=bs.slice(Math.ceil(bs.length/5));j=JSON.stringify(bs.map(lbRaw))}
 const sig=S.name+"|"+!!S.lb.prof+"|"+j;if(!force&&sig===LBSIG)return;LBSIG=sig;
 try{await window.SL_FS.doc("lb/"+UID).set({name:S.name,prof:!!S.lb.prof,v:1,upd:firebase.firestore.FieldValue.serverTimestamp(),j});LB.pub="ok"}
 catch(e){LBSIG="";LB.pub="err";slog("lb","publish failed: "+(e&&e.code||e))}if(pg==="lb")lbPaint()}
setInterval(()=>lbSync(),5000);
(async()=>{for(let k=0;k<60&&!UID;k++)await new Promise(r=>setTimeout(r,1000));if(!UID||!crypto.subtle)return;
 const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("sideline:"+UID));LB.myId=[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("").slice(0,16);if(pg==="lb")lbPaint()})();
async function lbLoad(force){if(LB_ART())return;if(LB.busy||(!force&&LB.data&&Date.now()-LB.at<12e4))return;LB.busy=true;lbPaint();
 try{const r=await fetch("leaderboard.json?t="+Date.now(),{cache:"no-store"});if(!r.ok)throw new Error(r.status);const d=await r.json();if(!d||!Array.isArray(d.users))throw new Error("bad file");if(!(LB.data&&LB.data.live&&LBL.unsub)){LB.data=d;LB.at=Date.now()}LB.err="";if(LBL.unsub&&Date.parse(d.at)>LBL.at){LBL.at=0;lbBase().then(()=>lbLiveRun()).catch(()=>{})}}
 catch(e){LB.err=LB.data?"Couldn't refresh just now. Showing the last update.":"Couldn't load the leaderboard. Check your connection and try again."}LB.busy=false;lbPaint()}
setInterval(()=>{if(pg==="lb"&&!document.hidden)lbLoad(true)},12e4);
/* ---------- live ranking: the moment a bet is placed, settled or cashed out ----------
   While the Leaderboard is open the page listens to every player's public bet record (Firestore lb/, readable by anyone)
   and re-ranks on each change with the same engine and the same checks as the server (lbcore.js aggregate): the official
   results archive and the server's memory of when it first saw each bet (results-archive.json, lb-reg.json, published
   with every server check), plus any final result this page has just received from ESPN. The server still re-checks every
   bet every 30 minutes; if live updates aren't available the page shows the server's file as before. */
const LBL={unsub:null,docs:null,A:null,REG:{},at:0,ids:{},seen:0,err:""};
async function lbBase(){if(LBL.A&&Date.now()-LBL.at<6e5)return;
 const get=f=>fetch(f+"?t="+Date.now(),{cache:"no-store"}).then(x=>{if(!x.ok)throw new Error(f+" "+x.status);return x.json()});
 try{const[a,r]=await Promise.all([get("results-archive.json"),get("lb-reg.json")]);["res","rp","ppd","ev"].forEach(k=>a[k]=a[k]||{});LBL.A=a;LBL.REG=r||{};LBL.at=Date.now()}catch(e){if(!LBL.A)throw e}}
async function lbPub(uid){if(LBL.ids[uid])return LBL.ids[uid];const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("sideline:"+uid));return LBL.ids[uid]=[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("").slice(0,16)}
/* the archive plus finals this page already has from ESPN (finished games only, by ESPN event id, as the server stores them) */
function lbArch(){const B=LBL.A,A={res:{...B.res},rp:{...B.rp},ppd:{...B.ppd},ev:{...B.ev}};
 const add=gid=>{const m=String(gid)[0]==="e"&&EVM[String(gid).slice(1)];if(!m||!m.iso)return false;if(!A.ev[gid])A.ev[gid]=m.end?{sp:m.sp,iso:m.iso,end:m.end}:{sp:m.sp,iso:m.iso};return true};
 for(const gid in RES){if(A.res[gid]||String(gid)[0]!=="e")continue;const m=EVM[String(gid).slice(1)];if(!m||m.state!=="post"||!add(gid))continue;A.res[gid]=RES[gid];if(RP[gid]&&Object.keys(RP[gid]).length)A.rp[gid]=RP[gid]}
 for(const gid in PPD){if(!A.ppd[gid]&&String(gid)[0]==="e"&&add(gid))A.ppd[gid]=PPD[gid]}return A}
async function lbLiveRun(){if(!LBL.docs||!LBL.A)return;const docs=await Promise.all(LBL.docs.map(async d=>({...d,id:await lbPub(d.uid)}))),REG={};
 docs.forEach(d=>{const r=LBL.REG[d.id];if(r)REG[d.uid]=JSON.parse(JSON.stringify(r))});   /* a copy: the engine updates it as it goes */
 const out=LBC.aggregate(docs,lbArch(),REG,Date.now());out.live=1;LB.data=out;LB.at=Date.now();LB.err="";if(pg==="lb")lbPaint()}
function lbLiveStart(){if(!LB_SITE()||LBL.unsub||LBL.busy||!crypto.subtle)return;LBL.busy=1;
 lbBase().then(()=>{LBL.unsub=window.SL_FS.collection("lb").onSnapshot(s=>{
   LBL.docs=s.docs.map(d=>{const f=d.data({serverTimestamps:"estimate"})||{};let bets=[];try{bets=JSON.parse(f.j||"[]")}catch(e){}return{uid:d.id,name:f.name||"",prof:!!f.prof,upd:f.upd&&f.upd.toMillis?f.upd.toMillis():Date.now(),bets}});
   LBL.err="";lbLiveRun().catch(e=>slog("lb","live ranking failed: "+(e&&e.message||e)))},
  e=>{LBL.err=String(e&&e.code||e);LBL.unsub=null;slog("lb","live updates unavailable: "+LBL.err);if(pg==="lb")lbPaint()})})
  .catch(e=>{LBL.err="base";slog("lb","live ranking unavailable: "+(e&&e.message||e))}).finally(()=>{LBL.busy=0})}
/* new finals reach the page every minute or so: re-rank with them; stop listening a minute after leaving the page */
setInterval(()=>{if(pg==="lb"&&!document.hidden){LBL.seen=Date.now();lbLiveStart();lbLiveRun().catch(()=>{})}else if(LBL.unsub&&Date.now()-LBL.seen>6e4){LBL.unsub();LBL.unsub=null}},15e3);

const LB_PER={all:"All time",month:"This month",d30:"Last 30 days",year:"This year"},LB_MET={net:"Net profit",roi:"ROI",wr:"Win rate",wins:"Wins"},LB_TYP={all:"All bets",single:"Singles",multi:"Multis"};
const lbSports=()=>Object.keys(SP).filter(k=>k!=="nfl");
const lbPct=(x,sg)=>x===null||x===undefined?"–":(sg&&x>0?"+":"")+x.toFixed(1)+"%";
const lbStreak=s=>s.streak?`<span class="${s.streak.k==="w"?"won":"lost"}">${s.streak.k==="w"?"W":"L"}${s.streak.n}</span>`:"–";
const lbMain=(m,s)=>m==="net"?`<b class="${s.net>0?"won":s.net<0?"lost":""}">${sgn(s.net)}</b>`:m==="roi"?`<b class="${s.roi>0?"won":s.roi<0?"lost":""}">${lbPct(s.roi,1)}</b>`:m==="wr"?`<b>${lbPct(s.wr)}</b>`:`<b>${s.w}</b>`;
const lbAgo=t=>{const m=Math.round((Date.now()-t)/6e4);return m<1?"just now":m<60?m+" min ago":Math.round(m/60)+" h ago"};
function lbFilters(){const f=LB.f,sel=(k,lab,o)=>`<label><small>${lab}</small><select data-lbf="${k}">${Object.entries(o).map(([v,t])=>`<option value="${v}"${String(f[k])===v?" selected":""}>${t}</option>`).join("")}</select></label>`;
 return`<div class="lbf">${sel("period","Period",LB_PER)}${sel("metric","Rank by",LB_MET)}${sel("sport","Sport",Object.assign({all:"All sports"},...lbSports().map(k=>({[k]:SP[k].n}))))}${sel("type","Bet type",LB_TYP)}
 ${f.metric==="roi"||f.metric==="wr"?sel("min","Qualify",{5:"5+ bets",10:"10+ bets",25:"25+ bets",50:"50+ bets"}):""}</div>
 ${f.metric==="roi"||f.metric==="wr"?`<div class="tm lbq">Ranking by ${LB_MET[f.metric]} needs at least <b>${f.min} ${f.metric==="wr"?"won or lost":"settled"} bets</b> in the selected period, so one lucky bet can't top the table.</div>`:""}`}
const LB_COL={net:0,roi:1,wr:2,wins:4},lbCols=a=>a.map((h,i)=>`<span${i===LB_COL[LB.f.metric]?' class="lbon"':""}>${h}</span>`).join("");
const lbStatCells=s=>lbCols([`<b class="${s.net>0?"won":s.net<0?"lost":""}">${sgn(s.net)}</b>`,lbPct(s.roi,1),lbPct(s.wr),s.tracked+(s.pending?`<small> · ${s.pending} open</small>`:""),s.w,s.l,s.c,$$(s.staked),$$(s.ret),s.avg?f2(s.avg):"–",s.best!==null?"+"+$$(s.best):"–",lbStreak(s)]);
function lbRow(x,me){const s=x.s,top=x.rank<=3?" lbt"+x.rank:"";
 return`<button class="lbr${top}${me?" lbmine":""}" data-lbu="${esc(x.u.id)}"><span class="lbk">${x.rank}</span><span class="lbn"><b>${esc(dn(x.u.name))}${me?" <i>You</i>":""}</b><small>${s.w}W · ${s.l}L${s.c?" · "+s.c+" cashed out":""} · ${s.tracked} bet${s.tracked===1?"":"s"}</small></span>
 <span class="lbm">${lbMain(LB.f.metric,s)}<small>${LB.f.metric==="net"?lbPct(s.roi,1)+" ROI":LB.f.metric==="wins"?lbPct(s.wr)+" win rate":sgn(s.net)}</small></span><span class="lbx">${lbStatCells(s)}</span></button>`}
function lbMe(R,users){const st=lbSet(),f={...LB.f,now:Date.now()},mine=LBC.stats(myRecs(),f);
 const box=(h,body)=>`<div class="card lbme"><div class="lbmh">${h}</div>${body}</div>`;
 const mini=s=>`<div class="lbms"><div><small>Net</small><b class="${s.net>0?"won":s.net<0?"lost":""}">${sgn(s.net)}</b></div><div><small>ROI</small><b>${lbPct(s.roi,1)}</b></div><div><small>Win rate</small><b>${lbPct(s.wr)}</b></div><div><small>Settled</small><b>${s.settled}</b></div></div>`;
 if(!LB_SITE())return box(`<b>Your stats</b>`,mini(mine)+`<div class="tm">To join the leaderboard, log in on the public site: sidelinesportsbook.github.io/sideline</div>`);
 const me=users.find(u=>u.id&&u.id===LB.myId),hit=me&&R.rows.find(x=>x.u===me),N=R.rows.length;
 const ctl=`<div class="lbctl"><label class="lbsw"><input type="checkbox" data-lbprof="1"${st.prof?" checked":""}> Show my bet history on my public profile</label></div>${LB.pub==="err"?`<div class="tm lost">Couldn't share your bets just now. It will try again automatically.</div>`:""}`;
 if(!me)return box(`<b>You're on the leaderboard</b><span class="tm">${LB.data&&LB.data.live?"You'll appear as soon as your first bet is saved.":"You'll appear after the next check (every 30 minutes)."}</span>`,mini(mine)+ctl);
 const s=hit?hit.s:LBC.stats(me.recs,f),need=LB.f.metric==="roi"?LB.f.min-s.counted:LB.f.metric==="wr"?LB.f.min-(s.w+s.l):1-s.counted,wait=(me.pend||0)+(me.unv||0);
 return box(hit?`<span class="lbk${hit.rank<=3?" lbt"+hit.rank:""}">${hit.rank}</span><b>Your rank: ${hit.rank} of ${N}</b><span class="tm">${LB_MET[LB.f.metric]} · ${LB_PER[LB.f.period]}</span>`:`<b>Not ranked yet</b><span class="tm">${need>0?`${need} more ${LB.f.metric==="wr"?"won or lost":"settled"} bet${need===1?"":"s"} to qualify`:"No settled bets in this view"}</span>`,
  mini(s)+`<button class="lnk" data-lbu="${esc(me.id)}">View your public profile</button>${wait?`<div class="tm">${me.pend?me.pend+" open bet"+(me.pend===1?"":"s")+" (not counted until settled)":""}${me.pend&&me.unv?" · ":""}${me.unv?me.unv+" waiting for official results":""}</div>`:""}`+ctl)}
function lbPaint(){const el=$("#lb");if(!el||pg!=="lb")return;const d=LB.data,users=d?d.users:[],f={...LB.f,now:Date.now()},R=LBC.rank(users,f,LB.f.metric,+LB.f.min);
 const head=`<div class="lbh"><div><h1>Leaderboard</h1><div class="tm">Every player's real results, checked against official results.</div></div><button class="lbref" data-lbref="1"${LB.busy?" disabled":""}>${LB.busy?"Loading…":"Refresh"}</button></div>`;
 let list;
 if(LB_ART())list=`<div class="card lbe"><b>The leaderboard is on the public site</b><div class="tm">Rankings use online accounts, so they live at sidelinesportsbook.github.io/sideline. Log in there to join.</div></div>`;
 else if(!d&&LB.busy)list=`<div class="card lbl">${'<div class="lbsk"></div>'.repeat(5)}</div>`;
 else if(!d)list=`<div class="card lbe"><b>Leaderboard unavailable</b><div class="tm">${esc(LB.err||"")}</div><button class="go" data-lbref="1">Try again</button></div>`;
 else if(!users.length)list=`<div class="card lbe"><b>No ranked players yet</b><div class="tm">Players appear at the next check after they log in.</div></div>`;
 else if(!R.rows.length)list=`<div class="card lbe"><b>No ranked players for these filters</b><div class="tm">Try a longer period, another sport or a lower qualifying number.</div></div>`;
 else{const rows=LB.all?R.rows:R.rows.slice(0,10),mine=x=>x.u.id===LB.myId,meRow=R.rows.find(mine);
  list=`<div class="card lbl"><div class="lbr lbhd"><span class="lbk">#</span><span class="lbn">Player</span><span class="lbm">${LB_MET[LB.f.metric]}</span><span class="lbx">${lbCols(["Net profit","ROI","Win rate","Bets","Won","Lost","Cash outs","Staked","Returns","Avg odds","Best win","Streak"])}</span></div>
  ${rows.map(x=>lbRow(x,mine(x))).join("")}${meRow&&!rows.includes(meRow)?`<div class="lbgap">···</div>`+lbRow(meRow,true):""}
  ${R.rows.length>10?`<button class="lball" data-lball="1">${LB.all?"Show top 10":"Show all "+R.rows.length+" players"}</button>`:""}</div>
  ${R.out.length?`<div class="tm lbq">${R.out.length} player${R.out.length===1?" isn't":"s aren't"} ranked in this view yet (not enough settled bets).</div>`:""}`}
 el.innerHTML=head+lbMe(R,users)+lbFilters()+list+`<div class="tm lbft">${d?(d.live?`<span class="lblv"><i></i>Live</span> Updates the moment a bet is placed, settled or cashed out · every bet is also re-checked on the server every 30 minutes`:`Updated ${lbAgo(Date.parse(d.at))} · checked every 30 minutes`):""}${LB.err&&d?" · "+esc(LB.err):""}</div>
 <details class="card lbhow"><summary>How it's calculated</summary><div class="tm">
 <p><b>Settled bets only.</b> Open bets never count as profit.</p>
 <p><b>Net</b> = returns − stakes · <b>ROI</b> = net ÷ staked · <b>Win rate</b> = won ÷ (won + lost). Voids are left out.</p>
 <p><b>Checked</b> against official ESPN results. Bets placed after the start or changed later don't count.</p></div></details>`}
function lbChart(series){if(series.length<2)return`<div class="tm">Not enough settled bets for a chart yet.</div>`;const w=340,h=140,L=46,T=10,B=20,ax=v=>(v<0?"-":v>0?"+":"")+"$"+Math.round(Math.abs(v)),pts=[[series[0][0]-1,0],...series],xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),lo=Math.min(0,...ys),hi=Math.max(0,...ys),pad=(hi-lo)*.1||5,y0=lo-pad,y1=hi+pad;
 const X=t=>L+(t-x0)/((x1-x0)||1)*(w-L-6),Y=v=>T+(y1-v)/(y1-y0)*(h-T-B),d=pts.map((p,i)=>(i?"L":"M")+X(p[0]).toFixed(1)+" "+Y(p[1]).toFixed(1)).join(" "),end=ys[ys.length-1],c=end>=0?"var(--g)":"var(--r)";
 return`<svg viewBox="0 0 ${w} ${h}" class="lbch" role="img" aria-label="Profit over time, now ${sgn(end)}"><line x1="${L}" x2="${w-6}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--line)" stroke-dasharray="3 3"/>
 <text x="${L-6}" y="${Y(0)+3}" text-anchor="end" font-size="9" fill="var(--mut)">$0</text>${hi>0?`<text x="${L-6}" y="${Y(hi)+3}" text-anchor="end" font-size="9" fill="var(--mut)">${ax(hi)}</text>`:""}${lo<0?`<text x="${L-6}" y="${Y(lo)+3}" text-anchor="end" font-size="9" fill="var(--mut)">${ax(lo)}</text>`:""}
 <path d="${d}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${X(x1)}" cy="${Y(end)}" r="3.5" fill="${c}"/>
 <text x="${L}" y="${h-5}" font-size="9" fill="var(--mut)">${fd(x0+1)}</text><text x="${w-6}" y="${h-5}" text-anchor="end" font-size="9" fill="var(--mut)">${fd(x1)}</text></svg>`}
function lbProfile(id){const d=LB.data,u=d&&d.users.find(x=>x.id===id);if(!u)return;const f={...LB.f,now:Date.now()},s=LBC.stats(u.recs,f),R=LBC.rank(d.users,f,LB.f.metric,+LB.f.min),hit=R.rows.find(x=>x.u===u),pf={period:LB.f.period,now:f.now};
 const cell=(k,v,c)=>`<div class="sc"><small>${k}</small><b class="${c||""}">${v}</b></div>`,brk=(lab,q)=>`<div class="kv"><span><b>${lab}</b> <small class="tm">${q.settled} settled · ${q.w}W ${q.l}L · ${lbPct(q.roi,1)} ROI</small></span><b class="${q.net>0?"won":q.net<0?"lost":""}">${sgn(q.net)}</b></div>`;
 const sps=lbSports().map(k=>[SP[k].n,LBC.stats(u.recs,{...pf,sport:k})]).filter(x=>x[1].settled),mix=LBC.stats(u.recs.filter(r=>r.p==="mix"),pf);
 const res={w:["WON","won"],l:["LOST","lost"],c:["CASHED OUT",""],r:["REFUNDED",""],v:["VOID",""]};
 $("#lbp").innerHTML=`<div class="mod lbpm" data-lbclose="1"><div class="mc lbpc" role="dialog" aria-label="${esc(dn(u.name))}'s profile"><button class="lbx0" data-lbclose="1" aria-label="Close">×</button>
 <div class="ph"><div class="av">${esc(u.name[0].toUpperCase())}</div><div><div class="lbpn">${esc(dn(u.name))}</div><div class="tm">${hit?`Rank ${hit.rank} of ${R.rows.length} · `:"Not ranked in this view · "}${LB_MET[LB.f.metric]} · ${LB_PER[LB.f.period]}${LB.f.sport!=="all"?" · "+SP[LB.f.sport].n:""}${LB.f.type!=="all"?" · "+LB_TYP[LB.f.type]:""}</div></div></div>
 <div class="sg lbsg">${cell("Net profit",sgn(s.net),s.net>0?"won":s.net<0?"lost":"")}${cell("ROI",lbPct(s.roi,1))}${cell("Win rate",lbPct(s.wr))}${cell("Settled bets",s.settled)}${cell("Won",s.w,"won")}${cell("Lost",s.l,"lost")}${cell("Cashed out",s.c)}${cell("Staked",$$(s.staked))}${cell("Returns",$$(s.ret))}${cell("Average odds",s.avg?f2(s.avg):"–")}${cell("Best win",s.best!==null?"+"+$$(s.best):"–")}${cell("Current streak",lbStreak(s))}${cell("Pending",s.pending)}</div>
 <h2>Profit over time</h2>${lbChart(s.series)}
 <h2>By sport</h2><div class="card">${sps.length||mix.settled?sps.map(([n,q])=>brk(n,q)).join("")+(mix.settled?brk("Mixed-sport multis",mix):""):`<div class="tm">No settled bets in this period.</div>`}</div>
 <h2>Singles and multis</h2><div class="card">${brk("Singles",LBC.stats(u.recs,{...pf,type:"single"}))}${brk("Multis",LBC.stats(u.recs,{...pf,type:"multi"}))}</div>
 <h2>Recent results</h2>${u.prof?(u.recent&&u.recent.length?`<div class="card">${u.recent.map(b=>`<div class="lbrc"><div><span class="chip ${res[b.x][1]}">${res[b.x][0]}</span><small class="tm">${fd(b.s)} · ${b.legs.length>1?b.legs.length+"-leg multi":"Single"} @ ${f2(b.o)}</small></div><div class="lbrl">${b.legs.map(l=>`<span class="${l.r==="w"?"won":l.r==="l"?"lost":""}">${esc(l.d)}</span>`).join("")}</div><b class="${b.r-b.k>0?"won":b.r-b.k<0?"lost":""}">${sgn(Math.round((b.r-b.k)*100)/100)}</b></div>`).join("")}</div>`:`<div class="tm">No settled bets yet.</div>`):`<div class="card tm">${esc(dn(u.name))} keeps their bet history private. Totals above are still checked and ranked.</div>`}
 </div></div>`;LB.open=id}
const _renderLB=render;render=function(m){_renderLB(m);const on=pg==="lb",el=$("#lb");if(!el)return;["#nlb","#blb"].forEach(q=>{const b=$(q);if(b)b.className=on?"on":""});
 if(!on){el.style.display="none";LB.shown=false;return}el.style.display="block";$("main").style.display="none";$("#pf").style.display="none";$("#pl").style.display="none";
 if(!LB.shown){LB.shown=true;lbPaint();lbLoad()}LBL.seen=Date.now();lbLiveStart()};
document.addEventListener("click",e=>{const t=e.target;if(!t||!t.closest)return;
 const u=t.closest("[data-lbu]");if(u){lbProfile(u.dataset.lbu);return}
 if(t.closest(".lbpc")&&!t.closest("[data-lbclose].lbx0"))return;if(t.closest("[data-lbclose]")){$("#lbp").innerHTML="";LB.open=null;return}
 if(t.closest("[data-lbref]")){lbLoad(true);lbLiveRun().catch(()=>{});return}if(t.closest("[data-lball]")){LB.all=!LB.all;lbPaint();return}
});
document.addEventListener("change",e=>{const t=e.target;if(!t)return;if(t.dataset.lbf){LB.f[t.dataset.lbf]=t.value;LB.all=false;lbPaint();return}
 if(t.dataset.lbprof){lbSet().prof=t.checked;save();lbSync(true);toast(t.checked?"Your bet history is shown on your public profile.":"Your bet history is hidden. You stay ranked with your totals.");if(pg==="lb")lbPaint()}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&LB.open){$("#lbp").innerHTML="";LB.open=null}});
/* your own profile uses the same rules as the leaderboard */
const _profLB=prof;prof=function(){const o=_profLB(),s=LBC.stats(myRecs());o.np=s.net;o.stake=s.staked;o.ret=s.ret;o.w=s.w;o.l=s.l;o.best=s.best||0;o.streak=s.streak?(s.streak.k==="w"?"W":"L")+s.streak.n:"–";return o};
const _renderProfileLB=renderProfile;renderProfile=function(){_renderProfileLB();const pf=$("#pf");if(!pf)return;const st=lbSet();
 pf.insertAdjacentHTML("beforeend",`<div class="card lbpf"><h2>Leaderboard</h2>${!LB_SITE()?`<div class="tm">The leaderboard is on the public site (sidelinesportsbook.github.io/sideline).</div>`:`<div class="lbctl"><label class="lbsw"><input type="checkbox" data-lbprof="1"${st.prof?" checked":""}> Show my bet history on my public profile</label></div><div class="tm">Every player is on the leaderboard. Others see your username and checked results${st.prof?", and your recent settled bets":""}. Never your balance, open slip, password or login details.</div>`}<button class="lnk" data-pg="lb">Open the leaderboard</button></div>`)};
/* the one-time notice: everyone is told they're on the leaderboard, and how to hide their bet history */
setInterval(()=>{if(!LB_SITE()||!UID||!S.name||$("#lbnote"))return;const st=lbSet();if(st.told)return;st.told=Date.now();save();
 document.body.insertAdjacentHTML("beforeend",`<div id="lbnote" class="lbnote" role="status"><span><b>You're on the leaderboard.</b> Every player's username and checked results are ranked. You can hide your bet history in your profile.</span><button data-lbnote="pf">Settings</button><button data-lbnote="ok" aria-label="Dismiss">OK</button></div>`)},2000);
document.addEventListener("click",e=>{const b=e.target&&e.target.closest&&e.target.closest("[data-lbnote]");if(!b)return;const n=$("#lbnote");if(n)n.remove();if(b.dataset.lbnote==="pf"){pg="pf";view=null;render();scrollTo(0,0)}});