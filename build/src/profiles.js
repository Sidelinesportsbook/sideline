/* ---------- team logos and player identity ----------
   Logos are ESPN's own team images: NBA by team abbreviation, soccer by ESPN team id, plus any logo ESPN sends with a game.
   The drawn crest stays underneath as the fallback until the image has loaded, and returns if the image fails.
   Players resolve by ESPN athlete id first, then by name, so box scores, bets and rosters all open the same profile. */
function logoMap(){return window.__LOGO||(window.__LOGO={})}
function logoUrl(n){if(!n)return"";const L=logoMap();if(L[n]!==undefined)return L[n];let u="";
 try{const t=Object.values(TM).find(x=>x.n===n);if(t&&t.ab)u="https://a.espncdn.com/i/teamlogos/nba/500/"+String(t.ab).toLowerCase()+".png";
  if(!u){const s=(typeof SOCTID!=="undefined"&&SOCTID[n])||null,id=s?s.tid:(Object.values((typeof TMD!=="undefined"&&TMD.soc)||{}).find(x=>x.n===n||SAL0[x.n]===n)||{}).id;if(id)u="https://a.espncdn.com/i/teamlogos/soccer/500/"+id+".png"}}catch(e){}
 return L[n]=u}
function logoOk(u){return(window.__LOK||(window.__LOK=new Set())).has(u)}
document.addEventListener("load",e=>{const t=e.target;if(t&&t.tagName==="IMG"&&t.parentNode&&t.parentNode.classList&&t.parentNode.classList.contains("tlg")){t.parentNode.classList.add("ok");(window.__LOK||(window.__LOK=new Set())).add(t.getAttribute("src"))}},true);
document.addEventListener("error",e=>{const t=e.target;if(t&&t.tagName==="IMG"&&t.parentNode&&t.parentNode.classList&&t.parentNode.classList.contains("tlg")){const n=t.dataset.n;if(n)logoMap()[n]="";t.parentNode.classList.remove("ok");t.remove()}},true);
/* players by ESPN id */
let PIDM=null;
function plById(id){if(!id)return null;if(!PIDM){PIDM={};Object.values(NBAP).forEach(p=>{if(p.id)PIDM["n"+p.id]=p.n});Object.values(SOCP).forEach(p=>{if(p.id&&!PIDM["s"+p.id])PIDM["s"+p.id]=p.n})}return PIDM["n"+id]||PIDM["s"+id]||null}
function plName(n,id){return plById(id)||(NBAP[n]||SOCP[n]?n:null)}
/* hit rates for every market with a line: last 5, last 10 and the season, from real game logs */
function propHits(pl,g,rows,cols,sts){if(!pl||!g||!rows.length)return"";const out=sts.map(st=>{const c=cols.find(x=>x.k===st);if(!c)return null;const m=mu(pl,st,g),ln=st==="g"?.5:lnOf(st,m),v=r=>{const x=c.f?c.f(r):r[c.i];return x===""||x==null||isNaN(+x)?null:+x};
  const rate=rs=>{const vs=rs.map(v).filter(x=>x!=null);return vs.length?[vs.filter(x=>x>ln).length,vs.length]:null},cell=x=>x?`<td class="${x[0]/x[1]>=.5?"ov":"un"}"><b>${x[0]}/${x[1]}</b> <small>${Math.round(x[0]/x[1]*100)}%</small></td>`:"<td>–</td>";
  const all=rows.map(v).filter(x=>x!=null),avg=all.length?all.reduce((a,b)=>a+b,0)/all.length:null;
  return`<tr><td><button class="pnm" data-pst="${st}">${esc(SL[st]||c.lab)}</button></td><td>${st==="g"?"Anytime":"Over "+ln}</td>${cell(rate(rows.slice(0,5)))}${cell(rate(rows.slice(0,10)))}${cell(rate(rows))}<td>${avg==null?"–":f1(avg)}</td></tr>`}).filter(Boolean);
 return out.length?`<h2>Hit rates for the next game's lines</h2><div class="tw"><table class="tb phr"><thead><tr><th>Market</th><th>Line</th><th>L5</th><th>L10</th><th>Season</th><th>Avg</th></tr></thead><tbody>${out.join("")}</tbody></table></div>`:""}
function upcoming(fx,sp){return fx&&fx.length?`<h2>Upcoming games</h2>${fixRows(fx.slice(0,3),sp)}`:""}
