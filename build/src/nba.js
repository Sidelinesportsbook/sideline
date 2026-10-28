/* ---------- NBA: market players come straight from the provider rosters + real averages ---------- */
Object.keys(P).forEach(tm=>{if(TBY[tm])delete P[tm]});
const NBAP={},STK=["pts","reb","ast","tpm","stl","blk"];
function curAvg(p){if(p.a27)return p.a27;const rows=(p.lg||[]).map(r=>r.split("|")).filter(r=>r[0]>="2026-10-01");if(!rows.length)return null;
 const s=k=>r2(rows.reduce((q,r)=>q+(+r[k]||0),0)/rows.length),c10=r=>[5,6,7,9,10].filter(k=>+r[k]>=10).length;
 return{gp:rows.length,min:s(4),pts:s(5),reb:s(6),ast:s(7),tpm:s(8),stl:s(9),blk:s(10),ddn:rows.filter(r=>c10(r)>=2).length,tdn:rows.filter(r=>c10(r)>=3).length}}
DATA.pl.forEach(p=>{const t=TM[p.t];if(!t)return;p.c27=curAvg(p);NBAP[p.n]=p;
 if(p.inj)INJ[p.n]=p.inj==="Out"?"out":"questionable";
 /* markets use this season only: no games this season = no player markets, never a 2025-26 fallback */
 const b=p.c27;if(!b||!b.gp||(+b.min||0)<12)return;
 const mu={};STK.forEach(k=>mu[k]=r2(+b[k]||0));
 if(b.gp>=5){const dd=b.dd!=null?b.dd:b.ddn,td=b.td!=null?b.td:b.tdn;if(dd!=null){mu.ddr=dd/b.gp;mu.tdr=(td||0)/b.gp}}
 A(t.n,N(p.n,p.pos||"",mu))});
/* PointsBet NBA player lines: real bookmaker over/unders. They set the line and price for every player PointsBet covers,
   including players with no games yet this season (e.g. a team that has not played), so those players still get markets. */
const PBJ=JSON.parse((document.getElementById("pbd")||{}).textContent||"null")||{events:[]},PBDD={};
const pnk=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z ]/g," ").replace(/\b(jr|sr|ii|iii|iv)\b/g," ").replace(/\s+/g," ").trim();
const dec2am=d=>d>=2?Math.round((d-1)*100):Math.round(-100/(d-1));
{const byK={};Object.values(NBAP).forEach(p=>byK[pnk(p.n)]=p);
 (PBJ.events||[]).filter(e=>e.comp==="nba").forEach(e=>Object.entries(e.pp||{}).forEach(([nm,v])=>{const p=byK[pnk(nm)];if(!p||!TM[p.t])return;const tn=TM[p.t].n;
  ["pts","reb","ast","tpm","pra","pr","pa","ra"].forEach(st=>{const x=v[st];if(x&&x[1]&&x[2])BKP[p.n+"|"+st]=[x[0],dec2am(x[1]),dec2am(x[2])]});
  if(v.dd||v.td)PBDD[p.n]={dd:v.dd,td:v.td};
  if(!(P[tn]||[]).some(e2=>e2[0]===p.n)){const mu={_pb:1};["pts","reb","ast","tpm"].forEach(st=>{if(v[st])mu[st]=v[st][0]});if(mu.pts!=null)A(tn,N(p.n,p.pos||"",mu))}}))}
/* Soccer: only real ESPN per-appearance rates. The old hand-made NFL/soccer lists are dropped entirely, so a club
   without provider data simply has no player markets. A stat the provider doesn't publish stays absent (never 0). */
const REALP=new Set();
Object.keys(P).forEach(tm=>{if(!TBY[tm])delete P[tm]});Object.keys(EX).forEach(k=>delete EX[k]);
const SOCK=["g","sa","ss","sot","ft","fw","yc"];
if(DATA.soc&&DATA.soc.length){const by={};DATA.soc.forEach(x=>{const tm=SAL0[x.tm]||x.tm;(by[tm]=by[tm]||[]).push(x)});
 Object.keys(by).forEach(tm=>{const ps=by[tm].filter(x=>x.gp>=2&&x.pos!=="G"&&x.ss!=null&&x.ss>0);if(!ps.length)return;
  P[tm]=ps.map(x=>{const m={_r:1};SOCK.forEach(k=>{if(x[k]!=null)m[k]=x[k]});REALP.add(x.n);return N(x.n,x.pos,m)})})}
const SOCP={};(DATA.soc||[]).forEach(x=>SOCP[x.n]=x);
const COMPN={"eng.1":"Premier League","esp.1":"LaLiga","ita.1":"Serie A","ger.1":"Bundesliga","fra.1":"Ligue 1","por.1":"Primeira Liga","ned.1":"Eredivisie","tur.1":"Süper Lig","bel.1":"Belgian Pro League","sco.1":"Scottish Premiership","aut.1":"Austrian Bundesliga","nor.1":"Eliteserien","gre.1":"Greek Super League","cze.1":"Czech First League","svk.1":"Slovak First League","aze.1":"Azerbaijan Premier League","uefa.champions":"Champions League","eng.fa":"FA Cup","eng.league_cup":"Carabao Cup","uefa.europa":"Europa League","eng.2":"Championship","eng.3":"League One","eng.4":"League Two","eng.5":"National League"},compN=s=>COMPN[s]||String(s||"").toUpperCase();
