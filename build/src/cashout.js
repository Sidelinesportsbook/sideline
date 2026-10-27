/* ---------- cash out: settle an open bet early at its current value (play money: the site settles it itself, no bookmaker) ----------
   Value = stake × boost × (odds of legs already won) × Π(placed odds ÷ current odds) for legs still to play, less a 5% margin.
   Current odds are this site's latest prices for the same selection (PointsBet / DraftKings where published, otherwise the
   same model the market was priced with). There is no live in-play odds feed, so cash out closes when a leg's game starts. */
/* cash-out = the bet's fair expected value minus one stated margin: 5% before the games start, 8% once a live leg is valued by
   the live model (extra allowance for its uncertainty). Bookmaker prices carry their own margin (about 5% across both sides), so it is
   removed first to get each leg's fair chance; nothing is counted twice. This is the site's own estimate, not a bookmaker offer. */
const CO_PRE=.05,CO_LIVE=.08,CO_OVR=1.05;
function legNow(l){const g=GM[l.g];if(!g)return null;
 if(l.m==="p"){const i=PLY.findIndex(p=>p.n===l.pl&&(p.tm===g.h||p.tm===g.a));if(i<0)return null;const x=pleg(i,l.st,l.s,l.line,g.id);return x&&x.odds>1?x.odds:null}
 const ln=l.m==="s"?(l.s==="h"?l.line:-l.line):l.m==="t"||l.m==="tg"?l.line:undefined;const x=leg(l.g,l.m,l.s,ln);return x&&x.odds>1?x.odds:null}
/* chance each open leg still wins:
   - not started: implied by its current price (1 / odds);
   - in play: modelled from the live score, the time remaining and real averages (team strength from the pre-game
     prices, player per-minute rates from this season's box scores). No live bookmaker odds exist for these games, so
     the live value is labelled as modelled. */
const nCdf=x=>{const t=1/(1+.3275911*Math.abs(x)/Math.SQRT2),y=1-((((1.061405429*t-1.453152027)*t+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x/2);return x>=0?(1+y)/2:(1-y)/2};
const nInv=p=>{let lo=-6,hi=6;for(let k=0;k<50;k++){const m=(lo+hi)/2;nCdf(m)<p?lo=m:hi=m}return(lo+hi)/2};
const poisLE=(k,l)=>{if(k<0)return 0;let p=Math.exp(-l),s=p;for(let i=1;i<=k;i++){p*=l/i;s+=p}return Math.min(1,s)};   /* P(X <= k) */
const clampP=p=>Math.min(.998,Math.max(.002,p));
function liveFrac(g,lv){const q=String(lv&&lv.q||""),m=evOf(g);if(/half ?time|^HT$/i.test(q))return .5;
 if(g.sp==="nba"){const PN4={"1st":1,"2nd":2,"3rd":3,"4th":4},end=q.match(/End of (?:the )?(1st|2nd|3rd|4th)/i);if(end)return Math.max(.002,1-PN4[end[1].toLowerCase()]/4);
  let P=m&&m.state==="in"?m.period:0,ck=m&&m.state==="in"?m.clock:"";const mm=q.match(/(\d+:\d+|\d+(?:\.\d+)?)\s*-?\s*(1st|2nd|3rd|4th|\d?OT)/i);if(!P&&mm){P=PN4[mm[2].toLowerCase()]||5;ck=mm[1]}
  if(!P)return null;const sec=/:/.test(ck)?ck.split(":").reduce((a,x)=>a*60+(+x),0):parseFloat(ck)||0;return Math.max(.002,P>4?sec/2880:((4-P)*720+sec)/2880)}
 const mn=String(m&&m.state==="in"&&m.clock||q).match(/(\d+)'(?:\s*\+\s*(\d+))?/);if(!mn)return null;return Math.max(.01,(90-Math.min(90,+mn[1]))/90)}
const legWin=(l,h,a)=>l.m==="h"?(l.s==="h"?h>a:l.s==="a"?a>h:h===a):l.m==="s"?(l.s==="h"?h+l.line>a:a+l.line>h):l.m==="b"?(l.s==="y"?h>0&&a>0:!(h>0&&a>0)):l.m==="dc"?(l.s==="1x"?h>=a:l.s==="x2"?a>=h:h!==a):l.m==="tg"?((l.s[1]==="o")?(l.s[0]==="h"?h:a)>l.line:(l.s[0]==="h"?h:a)<l.line):(l.s==="o"?h+a>l.line:h+a<l.line);
function liveProb(l,g,lv){const f=liveFrac(g,lv);if(f==null)return null;const h=+lv.h||0,a=+lv.a||0;
 if(l.m==="p"){const keys=COMB[l.st]||[l.st];if(l.st==="dd"||l.st==="td")return null;const s=pst(l.g,l.pl,l.st)||0;let lam;
  if(g.sp==="nba"){const c=(NBAP[l.pl]||{}).c27;if(!c||!(c.min>0))return null;const avg=keys.reduce((x,k)=>x+(+c[k]||0),0),played=(((LIVE[l.g]||{}).p||{})[l.pl]||{}).min||0;
   lam=avg/c.min*Math.max(.15*c.min*f,Math.min(c.min-played,48*f))}
  else{const p=SOCP[l.pl];if(!p)return null;const r=keys.reduce((x,k)=>x+(+p[k]||0),0);lam=r*f}
  const pr=l.s==="u"?poisLE(Math.ceil(l.line)-1-s,lam):1-poisLE((l.s==="k"?l.line:Math.floor(l.line)+1)-s-1,lam);return clampP(pr)}
 if(g.sp==="nba"){if(l.m==="h"&&l.s==="d")return null;const mu0=g.em!==undefined?g.em:12*nInv(clampP(g.p)),mean=(h-a)+mu0*f,sd=12*Math.sqrt(f),tot=h+a+(g.t||224)*f,sdt=17*Math.sqrt(f);
  const p=l.m==="h"?(l.s==="h"?nCdf(mean/sd):1-nCdf(mean/sd)):l.m==="s"?(l.s==="h"?nCdf((mean+l.line)/sd):nCdf((l.line-mean)/sd)):l.m==="t"?(l.s==="o"?1-nCdf((l.line-tot)/sdt):nCdf((l.line-tot)/sdt)):null;return p==null?null:clampP(p)}
 /* soccer: remaining goals for each side as Poisson, from the pre-game total and win chances */
 const T0=g.t||2.6,pa=Math.max(.05,1-g.p-(g.pd||0)),sh=Math.min(.8,Math.max(.2,.5+(g.p-pa)*.6)),lh=T0*sh*f,la=T0*(1-sh)*f;let p=0;
 for(let i=0;i<=10;i++){const pi=poisLE(i,lh)-poisLE(i-1,lh);for(let j=0;j<=10;j++){const pj=poisLE(j,la)-poisLE(j-1,la);if(legWin(l,h+i,a+j))p+=pi*pj}}return clampP(p)}
const liveAge=()=>Date.now()-Math.max(POLL&&POLL.state==="ok"?POLL.at:0,FEEDAT||0);
function legProb(l){const g=GM[l.g];if(!g)return{ok:0,why:"Game details not available yet"};
 if(RES[l.g])return{ok:0,why:"Game finished · settling on the final result"};
 const lv=LIVE[l.g];
 if(!lv){if(lock(g))return{ok:0,why:"Game has started · waiting for live data"};if(l.m==="p"&&INJ[l.pl]==="out")return{ok:0,why:"Suspended: player ruled out"};const c=legNow(l);return c?{ok:1,p:Math.min(.995,1/c/CO_OVR)}:{ok:0,why:"Suspended: no current price for a leg"}}
 if(/Suspend|Delay/i.test(lv.q||""))return{ok:0,why:"Suspended: play is "+(/Delay/i.test(lv.q)?"delayed":"suspended")};
 if(liveAge()>6*6e4)return{ok:0,why:"Suspended: live data is delayed"};
 const p=liveProb(l,g,lv);return p==null?{ok:0,why:"No live price for this market"}:{ok:1,p,live:1}}
/* value = chance-weighted return of the bet, less a 5% margin, never above the full payout.
   Miss-1: if exactly one leg loses the stake comes back, so that outcome counts too (and a Miss-1 bet with one
   lost leg keeps a value: the refund if every other leg wins). */
function coQuote(b){if(b.st!=="open")return{ok:0,why:""};const lost=b.legs.filter(l=>l.r==="l").length;
 if(lost>=2||(lost===1&&!b.ins))return{ok:0,why:"This bet has lost"};
 const ps=[];let live=0;for(const l of b.legs){if(l.r)continue;const q=legProb(l);if(!q.ok)return{ok:0,why:q.why};ps.push(q.p);if(q.live)live=1}
 const pay=Math.round(b.stake*b.odds*100)/100,all=ps.reduce((x,p)=>x*p,1);   /* the bet's shown "to win": stake x its current odds (void legs already taken out) */
 const one=b.ins&&!lost?ps.reduce((s,pj,j)=>s+(1-pj)*ps.reduce((x,p,i)=>i===j?x:x*p,1),0):0;
 const ev=lost?b.stake*all:pay*all+b.stake*one,mg=live?CO_LIVE:CO_PRE,v=Math.floor(Math.min(ev*(1-mg),pay-.01)*100)/100;
 /* chance: every remaining leg wins (legs treated as independent; same-game legs that move together are not boosted) */
 return v>0?{ok:1,amt:v,live,lostLeg:lost,pay:lost?b.stake:pay,win:all,refund:one,margin:mg,ev}:{ok:0,why:"No value available"}}
const pct=p=>p>=.995?">99%":p<.005?"<1%":Math.round(p*100)+"%";
/* cash out now vs keep the bet open, side by side */
function coCompare(b,q){return`<div class="coc"><div><small>Cash out</small><b class="${q.amt>=b.stake?"won":"lost"}">${$$(q.amt)}</b><em>${sgn(q.amt-b.stake)}</em></div>
 <div title="Potential return if ${q.lostLeg?"the rest win (stake back)":"every remaining leg wins"} · estimate less a ${Math.round(q.margin*100)}% margin, not a bookmaker offer"><small>${q.lostLeg?"Refund if rest win":"Keep · to win"}</small><b>${$$(q.pay)}</b></div></div>`}
function coRow(b,i){if(b.st!=="open")return"";const q=coQuote(b);
 return q.ok?`<div class="co"><div class="cow">${coCompare(b,q)}</div><button class="cob" data-co="${i}">Cash out</button></div>`
  :`<div class="co off"><small>Cash out unavailable · ${esc(q.why)}</small></div>`}
let CO_BUSY=false;
function coOpen(i,note){const b=S.bets[i],q=coQuote(b);if(!q.ok){toast("Cash out unavailable: "+q.why);renderBets();return}
 $("#psw").innerHTML=`<div class="mod" id="pso"><div class="mc" role="dialog" aria-label="Cash out"><button class="x cls" data-psx="1" aria-label="Close">×</button><h2 style="margin-top:4px">Cash out this bet?</h2>
 <div class="tm" style="margin:2px 0 10px">${b.legs.length>1?"Multi · "+b.legs.length+" legs":esc(b.legs[0].d)}</div>
 ${coCompare(b,q)}<div class="kv"><span>Original stake</span><b>${$$(b.stake)}</b></div>
 ${note?`<div class="msg">${esc(note)}</div>`:""}<button class="go" data-coc="${i}" data-amt="${q.amt}">Cash out ${$$(q.amt)}</button>
 <div class="tm" style="font-size:11px;margin-top:8px">The offer follows the latest odds and can change before you confirm. Play money only.</div></div></div>`}
function coConfirm(i,shown){if(CO_BUSY)return;const b=S.bets[i];if(!b||b.st!=="open"){$("#psw").innerHTML="";renderBets();return}
 const q=coQuote(b);if(!q.ok){$("#psw").innerHTML="";toast("Cash out unavailable: "+q.why);renderBets();return}
 if(Math.abs(q.amt-shown)>=.01){coOpen(i,`The offer changed to ${$$(q.amt)}. Confirm the new amount to cash out.`);return}   /* never accept a stale offer */
 CO_BUSY=true;slog("cashout",`bet ${i} cashed out for ${q.amt}${q.live?" (live)":""}`);b.st="cash";b.co={amt:q.amt,t:Date.now(),stake:b.stake};S.bal=Math.round((S.bal+q.amt)*100)/100;save();CO_BUSY=false;
 $("#psw").innerHTML="";render();toast(`Cashed out ${$$(q.amt)} (${sgn(q.amt-b.stake)})`)}
document.addEventListener("click",e=>{const t=e.target;if(!t||!t.closest)return;const o=t.closest("[data-co]");if(o){e.stopPropagation();e.preventDefault();coOpen(+o.dataset.co);return}
 const c=t.closest("[data-coc]");if(c){e.stopPropagation();e.preventDefault();coConfirm(+c.dataset.coc,+c.dataset.amt)}},true);
