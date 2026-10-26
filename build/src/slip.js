/* ---------- saved bet slips, honest bet statuses, price sources ----------
   The slip (selections, stake, singles/multi) is part of the saved account data S, so it is stored with everything else:
   in the account database where one is connected (the Claude version: same account on every device), and in this browser
   always. Saving a slip never places it: only "Place bet" creates a bet. */
let SLR=false,SLMSG="";
function slipSnap(){return JSON.stringify({sel,stake,mode})}
function slipRestore(){if(SLR||!S||!S.name)return;SLR=true;const s=S.slip;if(!s||!Array.isArray(s.sel)||!s.sel.length)return;
 const keep=s.sel.filter(x=>GM[x.g]&&!lock(GM[x.g])&&!gameDone(GM[x.g])),gone=s.sel.length-keep.length;
 sel=keep.map(x=>({...x}));if(s.stake>0)stake=s.stake;if(s.mode)mode=s.mode;
 if(gone)SLMSG=`${gone} saved selection${gone===1?"":"s"} removed: ${gone===1?"its game has":"their games have"} started.`;slog("slip",`restored ${keep.length}, dropped ${gone}`)}
const _renderSlip0=renderSlip;renderSlip=function(msg){slipRestore();_renderSlip0(msg||(SLMSG?(()=>{const m=SLMSG;SLMSG="";return m})():msg));
 /* where each price comes from */
 document.querySelectorAll("#slip .leg").forEach((row,k)=>{const x=sel[k],sm=row.querySelector("small");if(!x||!sm||sm.dataset.src)return;sm.dataset.src=1;sm.insertAdjacentHTML("beforeend",` · <span class="psrc">${esc(priceSrc(x))}</span>`)});
 if(sel.length)$("#slip h2").insertAdjacentHTML("afterend",`<div class="tm slsv">${DB?"Slip saved to your account":"Slip saved on this device"}</div>`);
 const snap=slipSnap();if(S&&S.name&&(!S.slip||S.slip.j!==snap)){S.slip={sel:JSON.parse(JSON.stringify(sel)),stake,mode,j:snap,t:Date.now()};save()}};
/* a price is labelled with its bookmaker only when it is that bookmaker's own price; everything else is the site's model */
function priceSrc(x){const g=GM[x.g];if(x.src)return x.src+" price";if(!g)return"Model price";
 const main=x.m==="h"||(x.m==="s"&&Math.abs(Math.abs(x.line)-Math.abs(g.hl))<1e-9)||(x.m==="t"&&x.line===g.t);return g.bk&&main?(g.src||"DraftKings")+" price":"Model price"}
/* bet status: LIVE only while a leg's game is in play; PENDING once the games are over but a leg awaits verified stats */
function betState(b){if(b.st!=="open")return null;const open=b.legs.filter(l=>!l.r);if(!open.length)return"PENDING";
 if(open.some(l=>LIVE[l.g]&&!(GM[l.g]&&gameDone(GM[l.g]))))return"LIVE";if(open.every(l=>GM[l.g]&&(gameDone(GM[l.g])||lock(GM[l.g]))))return"PENDING";return"UPCOMING"}
const _betCard2=betCard;betCard=function(b,i){const h=_betCard2(b,i),s=betState(b);return s?h.replace('<span class="chip c-open">LIVE</span>',`<span class="chip c-open st-${s.toLowerCase()}">${s}</span>`):h};
/* leg labels: HIT / MISS / VOID with the final figure; never "Live" for a finished game */
const _lp3=legProg;legProg=function(l){const r=_lp3(l),g=GM[l.g],done=g&&gameDone(g);
 if(l.r==="w")return{...r,lab:"HIT",txt:r.txt.replace(/ final · /," — HIT · ")};if(l.r==="l")return{...r,lab:"MISS",txt:r.txt.replace(/ final · /," — MISS · ")};
 if(l.r==="v")return{...r,lab:"VOID"};
 if(done&&!LIVE[l.g])return{...r,st:"idle",lab:"PENDING",bar:"",txt:/waiting|Final ·|Game finished/.test(r.txt)?r.txt:"Game finished · waiting for verified final stats"};
 return r};
/* ---------- leg results for bets that are no longer open (lost early, cashed out, refunded) ----------
   Settlement only handles open bets, so a cashed-out multi never had its legs marked. Each leg is now judged from the
   verified final stats with the same rules as normal settlement; the bet keeps its CASHED OUT status, amount and
   profit, and no money moves. */
function legOutcome(l){if(PPD&&PPD[l.g])return{r:"v",vr:typeof PPD[l.g]==="string"?PPD[l.g]:"postponed or cancelled"};
 const r=RES[l.g],lv=LIVE[l.g];if(!GM[l.g]&&!r&&!lv)return null;
 if(!r){if(!lv)return null;   /* in play: only outcomes that are already certain */
  if(l.m==="p"){const x=pst(l.g,l.pl,l.st);return x!==undefined&&(l.s==="k"?x>=l.line:l.s==="o"&&x>l.line)?{r:"w"}:null}
  if(l.m==="t"&&l.s==="o"&&lv.h+lv.a>l.line)return{r:"w"};if(l.m==="b"&&l.s==="y"&&lv.h>0&&lv.a>0)return{r:"w"};if(l.m==="tg"&&l.s[1]==="o"&&(l.s[0]==="h"?lv.h:lv.a)>l.line)return{r:"w"};return null}
 const[h,a]=r;
 if(l.m==="p"){if(!RP[l.g]||!Object.keys(RP[l.g]).length)return null;const x=pst(l.g,l.pl,l.st);if(x===undefined||isNaN(x))return{r:"v",vr:"player did not play"};return{r:(l.s==="k"?x>=l.line:l.s==="o"?x>l.line:x<l.line)?"w":"l"}}
 return{r:legWin(l,h,a)?"w":"l"}}
const _settleAll9=settleAll;settleAll=function(){_settleAll9();let ch=false;
 /* every closed bet: a multi that lost early, a cash-out, a refund. Only the remaining legs' own results are recorded. */
 S.bets.forEach(b=>{if(b.st==="open")return;b.legs.forEach(l=>{if(l.r)return;const o=legOutcome(l);if(!o)return;l.r=o.r;if(o.vr)l.vr=o.vr;ch=true})});
 if(ch){slog("settle","leg results recorded on closed bets");save()}};
/* new selections carry the player's ESPN id, so they stay linked to the right player after trades or name changes */
const _pleg9=pleg;pleg=function(...a){const x=_pleg9(...a);if(x&&x.pl&&!x.pid){const p=NBAP[x.pl]||SOCP[x.pl];if(p&&p.id)x.pid=String(p.id)}return x};
/* ---------- voided legs: odds and potential return follow the remaining legs ----------
   A leg is void only on verified grounds: the final box score shows the player did not play (covers players ruled out
   beforehand and late withdrawals), or the game was postponed, cancelled or abandoned. A player who played, even briefly
   before an injury, is settled on his real stats. Once a leg is void, the bet's current odds are rebuilt from the legs
   that still count (product of their odds x boost), so they can never be adjusted twice, on any device. The original
   odds are kept in odds0, and every void is logged once in voidLog (leg, reason, time, odds before and after).
   Cashed-out bets keep their accepted amount; settled bets were already paid on the remaining legs. */
const legsOdds=(b,keepVoid)=>Math.round(b.legs.reduce((x,l)=>l.r==="v"&&!keepVoid?x:x*l.odds,1)*(b.bx||1)*100)/100;
function applyVoids(){let ch=false;S.bets.forEach(b=>{if(!b.legs.some(l=>l.r==="v"))return;
 if(b.odds0===undefined){b.odds0=legsOdds(b,1);ch=true}
 const log=b.voidLog||(b.voidLog=[]);b.legs.forEach((l,i)=>{if(l.r!=="v"||log.some(x=>x.i===i))return;log.push({i,leg:l.d,reason:l.vr||"void",t:Date.now(),from:b.st==="open"?b.odds:null,to:b.st==="open"?legsOdds(b):null});ch=true});
 if(b.st==="open"){const cur=legsOdds(b);if(b.odds!==cur){b.odds=cur;ch=true}}});if(ch)save();return ch}
const _settleAllV=settleAll;settleAll=function(){_settleAllV();applyVoids()};
/* the injury report as a warning only, until the box score settles it */
const _lpV=legProg;legProg=function(l){const r=_lpV(l);if(l.r==="v")return{...r,lab:"VOID",txt:"Void · "+(l.vr||"leg void")+" · removed from the multi"};
 if(!l.r&&l.m==="p"&&INJ[l.pl]==="out")return{...r,txt:"Listed out on the injury report · voids if he doesn't play, settles normally if he does"};return r};
/* bet cards: revised odds, with the original struck through and the reason */
const _betCardV=betCard;betCard=function(b,i){let h=_betCardV(b,i);const vs=b.legs.filter(l=>l.r==="v");if(!vs.length||b.odds0===undefined||b.odds0===b.odds)return h;
 const note=`<div class="tm vnote">${vs.length} leg${vs.length>1?"s":""} void (${vs.map(l=>esc(String(l.d).split(" Over ")[0].split(" Under ")[0])+": "+esc(l.vr||"void")).join("; ")}). Odds revised from <s>${f2(b.odds0)}</s> to <b>${f2(b.odds)}</b>${b.st==="open"?`, potential return ${$$(b.stake*b.odds)}`:""}.</div>`;
 return h.replace('<div class="bf">',note+'<div class="bf">')};
