/* ---------- games: real fixtures; DraftKings prices where published, ESPN projections otherwise ---------- */
const nbaTot=(h,a)=>{const s=tm=>(P[tm]||[]).map(e=>e[2].pts||0).sort((x,y)=>y-x).slice(0,9).reduce((q,x)=>q+x,0),v=(s(h)+s(a))/.95;return v>170?Math.min(246.5,Math.max(212.5,Math.floor(v)+.5)):228.5};
function mkG(x,legacy){const sp=x.sp,iso=x.iso,h=SAL0[x.h]||x.h,a=SAL0[x.a]||x.a,c=SP[sp],L=x.ln||{},soc=c.m==="soc";
 const id=legacy?sp+"_"+(h+a).replace(/[^A-Za-z]/g,"").slice(0,20)+"_"+iso.slice(5,10):"e"+x.id;
 const o={id,eid:legacy?null:x.id,sp,h,a,iso,ts:Date.parse(iso),ps:1.91,p:x.ph!=null?x.ph:(soc?.42:.56),pd:soc?(x.pd||.26):0,leg:!!legacy};
 if(!soc){
  if(L.ml){const qh=1/am(L.ml[0]),qa=1/am(L.ml[1]);o.p=qh/(qh+qa);o.oh=r2(am(L.ml[0]));o.oa=r2(am(L.ml[1]));o.bk=1}else{o.oh=od(o.p);o.oa=od(1-o.p)}
  if(L.sp){o.hl=L.sp[0];o.sh=r2(am(L.sp[1]||-110));o.sa=r2(am(L.sp[2]||-110));o.em=-o.hl;o.bk=1}
  else{const em=c.k*Math.log(o.p/(1-o.p));o.em=em;o.hl=-(Math.floor(em)+.5)}
  if(L.t){o.t=L.t[0];o.po=r2(am(L.t[1]||-110));o.pu=r2(am(L.t[2]||-110))}else o.t=sp==="nba"?nbaTot(h,a):44.5}
 else{
  if(L.ml&&L.dr){const x3=[am(L.ml[0]),am(L.dr),am(L.ml[1])].map(r2),k=1/x3[0]+1/x3[1]+1/x3[2];o.oh=x3[0];o.od=x3[1];o.oa=x3[2];o.p=1/x3[0]/k;o.pd=1/x3[1]/k;o.bk=1}
  else{o.oh=od(o.p,1.06);o.od=od(o.pd,1.06);o.oa=od(1-o.p-o.pd,1.06)}
  let T=2.65+.9*Math.abs(o.p-(1-o.p-o.pd));o.t=2.5;
  if(L.t){const qo=1/am(L.t[1]),qu=1/am(L.t[2]),po=qo/(qo+qu),kk=Math.floor(L.t[0])+1;let lo=.3,hi=7;for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(pois(mid,kk)<po)lo=mid;else hi=mid}T=(lo+hi)/2;o.t=L.t[0];o.po=r2(am(L.t[1]));o.pu=r2(am(L.t[2]))}
  else{const pv=pois(T,3);o.po=od(pv,1.06);o.pu=od(1-pv,1.06)}
  o.T=T;const sh2=Math.max(.25,Math.min(.75,.5+.55*(o.p-(1-o.p-o.pd)))),lh=T*sh2,la=T-lh,pb=(1-Math.exp(-lh))*(1-Math.exp(-la));o.by=od(pb,1.06);o.bn=od(1-pb,1.06)}
 if(soc&&!legacy)pbApply(o);
 if(sp==="nba"&&!legacy&&!o.bk)pbApplyNBA(o);
 return o}
/* PointsBet (AU) soccer prices: kept in their own JSON, applied on top of ESPN fixtures by team + kick-off match */
const PBD=JSON.parse((document.getElementById("pbd")||{}).textContent||"null")||{events:[]};
const PGEN=new Set(["fc","afc","cf","sc","club","de","the","and","manchester","united","city","real","athletic","sporting","hotspur","albion","town","fk"]),
 PAL={nottm:"nottingham",man:"manchester",utd:"united",spurs:"tottenham",wolves:"wolverhampton",inter:"internazionale",psg:"paris",atletico:"atletico",bayern:"bayern",leverkusen:"leverkusen"};
const pnorm=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z ]/g," ").split(/\s+/).filter(Boolean).map(w=>PAL[w]||w);
function pteam(a,b){const x=pnorm(a),y=pnorm(b),xs=x.filter(w=>!PGEN.has(w)&&w.length>2),ys=y.filter(w=>!PGEN.has(w)&&w.length>2);
 if(xs.length&&ys.length)return xs.some(w=>ys.some(v=>v===w||(w.length>=5&&v.startsWith(w))||(v.length>=5&&w.startsWith(v))));return x.join(" ")===y.join(" ")}
function pbApply(o){const e=PBD.events.find(e=>Math.abs(Date.parse(e.iso)-o.ts)<6*36e5&&pteam(e.h,o.h)&&pteam(e.a,o.a));if(!e)return;o.pb=e;
 const M=e.mk||{};if(M.res){const k=1/M.res[0]+1/M.res[1]+1/M.res[2];o.oh=r2(M.res[0]);o.od=r2(M.res[1]);o.oa=r2(M.res[2]);o.p=1/M.res[0]/k;o.pd=1/M.res[1]/k;o.bk=1;o.src="PointsBet"}
 if(M.tot){const qo=1/M.tot[1],qu=1/M.tot[2],po=qo/(qo+qu),kk=Math.floor(M.tot[0])+1;let lo=.3,hi=7;for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(pois(mid,kk)<po)lo=mid;else hi=mid}o.T=(lo+hi)/2;o.t=M.tot[0];o.po=r2(M.tot[1]);o.pu=r2(M.tot[2]);o.bk=1;o.src="PointsBet"}
 if(M.btts){o.by=r2(M.btts[0]);o.bn=r2(M.btts[1])}}
/* NBA games without a DraftKings price take PointsBet's moneyline, line and total */
function pbApplyNBA(o){const e=(PBD.events||[]).find(e=>e.comp==="nba"&&Math.abs(Date.parse(e.iso)-o.ts)<6*36e5&&pteam(e.h,o.h)&&pteam(e.a,o.a));if(!e)return;const M=e.mk||{};
 if(M.ml){const qh=1/M.ml[0],qa=1/M.ml[1];o.p=qh/(qh+qa);o.oh=r2(M.ml[0]);o.oa=r2(M.ml[1]);o.bk=1;o.src="PointsBet"}
 if(M.sp){o.hl=M.sp[0];o.sh=r2(M.sp[1]);o.sa=r2(M.sp[2]);o.em=-o.hl;o.bk=1;o.src="PointsBet"}
 if(M.tot){o.t=M.tot[0];o.po=r2(M.tot[1]);o.pu=r2(M.tot[2]);o.bk=1;o.src="PointsBet"}}
/* a player's PointsBet price for one selection, or null. Ladders are keyed by surname on PointsBet's side. */
function pbPx(g,name,st,s,l){if(!g||!g.pb||!g.pb.pp)return null;const pp=g.pb.pp,last=pnorm(name).slice(-1)[0];
 let r=pp[name];if(!r){const ks=Object.keys(pp).filter(k=>{const w=pnorm(k);return w.join(" ")===pnorm(name).join(" ")||(w.length===1&&w[0]===last)});if(ks.length===1)r=pp[ks[0]];else if(ks.length>1)r=ks.map(k=>pp[k]).reduce((a,b)=>Object.assign({},a,b),{})}
 if(!r)return null;if(st==="g"||st==="yc")return s==="k"&&l===1&&r[st]?r[st]:null;
 const lad=r[st];if(!lad)return null;const k=s==="k"?l:s==="o"?Math.floor(l)+1:null;return k!=null&&lad[k]?lad[k]:null}
const UCLX=[["Atlético Madrid","Bayern Munich","2026-11-03T20:00Z",32.1,27.1],["Barcelona","Aston Villa","2026-11-03T20:00Z",61.2,22.9],["Bodo/Glimt","Lille OSC","2026-11-03T20:00Z",36.0,28.0],["Feyenoord Rotterdam","Inter Milano","2026-11-03T20:00Z",22.3,24.7],["Galatasaray Istanbul","VfB Stuttgart","2026-11-03T17:45Z",40.8,27.1],["Manchester United","AS Roma","2026-11-03T20:00Z",50.0,25.3],["FC Shakhtar Donetsk","Sporting CP","2026-11-03T17:45Z",30.9,26.8],["LASK Linz","Slovan Bratislava","2026-11-03T20:00Z",54.4,24.4],["Villarreal","Paris Saint-Germain","2026-11-03T20:00Z",19.0,23.8],["AEK Athens","Real Madrid","2026-11-04T17:45Z",6.8,19.6],["Slavia Prague","Arsenal","2026-11-04T20:00Z",9.7,20.8],["Borussia Dortmund","Real Betis Seville","2026-11-04T20:00Z",61.2,22.9],["PSV Eindhoven","Club Brugge","2026-11-04T20:00Z",54.4,24.4],["Racing Club De Lens","Como 1907","2026-11-04T20:00Z",48.5,25.6],["RB Leipzig","Manchester City","2026-11-04T20:00Z",25.9,25.6],["Fenerbahce","Liverpool","2026-11-04T17:45Z",17.9,23.5],["FC Porto","Napoli","2026-11-04T20:00Z",39.2,27.4],["Viking FK","Sabah FK","2026-11-04T20:00Z",47.0,25.9]];
const UCLX_=DATA.games.some(x=>x.sp==="ucl")?[]:UCLX.map(x=>{const g=mkG({sp:"ucl",id:"ucl"+x[0].replace(/[^A-Za-z]/g,"").slice(0,8)+x[2].slice(5,10),h:x[0],a:x[1],iso:x[2],ph:x[3]/100,pd:x[4]/100});g.eid=null;g.mod=1;return g});
const G=[...DATA.games.map(x=>mkG(x)),...UCLX_,...LEGACY.map(x=>mkG({sp:x[0],h:x[1],a:x[2],iso:x[3],ph:x[4]/100,pd:(x[5]||0)/100},1))];
