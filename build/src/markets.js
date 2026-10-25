/* ---------- verified markets only ----------
   A selection is offered only when a bookmaker publishes it: DraftKings (main lines, via ESPN) or PointsBet (AU)
   (main lines, alternate spreads and totals, team totals, double chance, both teams to score, player over/unders and
   player alternate lines). Lines and prices are the bookmaker's own; nothing is filled in from the site's model.
   Whatever no bookmaker has priced is shown as not released yet. Model figures (projections, live cash-out values)
   stay on the page as analysis, labelled as such. */
const STALE_HIDE=12*36e5,STALE_WARN=2*36e5;
const pbAge=()=>PBD&&PBD.fetched?Date.now()-Date.parse(PBD.fetched):Infinity,dkAge=()=>Date.now()-Date.parse(DATA.synced);
const half=x=>Math.abs(Math.abs(x%1)-.5)<1e-9;   /* only lines that cannot push (x.5), so settlement is a clean win or loss */
function pbe(g){if(!g)return null;if(g.pbe!==undefined)return g.pbe;const soc=SP[g.sp]&&SP[g.sp].m==="soc";
 return g.pbe=(PBD.events||[]).find(e=>(soc?e.comp!=="nba":e.comp==="nba")&&Math.abs(Date.parse(e.iso)-g.ts)<6*36e5&&pteam(e.h,g.h)&&pteam(e.a,g.a))||null}
function vTeam(g,m,s,l){const e=pbe(g),M=(e&&e.mk)||{},pbOK=pbAge()<STALE_HIDE,pb=x=>pbOK&&x>1?{odds:r2(x),src:"PointsBet"}:null;
 const mainOK=g.bk&&(g.src?pbOK:dkAge()<STALE_HIDE),src=g.src||"DraftKings",main=x=>mainOK&&x>1?{odds:r2(x),src}:null;
 if(m==="h")return main(s==="h"?g.oh:s==="a"?g.oa:g.od);
 if(m==="s"){const HL=l!==undefined?l:g.hl;if(g.hl!==undefined&&HL===g.hl&&g.sh){const v=main(s==="h"?g.sh:g.sa);if(v)return v}const x=(M.altsp||[]).find(r=>r[0]===HL);return x&&half(HL)?pb(s==="h"?x[1]:x[2]):null}
 if(m==="t"){const L=l!==undefined?l:g.t;if(L===g.t&&g.po){const v=main(s==="o"?g.po:g.pu);if(v)return v}const x=(M.alttot||[]).find(r=>r[0]===L);return x&&half(L)?pb(s==="o"?x[1]:x[2]):null}
 if(m==="tg"){const x=(M["tt"+s[0]]||[]).find(r=>r[0]===l);return x&&half(l)?pb(s[1]==="o"?x[1]:x[2]):null}
 if(m==="b")return M.btts?pb(s==="y"?M.btts[0]:M.btts[1]):null;
 if(m==="dc")return M.dc?pb(s==="1x"?M.dc[0]:s==="12"?M.dc[1]:M.dc[2]):null;
 return null}
/* PointsBet sometimes shortens names ("G. Antetokounmpo"): accept initial + surname only when exactly one player on
   the two teams fits, so a short name can never land on the wrong player */
const shortK=n=>{const w=pnk(n).split(" ");return w.length>1?w[0][0]+" "+w[w.length-1]:w[0]};
function pbKeyFor(e,n,g){if(!e||!e.pp)return null;if(e.pp[n])return n;const k=pnk(n),ex=Object.keys(e.pp).filter(x=>pnk(x)===k);if(ex.length===1)return ex[0];
 const sk=shortK(n),cand=Object.keys(e.pp).filter(x=>/^[a-z]\.?\s/i.test(x.trim())&&shortK(x.replace(/\./g," "))===sk);if(cand.length!==1)return null;
 const rivals=PLY.filter(p=>(p.tm===g.h||p.tm===g.a)&&shortK(p.n)===sk);return rivals.length===1?cand[0]:null}
function pRow(g,n){const e=pbe(g),k=pbKeyFor(e,n,g);return k?e.pp[k]:null}
/* fill in bookmaker over/unders and double/triple-doubles for players PointsBet lists under a short name */
(G||[]).filter(g=>g.sp==="nba"&&!g.leg).forEach(g=>{const e=pbe(g);if(!e||!e.pp)return;PLY.filter(p=>p.tm===g.h||p.tm===g.a).forEach(p=>{const k=pbKeyFor(e,p.n,g);if(!k||k===p.n)return;const v=e.pp[k];
 ["pts","reb","ast","tpm","pra","pr","pa","ra"].forEach(st=>{const x=v[st];if(x&&x[1]&&x[2]&&!BKP[p.n+"|"+st])BKP[p.n+"|"+st]=[x[0],dec2am(x[1]),dec2am(x[2])]});if((v.dd||v.td)&&!PBDD[p.n])PBDD[p.n]={dd:v.dd,td:v.td}})});
function vPlayer(p,g,st,s,l){if(!p||!g||pbAge()>STALE_HIDE)return null;const pb=x=>x>1?{odds:r2(x),src:"PointsBet"}:null;
 if(st==="dd"||st==="td")return s==="k"&&PBDD[p.n]&&PBDD[p.n][st]?pb(PBDD[p.n][st]):null;
 if(g.sp==="nba"){const bk=BKP[p.n+"|"+st];if((s==="o"||s==="u")&&bk&&bk[0]===l)return pb(am(s==="o"?bk[1]:bk[2]));
  if(s==="k"){const r=pRow(g,p.n),lad=r&&r.lad&&r.lad[st];return lad&&lad[l]?pb(lad[l]):null}return null}
 if(st==="g"&&s==="k"&&l===2){const r=pbPx(g,p.n,"g","k",1)!=null&&g.pb&&g.pb.pp?(Object.entries(g.pb.pp).find(([k])=>pnorm(k).slice(-1)[0]===pnorm(p.n).slice(-1)[0])||[])[1]:null;return r&&r.g2?pb(r.g2):null}
 const px=pbPx(g,p.n,st,s,l);return px?pb(px):null}
/* every price the site hands out goes through these: no verified price, no selection */
const _legV=leg;leg=function(id,m,s,l){const x=_legV(id,m,s,l),g=GM[id];if(!g||!x)return x;const v=vTeam(g,m,s,m==="s"?(l!==undefined?l:g.hl):m==="t"?(l!==undefined?l:g.t):l);
 if(v){x.odds=v.odds;x.src=v.src;x.na=0}else{x.na=1;x.odds=0}return x};
const _plegV=pleg;pleg=function(i,st,s,l,gid){const x=_plegV(i,st,s,l,gid),p=PLY[i],g=gid?GM[gid]:gOf(p.tm);const v=vPlayer(p,g,st,s,l);
 if(v){x.odds=v.odds;x.src=v.src;x.na=0}else{x.na=1;x.odds=0}return x};
const _pbtV=pbt;pbt=function(i,st,s,l,lab){const g=GM[view],x=pleg(i,st,s,l,g&&g.id);return x&&!x.na?_pbtV(i,st,s,l,lab):""};
const _btnV=btn;btn=function(id,m,s,dis,l){const x=leg(id,m,s,l);return x&&!x.na?_btnV(id,m,s,dis,l):""};
/* team markets: the bookmaker's main lines, then its real alternates (spreads, totals, team totals, double chance) */
mkts=function(g,dis,full){const soc=SP[g.sp].m==="soc",M=(pbe(g)||{}).mk||{},row=(lab,b)=>b?`<div class="mk"><span class="ml">${lab}</span><div class="bs">${b}</div></div>`:"";
 const B=(m,s,l)=>btn(g.id,m,s,dis,l),all=(...b)=>b.every(Boolean)?b.join(""):"";
 let h=row(soc?"Result":"Head to head",all(B("h","a"),...(soc?[B("h","d")]:[]),B("h","h")));
 h+=soc?row("Both teams to score",all(B("b","y"),B("b","n"))):row("Line",all(B("s","a"),B("s","h")));
 h+=row(soc?"Total goals":"Total",all(B("t","o"),B("t","u")));
 if(full){if(soc)h+=row("Double chance",all(B("dc","1x"),B("dc","x2"),B("dc","12")));
  const near=(xs,c,n)=>xs.filter(x=>half(x[0])&&x[0]!==c).sort((a,b)=>Math.abs(a[0]-(c||0))-Math.abs(b[0]-(c||0))).slice(0,n).sort((a,b)=>a[0]-b[0]);
  h+=near(M.altsp||[],g.hl,soc?6:8).map(x=>row(soc?"Handicap":"Alt line",all(B("s","a",x[0]),B("s","h",x[0])))).join("");
  h+=near(M.alttot||[],g.t,8).map(x=>row((soc?"Goals ":"Points ")+x[0],all(B("t","o",x[0]),B("t","u",x[0])))).join("");
  ["h","a"].forEach(k=>(M["tt"+k]||[]).filter(x=>half(x[0])).forEach(x=>{h+=row(sh(k==="h"?g.h:g.a)+(soc?" goals ":" total ")+x[0],all(B("tg",k+"o",x[0]),B("tg",k+"u",x[0])))}))}
 return h||`<div class="mk mna"><span class="ml">Markets</span><div class="tm">Not released yet · no bookmaker has priced this game</div></div>`};
/* player markets on the game page: the bookmaker's over/under and its alternate lines, nothing else */
function propMarkets(i,p,g,st){const soc=SP[g.sp].m==="soc",rows=[];
 const bk=g.sp==="nba"&&BKP[p.n+"|"+st];if(bk){const o=pbt(i,st,"o",bk[0],"Over "+bk[0]),u=pbt(i,st,"u",bk[0],"Under "+bk[0]);if(o&&u)rows.push(`<div class="mk"><span class="ml">Over / Under · PointsBet</span><div class="bs">${o}${u}</div></div>`)}
 let ks=[];if(st==="dd"||st==="td")ks=[1];else if(g.sp==="nba"){const r=pRow(g,p.n);ks=Object.keys((r&&r.lad&&r.lad[st])||{}).map(Number)}
 else if(st==="g")ks=[1,2];else if(st==="yc")ks=[1];else{const r=g.pb&&g.pb.pp?Object.entries(g.pb.pp).find(([k])=>pnorm(k).join(" ")===pnorm(p.n).join(" ")||pnorm(k).slice(-1)[0]===pnorm(p.n).slice(-1)[0]):null;ks=Object.keys((r&&r[1]&&r[1][st])||{}).map(Number)}
 const lad=ks.sort((a,b)=>a-b).map(k=>pbt(i,st,"k",k,rl(st,k))).filter(Boolean);
 if(lad.length)rows.push(`<div class="ml" style="margin:8px 0 4px">${NO[st]?SL[st]+" · PointsBet":"Alternate lines · PointsBet"}</div><div class="lad">${lad.join("")}</div>`);
 return rows.join("")}
const _renderDetailV=renderDetail;renderDetail=function(){_renderDetailV();const g=GM[view];if(!g||$("#games .mh"))return;
 const age=pbAge(),upd=PBD.fetched?new Date(PBD.fetched).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}):"",stale=age>STALE_WARN;
 const note=`<div class="tm mnote">Only real bookmaker prices are shown (PointsBet${g.bk&&!g.src?" and DraftKings":""}). PointsBet prices updated ${upd||"–"}${stale?' · <b class="lost">may be out of date</b>':""}.`;
 if(!SL[dtab]||dtab==="main"){const tb=$("#games .tabs");if(tb&&!$("#games .mnote"))tb.insertAdjacentHTML("afterend",note+"</div>");return}
 let hid=0;document.querySelectorAll("#games > .card").forEach(c=>{const pn=c.querySelector(".pn"),nb=pn&&pn.querySelector("[data-ply]");if(!pn||!nb)return;const i=PLY.findIndex(p=>p.n===nb.dataset.ply&&(p.tm===g.h||p.tm===g.a));if(i<0)return;const p=PLY[i];
  [...c.children].forEach(x=>{if(x.classList.contains("mk")||x.classList.contains("lad")||(x.classList.contains("ml")&&x.tagName==="DIV"))x.remove()});
  const html=propMarkets(i,p,g,dtab);if(!html){c.remove();hid++;return}c.insertAdjacentHTML("beforeend",html)});
 const left=document.querySelectorAll("#games > .card .pn").length,tb=[...document.querySelectorAll("#games .tabs")].pop();
 if(tb)tb.insertAdjacentHTML("afterend",note+(hid?` ${hid} player${hid===1?"":"s"} without a ${SL[dtab].toLowerCase()} market yet (not released).`:"")+"</div>"+(left?"":`<div class="card cempty">No ${SL[dtab].toLowerCase()} markets released for this game yet.</div>`))};
/* the slip re-checks every selection against the bookmaker's current price before a bet is placed */
function curPrice(x){const g=GM[x.g];if(!g)return null;if(x.m==="p"){const i=PLY.findIndex(p=>p.n===x.pl&&(p.tm===g.h||p.tm===g.a));if(i<0)return null;const y=pleg(i,x.st,x.s,x.line,g.id);return y.na?null:y.odds}
 const y=leg(x.g,x.m,x.s,x.m==="s"?(x.s==="h"?x.line:-x.line):x.m==="h"||x.m==="b"||x.m==="dc"?undefined:x.line);return y.na?null:y.odds}
const slipIssues=()=>sel.map(x=>{const c=curPrice(x);return c==null?{gone:1}:Math.abs(c-x.odds)>=.005?{was:x.odds,now:c}:null});
const _renderSlipV=renderSlip;renderSlip=function(msg){_renderSlipV(msg);const iss=slipIssues();if(!iss.some(Boolean))return;
 document.querySelectorAll("#slip .leg").forEach((row,k)=>{const q=iss[k];if(!q)return;row.insertAdjacentHTML("beforeend",`<div class="pchg">${q.gone?"No longer offered by the bookmaker · remove it to continue":`Price changed ${f2(q.was)} → <b>${f2(q.now)}</b>`}</div>`)});
 const m=$("#slip #msg");if(m&&!m.querySelector(".accp"))m.insertAdjacentHTML("afterbegin",`<div class="accp">Prices have changed since you picked them. ${iss.some(q=>q&&q.gone)?"Remove the selections that are no longer offered, then ":""}<button data-accp="1">Accept new prices</button></div>`)};
const _placeV=place;place=function(){const iss=slipIssues();if(iss.some(Boolean)){renderSlip();return}_placeV()};
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-accp]");if(!b)return;e.stopPropagation();
 sel=sel.filter(x=>curPrice(x)!=null).map(x=>({...x,odds:curPrice(x)}));renderGames();renderSlip()},true);
