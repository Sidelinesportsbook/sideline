/* ---------- leaderboard rules: one engine for the leaderboard, public profiles and your own profile ----------
   The same file runs in the page and on GitHub's servers (lb-agg.js), so the numbers can never disagree.
   Only placed bets count (a saved slip is not a bet). A bet counts towards results once it is settled:
     won         return = stake x final odds (odds of the legs that won, x any boost; void legs drop out)
     lost        return = 0
     cashed out  return = the cash-out amount accepted (never an offer that wasn't taken)
     refunded    return = stake (Miss-1-leg insurance)
     void        return = stake; left out of staked, returns, ROI, win rate and average odds
   Net profit = returns - staked. ROI = net profit / staked x 100. Win rate = won / (won + lost) x 100 (cash-outs and
   refunds are neither). Average odds = mean decimal odds of settled bets other than voids (final odds for winners,
   placed odds otherwise). Open bets are pending: counted as bets, never as profit. Each bet is one record, so its
   return can only be counted once.
   Record fields: t placed, s settled, p sport, n legs, k stake, r return, o odds, x result (w l c r v, "" pending),
   v void legs. */
const LBC=(()=>{
 const r2=x=>Math.round(x*100)/100,num=x=>typeof x==="number"&&isFinite(x);
 const COMB={pra:["pts","reb","ast"],pr:["pts","reb"],pa:["pts","ast"],ra:["reb","ast"],ga:["g","sa"]};
 const stat=(v,st)=>{if(!v)return;if(st==="dd"||st==="td"){const n=["pts","reb","ast","stl","blk"].filter(q=>v[q]>=10).length;return n>=(st==="dd"?2:3)?1:0}return COMB[st]?COMB[st].reduce((q,k)=>q+v[k],0):v[st]};
 const legWin=(l,h,a)=>l.m==="h"?(l.s==="h"?h>a:l.s==="a"?a>h:h===a):l.m==="s"?(l.s==="h"?h+l.line>a:a+l.line>h):l.m==="b"?(l.s==="y"?h>0&&a>0:!(h>0&&a>0)):l.m==="dc"?(l.s==="1x"?h>=a:l.s==="x2"?a>=h:h!==a):l.m==="tg"?((l.s[1]==="o")?(l.s[0]==="h"?h:a)>l.line:(l.s[0]==="h"?h:a)<l.line):(l.s==="o"?h+a>l.line:h+a<l.line);
 /* a leg judged from the official final result and box score (A = {res, rp, ppd, ev, lv}), with the app's settlement rules:
    "w" / "l", "v" (postponed, or the player did not play), "" (no final result yet).
    During a game (A.lv = the live box score) a player "over" that has already been passed is won, as the app settles it:
    the figure can only go up. Nothing else is decided before the final. */
 function legResult(l,A){if(l.m==="fut"){const f=futRes(l,A);return f?(f.win.map(String).includes(String(l.s))?"w":"l"):""}   /* a futures bet: the official result for its market (futures-settle.ps1) */
  if(A.ppd&&A.ppd[l.g])return"v";const r=A.res&&A.res[l.g];
  if(!r){const lv=A.lv&&A.lv[l.g];if(lv&&l.m==="p"&&(l.s==="o"||l.s==="k")){const x=stat(lv[l.pl],l.st);if(x!==undefined&&!isNaN(x)&&(l.s==="k"?x>=l.line:x>l.line))return"w"}return""}
  if(l.m==="p"){const box=A.rp&&A.rp[l.g];if(!box||!Object.keys(box).length)return"";const x=stat(box[l.pl],l.st);if(x===undefined||isNaN(x))return"v";return(l.s==="k"?x>=l.line:l.s==="o"?x>l.line:x<l.line)?"w":"l"}
  return legWin(l,r[0],r[1])?"w":"l"}
 function betResult(rs,ins){const lost=rs.filter(r=>r==="l").length;if(lost>=2||(lost===1&&!ins))return"l";if(rs.some(r=>!r))return"";if(lost===1)return"r";if(rs.every(r=>r==="v"))return"v";return"w"}
 /* futures legs are "fut:<sport>:<PointsBet market id>"; their result, and when it was decided, come from A.fut */
 const futRes=(l,A)=>A.fut&&A.fut[String(l.g).split(":")[2]]||null;
 const futEv=(l,A)=>{const f=futRes(l,A);return f?{sp:String(l.g).split(":")[1],iso:f.ends,end:f.at}:null};
 const wonOdds=(legs,bx)=>r2(legs.reduce((q,l)=>l.r==="w"?q*l.odds:q,1)*(bx||1)),allOdds=(legs,bx)=>r2(legs.reduce((q,l)=>q*l.odds,1)*(bx||1));
 /* a bet as recorded in an account -> its record. spOf(gameId) gives the sport, endOf(legs) the latest game end */
 function fromBet(b,spOf,endOf){const x={won:"w",lost:"l",cash:"c",ref:"r",void:"v"}[b.st]||"",sps=[...new Set(b.legs.map(l=>spOf(l.g)||"?"))];
  const r=x==="w"?r2(b.stake*b.odds):x==="c"?r2(b.co.amt):x==="r"||x==="v"?b.stake:0,o=x==="w"?b.odds:(b.odds0!==undefined?b.odds0:b.odds);
  return{t:b.t,s:x?(b.sat||(b.co&&b.co.t)||endOf(b.legs)||b.t):0,p:sps.length===1?sps[0]:"mix",n:b.legs.length,k:b.stake,r,o,x,v:b.legs.filter(l=>l.r==="v").length}}
 function inPeriod(ts,p,now){if(!p||p==="all")return true;const d=new Date(now);if(p==="d30")return ts>=now-30*864e5;
  if(p==="month")return ts>=new Date(d.getFullYear(),d.getMonth(),1).getTime();if(p==="year")return ts>=new Date(d.getFullYear(),0,1).getTime();return true}
 /* every statistic for one player under one set of filters (period, sport, type); settled bets fall in a period by their
    settlement time, pending bets by when they were placed */
 function stats(recs,f){f=f||{};const now=f.now||Date.now(),per=f.period||"all",
   R=(recs||[]).filter(r=>(!f.sport||f.sport==="all"||r.p===f.sport)&&(!f.type||f.type==="all"||(f.type==="single"?r.n===1:r.n>1))),
   set=R.filter(r=>r.x&&inPeriod(r.s,per,now)).sort((a,b)=>a.s-b.s||a.t-b.t),pend=R.filter(r=>!r.x&&inPeriod(r.t,per,now)).length;
  const o={settled:set.length,pending:pend,tracked:set.length+pend,w:0,l:0,v:0,c:0,rf:0,vl:0,counted:0,staked:0,ret:0,net:0,roi:null,wr:null,avg:null,best:null,streak:null,series:[]};let os=0,cum=0;
  set.forEach(r=>{o.vl+=r.v||0;if(r.x==="v"){o.v++;return}o.counted++;o.staked+=r.k;o.ret+=r.r;os+=r.o;const net=r2(r.r-r.k);cum=r2(cum+net);o.series.push([r.s,cum]);
   if(r.x==="w")o.w++;else if(r.x==="l")o.l++;else if(r.x==="c")o.c++;else o.rf++;if(net>0&&(o.best===null||net>o.best))o.best=net});
  o.staked=r2(o.staked);o.ret=r2(o.ret);o.net=r2(o.ret-o.staked);if(o.staked>0)o.roi=o.net/o.staked*100;if(o.w+o.l)o.wr=o.w/(o.w+o.l)*100;if(o.counted)o.avg=os/o.counted;
  const wl=set.filter(r=>r.x==="w"||r.x==="l");if(wl.length){const k=wl[wl.length-1].x;let n=0;for(let i=wl.length-1;i>=0&&wl[i].x===k;i--)n++;o.streak={k,n}}
  return o}
 /* ranking: ROI needs at least `min` settled bets (voids aside), win rate at least `min` won-or-lost bets; profit and
    wins need one settled bet. Ties share a rank; then the bigger profit and the longer record go first. */
 const METRIC={net:{l:"Net profit",v:s=>s.net},roi:{l:"ROI",v:s=>s.roi},wr:{l:"Win rate",v:s=>s.wr},wins:{l:"Wins",v:s=>s.w}};
 const qualifies=(s,m,min)=>m==="roi"?s.counted>=min&&s.staked>0:m==="wr"?s.w+s.l>=min:s.counted>0;
 function rank(users,f,m,min){const ok=[],out=[],v=METRIC[m].v;users.forEach(u=>{const s=stats(u.recs,f);(qualifies(s,m,min)?ok:out).push({u,s})});
  ok.sort((a,b)=>v(b.s)-v(a.s)||b.s.net-a.s.net||(b.s.counted-a.s.counted)||a.u.name.localeCompare(b.u.name));
  ok.forEach((x,i)=>{const p=ok[i-1];x.rank=p&&v(p.s)===v(x.s)?p.rank:i+1});return{rows:ok,out}}

 /* ---------- server-side checks (GitHub Actions, every 30 minutes) ----------
    Stats are never taken from a player: the server rebuilds every result from the official ESPN finals and box scores,
    and only counts a bet that passes these checks:
      - every leg is on a real listed game, and the bet was placed before the first of those games started
      - stake and odds are in range; a duplicate copy of a bet counts once
      - the bet hasn't been changed since the server first saw it (stake, legs, odds)
      - it was in the player's record before its games started, once the server had already been seeing that record
      - a cash-out is no more than the bet could have paid, and was taken before the server saw the bet decided
      - the stake was affordable: start balance + the most the daily spin can pay + returns so far
      - a placed bet can't be taken back (the app never cancels one): once the server has seen a bet it keeps a copy, and the
        bet keeps counting, and settles on the official result, even if it later disappears from the player's public record
        (counted as "removed")
    A bet the results show differently from the player's own copy is counted as the official result says. */
 const TEST=/^(test|demo|qa|sltest|tmp|dummy)/i;
 const key=b=>b.t+"|"+b.legs.map(l=>[l.g,l.m,l.s,l.line,l.pl||"",l.st||""].join(":")).join(",");
 const core=b=>key(b)+"|"+b.stake+"|"+b.legs.map(l=>l.odds).join(",")+"|"+(b.ins?1:0)+"|"+(b.bx||1);
 const sane=b=>b&&num(b.t)&&num(b.stake)&&b.stake>0&&b.stake<=1e5&&Array.isArray(b.legs)&&b.legs.length>=1&&b.legs.length<=25&&(b.bx==null||(num(b.bx)&&b.bx>=1&&b.bx<=3))&&b.legs.every(l=>l&&typeof l.g==="string"&&typeof l.m==="string"&&num(l.odds)&&l.odds>=1.01&&l.odds<=1001);
 const endOfEv=e=>e.end?Date.parse(e.end):Date.parse(e.iso)+3*36e5;
 function verifyUser(doc,A,reg,now){const out={recs:[],recent:[],pend:0,unv:0,fix:0,bad:{invalid:0,dup:0,edited:0,late:0,cash:0,funds:0,removed:0}},seen=reg.seen||(reg.seen={}),prev=reg.last||0,keys=new Set(),J=[];
  const bets=(Array.isArray(doc.bets)?doc.bets:[]).filter(b=>{if(!sane(b)){out.bad.invalid++;return false}const k=key(b);if(keys.has(k)){out.bad.dup++;return false}keys.add(k);return true});
  /* bets the server has a copy of but the record no longer has: put back and counted */
  for(const k in seen){const s=seen[k];if(s&&s.keep&&!keys.has(k)&&sane(s.keep)){keys.add(k);bets.push(s.keep);out.bad.removed++}}
  bets.sort((a,b)=>a.t-b.t);
  bets.forEach(b=>{const k=key(b),h=core(b),evs=b.legs.map(l=>l.m==="fut"?futEv(l,A):A.ev[l.g]),known=evs.every(Boolean),start=known?Math.min(...evs.map(e=>Date.parse(e.iso))):null;let s=seen[k];
   if(!s){s=seen[k]={h,f:doc.upd};if(prev&&start!==null&&prev>start+6e4)s.late=1}
   if(s.h!==h){out.bad.edited++;return}if(s.late||(known&&b.t>start+12e4)){out.bad.late++;return}
   /* a game the results don't know yet (not started, or not in the feed): the bet is pending, whatever the player's copy says,
      until the official result arrives (it used to be dropped from the table if the copy already said won or lost) */
   if(!known){J.push({b,legs:b.legs,x:"",sp:["?"],at:0});if(b.st!=="open"||b.co)out.unv++;return}
   const legs=b.legs.map(l=>({...l,r:legResult(l,A)})),sr=betResult(legs.map(l=>l.r),b.ins),sp=[...new Set(evs.map(e=>e.sp))];
   if(sr&&!s.dec&&!b.co)s.dec=now;if(b.co&&!s.cof)s.cof=now;
   const lossAt=(()=>{const L=legs.map((l,i)=>l.r==="l"?endOfEv(evs[i]):null).filter(x=>x!==null).sort((a,b)=>a-b);return L[b.ins?1:0]??null})();
   let x=sr,r=0,o=allOdds(b.legs,b.bx),at=Math.min(now,Math.max(...evs.map(endOfEv)));
   if(b.st==="cash"&&b.co&&num(b.co.amt)){const ok=b.co.amt>0&&b.co.amt<=r2(b.stake*o)+.01&&!(s.dec&&s.cof>s.dec)&&!(sr==="l"&&lossAt!==null&&b.co.t>lossAt+9e5);
    if(ok){x="c";r=r2(b.co.amt);at=Math.min(Math.max(num(b.co.t)?b.co.t:b.t,b.t),doc.upd||now)}else out.bad.cash++}
   if(x!=="c"){if(!x){J.push({b,legs,x:"",sp,at:0});return}
    const mine={won:"w",lost:"l",ref:"r",void:"v"}[b.st];if(mine!==x)out.fix++;
    if(x==="w"){o=wonOdds(legs,b.bx);r=r2(b.stake*o)}else r=x==="l"?0:b.stake;if(x==="l"&&lossAt!==null)at=Math.min(now,lossAt)}
   J.push({b,legs,x,r,o,sp,at})});
  /* affordability, in time order: $100 to start, at most $50 a day from the spin, plus everything returned so far */
  const t0=J.length?J[0].b.t:0,evts=[];J.forEach((j,i)=>{evts.push([j.b.t,0,i]);if(j.x)evts.push([j.at,1,i])});evts.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  let bank=0;const drop=new Set();evts.forEach(([t,kind,i])=>{const j=J[i];if(drop.has(i))return;if(kind){bank+=j.r;return}
   const allow=100+50*(Math.floor((t-t0)/864e5)+1);if(bank-j.b.stake+allow<-.01){drop.add(i);out.bad.funds++;return}bank-=j.b.stake});
  /* every bet that counts is kept (only what's needed to check it again), so it can't be taken back later */
  J.forEach((j,i)=>{if(!drop.has(i)){const s=seen[key(j.b)];if(s&&!s.keep){const b=j.b;s.keep={t:b.t,st:b.st,stake:b.stake,odds:b.odds,ins:b.ins?1:0,bx:b.bx||1,sat:b.sat||null,co:b.co?{amt:b.co.amt,t:b.co.t}:null,legs:b.legs.map(l=>({g:l.g,m:l.m,s:l.s,line:l.line,pl:l.pl||"",st:l.st||"",odds:l.odds,r:"",d:String(l.d||"").slice(0,90)}))}}}});
  J.forEach((j,i)=>{if(drop.has(i))return;const p=j.sp.length===1?j.sp[0]:"mix",vl=j.legs.filter(l=>l.r==="v").length;
   if(!j.x){out.pend++;out.recs.push({t:j.b.t,s:0,p,n:j.legs.length,k:j.b.stake,r:0,o:j.o||allOdds(j.b.legs,j.b.bx),x:"",v:vl});return}
   out.recs.push({t:j.b.t,s:j.at,p,n:j.legs.length,k:j.b.stake,r:j.r,o:j.o,x:j.x,v:vl})});
  if(doc.prof)out.recent=J.filter((j,i)=>j.x&&!drop.has(i)).sort((a,b)=>b.at-a.at).slice(0,15).map(j=>({s:j.at,x:j.x,k:j.b.stake,r:j.r,o:j.o,legs:j.legs.map(l=>({d:String(l.d||"").slice(0,90),r:l.r||""}))}));
  return out}
 /* docs: [{uid, id (public id), name, prof, upd, bets}] from the opted-in records; REG: the server's memory between runs */
 function aggregate(docs,A,REG,now){const users=[],here=new Set();
  docs.forEach(d=>{if(!d||!d.uid||typeof d.name!=="string"||!/^[A-Za-z0-9_]{3,16}$/.test(d.name)||TEST.test(d.name))return;here.add(d.uid);
   const reg=REG[d.uid]||(REG[d.uid]={}),v=verifyUser(d,A,reg,now);reg.last=d.upd;
   users.push({id:d.id,name:d.name,prof:!!d.prof,recs:v.recs,recent:v.recent,pend:v.pend,unv:v.unv,fix:v.fix,bad:v.bad,upd:d.upd})});
  Object.keys(REG).forEach(k=>{if(!here.has(k))delete REG[k].last});   /* left the leaderboard: the record starts fresh if they rejoin */
  return{at:new Date(now).toISOString(),v:1,users}}
 return{r2,legResult,betResult,wonOdds,allOdds,fromBet,inPeriod,stats,rank,METRIC,qualifies,verifyUser,aggregate,key}})();
if(typeof module!=="undefined"&&module.exports)module.exports=LBC;
