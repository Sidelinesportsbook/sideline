/* ---------- prices anchored to the real market ----------
   1. Where PointsBet prices the exact selection (player over/unders, alternate player lines, alternate spreads and
      totals, team totals, double chance, both teams to score), that exact price is used.
   2. For a line PointsBet doesn't list, the player's expected figure is solved from PointsBet's own line and odds
      (with the bookmaker margin removed) and the line is priced from that, instead of from a handful of early-season
      games. So every alternate sits in line with the real market.
   3. Only players and stats PointsBet hasn't priced at all fall back to season averages. */
function pbEv(g){if(!g)return null;if(g.pbEv!==undefined)return g.pbEv;const soc=SP[g.sp]&&SP[g.sp].m==="soc";
 return g.pbEv=(PBD.events||[]).find(e=>(soc?e.comp!=="nba":e.comp==="nba")&&Math.abs(Date.parse(e.iso)-g.ts)<6*36e5&&pteam(e.h,g.h)&&pteam(e.a,g.a))||null}
/* PointsBet shortens some names ("G. Antetokounmpo"): initial + surname is accepted only when exactly one player on
   the two teams fits, so a short name can never land on the wrong player */
const shortNm=n=>{const w=pnk(n).split(" ");return w.length>1?w[0][0]+" "+w[w.length-1]:w[0]};
function pbRow(g,n){const e=pbEv(g);if(!e||!e.pp)return null;if(e.pp[n])return e.pp[n];const k=pnk(n),ex=Object.keys(e.pp).filter(x=>pnk(x)===k);if(ex.length===1)return e.pp[ex[0]];
 const sk=shortNm(n),c=Object.keys(e.pp).filter(x=>shortNm(x.replace(/\./g," "))===sk);if(c.length===1&&PLY.filter(p=>(p.tm===g.h||p.tm===g.a)&&shortNm(p.n)===sk).length===1)return e.pp[c[0]];
 if(SP[g.sp].m==="soc"){const last=pnorm(n).slice(-1)[0],ls=Object.keys(e.pp).filter(x=>{const w=pnorm(x);return w.length===1&&w[0]===last});if(ls.length===1)return e.pp[ls[0]]}return null}
/* players PointsBet lists under a short name still get its over/unders */
G.filter(g=>g.sp==="nba"&&!g.leg).forEach(g=>{const e=pbEv(g);if(!e||!e.pp)return;PLY.filter(p=>p.tm===g.h||p.tm===g.a).forEach(p=>{const v=pbRow(g,p.n);if(!v)return;
 ["pts","reb","ast","tpm","pra","pr","pa","ra"].forEach(st=>{const x=v[st];if(x&&x[1]&&x[2]&&!BKP[p.n+"|"+st])BKP[p.n+"|"+st]=[x[0],dec2am(x[1]),dec2am(x[2])]});if((v.dd||v.td)&&!PBDD[p.n])PBDD[p.n]={dd:v.dd,td:v.td}})});
function pbLadder(p,g,st){const r=pbRow(g,p.n);if(!r)return null;const lad=g.sp==="nba"?r.lad&&r.lad[st]:r[st];return lad&&typeof lad==="object"&&Object.keys(lad).length?lad:null}
/* PointsBet's own price for exactly this selection, or null */
function pbExact(p,g,st,s,l){if(st==="dd"||st==="td")return s==="k"&&PBDD[p.n]&&PBDD[p.n][st]?r2(PBDD[p.n][st]):null;
 const bk=BKP[p.n+"|"+st];if((s==="o"||s==="u")&&bk&&bk[0]===l)return r2(am(s==="o"?bk[1]:bk[2]));
 const r=pbRow(g,p.n);if(st==="g"&&s==="k"&&r){if(l===1&&r.g)return r2(r.g);if(l===2&&r.g2)return r2(r.g2);return null}if(st==="yc"&&s==="k"&&l===1&&r&&r.yc)return r2(r.yc);
 const lad=pbLadder(p,g,st),k=s==="k"?l:s==="o"?Math.floor(l)+1:null;return lad&&k!=null&&lad[k]>1?r2(lad[k]):null}
/* the expected figure implied by PointsBet: from its over/under (margin removed), else from the ladder rung nearest 50% */
const PBCAL={};
function solveMean(st,K,p){let lo=.01,hi=150;for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(pge(st,mid,K)<p)lo=mid;else hi=mid}return(lo+hi)/2}
function pbMean(p,g,st){if(!g||CF[st]&&CF[st][0]==="x")return null;const key=p.n+"|"+st+"|"+g.id;if(PBCAL[key]!==undefined)return PBCAL[key];let m=null;
 const bk=BKP[p.n+"|"+st];if(bk){const qo=1/am(bk[1]),qu=1/am(bk[2]);m=solveMean(st,Math.floor(bk[0])+1,qo/(qo+qu))}
 else{const lad=pbLadder(p,g,st);if(lad){let best=null;for(const[k,pr]of Object.entries(lad)){const q=Math.min(.97,1/pr/1.06);if(!best||Math.abs(q-.5)<Math.abs(best[1]-.5))best=[+k,q]}if(best)m=solveMean(st,best[0],best[1])}}
 if(m==null)m=estMean(p,g,st);
 return PBCAL[key]=m}
/* no bookmaker line for this player yet: early in the season a couple of games say little, so this season's
   averages are blended with last season's full-season averages until 10 games are played, then scaled by the
   game's real bookmaker odds (win chance) exactly as before */
function estMean(p,g,st){const P=NBAP[p.n];if(!P||!P.c27||!P.a26||g.sp!=="nba")return null;const keys=COMB[st]||[st],gp=P.c27.gp||0;if(gp>=10)return null;
 if(!keys.every(k=>P.c27[k]!=null&&P.a26[k]!=null))return null;const w=gp/10,bl=keys.reduce((s,k)=>s+w*P.c27[k]+(1-w)*P.a26[k],0),base=raw(p,st);
 return base>0?bl*mu(p,st,g)/base:bl}
const _plegP=pleg;pleg=function(i,st,s,l,gid){const x=_plegP(i,st,s,l,gid),p=PLY[i],g=gid?GM[gid]:gOf(p&&p.tm);if(!x||!p||!g)return x;
 const ex=pbExact(p,g,st,s,l);if(ex){x.odds=ex;x.src="PointsBet";x.cal=0;return x}
 const m=pbMean(p,g,st);if(m==null)return x;
 if(s==="k")x.odds=bkOdds(pge(st,m,l));else{const po=pge(st,m,Math.floor(l)+1);x.odds=bkOdds(s==="o"?po:1-po)}x.src=null;x.cal=1;return x};
/* how bookmakers turn a chance into a price, fitted to 2,300+ PointsBet player prices: a small margin on likely outcomes
   and shorter prices on long shots (odds = 1 / (1.025 p + 0.024)). A 50/50 line prices at 1.87 / 1.87, like the books. */
function bkOdds(p){return Math.min(41,Math.max(1.01,Math.round(100/(1.025*p+.024))/100))}
/* team markets: PointsBet's exact price for alternate lines, team totals, double chance and both teams to score */
const _legP=leg;leg=function(id,m,s,l){const x=_legP(id,m,s,l),g=GM[id];if(!x||!g)return x;const M=(pbEv(g)||{}).mk||{};let v=null;
 if(m==="s"){const HL=l!==undefined?l:g.hl;if(!(HL===g.hl&&g.bk)){const r=(M.altsp||[]).find(r=>r[0]===HL);if(r)v=s==="h"?r[1]:r[2]}}
 else if(m==="t"){const L=l!==undefined?l:g.t;if(!(L===g.t&&g.bk)){const r=(M.alttot||[]).find(r=>r[0]===L);if(r)v=s==="o"?r[1]:r[2]}}
 else if(m==="tg"){const r=(M["tt"+s[0]]||[]).find(r=>r[0]===x.line);if(r)v=s[1]==="o"?r[1]:r[2]}
 else if(m==="dc"&&M.dc)v=s==="1x"?M.dc[0]:s==="12"?M.dc[1]:M.dc[2];
 else if(m==="b"&&M.btts)v=s==="y"?M.btts[0]:M.btts[1];
 if(v>1){x.odds=r2(v);x.src="PointsBet"}return x};
/* player cards: over/under on PointsBet's line (or the line its prices imply), alternate lines on PointsBet's own rungs */
const _renderDetailP=renderDetail;renderDetail=function(){_renderDetailP();const g=GM[view];if(!g||!SL[dtab]||dtab==="main"||$("#games .mh"))return;
 document.querySelectorAll("#games > .card").forEach(c=>{const b=c.querySelector("[data-pl]");if(!b)return;const i=+b.dataset.pl,p=PLY[i],st=dtab;if(!p)return;
  const lad=pbLadder(p,g,st),m=pbMean(p,g,st),bk=BKP[p.n+"|"+st];
  const ou=c.querySelector(".mk .bs");if(ou&&!NO[st]&&!bk&&m!=null){const ln=lnOf(st,m);ou.innerHTML=pbt(i,st,"o",ln,"Over "+ln)+pbt(i,st,"u",ln,"Under "+ln)}
  const ld=c.querySelector(".lad");if(ld&&!NO[st]){const ks=lad?Object.keys(lad).map(Number).sort((a,b)=>a-b):m!=null?rungs(st,m):null;if(ks)ld.innerHTML=ks.map(k=>pbt(i,st,"k",k,rl(st,k))).join("")}
  const lab=c.querySelector(".mk .ml");if(lab&&(bk||lad||m!=null)&&!/PointsBet/.test(lab.textContent))lab.textContent=bk?"Over / Under · PointsBet":"Over / Under · from PointsBet line"})};
/* smoother background updates: a live refresh no longer steals focus from the search or stake box, or moves the page */
const _renderSm=render;render=function(msg){const a=document.activeElement,id=a&&(a.tagName==="INPUT"||a.tagName==="TEXTAREA")&&a.id,s0=id&&a.selectionStart,s1=id&&a.selectionEnd,y=scrollY;
 _renderSm(msg);if(id){const n=document.getElementById(id);if(n&&n!==document.activeElement){n.focus({preventScroll:true});try{n.setSelectionRange(s0,s1)}catch(e){}}}if(Math.abs(scrollY-y)>2)scrollTo(0,y)};
