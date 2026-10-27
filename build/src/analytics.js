/* ---------- analytics: shot charts, trends, splits and team dashboards, from official data only ----------
   Sources: ESPN play-by-play (each shot's court location, period, clock and result) and ESPN box scores. The cloud refresh
   (nba-season.ps1) reads every finished game (again while it is under 36 hours old, so stat corrections replace the first
   version) into pa/<ESPN athlete id>.json (the full season game log and every shot), pa/t<ESPN team id>.json (each game's
   line score and box totals for both teams, and every shot) and pa/league.json (league-wide shooting by court zone).
   Where those files can't be reached (the Claude artifact) a player's recent games are read straight from ESPN, and the
   page says so. A shot ESPN sent without a location is counted but never placed on the court; nothing is estimated.
   Formulas: FG% = made ÷ attempts, always from totals (never an average of game percentages) · eFG% = (FGM + 0.5 × 3PM) ÷ FGA
   · TS% = PTS ÷ (2 × (FGA + 0.44 × FTA)) · possessions (estimate) = FGA − OREB + TOV + 0.44 × FTA · offensive rating =
   100 × points ÷ possessions · pace = possessions per 48 minutes · rolling average = the mean of the last N games up to
   and including that game (percentages: made ÷ attempts over those games).
   End-of-period heaves are not field-goal attempts under NBA rules, so they're left out of every shooting figure. */
var PA={},PAQ={};
function paBase(){return window.claude&&!window.SL_CLOUD?"https://sidelinesportsbook.github.io/sideline/":""}
/* the file for a player ("<id>"), team ("t<id>") or the league; re-checked every 10 minutes while a profile is open */
function paGet(key,fb){const d=PA[key];
 /* the published file wasn't reachable: a caller that can read ESPN directly (fb) does so once */
 if(d&&d.err&&fb&&!d.fbd&&!PAQ[key]){d.fbd=1;PAQ[key]=1;fb().then(x=>{if(x)PA[key]=Object.assign(x,{got:Date.now()})}).catch(()=>{}).finally(()=>{delete PAQ[key];paDone(key)});return null}
 if(d&&Date.now()-d.got<(d.err?12e4:6e5))return d;if(PAQ[key])return d||null;PAQ[key]=1;
 fetch(paBase()+"pa/"+key+".json?t="+Math.floor(Date.now()/3e5),{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}).then(x=>{if(!x||x.v!==1)throw new Error("format");x.got=Date.now();PA[key]=x})
  .catch(async()=>{if(d&&!d.err){d.got=Date.now();return}let x=null;if(fb)try{x=await fb()}catch(e){}PA[key]=x?Object.assign(x,{got:Date.now()}):{err:1,got:Date.now()}})
  .finally(()=>{delete PAQ[key];paDone(key)});return d||null}
function paDone(key){if(!SHEET||!$("#pso"))return;
 if(SHEET.kind==="team"){const k=teamKey(SHEET.n);if(k&&(key==="t"+k.id||key==="st"+k.id||key==="league"))openTeam(SHEET.n,SHEET.tab)}
 else{const p=NBAP[SHEET.n],s=SOCP[SHEET.n];if(p&&(key===String(p.id)||key==="league")||!p&&s&&key==="s"+s.id)openPlayer(SHEET.n)}}
/* ESPN summary -> shots (the same reading as the cloud refresh) */
function espnShots(j){const out=[];(j.plays||[]).forEach(p=>{if(!p.shootingPlay||!p.participants||!p.participants[0])return;const c=p.coordinate||{},tx=(p.type||{}).text||"",
  v=+p.pointsAttempted||(/^Free Throw/.test(tx)?1:/three point/.test(p.text||"")?3:2),ok=v>1&&c.x>=-2&&c.x<=52&&c.y>=-2&&c.y<=94,d=((p.text||"").match(/(\d+)-foot/)||[])[1];
  out.push({id:p.id,pid:String((p.participants[0].athlete||{}).id||""),tid:String((p.team||{}).id||""),q:(p.period||{}).number,c:(p.clock||{}).displayValue||"",x:ok?c.x:null,y:ok?c.y:null,m:p.scoringPlay?1:0,v,d:d==null?null:+d,ty:v===1?"Free throw":tx,t:p.text||""})});return out}
async function paFallback(p){const rows=uniqLog(p.lg).filter(r=>nbaSeasonOf(r[0])===SEASON.current&&r[17]),sh=[];let ok=0;
 await Promise.all(rows.map(r=>jget(EB+"basketball/nba/summary?event="+r[17]).then(j=>{ok++;espnShots(j).forEach(s=>{if(s.pid===String(p.id))sh.push([r[17],s.q,s.c,s.x??"",s.y??"",s.m,s.v,s.d??"",s.ty].join("|"))})}).catch(()=>{})));
 return ok?{v:1,id:p.id,fb:1,fbn:ok,lg:rows.map(r=>r.join("|")),sh}:null}
const shP=r=>{const f=r.split("|");return{e:f[0],q:+f[1],c:f[2],x:f[3]===""?null:+f[3],y:f[4]===""?null:+f[4],m:+f[5],v:+f[6],d:f[7]===""?null:+f[7],ty:f[8]||""}};
const shT=r=>{const f=r.split("|");return{e:f[0],pid:f[1],q:+f[2],c:"",x:+f[3],y:+f[4],m:+f[5],v:+f[6],d:f[7]===""?null:+f[7],ty:""}};
/* the season's rows for a player: the full log from the analytics file once it has loaded, else the last 10 shipped with the page */
function paRows(p){const d=PA[String(p.id)];return d&&d.lg&&!d.fb&&d.lg.length?d.lg.map(r=>r.split("|")):null}

/* ---------- the court (feet; ESPN puts the rim at x 25, y 1 and measures away from the baseline) ---------- */
var HY=1,CBASE=HY-5.25,CHALF=CBASE+47,BRK=HY+Math.sqrt(23.75*23.75-22*22),FTY=CBASE+19;
var ZN=[["ra","Restricted area"],["pt","Paint (non-RA)"],["mid","Mid-range"],["c3","Corner 3"],["ab3","Above the break 3"]];
const isHeave=s=>/heave/i.test(s.ty||"");
function zoneOf(s){if(s.x==null)return null;if(s.v===3)return s.y<=BRK?"c3":"ab3";return Math.hypot(s.x-25,s.y-HY)<=4?"ra":s.x>=17&&s.x<=33&&s.y<=FTY?"pt":"mid"}
const qL=q=>q<=4?"Q"+q:"OT"+(q>5?q-4:"");
const pctS=(m,a)=>a?(m/a*100).toFixed(1)+"%":"–";
function courtLines(k){const P=(x,y)=>(x*k).toFixed(1)+","+((y-CBASE)*k).toFixed(1),r=v=>(v*k).toFixed(1);
 return`<g class="ctl"><rect x="0" y="0" width="${r(50)}" height="${r(47)}"/><rect x="${r(17)}" y="0" width="${r(16)}" height="${r(19)}"/><circle cx="${r(25)}" cy="${r(19)}" r="${r(6)}"/>
 <path d="M${P(3,CBASE)}L${P(3,BRK)}A${r(23.75)} ${r(23.75)} 0 0 0 ${P(47,BRK)}L${P(47,CBASE)}"/><path d="M${P(21,CBASE+4)}L${P(21,HY)}A${r(4)} ${r(4)} 0 0 0 ${P(29,HY)}L${P(29,CBASE+4)}"/>
 <line x1="${r(22)}" x2="${r(28)}" y1="${r(4)}" y2="${r(4)}" class="ctb"/><circle cx="${r(25)}" cy="${r(HY-CBASE)}" r="${r(.75)}" class="ctr"/><path d="M${P(19,CHALF)}A${r(6)} ${r(6)} 0 0 1 ${P(31,CHALF)}"/></g>`}
function zonePaths(k){const P=(x,y)=>(x*k).toFixed(1)+","+((y-CBASE)*k).toFixed(1),r=v=>(v*k).toFixed(1),A=`A${r(23.75)} ${r(23.75)} 0 0 0 `;
 return{mid:`M${P(3,CBASE)}L${P(3,BRK)}${A}${P(47,BRK)}L${P(47,CBASE)}Z`,pt:`M${P(17,CBASE)}L${P(17,FTY)}L${P(33,FTY)}L${P(33,CBASE)}Z`,ra:`M${P(21,CBASE+4)}L${P(21,HY)}A${r(4)} ${r(4)} 0 0 0 ${P(29,HY)}L${P(29,CBASE+4)}Z`,
  c3:`M${P(0,CBASE)}L${P(0,BRK)}L${P(3,BRK)}L${P(3,CBASE)}ZM${P(47,CBASE)}L${P(47,BRK)}L${P(50,BRK)}L${P(50,CBASE)}Z`,ab3:`M${P(0,BRK)}L${P(3,BRK)}${A}${P(47,BRK)}L${P(50,BRK)}L${P(50,CHALF)}L${P(0,CHALF)}Z`}}
const ZLAB={ra:[25,3.9],pt:[25,10.6],mid:[25,21.6],c3:[1.5,6.5],ab3:[25,33]};
/* shots on the court: markers (made filled circle, missed cross), zones (FG% against the league), or a frequency heat map */
function courtSvg(shots,o){const W=o.w,k=W/50,H=47*k,sx=x=>(x*k).toFixed(1),sy=y=>((y-CBASE)*k).toFixed(1);let body="";
 if(o.v==="zones"){const Z=zoneStats(shots),zp=zonePaths(k),L=o.lg;
  body=["ab3","mid","c3","pt","ra"].map(z=>{const s=Z[z],p=s.a?s.m/s.a*100:null,lp=L&&L[z]&&L[z][1]?L[z][0]/L[z][1]*100:null,df=p!=null&&lp!=null&&s.a>=5?p-lp:null,cls=df==null?"zn0":df>=5?"zn2":df>=2?"zn1":df<=-5?"zm2":df<=-2?"zm1":"zn0";
   return`<path d="${zp[z]}" class="zn ${s.a?cls:"zne"}"/>`}).join("")+courtLines(k)+ZN.map(([z])=>{const s=Z[z],[lx,ly]=ZLAB[z],small=z==="c3"||z==="ra";if(!s.a)return"";
   const t=`<text x="${sx(lx)}" y="${sy(ly)}" class="znl${small?" sm":""}" text-anchor="middle">${Math.round(s.m/s.a*100)}%</text>`+(small?"":`<text x="${sx(lx)}" y="${(+sy(ly)+13).toFixed(1)}" class="zns" text-anchor="middle">${s.m}/${s.a}</text>`);
   return z==="c3"?t+`<text x="${sx(48.5)}" y="${sy(ly)}" class="znl sm" text-anchor="middle">${Math.round(s.m/s.a*100)}%</text>`:t}).join("")}
 else if(o.v==="heat"){const c=3,B={};let mx=0;shots.forEach(s=>{const i=Math.min(16,Math.floor(Math.max(0,s.x)/c)),j=Math.min(15,Math.floor(Math.max(0,s.y-CBASE)/c)),key=i+"_"+j;B[key]=(B[key]||0)+1;mx=Math.max(mx,B[key])});
  body=Object.keys(B).map(key=>{const[i,j]=key.split("_").map(Number),n=B[key];return`<rect x="${(i*c*k).toFixed(1)}" y="${(j*c*k).toFixed(1)}" width="${(Math.min(c,50-i*c)*k).toFixed(1)}" height="${(c*k).toFixed(1)}" class="hm" style="opacity:${(.14+.8*n/mx).toFixed(2)}"><title>${n} attempt${n>1?"s":""}</title></rect>`}).join("")+courtLines(k);o.hmax=mx}
 else{const rr=Math.max(3.2,.52*k);body=courtLines(k)+shots.map(s=>{const x=sx(s.x),y=sy(s.y),tip=esc(o.tip(s));
   return s.m?`<g class="gbb shm" data-gt="${tip}"><circle cx="${x}" cy="${y}" r="${Math.max(9,rr+5)}" class="shh"/><circle cx="${x}" cy="${y}" r="${rr.toFixed(1)}" class="mk"/></g>`
   :`<g class="gbb shm" data-gt="${tip}"><circle cx="${x}" cy="${y}" r="${Math.max(9,rr+5)}" class="shh"/><path d="M${(+x-rr*.8).toFixed(1)},${(+y-rr*.8).toFixed(1)}l${(rr*1.6).toFixed(1)},${(rr*1.6).toFixed(1)}m0,-${(rr*1.6).toFixed(1)}l-${(rr*1.6).toFixed(1)},${(rr*1.6).toFixed(1)}" class="mx"/></g>`}).join("")}
 return`<svg class="ctc" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" width="100%" role="img" aria-label="${esc(o.label||"Shot chart")}"><rect width="${W}" height="${H}" class="ctbg"/>${body}</svg>`}
function zoneStats(shots){const Z={};ZN.forEach(([z])=>Z[z]={m:0,a:0});shots.forEach(s=>{const z=zoneOf(s);if(z){Z[z].a++;Z[z].m+=s.m}});return Z}
/* the panel around a chart: view, games, period and shot type, then the figures and where every attempt went */
function scState(o){return o.st||(o.st={v:"dots",g:"all",ha:"all",q:0,t:"all"})}
function shotPanel(all,o){const st=o.st,G=o.games||{},order=o.order||[],ctx=o.ctx;
 let eids=st.g==="all"?order:st.g==="5"?order.slice(0,5):st.g==="10"?order.slice(0,10):order.includes(st.g)?[st.g]:order;
 if(st.ha!=="all")eids=eids.filter(e=>G[e]&&(st.ha==="a"?G[e].ha==="@":G[e].ha!=="@"));const ES=new Set(eids);
 const inQ=s=>!st.q||(st.q===5?s.q>=5:s.q===st.q),sel=all.filter(s=>(!order.length||ES.has(s.e))&&inQ(s)),ft=sel.filter(s=>s.v===1);
 const fg0=sel.filter(s=>s.v>1&&!isHeave(s)),hv=sel.filter(s=>s.v>1&&isHeave(s)).length,fg=fg0.filter(s=>st.t==="all"||String(s.v)===st.t);
 const loc=fg.filter(s=>s.x!=null&&s.y<=CHALF),far=fg.filter(s=>s.x!=null&&s.y>CHALF).length,nol=fg.filter(s=>s.x==null).length;
 const M=fg.filter(s=>s.m).length,t3=fg0.filter(s=>s.v===3),m3=t3.filter(s=>s.m).length,dist=loc.map(s=>s.d!=null?s.d:Math.hypot(s.x-25,s.y-HY));
 const W=Math.min(o.w||gbW(),560),btn=(key,val,lab)=>`<button data-sc="${key}:${val}" class="${String(st[key])===String(val)?"on":""}">${lab}</button>`;
 const gsel=order.length>1?`<select class="scsel" data-scg="1" aria-label="Choose a game"><option value="all"${order.includes(st.g)?"":" selected"}>One game…</option>${order.map(e=>{const g=G[e]||{};return`<option value="${e}"${st.g===e?" selected":""}>${esc(g.d?fd(Date.parse(g.d+"T12:00Z")):"")} ${g.ha==="@"?"@":"vs"} ${esc(g.opp||"")}</option>`}).join("")}</select>`:"";
 const qs=[...new Set(all.map(s=>Math.min(5,s.q)))].sort();
 const ctl=`<div class="pst gbt">${btn("v","dots","Shots")}${btn("v","zones","Zones · FG%")}${btn("v","heat","Heat · attempts")}</div>
  ${order.length>1?`<div class="gbf">${btn("g","all","Season ("+order.length+")")}${order.length>5?btn("g","5","L5"):""}${order.length>10?btn("g","10","L10"):""}${ctx!=="m"?btn("ha","all","Home & away")+btn("ha","h","Home")+btn("ha","a","Away"):""}${gsel}</div>`:""}
  <div class="gbf">${btn("q",0,"All periods")}${qs.map(q=>btn("q",q,q>=5?"OT":"Q"+q)).join("")}<span class="gbsp"></span>${btn("t","all","2PT + 3PT")}${btn("t","2","2PT")}${btn("t","3","3PT")}</div>`;
 if(!sel.length&&!fg.length)return`<div class="gbc">${ctl}<div class="cempty">${o.none||"No shots in this selection."}</div></div>`;
 const chart=loc.length?courtSvg(loc,{w:W,v:st.v,lg:o.lg,tip:o.tip,label:o.label}):`<div class="cempty">No shot locations in this selection.</div>`;
 const leg=st.v==="zones"?`<div class="scleg"><span><i class="lz zn2"></i>5+ pts above league</span><span><i class="lz zn1"></i>2 to 5 above</span><span><i class="lz zn0"></i>within 2</span><span><i class="lz zm1"></i>2 to 5 below</span><span><i class="lz zm2"></i>5+ below</span>${o.lg?"":"<span>League figures not loaded</span>"}</div><div class="tm note">Colour compares FG% in each zone with the NBA this season (zones with fewer than 5 attempts stay neutral). Figures are made / attempted.</div>`
  :st.v==="heat"?`<div class="scleg"><span class="hgr"><i></i></span><span>Darker = more attempts. Each square is 3 × 3 ft. This shows how often, not how well.</span></div>`
  :`<div class="scleg"><span><i class="lm"></i>Made</span><span><i class="lx">✕</i>Missed</span><span>${loc.length} shot${loc.length===1?"":"s"} shown</span></div>`;
 const Z=zoneStats(fg.filter(s=>s.x!=null)),L=o.lg,za=fg.filter(s=>s.x!=null).length||1;
 const ztb=`<div class="tw"><table class="tb ztb"><thead><tr><th>Zone</th><th>FGM-FGA</th><th>FG%</th><th>NBA</th><th>Share</th></tr></thead><tbody>${ZN.map(([z,lab])=>{const s=Z[z],lp=L&&L[z]&&L[z][1]?L[z][0]/L[z][1]*100:null,p=s.a?s.m/s.a*100:null;
  return`<tr><td>${lab}</td><td>${s.m}-${s.a}</td><td class="${p!=null&&lp!=null&&s.a>=5?(p-lp>=2?"won":p-lp<=-2?"lost":""):""}">${s.a?p.toFixed(1)+"%":"–"}</td><td>${lp!=null?lp.toFixed(1)+"%":"–"}</td><td>${s.a?Math.round(s.a/za*100)+"%":"–"}</td></tr>`}).join("")}
  ${ft.length?`<tr><td>Free throws</td><td>${ft.filter(s=>s.m).length}-${ft.length}</td><td>${pctS(ft.filter(s=>s.m).length,ft.length)}</td><td>–</td><td>–</td></tr>`:""}</tbody></table></div>`;
 const sum=`<div class="gbs"><span>FG <b>${M}/${fg.length}</b> ${pctS(M,fg.length)}</span><span>3PT <b>${m3}/${t3.length}</b> ${pctS(m3,t3.length)}</span><span>eFG% <b>${fg0.length?((fg0.filter(s=>s.m).length+.5*m3)/fg0.length*100).toFixed(1):"–"}</b></span><span>Avg distance <b>${dist.length?f1(dist.reduce((a,b)=>a+b,0)/dist.length)+" ft":"–"}</b></span>${ft.length?`<span>FT <b>${ft.filter(s=>s.m).length}/${ft.length}</b></span>`:""}</div>`;
 let rec="";if(o.box&&!st.q&&st.t==="all"){let bm=0,ba=0;(order.length?eids:Object.keys(o.box)).forEach(e=>{const b=o.box[e];if(b){bm+=b[0];ba+=b[1]}});
  if(ba)rec=fg.length===ba&&M===bm?`All ${ba} field-goal attempts in the official box scores are here.`:`The official box scores have ${bm}/${ba} field goals; ESPN's play-by-play has ${M}/${fg.length} for these games, and the chart uses the play-by-play.`}
 const why=[nol?`${nol} attempt${nol>1?"s":""} without a recorded location (counted, not shown)`:"",far?`${far} from beyond half court (counted, not shown)`:"",hv?`${hv} end-of-period heave${hv>1?"s":""} left out (not a field-goal attempt under NBA rules)`:""].filter(Boolean).join(" · ");
 return`<div class="gbc">${ctl}${sum}<div class="ctw">${chart}</div>${leg}</div>${o.table===false?"":`<h2>By zone</h2>${ztb}`}<div class="tm note">${[rec,why,"Shot locations as ESPN records them"+(o.src?" · "+o.src:"")+"."].filter(Boolean).join(" ")}</div>`}
/* filter buttons and the game picker, for whichever chart they belong to (profile sheet or match centre) */
document.addEventListener("click",e=>{const b=e.target&&e.target.closest&&e.target.closest("[data-sc]");if(!b)return;e.stopPropagation();const[k,v]=b.dataset.sc.split(":"),st=b.closest("#psw")?SHEET&&SHEET.sc:MSC;if(!st)return;
 st[k]=k==="q"?+v:v;scRedraw(b)},true);
document.addEventListener("change",e=>{const s=e.target;if(!s||!s.matches||!s.matches("[data-scg]"))return;const st=s.closest("#psw")?SHEET&&SHEET.sc:MSC;if(!st)return;st.g=s.value;scRedraw(s)},true);
function scRedraw(el){if(el.closest("#psw")){if(SHEET.kind==="team")openTeam(SHEET.n,SHEET.tab);else openPlayer(SHEET.n)}else renderGames()}
var MSC={v:"dots",g:"all",ha:"all",q:0,t:"all",side:"both"};

/* ---------- trend chart: each game's figure (bars), a rolling average (line) and the season average (dashed) ---------- */
function trendChart(gs,o){if(!gs.length)return`<div class="cempty">No games in this range.</div>`;
 const W=o.w||gbW(),n=gs.length,H=W<440?220:250,pl=34,pr=54,pt=18,pb=42,iw=W-pl-pr,ih=H-pt-pb;
 const vs=gs.flatMap(g=>[g.v,g.ra]).filter(v=>v!=null);let lo=Math.min(0,...vs),hi=Math.max(1,o.avg||0,...vs);
 const tk=o.pct?[0,25,50,75,100]:nice(lo,hi+(hi-lo)*.06,4),y0=tk[0],y1=tk[tk.length-1],Y=v=>pt+(1-(v-y0)/(y1-y0||1))*ih,zy=Y(Math.max(0,y0));
 const bw=iw/n,w=Math.min(32,Math.max(4,bw*.6)),every=Math.max(1,Math.ceil(26/bw)),everyD=Math.max(1,Math.ceil(40/bw)),X=i=>pl+i*bw+bw/2,fs=w<14?9:10.5;
 const grid=tk.map(v=>`<line x1="${pl}" x2="${W-pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="${v===0&&lo<0?"gbz0":"gbg"}"/><text x="${pl-7}" y="${(Y(v)+3.5).toFixed(1)}" class="gbax" text-anchor="end">${v}${o.pct?"%":""}</text>`).join("");
 const bars=gs.map((g,i)=>{const cx=X(i),x=cx-w/2,lab=`<text x="${cx.toFixed(1)}" y="${H-pb+15}" class="gbop" text-anchor="middle">${i%every&&i!==n-1?"":esc(g.short||"")}</text>${i%everyD&&i!==n-1?"":`<text x="${cx.toFixed(1)}" y="${H-pb+29}" class="gbdt" text-anchor="middle">${gbDate(g.t)}</text>`}`;
  const hit=`<rect class="gbhit" x="${(pl+i*bw).toFixed(1)}" y="${pt}" width="${bw.toFixed(1)}" height="${ih}"/>`;
  if(g.v==null)return`<g class="gbb" data-gt="${esc(g.tip)}">${hit}<rect class="gbr na" x="${x.toFixed(1)}" y="${(zy-5).toFixed(1)}" width="${w.toFixed(1)}" height="5" rx="2"/>${lab}</g>`;
  const top=Math.min(Y(g.v),zy),h=Math.max(1.5,Math.abs(Y(g.v)-zy));
  return`<g class="gbb" data-gt="${esc(g.tip)}">${hit}<rect class="gbr tr${g.v<0?" neg":""}" x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(3,w/3).toFixed(1)}"/>${n<=20?`<text x="${cx.toFixed(1)}" y="${(g.v<0?top+h+11:top-5).toFixed(1)}" class="gbv mut" text-anchor="middle" font-size="${fs}">${o.pct?Math.round(g.v):g.v}</text>`:""}${lab}</g>`}).join("");
 const rp=gs.map((g,i)=>g.ra==null?null:[X(i),Y(g.ra)]).filter(Boolean),line=rp.length>1?`<path d="${rp.map((p,i)=>(i?"L":"M")+p[0].toFixed(1)+","+p[1].toFixed(1)).join("")}" class="trl"/>${rp.map(p=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.6" class="trd"/>`).join("")}`:"";
 const av=o.avg!=null?`<line x1="${pl}" x2="${W-pr+4}" y1="${Y(o.avg).toFixed(1)}" y2="${Y(o.avg).toFixed(1)}" class="gbl"/><rect x="${W-pr+6}" y="${(Y(o.avg)-9).toFixed(1)}" width="${pr-8}" height="18" rx="9" class="gblp"/><text x="${(W-pr+6+(pr-8)/2).toFixed(1)}" y="${(Y(o.avg)+4).toFixed(1)}" class="gblt" text-anchor="middle">${o.pct?Math.round(o.avg)+"%":f1(o.avg)}</text>`:"";
 return`<div class="gbw"><svg class="gb" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(o.label||"Trend")}">${grid}${bars}${line}${av}</svg></div>
 <div class="scleg"><span><i class="lb"></i>Each game</span>${rp.length>1?`<span><i class="ll"></i>${o.win}-game rolling average</span>`:""}<span><i class="ld"></i>Season average</span>${gs.some(g=>g.v==null)?`<span><i class="lna"></i>${o.pct?"No attempts":"No data"}</span>`:""}</div>`}
/* rolling series: counts = mean of the window; percentages = made ÷ attempts over the window */
function rolling(gs,win,pct){return gs.map((g,i)=>{if(i+1<win)return null;const w=gs.slice(i+1-win,i+1);if(pct){const a=w.reduce((s,x)=>s+x.a,0);return a?w.reduce((s,x)=>s+x.m,0)/a*100:null}const v=w.map(x=>x.v).filter(x=>x!=null);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null})}

/* ---------- NBA player: Shot chart, Trends and Splits tabs (the Overview is the existing page) ---------- */
var PSTATS=[["pts","Points",r=>+r[5]],["reb","Rebounds",r=>+r[6]],["ast","Assists",r=>+r[7]],["tpm","3PM",r=>+r[8]],["pra","PRA",r=>+r[5]+ +r[6]+ +r[7]],["min","Minutes",r=>+r[4]],["fgp","FG%",null,r=>[+r[12],+r[13]]],["tpp","3P%",null,r=>[+r[8],+r[14]]],["stl","Steals",r=>+r[9]],["blk","Blocks",r=>+r[10]],["to","Turnovers",r=>+r[11]]];
function plTabs(cur,soc){return`<div class="tabs mtabs ptb">${[["ov","Overview"],["sh",soc?"Shot map":"Shot chart"],["tr","Trends"],["sp","Splits"]].map(([k,l])=>`<button data-pt="${k}" class="${cur===k?"on":""}">${l}</button>`).join("")}</div>`}
function paSkel(t){return`<div class="skl" style="height:${t||300}px"></div><div class="tm note">Loading this season's play-by-play…</div>`}
function nbaAnalytics(n,p,pt){if(!p.c27&&!(PA[String(p.id)]||{}).lg)return`<div class="cempty">${esc(n)} hasn't played a game this season yet.</div>`;const d=paGet(String(p.id),()=>paFallback(p)),lg=paGet("league");
 if(!d)return paSkel();if(d.err)return`<div class="cempty">Couldn't load ${esc(n)}'s play-by-play right now. The Overview tab still has the season averages and game log.</div>`;
 const rows=(d.lg||[]).map(r=>r.split("|")),src=d.fb?`read directly from ESPN for the last ${d.fbn} games (the full season is on the public site)`:`ESPN play-by-play, ${rows.length} game${rows.length===1?"":"s"} this season, updated ${fmt(Date.parse(d.at))}`;
 if(!rows.length)return`<div class="cempty">No games played this season yet.</div>`;
 if(pt==="sh"){const G={},box={};rows.forEach(r=>{G[r[17]]={d:r[0],opp:r[1],ha:r[2],res:r[3]};box[r[17]]=[+r[12],+r[13]]});SHEET.sc=SHEET.sc||{v:"dots",g:"all",ha:"all",q:0,t:"all"};
  return`<h2>Shot chart · ${SEASON.current}</h2>`+shotPanel((d.sh||[]).map(shP),{st:SHEET.sc,games:G,order:rows.map(r=>r[17]),box,ctx:"p",lg:lg&&lg.z,src,label:n+" shot chart",
   tip:s=>{const g=G[s.e]||{};return`${g.d?fmtD(Date.parse(g.d+"T12:00Z")):""} · ${g.ha==="@"?"@":"vs"} ${g.opp||""} · ${qL(s.q)} ${s.c} · ${s.ty}${s.d!=null?" · "+s.d+" ft":""} · ${s.v}PT ${s.m?"MADE":"MISSED"}`}})}
 if(pt==="tr")return plTrends(rows,src);return plSplits(rows,d,src)}
function plTrends(rows,src){const wins=[3,5,10].filter(x=>x<=rows.length),win=wins.includes(SHEET.tw)?SHEET.tw:wins.includes(5)?5:wins[wins.length-1]||0,sel=SHEET.ts||"pts",rng=SHEET.tg||"all",def=PSTATS.find(x=>x[0]===sel)||PSTATS[0],pct=!!def[3];
 const rs=(rng==="all"?rows:rows.slice(0,+rng)).slice().reverse(),gs=rs.map(r=>{const ma=pct?def[3](r):null,v=pct?(ma[1]?ma[0]/ma[1]*100:null):def[2](r);return{t:Date.parse(r[0]+"T12:00Z"),short:r[1],ha:r[2],res:r[3],v:v==null?null:Math.round(v*10)/10,m:ma?ma[0]:0,a:ma?ma[1]:0}});
 const ra=win?rolling(gs,win,pct):gs.map(()=>null);gs.forEach((g,i)=>{g.ra=ra[i];g.tip=`${fmtD(g.t)} · ${g.ha==="@"?"@":"vs"} ${g.short} · ${g.res} · ${g.v==null?"no attempts":(pct?g.m+"/"+g.a+" ("+g.v+"%)":g.v+" "+def[1].toLowerCase())}${g.ra!=null?` · ${win}-game avg ${pct?g.ra.toFixed(1)+"%":f1(g.ra)}`:""}`});
 const all=rows.map(r=>pct?def[3](r):def[2](r)),avg=pct?(()=>{const a=all.reduce((s,x)=>s+x[1],0);return a?all.reduce((s,x)=>s+x[0],0)/a*100:null})():all.reduce((a,b)=>a+b,0)/all.length;
 const vals=gs.map(g=>g.v).filter(v=>v!=null),mean=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0,sd=vals.length>1?Math.sqrt(vals.reduce((s,v)=>s+(v-mean)*(v-mean),0)/(vals.length-1)):null;
 const l5=gs.slice(-5),l5v=pct?(()=>{const a=l5.reduce((s,g)=>s+g.a,0);return a?l5.reduce((s,g)=>s+g.m,0)/a*100:null})():(l5.length?l5.reduce((s,g)=>s+g.v,0)/l5.length:null);
 const b=(k,v,l,c)=>`<button data-${k}="${v}" class="${c?"on":""}">${l}</button>`;
 return`<h2>Trends · ${SEASON.current}</h2><div class="gbc"><div class="pst gbt">${PSTATS.map(x=>b("trs",x[0],x[1],x[0]===sel)).join("")}</div>
 <div class="gbf">${[["all","Season ("+rows.length+")"],["10","Last 10"],["20","Last 20"]].filter(x=>x[0]==="all"||rows.length>+x[0]).map(x=>b("trg",x[0],x[1],rng===x[0])).join("")}${wins.length?`<span class="gbsp"></span>${wins.map(x=>b("trw",x,x+"-game avg",win===x)).join("")}`:""}</div>
 ${gbHead(def[1],"Game by game · bars are actual results",null,"")}${trendChart(gs,{avg,pct,win,label:def[1]+" by game with rolling average"})}
 <div class="gbs"><span>Season average <b>${avg==null?"–":pct?avg.toFixed(1)+"%":f1(avg)}</b></span><span>Last 5 <b>${l5v==null?"–":pct?l5v.toFixed(1)+"%":f1(l5v)}</b>${l5v!=null&&avg!=null&&rows.length>5?` <span class="${l5v>avg?"won":l5v<avg?"lost":""}">${l5v>=avg?"+":""}${pct?(l5v-avg).toFixed(1):f1(l5v-avg)}</span>`:""}</span>${!pct&&sd!=null?`<span>Std dev <b>${f1(sd)}</b></span><span>At or above average <b>${vals.filter(v=>v>=mean).length} of ${vals.length}</b></span>`:""}<span>High <b>${vals.length?Math.max(...vals):"–"}</b></span><span>Low <b>${vals.length?Math.min(...vals):"–"}</b></span></div></div>
 <div class="tm note">Bars are each game's official figure${win?`; the line is the average of the last ${win} games up to that game${pct?" (made ÷ attempted over those games)":""}`:""}; the dashed line is the season average. Past results don't predict future games. Source: ${esc(src)}.</div>`}
function aggRows(rs){const n=rs.length,S=i=>rs.reduce((s,r)=>s+(+r[i]||0),0);if(!n)return null;const fga=S(13),tpa=S(14),fta=S(16);
 return{gp:n,min:S(4)/n,pts:S(5)/n,reb:S(6)/n,ast:S(7)/n,tpm:S(8)/n,stl:S(9)/n,blk:S(10)/n,to:S(11)/n,fg:fga?S(12)/fga*100:null,tp:tpa?S(8)/tpa*100:null,ft:fta?S(15)/fta*100:null,ts:fga+fta?S(5)/(2*(fga+.44*fta))*100:null}}
function plSplits(rows,d,src){const sp=[["Season",rows],["Last 5",rows.slice(0,5)],["Last 10",rows.slice(0,10)],["Home",rows.filter(r=>r[2]!=="@")],["Away",rows.filter(r=>r[2]==="@")],["Wins",rows.filter(r=>r[3][0]==="W")],["Losses",rows.filter(r=>r[3][0]==="L")]].filter((x,i)=>i===0||x[1].length&&!(i===1&&rows.length<=5)&&!(i===2&&rows.length<=10));
 const P=v=>v==null?"–":v.toFixed(1);
 const tb=`<div class="tw"><table class="tb"><thead><tr><th>Split</th><th>GP</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>3PM</th><th>FG%</th><th>3P%</th><th>FT%</th><th>TS%</th></tr></thead><tbody>${sp.map(([l,rs])=>{const a=aggRows(rs);return`<tr${l==="Season"?' class="me"':""}><td>${l}</td><td>${a.gp}</td><td>${f1(a.min)}</td><td><b>${f1(a.pts)}</b></td><td>${f1(a.reb)}</td><td>${f1(a.ast)}</td><td>${f1(a.tpm)}</td><td>${P(a.fg)}</td><td>${P(a.tp)}</td><td>${P(a.ft)}</td><td>${P(a.ts)}</td></tr>`}).join("")}</tbody></table></div>`;
 /* points by period, from the made shots in the play-by-play; checked against the box score total */
 const sh=(d.sh||[]).map(shP),Q={};sh.forEach(s=>{if(s.m){const q=Math.min(5,s.q);Q[q]=(Q[q]||0)+s.v}});const tot=Object.values(Q).reduce((a,b)=>a+b,0),box=rows.reduce((s,r)=>s+(+r[5]||0),0),n=rows.length;
 const qs=[1,2,3,4,...(Q[5]?[5]:[])],mx=Math.max(1,...qs.map(q=>Q[q]||0));
 const qt=tot?`<div class="card qsp">${qs.map(q=>`<div class="qr"><span>${q===5?"OT":"Q"+q}</span><div class="qb"><i style="width:${((Q[q]||0)/mx*100).toFixed(1)}%"></i></div><b>${f1((Q[q]||0)/n)}</b><small>${tot?Math.round((Q[q]||0)/tot*100):0}%</small></div>`).join("")}</div>
  <div class="tm note">Points per game in each period over ${n} game${n===1?"":"s"} (${q5(Q)}), from made shots in ESPN's play-by-play${tot===box?`; they add up to the box-score total of ${box} points`:`; they add up to ${tot} points against ${box} in the box scores, so a few plays are missing from the play-by-play`}.</div>`:`<div class="cempty" style="height:64px">No points by period available.</div>`;
 const fga=sh.filter(s=>s.v>1&&!isHeave(s)),z=zoneStats(fga.filter(s=>s.x!=null)),za=fga.filter(s=>s.x!=null).length;
 const mix=za?`<div class="card qsp">${ZN.map(([k,l])=>`<div class="qr"><span>${l}</span><div class="qb"><i style="width:${(z[k].a/za*100).toFixed(1)}%"></i></div><b>${Math.round(z[k].a/za*100)}%</b><small>${z[k].a?Math.round(z[k].m/z[k].a*100)+"% FG":"–"}</small></div>`).join("")}</div><div class="tm note">Share of ${za} located field-goal attempts by zone, with the FG% in each.</div>`:"";
 return`<h2>Splits · ${SEASON.current}</h2>${tb}<div class="tm note">Per-game averages. Shooting percentages are totals (made ÷ attempted). TS% = points ÷ (2 × (FGA + 0.44 × FTA)).</div><h2>Scoring by period</h2>${qt}${mix?`<h2>Shot mix</h2>${mix}`:""}<div class="tm note">Source: ${esc(src)}.</div>`}
const q5=Q=>Q[5]?"overtime totals combined":"no overtime";
document.addEventListener("click",e=>{const t=e.target;if(!t||!t.closest||!SHEET)return;
 const a=t.closest("[data-pt]");if(a){e.stopPropagation();SHEET.pt=a.dataset.pt;openPlayer(SHEET.n);return}
 const s=t.closest("[data-trs]");if(s){e.stopPropagation();SHEET.ts=s.dataset.trs;openPlayer(SHEET.n);return}
 const w=t.closest("[data-trw]");if(w){e.stopPropagation();SHEET.tw=+w.dataset.trw;openPlayer(SHEET.n);return}
 const g=t.closest("[data-trg]");if(g){e.stopPropagation();SHEET.tg=g.dataset.trg;openPlayer(SHEET.n);return}
 const tm=t.closest("[data-tas]");if(tm&&SHEET.kind==="team"){e.stopPropagation();SHEET.tas=tm.dataset.tas;openTeam(SHEET.n,SHEET.tab);return}},true);

/* ---------- NBA team: Analytics tab ---------- */
const mA=s=>{const x=String(s||"").split("-");return[+x[0]||0,+x[1]||0]};
function tGame(g){const s=g.s||[],o=g.os||[],fg=mA(s[0]),tp=mA(s[1]),ft=mA(s[2]),ofg=mA(o[0]),otp=mA(o[1]),oft=mA(o[2]),ots=Math.max(0,(g.q||[]).length-4),min=48+5*ots;
 const poss=fg[1]-(+s[4]||0)+(+s[8]||0)+.44*ft[1],oposs=ofg[1]-(+o[4]||0)+(+o[8]||0)+.44*oft[1];
 return{e:g.e,t:Date.parse(g.d+"T12:00Z"),d:g.d,opp:g.o,oid:g.oid,ha:g.ha,pf:g.pf,pa:g.pa,res:(g.pf>g.pa?"W ":"L ")+Math.max(g.pf,g.pa)+"-"+Math.min(g.pf,g.pa),q:g.q||[],oq:g.oq||[],ots,fg,tp,ft,ofg,otp,oft,
  reb:+s[3]||0,oreb:+s[4]||0,ast:+s[5]||0,stl:+s[6]||0,blk:+s[7]||0,to:+s[8]||0,pip:+s[9]||0,fbp:+s[10]||0,oreb2:+o[3]||0,ooreb:+o[4]||0,oast:+o[5]||0,ostl:+o[6]||0,oblk:+o[7]||0,oto:+o[8]||0,opip:+o[9]||0,ofbp:+o[10]||0,
  poss,oposs,pace:(poss+oposs)/2*48/min}}
function tAgg(gs){const n=gs.length,S=f=>gs.reduce((s,g)=>s+f(g),0);if(!n)return null;const fga=S(g=>g.fg[1]),ofga=S(g=>g.ofg[1]),poss=S(g=>g.poss),oposs=S(g=>g.oposs);
 return{n,pf:S(g=>g.pf)/n,pa:S(g=>g.pa)/n,fg:fga?S(g=>g.fg[0])/fga*100:null,ofg:ofga?S(g=>g.ofg[0])/ofga*100:null,tp:S(g=>g.tp[1])?S(g=>g.tp[0])/S(g=>g.tp[1])*100:null,otp:S(g=>g.otp[1])?S(g=>g.otp[0])/S(g=>g.otp[1])*100:null,
  ft:S(g=>g.ft[1])?S(g=>g.ft[0])/S(g=>g.ft[1])*100:null,oft:S(g=>g.oft[1])?S(g=>g.oft[0])/S(g=>g.oft[1])*100:null,efg:fga?(S(g=>g.fg[0])+.5*S(g=>g.tp[0]))/fga*100:null,oefg:ofga?(S(g=>g.ofg[0])+.5*S(g=>g.otp[0]))/ofga*100:null,
  tpm:S(g=>g.tp[0])/n,otpm:S(g=>g.otp[0])/n,reb:S(g=>g.reb)/n,oreb:S(g=>g.oreb2)/n,orb:S(g=>g.oreb)/n,oorb:S(g=>g.ooreb)/n,ast:S(g=>g.ast)/n,oast:S(g=>g.oast)/n,to:S(g=>g.to)/n,oto:S(g=>g.oto)/n,stl:S(g=>g.stl)/n,ostl:S(g=>g.ostl)/n,blk:S(g=>g.blk)/n,oblk:S(g=>g.oblk)/n,
  pip:S(g=>g.pip)/n,opip:S(g=>g.opip)/n,fbp:S(g=>g.fbp)/n,ofbp:S(g=>g.ofbp)/n,ortg:poss?S(g=>g.pf)/poss*100:null,drtg:oposs?S(g=>g.pa)/oposs*100:null,pace:S(g=>g.pace)/n}}
var TSTATS=[["pf","Points scored",g=>g.pf],["pa","Points allowed",g=>g.pa],["mg","Margin",g=>g.pf-g.pa],["ortg","Off rating",g=>g.poss?Math.round(g.pf/g.poss*1000)/10:null],["drtg","Def rating",g=>g.oposs?Math.round(g.pa/g.oposs*1000)/10:null],["fgp","FG%",null,g=>g.fg],["tpp","3P%",null,g=>g.tp],["pace","Pace",g=>Math.round(g.pace*10)/10]];
function nbaTeamAnalytics(k){const d=paGet("t"+k.id),lg=paGet("league");
 if(!d)return paSkel(360);if(d.err)return`<div class="cempty">${window.claude&&!window.SL_CLOUD?"Team analytics are on the public site (sidelinesportsbook.github.io/sideline).":"Couldn't load this team's analytics right now. Try again in a minute."}</div>`;
 const gs=(d.g||[]).map(tGame);if(!gs.length)return`<div class="cempty">No games played this season yet.</div>`;
 const A=tAgg(gs),L5=gs.length>5?tAgg(gs.slice(0,5)):null,P=v=>v==null?"–":v.toFixed(1),D=(v,lo)=>v==null?"":`<small class="${(lo?-v:v)>0?"won":(lo?-v:v)<0?"lost":""}">${v>0?"+":""}${v.toFixed(1)}</small>`;
 const card=(l,v,l5,lo,unit)=>`<div class="sc"><small>${l}</small><b>${P(v)}${unit||""}</b>${L5&&l5!=null?`<small class="tm">Last 5: ${P(l5)}${unit||""} ${D(l5-v,lo)}</small>`:""}</div>`;
 const eff=`<div class="sg tsg">${card("Off rating",A.ortg,L5&&L5.ortg)}${card("Def rating",A.drtg,L5&&L5.drtg,1)}${card("Net rating",A.ortg-A.drtg,L5&&L5.ortg-L5.drtg)}${card("Pace",A.pace,L5&&L5.pace)}${card("eFG%",A.efg,L5&&L5.efg,0,"%")}${card("Opp eFG%",A.oefg,L5&&L5.oefg,1,"%")}</div>
  <div class="tm note">Calculated from ESPN box scores over ${A.n} game${A.n===1?"":"s"}: ratings are points per 100 possessions, possessions = FGA − OREB + TOV + 0.44 × FTA (an estimate), pace = possessions per 48 minutes.</div>`;
 const nq=Math.max(4,...gs.map(g=>g.q.length)),qa=i=>{const h=gs.filter(g=>g.q.length>i);return h.length?[h.reduce((s,g)=>s+g.q[i],0)/h.length,h.reduce((s,g)=>s+g.oq[i],0)/h.length,h.length]:null};
 const qrow=[0,1,2,3].map(qa),ot=nq>4?(()=>{const h=gs.filter(g=>g.q.length>4);return[h.reduce((s,g)=>s+g.q.slice(4).reduce((a,b)=>a+b,0),0)/h.length,h.reduce((s,g)=>s+g.oq.slice(4).reduce((a,b)=>a+b,0),0)/h.length,h.length]})():null;
 const qtb=`<div class="tw"><table class="tb"><thead><tr><th></th>${["Q1","Q2","Q3","Q4"].map(q=>`<th>${q}</th>`).join("")}${ot?"<th>OT</th>":""}</tr></thead><tbody>
  <tr><td>Scored</td>${qrow.map(x=>`<td>${x?f1(x[0]):"–"}</td>`).join("")}${ot?`<td>${f1(ot[0])}</td>`:""}</tr><tr><td>Allowed</td>${qrow.map(x=>`<td>${x?f1(x[1]):"–"}</td>`).join("")}${ot?`<td>${f1(ot[1])}</td>`:""}</tr>
  <tr><td>Difference</td>${[...qrow,...(ot?[ot]:[])].map(x=>x?`<td class="${x[0]>x[1]?"won":x[0]<x[1]?"lost":""}"><b>${x[0]-x[1]>0?"+":""}${f1(x[0]-x[1])}</b></td>`:"<td>–</td>").join("")}</tr></tbody></table></div>
  <div class="tm note">Average points per game in each quarter from ESPN line scores (${A.n} games${ot?`; overtime averaged over the ${ot[2]} game${ot[2]>1?"s":""} that went to OT`:""}).</div>`;
 const cm=[["Points",A.pf,A.pa],["FG%",A.fg,A.ofg],["3P%",A.tp,A.otp],["3-pointers made",A.tpm,A.otpm],["FT%",A.ft,A.oft],["Rebounds",A.reb,A.oreb],["Offensive rebounds",A.orb,A.oorb],["Assists",A.ast,A.oast],["Turnovers",A.to,A.oto],["Steals",A.stl,A.ostl],["Blocks",A.blk,A.oblk],["Points in the paint",A.pip,A.opip],["Fast-break points",A.fbp,A.ofbp]];
 const cmp=`<div class="card"><div class="cmh"><span>${esc(TM[k.id]?TM[k.id].ab:k.n)}</span><span></span><span>Opponents</span></div>${cm.map(([l,a,b])=>cmpRow(l,a==null?"–":a.toFixed(1),b==null?"–":b.toFixed(1))).join("")}</div><div class="tm note">Per game, from ESPN box scores. Percentages are totals over the season.</div>`;
 const sel=SHEET.tas||"pf",def=TSTATS.find(x=>x[0]===sel)||TSTATS[0],pct=!!def[3],ord=gs.slice().reverse();
 const tg=ord.map(g=>{const ma=pct?def[3](g):null,v=pct?(ma[1]?Math.round(ma[0]/ma[1]*1000)/10:null):def[2](g);return{t:g.t,short:g.opp,ha:g.ha,res:g.res,v,m:ma?ma[0]:0,a:ma?ma[1]:0}}),win=tg.length>=10?5:tg.length>=3?3:0,ra=win?rolling(tg,win,pct):tg.map(()=>null);
 tg.forEach((g,i)=>{g.ra=ra[i];g.tip=`${fmtD(g.t)} · ${g.ha==="@"?"@":"vs"} ${g.short} · ${g.res} · ${def[1]} ${g.v==null?"–":pct?g.v+"%":g.v}${g.ra!=null?` · ${win}-game avg ${pct?g.ra.toFixed(1)+"%":f1(g.ra)}`:""}`});
 const avg=pct?(()=>{const a=tg.reduce((s,g)=>s+g.a,0);return a?tg.reduce((s,g)=>s+g.m,0)/a*100:null})():(()=>{const v=tg.map(g=>g.v).filter(x=>x!=null);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null})();
 const trend=`<div class="gbc"><div class="pst gbt">${TSTATS.map(x=>`<button data-tas="${x[0]}" class="${x[0]===def[0]?"on":""}">${x[1]}</button>`).join("")}</div>${gbHead(def[1],"Game by game · this season",null,"")}${trendChart(tg,{avg,pct,win,label:def[1]+" by game"})}</div>`;
 const G={},order=gs.map(g=>g.e);gs.forEach(g=>G[g.e]={d:g.d,opp:g.opp,ha:g.ha,res:g.res});SHEET.sc=SHEET.sc||{v:"zones",g:"all",ha:"all",q:0,t:"all"};
 const tbox={};gs.forEach(g=>tbox[g.e]=g.fg);const shots=shotPanel((d.sh||[]).map(shT),{st:SHEET.sc,games:G,order,box:tbox,ctx:"t",lg:lg&&lg.z,src:"ESPN play-by-play",label:k.n+" shot chart",tip:s=>{const g=G[s.e]||{};return`${plById(s.pid)||"Player"} · ${g.d?fd(Date.parse(g.d+"T12:00Z")):""} ${g.ha==="@"?"@":"vs"} ${g.opp||""} · ${qL(s.q)} · ${s.d!=null?s.d+" ft · ":""}${s.v}PT ${s.m?"MADE":"MISSED"}`}});
 const nx=gOf(k.n),oppN=nx?(nx.h===k.n?nx.a:nx.h):null,oab=oppN&&(Object.values(TM).find(t=>t.n===oppN)||{}).ab,h2h=oab?gs.filter(g=>g.opp===oab):[];
 const hh=oppN?`<h2>Head to head · ${esc(oppN)}</h2>${h2h.length?`<div class="card">${h2h.map(g=>`<div class="kv"><span>${fd(g.t)} · ${g.ha==="@"?"@":"vs"} ${esc(g.opp)}</span><b class="${g.pf>g.pa?"won":"lost"}">${g.res}</b></div>`).join("")}</div>`:`<div class="cempty" style="height:56px">No meetings yet this season.</div>`}`:"";
 const leaders=(()=>{const ro=DATA.pl.filter(p=>p.t===k.id&&p.c27&&p.c27.gp);if(!ro.length)return"";const top=(f,l)=>{const p=ro.slice().sort((a,b)=>f(b.c27)-f(a.c27))[0];return`<div class="kv"><span>${l}</span><span class="bxp">${avatar(p.n,p.id,"nba",22)}<button class="pnm" data-ply="${esc(p.n)}">${esc(p.n)}</button> <b>${f1(f(p.c27))}</b></span></div>`};
  return`<h2>Team leaders</h2><div class="card">${top(a=>a.pts,"Points")}${top(a=>a.reb,"Rebounds")}${top(a=>a.ast,"Assists")}${top(a=>a.tpm,"3-pointers")}${top(a=>a.stl+a.blk,"Steals + blocks")}</div><div class="tm note">Per-game season averages from ESPN box scores (players with at least one game).</div>`})();
 return`<h2>Efficiency</h2>${eff}<h2>Trends</h2>${trend}<h2>Scoring by quarter</h2>${qtb}<h2>Team vs opponents</h2>${cmp}<h2>Shot chart</h2>${shots}${leaders}${hh}<div class="tm note">Source: ESPN box scores and play-by-play, ${A.n} game${A.n===1?"":"s"}, updated ${fmt(Date.parse(d.at))}.</div>`}

/* ---------- match centre: play-by-play, shot chart and game flow ---------- */
var PBT="all";
const PBK=[["all","All"],["sc","Scoring"],["sh","Shots"],["rb","Rebounds"],["to","Turnovers"],["fl","Fouls"],["sub","Subs"]];
function pbKind(p){const t=p.ty||"";return{sc:p.sc,sh:p.shp,rb:/Rebound/i.test(t),to:/Turnover|Bad Pass|Lost Ball|Traveling|Offensive Charge|Shot Clock|Kicked Ball|3-Second|Out of Bounds/i.test(t)&&!/Technical/i.test(t),fl:/Foul|Technical|Flagrant/i.test(t),sub:/Substitution/i.test(t)}}
function feedState(m,mc){const live=m.state==="in",age=mc?Date.now()-mc.at:0;return!mc?["na","Unavailable","ESPN hasn't sent events for this game"]:live?(age>9e4?["dl","Delayed",`last update from ESPN ${Math.round(age/6e4)} min ago, retrying`]:["lv","Live",`updated ${Math.max(1,Math.round(age/1e3))}s ago from ESPN`]):mc.fin?["fn","Final",m.sp==="nba"?"complete play-by-play from ESPN":"complete match feed from ESPN"]:["dl","Not final","ESPN hasn't marked this game complete"]}
function mPbp2(m,mc){if(!mc.pbp||!mc.pbp.length)return`<div class="cempty">${m.state==="pre"?"Play-by-play starts at tip-off.":"ESPN hasn't published play-by-play for this game. Nothing is shown rather than guessing."}</div>`;
 const[fs,fl,fd2]=feedState(m,mc),qs=[...new Set(mc.pbp.map(p=>p.q))].filter(Boolean),q=PBQ>0&&qs.includes(PBQ)?PBQ:PBQ===0?0:qs[qs.length-1];
 const rows=mc.pbp.filter(p=>(!q||p.q===q)&&(PBT==="all"||pbKind(p)[PBT])).slice().reverse(),last=mc.pbp[mc.pbp.length-1];
 const chk=mc.fin&&last&&last.h!=null&&(+last.h!==+m.h.sc||+last.a!==+m.a.sc)?`<div class="tm note"><b class="lost">ESPN's play-by-play ends at ${last.a}–${last.h}; the official final is ${m.a.sc}–${m.h.sc}.</b> Scores beside each play are as ESPN sent them.</div>`:"";
 const nm=p=>p.pid?plById(p.pid):null;
 return`<div class="fst ${fs}"><i></i><b>${fl}</b><span>${fd2} · ${mc.pbp.length} plays</span></div>
 <div class="gbf">${qs.map(x=>`<button data-pbq="${x}" class="${x===q?"on":""}">${qL(x)}</button>`).join("")}<button data-pbq="0" class="${q===0?"on":""}">Whole game</button></div>
 <div class="gbf">${PBK.map(([k,l])=>`<button data-pbt="${k}" class="${PBT===k?"on":""}">${l}</button>`).join("")}</div>
 <div class="card mpbp">${rows.length?rows.map(p=>{const n=nm(p);return`<div class="mpr${p.sc?" sc":""}" data-pid="${esc(p.id||"")}"><span class="mmin">${!q?qL(p.q)+" ":""}${esc(p.c)}</span>${p.tm?mLogo(m[p.tm],16):"<span></span>"}<span>${n?avatar(n,p.pid,"nba",18)+" ":""}${esc(p.t)}${p.sc&&p.v?` <em class="pv">+${p.v}</em>`:""}</span><b>${p.a??""}–${p.h??""}</b></div>`}).join(""):`<div class="cempty" style="height:56px;border:0">No ${PBK.find(x=>x[0]===PBT)[1].toLowerCase()} plays in ${q?qL(q):"this game"}.</div>`}</div>
 ${chk}<div class="tm note">Every play is ESPN's official play-by-play, newest first, with the score after the play (${esc(m.a.ab||"Away")}–${esc(m.h.ab||"Home")}). Plays ESPN corrects are replaced on the next update.</div>`}
/* lead by game time: home minus away, drawn as steps because the lead only changes on a scoring play (no smoothing) */
function gameFlow(m,mc){const P=(mc.pbp||[]).filter(p=>p.h!=null&&p.a!=null&&p.q);if(P.length<4)return"";const el=p=>{const c=String(p.c||"0"),pr=c.includes(":")?c.split(":").map(Number):[0,+c],sec=pr[0]*60+pr[1],len=p.q<=4?720:300,st=p.q<=4?(p.q-1)*720:2880+(p.q-5)*300;return(st+len-sec)/60};
 const pts=[{t:0,v:0,lab:"Tip-off · 0–0"}];P.forEach(p=>{const v=p.h-p.a;if(v!==pts[pts.length-1].v||p===P[P.length-1])pts.push({t:el(p),v,lab:`${qL(p.q)} ${p.c} · ${m.a.ab||"Away"} ${p.a}–${p.h} ${m.h.ab||"Home"}${v?" · "+(v>0?m.h.ab:m.a.ab)+" by "+Math.abs(v):" · tied"}`})});
 const W=Math.min(760,(($("#games")||{}).clientWidth||360)-28),H=200,pl=34,pr=10,pt=14,pb=24,T=Math.max(48,pts[pts.length-1].t),mx=Math.max(5,...pts.map(p=>Math.abs(p.v))),tk=nice(-mx,mx,4),y0=tk[0],y1=tk[tk.length-1];
 const X=t=>pl+t/T*(W-pl-pr),Y=v=>pt+(1-(v-y0)/(y1-y0))*(H-pt-pb),d=pts.map((p,i)=>i?"L"+X(p.t).toFixed(1)+","+Y(pts[i-1].v).toFixed(1)+"L"+X(p.t).toFixed(1)+","+Y(p.v).toFixed(1):"M"+X(0).toFixed(1)+","+Y(0).toFixed(1)).join(""),id="gf"+String(m.id).slice(-5),zy=Y(0);
 const qx=[12,24,36,...Array.from({length:Math.max(0,Math.ceil((T-48)/5))},(_,i)=>48+i*5)].filter(t=>t<T).map(t=>`<line x1="${X(t).toFixed(1)}" x2="${X(t).toFixed(1)}" y1="${pt}" y2="${H-pb}" class="gl"/>`).join("");
 const ql=[...Array(4).keys()].map(i=>`<text x="${X(i*12+6).toFixed(1)}" y="${H-7}" class="ax" text-anchor="middle">Q${i+1}</text>`).join("")+(T>48?`<text x="${X(48+(T-48)/2).toFixed(1)}" y="${H-7}" class="ax" text-anchor="middle">OT</text>`:"");
 const area=`${d}L${X(pts[pts.length-1].t).toFixed(1)},${zy.toFixed(1)}L${X(0)},${zy.toFixed(1)}Z`;
 return`<h2>Game flow</h2><div class="card"><svg class="ch" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Lead by game time" ${tipAttr(pts.map(p=>[+X(p.t).toFixed(1),+Y(p.v).toFixed(1),p.lab]))}>
 <defs><clipPath id="${id}a"><rect x="0" y="0" width="${W}" height="${zy}"/></clipPath><clipPath id="${id}b"><rect x="0" y="${zy}" width="${W}" height="${H}"/></clipPath></defs>${qx}
 ${tk.map(v=>`<line x1="${pl}" x2="${W-pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="${v===0?"zl":"gl"}"/><text x="${pl-6}" y="${(Y(v)+4).toFixed(1)}" class="ax" text-anchor="end">${Math.abs(v)}</text>`).join("")}
 <path d="${area}" class="gfh" clip-path="url(#${id}a)"/><path d="${area}" class="gfa" clip-path="url(#${id}b)"/><path d="${d}" class="ln gfl"/>${ql}<line class="hv" x1="0" x2="0" y1="${pt}" y2="${H-pb}"/><circle class="hd" r="4.5" cx="-20" cy="-20"/></svg>
 <div class="pl"><span><i class="gfk h"></i>${esc(m.h.ab||"Home")} ahead (above the line)</span><span><i class="gfk a"></i>${esc(m.a.ab||"Away")} ahead (below)</span></div></div>`}
function mShots(m,mc){const sh=(mc.pbp||[]).filter(p=>p.shp).map(p=>({e:m.id,q:p.q,c:p.c,x:p.x,y:p.y,m:p.sc?1:0,v:p.v||2,d:p.d,ty:p.ty,pid:p.pid,tm:p.tm}));
 if(!sh.length)return`<div class="cempty">${m.state==="pre"?"The shot chart starts at tip-off.":"ESPN hasn't published shot locations for this game."}</div>`;
 const side=MSC.side||"both",sel=side==="both"?sh:sh.filter(s=>s.tm===side),bt=(v,l)=>`<button data-scs="${v}" class="${side===v?"on":""}">${l}</button>`;
 const box={};if(side!=="both"){const p=mc.players[side];if(p){const ix=p.lab.indexOf("FG");if(ix>=0){const t=String(p.tot[ix]||"").split("-");box[m.id]=[+t[0],+t[1]]}}}
 return`<div class="gbf">${bt("both","Both teams")}${bt("a",esc(m.a.ab||tName(m.a)))}${bt("h",esc(m.h.ab||tName(m.h)))}</div>`+shotPanel(sel,{st:MSC,games:{},order:[],box:side!=="both"?box:null,ctx:"m",lg:(PA.league||{}).z,src:"ESPN play-by-play for this game"+(m.state==="in"?", updating live":""),label:"Shot chart",table:true,
  tip:s=>`${plById(s.pid)||"Player"} (${esc((m[s.tm]||{}).ab||"")}) · ${qL(s.q)} ${s.c} · ${s.ty}${s.d!=null?" · "+s.d+" ft":""} · ${s.v}PT ${s.m?"MADE":"MISSED"}`})}
document.addEventListener("click",e=>{const t=e.target;if(!t||!t.closest)return;const b=t.closest("[data-pbt]");if(b){e.stopPropagation();PBT=b.dataset.pbt;renderGames();return}
 const s=t.closest("[data-scs]");if(s){e.stopPropagation();MSC.side=s.dataset.scs;renderGames()}},true);

/* ---------- soccer match: every event ESPN's match feed has (commentary), and a shot map ---------- */
var SOCT="key";
const SOK=[["key","Key events"],["sh","Shots"],["fl","Fouls & cards"],["sp","Corners & offsides"],["all","Everything"]];
function socKind(e){const t=e.ty||"";return{key:e.sc||/Goal|Card|Substitution|Penalty|VAR|Own Goal/i.test(t),sh:/Shot|Goal|Penalty - (Scored|Saved|Missed)/i.test(t),fl:/Foul|Card|Handball/i.test(t),sp:/Corner|Offside/i.test(t),all:true}}
function mTimeline2(m,mc){const C=mc.com||[];if(!C.length)return mTimeline(m,mc);
 const[fs,fl,fd2]=feedState(m,mc),rows=C.filter(e=>e.ty&&socKind(e)[SOCT]||(SOCT==="all"&&!e.ty)).slice().reverse(),goals=C.filter(e=>e.sc),sc={h:0,a:0},run={};
 goals.forEach(e=>{if(e.tm){sc[e.tm]++;run[e.id]=sc.h+"–"+sc.a}});const ok=sc.h===+m.h.sc&&sc.a===+m.a.sc;
 return`<div class="fst ${fs}"><i></i><b>${fl}</b><span>${fd2} · ${C.length} events</span></div><div class="gbf">${SOK.map(([k,l])=>`<button data-sot="${k}" class="${SOCT===k?"on":""}">${l}</button>`).join("")}</div>
 <div class="card mpbp">${rows.length?rows.map(e=>`<div class="mev ${e.tm}${e.sc?" sc":""}"><span class="mmin">${esc(e.min)}</span><span class="mic">${evIcon({type:e.ty})}</span><span>${esc(e.t)}</span>${e.sc&&ok&&run[e.id]?`<b>${run[e.id]}</b>`:e.tm?mLogo(m[e.tm],16):""}</div>`).join(""):`<div class="cempty" style="height:56px;border:0">No events of this kind.</div>`}</div>
 <div class="tm note">ESPN's match feed, newest first.${goals.length&&ok?" The score beside a goal is the score after it.":goals.length?" Running scores are hidden because the feed's goals don't add up to the official score.":""}</div>`}
function mShotMap(m,mc){const S=(mc.com||[]).filter(e=>e.x!=null&&/Shot|Goal|Penalty - (Scored|Saved|Missed)/i.test(e.ty)&&!/Own Goal|Goal Kick/i.test(e.ty));
 if(!S.length)return`<div class="cempty">${m.state==="pre"?"The shot map starts at kick-off.":"ESPN hasn't published shot positions for this match."}</div>`;
 const side=MSC.ss||"both",sel=side==="both"?S:S.filter(s=>s.tm===side),bt=(v,l)=>`<button data-sss="${v}" class="${side===v?"on":""}">${l}</button>`;
 const kind=e=>e.sc||/Goal|Scored/i.test(e.ty)&&!/Saved|Missed/i.test(e.ty)?"g":/On Target|Saved/i.test(e.ty)?"o":/Blocked/i.test(e.ty)?"b":"x";
 const svg=pitchSvg(sel.map(e=>({x:e.x,y:e.y,k:kind(e),c:e.tm,tip:`${e.min} · ${e.t}`})),{w:Math.min(520,(($("#games")||{}).clientWidth||360)-28),label:"Shot map"});
 const far=sel.filter(e=>e.x<50).length,cnt=s=>{const a=S.filter(e=>e.tm===s);return{n:a.length,o:a.filter(e=>{const k2=kind(e);return k2==="g"||k2==="o"}).length,g:a.filter(e=>kind(e)==="g").length,b:a.filter(e=>kind(e)==="b").length,in:a.filter(e=>e.x>=83&&e.y>=21.1&&e.y<=78.9).length}};
 const tb=`<div class="tw"><table class="tb"><thead><tr><th></th><th>Shots</th><th>On target</th><th>Goals</th><th>Blocked</th><th>In the box</th></tr></thead><tbody>${["h","a"].map(s=>{const c=cnt(s);return`<tr><td>${mLogo(m[s],16)} ${esc(m[s].ab||tName(m[s]))}</td><td>${c.n}</td><td>${c.o}</td><td>${c.g}</td><td>${c.b}</td><td>${c.in}</td></tr>`}).join("")}</tbody></table></div>`;
 return`<div class="gbf">${bt("both","Both teams")}${bt("h",esc(m.h.ab||tName(m.h)))}${bt("a",esc(m.a.ab||tName(m.a)))}</div><div class="gbc"><div class="ctw">${svg}</div>
 ${pitchLegend()}${side==="both"?`<span><i class="lh"></i>${esc(m.h.ab||"Home")}</span><span><i class="la"></i>${esc(m.a.ab||"Away")}</span>`:""}</div></div>${tb}
 <div class="tm note">Where each shot was taken, from ESPN's match feed, both teams attacking upwards. ${(()=>{const ts=s=>{const x=(mc.teams[s]||[]).find(r=>r[2]==="totalShots");return x?+x[1]:null},th=ts("h"),ta=ts("a");return th==null||ta==null?"":th===cnt("h").n&&ta===cnt("a").n?"The counts match ESPN's team statistics.":`ESPN's team statistics list ${th} and ${ta} shots; the map shows the ${cnt("h").n} and ${cnt("a").n} in its match feed.`})()}${far?` ${far} shot${far>1?"s":""} from the team's own half not drawn.`:""} ESPN doesn't publish expected goals (xG) for these matches, so none is shown.</div>`}
/* half pitch, attacking upwards; positions on the feed's 0-100 scale (x towards goal, y across) drawn on a 105 × 68 m pitch;
   box lines on the same scale (box from 83, six-yard box from 94.2), so a shot "in the box" plots inside it.
   Markers: goal filled circle, on target ring, blocked triangle, off target (or woodwork) cross; colour = team */
function pitchSvg(S,o){const W=o.w,k=W/68,H=52.5*k,X=y=>((100-y)/100*68*k).toFixed(1),Y=x=>((100-x)/100*105*k).toFixed(1),r=v=>(v*k).toFixed(1);
 const pitch=`<g class="ctl"><rect x="0" y="0" width="${r(68)}" height="${r(52.5)}"/><rect x="${r(14.35)}" y="0" width="${r(39.3)}" height="${r(17.85)}"/><rect x="${r(25.02)}" y="0" width="${r(17.95)}" height="${r(6.09)}"/><circle cx="${r(34)}" cy="${r(12.08)}" r="1.5" class="ctr"/>
  <path d="M${r(26.9)},${r(17.85)}A${r(9.15)} ${r(9.15)} 0 0 0 ${r(41.1)},${r(17.85)}"/><path d="M${r(24.85)},${r(52.5)}A${r(9.15)} ${r(9.15)} 0 0 1 ${r(43.15)},${r(52.5)}"/><line x1="${r(30.06)}" x2="${r(37.94)}" y1="1" y2="1" class="ctb"/></g>`;
 const dots=S.filter(e=>e.x!=null&&e.x!==""&&e.x>=50).map(e=>{const x=X(e.y),y=Y(e.x),kd=e.k,R=5.5;
  const mk=kd==="g"?`<circle cx="${x}" cy="${y}" r="${R+1}" class="sg-g"/>`:kd==="o"?`<circle cx="${x}" cy="${y}" r="${R}" class="sg-o"/>`:kd==="b"?`<path d="M${x},${(+y-R).toFixed(1)}l${R},${(R*1.7).toFixed(1)}h-${2*R}z" class="sg-b"/>`:`<path d="M${(+x-4).toFixed(1)},${(+y-4).toFixed(1)}l8,8m0,-8l-8,8" class="mx"/>`;
  return`<g class="gbb shm ${e.c||""}" data-gt="${esc(e.tip)}"><circle cx="${x}" cy="${y}" r="11" class="shh"/>${mk}</g>`}).join("");
 return`<svg class="ctc pitch" viewBox="0 0 ${W} ${H.toFixed(1)}" width="100%" role="img" aria-label="${esc(o.label||"Shot map")}"><rect width="${W}" height="${H}" class="ctbg"/>${pitch}${dots}</svg>`}
const pitchLegend=()=>`<div class="scleg"><span><i class="lm n"></i>Goal</span><span><i class="lo"></i>On target</span><span><i class="lt"></i>Blocked</span><span><i class="lx n">✕</i>Off target</span>`;

/* ---------- soccer: player Shot map, Trends and Splits, and the team Analytics tab ----------
   Source: ESPN's summary of every Premier League and Champions League match this season, read by the cloud refresh
   (soc-season.ps1) into pa/s<ESPN athlete id>.json and pa/st<ESPN team id>.json. Minutes are worked out from ESPN's
   substitution times (a starter from 0, a substitute from the minute he came on, to the minute he went off, was sent off
   or 90; stoppage time isn't counted), so minutes and per-90 figures are approximate and labelled that way. Shot distance
   is from the shot's position to the centre of the goal on a 105 × 68 m pitch, so it's approximate too. ESPN publishes no
   expected goals (xG) for these matches, so none is shown. Cup matches aren't in ESPN's feed for this and are left out. */
var SCOMP={"eng.1":"Premier League","uefa.champions":"Champions League"},SPER=["1–15","16–30","31–45+","46–60","61–75","76–90+","Extra time"];
const smin=s=>{const m=String(s||"").match(/(\d+)(?:\+(\d+))?/);return m?{b:+m[1],x:+(m[2]||0)}:null};
const sper=s=>{const t=smin(s);if(!t)return null;const b=t.b;return b>90?6:b<=15?0:b<=30?1:b<=45?2:b<=60?3:b<=75?4:5};
const sDist=s=>Math.hypot((100-s.x)*1.05,(s.y-50)*.68),sZone=s=>s.x>=94.2&&s.y>=36.8&&s.y<=63.2?"six":s.x>=83&&s.y>=21.1&&s.y<=78.9?"box":"out";
const SKW={g:"GOAL",o:"saved (on target)",b:"blocked",x:"off target",w:"hit the woodwork"},SBW={h:"header",l:"left foot",r:"right foot"};
const sShP=r=>{const f=r.split("|");return{e:f[0],mn:f[1],x:f[2]===""?null:+f[2],y:f[3]===""?null:+f[3],k:f[4],pen:+f[5],hd:f[6]||""}};
const sShT=r=>{const f=r.split("|");return{e:f[0],f:+f[1],aid:f[2],mn:f[3],x:f[4]===""?null:+f[4],y:f[5]===""?null:+f[5],k:f[6],pen:+f[7],hd:f[8]||""}};
/* the match summary read straight from ESPN (the artifact, where the published files can't be reached): same rules as soc-season.ps1 */
function socParse(j){const cp=((j.header||{}).competitions||[])[0]||{},T={},NM={},mins=s=>(String(s||"").match(/\d+/g)||[]).reduce((a,b)=>a+ +b,0);
 (cp.competitors||[]).forEach(c=>{const s=c.homeAway==="home"?"h":"a",t=c.team||{};T[s]={id:String(t.id),n:t.displayName,ab:t.abbreviation,sc:+c.score||0};[t.displayName,t.shortDisplayName,t.name].forEach(x=>{if(x)NM[x]=s})});
 const red={},by={},pl=[],sh=[];(j.keyEvents||[]).forEach(e=>{if(/Red Card/.test((e.type||{}).text||"")&&e.participants)red[String(e.participants[0].athlete.id)]=mins((e.clock||{}).displayValue)});
 (j.rosters||[]).forEach(r=>{const s=r.homeAway==="home"?"h":"a";(r.roster||[]).forEach(a=>{const id=String((a.athlete||{}).id);by[s+"|"+(a.athlete||{}).displayName]=id;if(!a.starter&&!a.subbedIn)return;const x={};(a.stats||[]).forEach(q=>x[q.name]=q.value);
  const sub=(a.plays||[]).filter(q=>q.substitution).map(q=>mins((q.clock||{}).displayValue)),on=a.starter?0:sub[0]||0;let off=a.subbedOut?sub[sub.length-1]:red[id]!=null?red[id]:90;if(a.subbedIn&&a.subbedOut&&sub.length<2)off=90;
  pl.push({id,s,st:a.starter?1:0,on,off,min:Math.max(0,Math.min(90,off)-Math.min(90,on)),x,pos:(a.position||{}).abbreviation||""})})});
 (j.commentary||[]).forEach(c=>{const p=c.play;if(!p||!p.type)return;const ty=p.type.text||"",s=p.team&&NM[p.team.displayName];if(!s||!/Shot|^Goal|Penalty - (Scored|Saved|Missed)/.test(ty)||/^Own Goal/.test(ty))return;
  const nm=(((p.participants||[])[0]||{}).athlete||{}).displayName,aid=by[s+"|"+nm]||by[(s==="h"?"a":"h")+"|"+nm]||"",tx=c.text||"";
  sh.push({s,aid,mn:String((c.time||{}).displayValue||"").replace(/[^0-9+]/g,""),x:p.fieldPositionX??"",y:p.fieldPositionY??"",k:p.scoringPlay||/^Goal|Penalty - Scored/.test(ty)?"g":/On Target|Saved/.test(ty)?"o":/Blocked/.test(ty)?"b":/Woodwork/.test(ty)?"w":"x",pen:/Penalty/.test(ty)||/penalty/.test(tx)?1:0,hd:/\bheader\b/.test(tx)?"h":/left footed/.test(tx)?"l":/right footed/.test(tx)?"r":""})});
 return{T,pl,sh,d:String(cp.date||"").slice(0,10)}}
async function socFallback(p){const lg=uniqLog(p.lg).filter(r=>r[12]),rows=[],sh=[],K=["totalGoals","goalAssists","totalShots","shotsOnTarget","foulsCommitted","foulsSuffered","yellowCards","redCards","saves","offsides","ownGoals"];
 await Promise.all(lg.map(r=>jget(EB+"soccer/"+p.src+"/summary?event="+r[12]).then(j=>{const m=socParse(j),me=m.pl.find(x=>x.id===String(p.id));if(!me)return;const o=me.s==="h"?"a":"h",a=m.T[me.s],b=m.T[o];
  rows.push([r[12],m.d,p.src,b.ab,b.n,me.s==="h"?"vs":"@",(a.sc>b.sc?"W ":a.sc<b.sc?"L ":"D ")+a.sc+"-"+b.sc,me.st,me.on,me.off,me.min,...K.map(q=>Math.round(me.x[q]||0)),me.pos].join("|"));
  m.sh.filter(s=>s.aid===String(p.id)).forEach(s=>sh.push([r[12],s.mn,s.x,s.y,s.k,s.pen,s.hd].join("|")))}).catch(()=>{})));
 return rows.length?{v:1,id:p.id,fb:1,fbn:rows.length,rows:rows.sort((a,b)=>a.split("|")[1]<b.split("|")[1]?1:-1),sh}:null}
/* filters shared by the soccer charts: competition, last 5 / 10, home or away, one match */
function sFilt(rows,st,eidAt,dAt,haAt,cAt){let r=rows;if(st.c&&st.c!=="all")r=r.filter(x=>x[cAt]===st.c);if(st.ha&&st.ha!=="all")r=r.filter(x=>st.ha==="a"?x[haAt]==="@":x[haAt]!=="@");
 return st.g==="5"?r.slice(0,5):st.g==="10"?r.slice(0,10):st.g&&st.g!=="all"?r.filter(x=>x[eidAt]===st.g):r}
function sCtl(rows,st,key,eidAt,dAt,cAt,oppAt,haAt){const b=(k,v,l)=>`<button data-${key}="${k}:${v}" class="${String(st[k])===String(v)?"on":""}">${l}</button>`,cs=[...new Set(rows.map(r=>r[cAt]))];
 const sel=rows.length>1?`<select class="scsel" data-${key}g="1" aria-label="Choose a match"><option value="all">One match…</option>${rows.map(r=>`<option value="${r[eidAt]}"${st.g===r[eidAt]?" selected":""}>${fd(Date.parse(r[dAt]+"T12:00Z"))} ${r[haAt]==="@"?"@":"vs"} ${esc(r[oppAt])}</option>`).join("")}</select>`:"";
 return`${cs.length>1?`<div class="gbf">${b("c","all","All competitions")}${cs.map(c=>b("c",c,SCOMP[c]||c)).join("")}</div>`:""}<div class="gbf">${b("g","all","Season ("+rows.length+")")}${rows.length>5?b("g","5","L5"):""}${rows.length>10?b("g","10","L10"):""}${b("ha","all","Home & away")}${b("ha","h","Home")}${b("ha","a","Away")}${sel}</div>`}
function sShotSum(S){const n=S.length,on=S.filter(s=>s.k==="g"||s.k==="o").length,g=S.filter(s=>s.k==="g").length,pen=S.filter(s=>s.k==="g"&&s.pen).length,loc=S.filter(s=>s.x!=null),hd=S.filter(s=>s.hd==="h").length;
 return`<div class="gbs"><span>Shots <b>${n}</b></span><span>On target <b>${on}</b> ${n?Math.round(on/n*100)+"%":""}</span><span>Goals <b>${g}</b>${pen?` (${pen} pen)`:""}</span><span>Goals per shot <b>${n?(g/n).toFixed(2):"–"}</b></span><span>Headers <b>${hd}</b></span><span>Avg distance <b>${loc.length?"~"+f1(loc.reduce((a,s)=>a+sDist(s),0)/loc.length)+" m":"–"}</b></span></div>`}
function sZoneTb(S){const Z={six:"Six-yard box",box:"Rest of the box",out:"Outside the box"},loc=S.filter(s=>s.x!=null);if(!loc.length)return"";
 return`<div class="tw"><table class="tb ztb"><thead><tr><th>Where</th><th>Shots</th><th>On target</th><th>Goals</th><th>Goals per shot</th></tr></thead><tbody>${Object.keys(Z).map(z=>{const a=loc.filter(s=>sZone(s)===z),g=a.filter(s=>s.k==="g").length;return`<tr><td>${Z[z]}</td><td>${a.length}</td><td>${a.filter(s=>s.k==="g"||s.k==="o").length}</td><td>${g}</td><td>${a.length?(g/a.length).toFixed(2):"–"}</td></tr>`}).join("")}</tbody></table></div>`}
var SSTATS=[["g","Goals",11],["sh","Shots",13],["sot","On target",14],["a","Assists",12],["min","Minutes (approx.)",10],["fc","Fouls",15],["fs","Fouls won",16],["sv","Saves",19]];
function socAnalytics(n,p,pt){const d=paGet("s"+p.id,()=>socFallback(p));if(!d)return paSkel();
 if(d.err)return`<div class="cempty">Couldn't load ${esc(n)}'s match data right now. The Overview tab still has the season figures and match log.</div>`;
 const rows=(d.rows||[]).map(r=>r.split("|"));if(!rows.length)return`<div class="cempty">${esc(n)} hasn't played in the Premier League or Champions League this season yet.</div>`;
 const src=d.fb?`read directly from ESPN for the last ${d.fbn} league matches (the full season is on the public site)`:`ESPN match summaries, ${rows.length} Premier League and Champions League match${rows.length===1?"":"es"}, updated ${fmt(Date.parse(d.at))}`;
 const st=SHEET.ss||(SHEET.ss={c:"all",g:"all",ha:"all"}),fr=sFilt(rows,st,0,1,5,2),E=new Set(fr.map(r=>r[0])),G={};rows.forEach(r=>G[r[0]]=r);
 if(pt==="sh"){const S=(d.sh||[]).map(sShP).filter(s=>E.has(s.e)),box=fr.reduce((a,r)=>a+ +r[13],0);
  const svg=pitchSvg(S.map(s=>{const r=G[s.e]||[];return{...s,c:"",tip:`${r[1]?fd(Date.parse(r[1]+"T12:00Z")):""} ${r[5]==="@"?"@":"vs"} ${r[3]||""} · ${s.mn}' · ${SKW[s.k]||""}${s.pen?" (penalty)":""}${s.hd?" · "+SBW[s.hd]:""}${s.x!=null?" · ~"+Math.round(sDist(s))+" m":""}`}}),{w:Math.min(gbW(),520),label:n+" shot map"});
  const rec=box===S.length?`All ${box} shots in ESPN's match statistics are here.`:`ESPN's match statistics count ${box} shots; its match feed has ${S.length}, and the map uses the feed.`;
  return`<h2>Shot map · this season</h2><div class="gbc">${sCtl(rows,st,"ssf",0,1,2,3,5)}${sShotSum(S)}${S.length?`<div class="ctw">${svg}</div>${pitchLegend()}</div>`:`<div class="cempty">No shots in this selection.</div>`}</div>${S.length?`<h2>By area</h2>${sZoneTb(S)}`:""}
  <div class="tm note">${rec} Positions from ESPN's match feed, attacking upwards; distances are approximate. ESPN doesn't publish expected goals (xG) for these matches. Source: ${esc(src)}.</div>`}
 if(pt==="tr"){const list=SSTATS.filter(x=>x[0]!=="sv"||p.pos==="G"),sel=list.find(x=>x[0]===SHEET.ts)||list[p.pos==="G"?list.length-1:1],ord=fr.slice().reverse();
  const wins=[3,5,10].filter(x=>x<=ord.length),win=wins.includes(SHEET.tw)?SHEET.tw:wins.includes(5)?5:wins[wins.length-1]||0;
  const gs=ord.map(r=>({t:Date.parse(r[1]+"T12:00Z"),short:r[3],ha:r[5],res:r[6],v:+r[sel[2]],st:r[7]==="1",min:+r[10]})),ra=win?rolling(gs,win,false):gs.map(()=>null);
  gs.forEach((g,i)=>{g.ra=ra[i];g.tip=`${fmtD(g.t)} · ${g.ha==="@"?"@":"vs"} ${g.short} · ${g.res} · ${g.v} ${sel[1].toLowerCase()} · ${g.st?"started":"off the bench"}, ~${g.min} min${g.ra!=null?` · ${win}-match avg ${f1(g.ra)}`:""}`});
  const avg=gs.length?gs.reduce((a,g)=>a+g.v,0)/gs.length:null,b=(k,v,l,c)=>`<button data-${k}="${v}" class="${c?"on":""}">${l}</button>`;
  return`<h2>Trends · this season</h2><div class="gbc">${sCtl(rows,st,"ssf",0,1,2,3,5)}<div class="pst gbt">${list.map(x=>b("trs",x[0],x[1],x[0]===sel[0])).join("")}</div>${wins.length?`<div class="gbf">${wins.map(x=>b("trw",x,x+"-match avg",win===x)).join("")}</div>`:""}
  ${gbHead(sel[1],"Match by match · bars are actual results",null,"")}${trendChart(gs,{avg,win,label:sel[1]+" by match"})}<div class="gbs"><span>Average <b>${avg==null?"–":f1(avg)}</b> per match</span><span>Total <b>${gs.reduce((a,g)=>a+g.v,0)}</b></span><span>Matches <b>${gs.length}</b></span></div></div>
  <div class="tm note">Bars are each match's official figure${win?`; the line is the average of the last ${win} matches up to that one`:""}; the dashed line is the average for this selection. Minutes are worked out from substitution times. Past results don't predict future matches. Source: ${esc(src)}.</div>`}
 /* splits: per match, plus per 90 minutes from the approximate minutes */
 const sp=[["Season",rows],["Last 5",rows.slice(0,5)],["Home",rows.filter(r=>r[5]!=="@")],["Away",rows.filter(r=>r[5]==="@")],["Started",rows.filter(r=>r[7]==="1")],["Off the bench",rows.filter(r=>r[7]!=="1")],...Object.keys(SCOMP).map(c=>[SCOMP[c],rows.filter(r=>r[2]===c)])].filter((x,i)=>i===0||x[1].length&&!(i===1&&rows.length<=5));
 const agg=rs=>{const S=i=>rs.reduce((a,r)=>a+(+r[i]||0),0),m=S(10);return{n:rs.length,m,g:S(11),a:S(12),sh:S(13),sot:S(14),fc:S(15),yc:S(17),p90:v=>m>=90?(v*90/m).toFixed(2):"–"}};
 const tb=`<div class="tw"><table class="tb"><thead><tr><th>Split</th><th>Apps</th><th>Min*</th><th>G</th><th>A</th><th>Sh</th><th>SoT</th><th>G/90*</th><th>Sh/90*</th><th>Fouls</th><th>YC</th></tr></thead><tbody>${sp.map(([l,rs])=>{const a=agg(rs);return`<tr${l==="Season"?' class="me"':""}><td>${l}</td><td>${a.n}</td><td>${a.m}</td><td><b>${a.g}</b></td><td>${a.a}</td><td>${a.sh}</td><td>${a.sot}</td><td>${a.p90(a.g)}</td><td>${a.p90(a.sh)}</td><td>${a.fc}</td><td>${a.yc}</td></tr>`}).join("")}</tbody></table></div>`;
 const S=(d.sh||[]).map(sShP),per=SPER.map((l,i)=>{const a=S.filter(s=>sper(s.mn)===i);return{l,n:a.length,g:a.filter(s=>s.k==="g").length}}).filter((x,i)=>i<6||x.n),mx=Math.max(1,...per.map(x=>x.n));
 const pt2=S.length?`<div class="card qsp">${per.map(x=>`<div class="qr"><span>${x.l}</span><div class="qb"><i style="width:${(x.n/mx*100).toFixed(1)}%"></i></div><b>${x.n}</b><small>${x.g} goal${x.g===1?"":"s"}</small></div>`).join("")}</div><div class="tm note">Shots in each 15-minute spell of the match, with the goals among them (stoppage time counts with the half it was played in).</div>`:"";
 return`<h2>Splits · this season</h2>${tb}<div class="tm note">Totals from ESPN's match statistics. *Minutes are approximate, worked out from substitution times without stoppage time, so per-90 figures are approximate too.</div>${pt2?`<h2>Shots by match minute</h2>${pt2}`:""}<div class="tm note">Source: ${esc(src)}.</div>`}
/* team: Analytics tab */
var TSOC=[["gf","Goals scored",g=>g.gf],["ga","Goals conceded",g=>g.ga],["sh","Shots",g=>g.n(1)],["osh","Shots faced",g=>g.o(1)],["sot","On target",g=>g.n(2)],["pos","Possession %",g=>g.n(0)],["cor","Corners",g=>g.n(4)]];
function socTeamAnalytics(k){const d=paGet("st"+k.id);if(!d)return paSkel(360);
 if(d.err)return`<div class="cempty">${window.claude&&!window.SL_CLOUD?"Team analytics are on the public site (sidelinesportsbook.github.io/sideline).":"Couldn't load this team's match data right now. Try again in a minute."}</div>`;
 const all=(d.g||[]).map(g=>({...g,t:Date.parse(g.d+"T12:00Z"),res:(g.gf>g.ga?"W ":g.gf<g.ga?"L ":"D ")+g.gf+"-"+g.ga,n:i=>+((g.s||[])[i])||0,o:i=>+((g.os||[])[i])||0}));if(!all.length)return`<div class="cempty">No Premier League or Champions League matches yet this season.</div>`;
 const st=SHEET.ts2||(SHEET.ts2={c:"all",g:"all",ha:"all",side:"for"}),cs=[...new Set(all.map(g=>g.c))],gs=all.filter(g=>st.c==="all"||g.c===st.c),n=gs.length,cnt=f=>gs.filter(f).length,pc=x=>n?Math.round(x/n*100)+"%":"–";
 const b=(kk,v,l)=>`<button data-tsf="${kk}:${v}" class="${String(st[kk])===String(v)?"on":""}">${l}</button>`,comp=cs.length>1?`<div class="gbf">${b("c","all","All competitions")}${cs.map(c=>b("c",c,SCOMP[c]||c)).join("")}</div>`:"";
 if(!n)return comp+`<div class="cempty">No matches in this competition yet.</div>`;
 const w=cnt(g=>g.gf>g.ga),dr=cnt(g=>g.gf===g.ga),gf=gs.reduce((a,g)=>a+g.gf,0),ga=gs.reduce((a,g)=>a+g.ga,0);
 const rec=`<div class="sg tsg">${kc("W-D-L",`${w}-${dr}-${n-w-dr}`)}${kc("Goals",`${gf}–${ga}`)}${kc("Clean sheets",`${cnt(g=>!g.ga)} <small class="tm">of ${n}</small>`)}${kc("Failed to score",`${cnt(g=>!g.gf)} <small class="tm">of ${n}</small>`)}${kc("Both teams scored",`${cnt(g=>g.gf&&g.ga)} <small class="tm">${pc(cnt(g=>g.gf&&g.ga))}</small>`)}${kc("Over 2.5 goals",`${cnt(g=>g.gf+g.ga>2)} <small class="tm">${pc(cnt(g=>g.gf+g.ga>2))}</small>`)}</div>`;
 const ht=gs.filter(g=>g.ht&&g.ht[0]!=null&&g.ht[1]!=null),hrow=(l,f)=>{const a=ht.filter(f);return`<tr><td>${l}</td><td>${a.length}</td><td class="won">${a.filter(g=>g.gf>g.ga).length}</td><td>${a.filter(g=>g.gf===g.ga).length}</td><td class="lost">${a.filter(g=>g.gf<g.ga).length}</td></tr>`};
 const htft=ht.length?`<div class="tw"><table class="tb"><thead><tr><th>At half-time</th><th>Matches</th><th>Won</th><th>Drew</th><th>Lost</th></tr></thead><tbody>${hrow("Ahead",g=>g.ht[0]>g.ht[1])}${hrow("Level",g=>g.ht[0]===g.ht[1])}${hrow("Behind",g=>g.ht[0]<g.ht[1])}</tbody></table></div>`:"";
 const GL=gs.flatMap(g=>(g.gl||[]).map(x=>{const f=x.split("|");return{mn:f[0],f:f[1]==="1",aid:f[2],k:f[3]}})),per=SPER.map((l,i)=>({l,f:GL.filter(x=>x.f&&sper(x.mn)===i).length,a:GL.filter(x=>!x.f&&sper(x.mn)===i).length})).filter((x,i)=>i<6||x.f||x.a),mx=Math.max(1,...per.map(x=>Math.max(x.f,x.a)));
 const pt=`<div class="card qsp">${per.map(x=>`<div class="qr gq"><span>${x.l}</span><div class="qb2"><div class="qb gf"><i style="width:${(x.f/mx*100).toFixed(1)}%"></i></div><div class="qb ga"><i style="width:${(x.a/mx*100).toFixed(1)}%"></i></div></div><b class="won">${x.f}</b><b class="lost">${x.a}</b></div>`).join("")}</div><div class="tm note">Goals scored (green, top bar) and conceded (red, bottom bar) in each 15-minute spell, from ESPN's match feed. Stoppage time counts with its half.</div>`;
 const T=(i,o)=>{const a=gs.reduce((s,g)=>s+(o?g.o(i):g.n(i)),0);return a/n},R=(m,a,o)=>{const x=gs.reduce((s,g)=>s+(o?g.o(m):g.n(m)),0),y=gs.reduce((s,g)=>s+(o?g.o(a):g.n(a)),0);return y?x/y*100:null},F=v=>v==null?"–":v.toFixed(1);
 const cm=[["Possession %",T(0),T(0,1)],["Shots",T(1),T(1,1)],["On target",T(2),T(2,1)],["Corners",T(4),T(4,1)],["Pass accuracy %",R(10,11),R(10,11,1)],["Passes",T(11),T(11,1)],["Crosses",T(13),T(13,1)],["Tackles won",T(14),T(14,1)],["Interceptions",T(16),T(16,1)],["Clearances",T(17),T(17,1)],["Fouls",T(5),T(5,1)],["Yellow cards",T(6),T(6,1)],["Offsides",T(8),T(8,1)],["Saves",T(9),T(9,1)]];
 const ab=((TMD.soc||{})[k.id]||{}).ab||k.n,cmp=`<div class="card"><div class="cmh"><span>${esc(ab)}</span><span></span><span>Opponents</span></div>${cm.map(([l,a,o])=>cmpRow(l,F(a),F(o))).join("")}</div><div class="tm note">Per match, from ESPN's team statistics over ${n} match${n===1?"":"es"}. Pass accuracy is a total (accurate ÷ all passes).</div>`;
 const sel=TSOC.find(x=>x[0]===SHEET.tas)||TSOC[0],pct=sel[0]==="pos",ord=gs.slice().reverse(),tg=ord.map(g=>{const v=sel[2](g);return{t:g.t,short:g.o,ha:g.ha,res:g.res,v,m:pct?v:0,a:pct?100:0}}),win=tg.length>=10?5:tg.length>=3?3:0,ra=win?rolling(tg,win,pct):tg.map(()=>null);
 tg.forEach((g,i)=>{g.ra=ra[i];g.tip=`${fmtD(g.t)} · ${g.ha==="@"?"@":"vs"} ${g.short} · ${g.res} · ${sel[1]} ${g.v}${g.ra!=null?` · ${win}-match avg ${f1(g.ra)}`:""}`});
 const avg=tg.length?tg.reduce((a,g)=>a+g.v,0)/tg.length:null;
 const trend=`<div class="gbc"><div class="pst gbt">${TSOC.map(x=>`<button data-tas="${x[0]}" class="${x[0]===sel[0]?"on":""}">${x[1]}</button>`).join("")}</div>${gbHead(sel[1],"Match by match · this season",null,"")}${trendChart(tg,{avg,pct,win,label:sel[1]+" by match"})}</div>`;
 const side=st.side||"for",fr=sFilt(gs.map(g=>[g.e,g.d,g.c,g.o,g.on,g.ha]),st,0,1,5,2),E=new Set(fr.map(r=>r[0])),GG={};gs.forEach(g=>GG[g.e]=g);
 const S=(d.sh||[]).map(sShT).filter(s=>E.has(s.e)&&(side==="for"?s.f:!s.f));
 const svg=pitchSvg(S.map(s=>{const g=GG[s.e]||{};return{...s,c:side==="for"?"":"a",tip:`${plById(s.aid)||"Player"} · ${g.d?fd(g.t):""} ${g.ha==="@"?"@":"vs"} ${g.o||""} · ${s.mn}' · ${SKW[s.k]||""}${s.pen?" (penalty)":""}${s.hd?" · "+SBW[s.hd]:""}`}}),{w:Math.min(gbW(),520),label:"Shot map"});
 const bx=fr.reduce((a,r)=>{const g=GG[r[0]];return a+(side==="for"?g.n(1):g.o(1))},0);
 const map=`<div class="gbc"><div class="pst gbt">${b("side","for","Shots taken")}${b("side","against","Shots faced")}</div>${sCtl(gs.map(g=>[g.e,g.d,g.c,g.o,g.on,g.ha]),st,"tsf",0,1,2,4,5).replace(/<div class="gbf">.*?All competitions.*?<\/div>/,"")}${sShotSum(S)}${S.length?`<div class="ctw">${svg}</div>${pitchLegend()}</div>`:`<div class="cempty">No shots in this selection.</div>`}</div>${S.length?sZoneTb(S):""}
  <div class="tm note">${bx===S.length?`All ${bx} shots in ESPN's team statistics are here.`:`ESPN's team statistics count ${bx} shots; its match feed has ${S.length}, and the map uses the feed.`} Positions from ESPN's match feed, attacking upwards.</div>`;
 const sc={};GL.filter(x=>x.f&&x.k!=="og"&&x.aid).forEach(x=>{sc[x.aid]=sc[x.aid]||{g:0,p:0};sc[x.aid].g++;if(x.k==="p")sc[x.aid].p++});const top=Object.keys(sc).sort((a,c)=>sc[c].g-sc[a].g).slice(0,5);
 const scorers=top.length?`<h2>Top scorers</h2><div class="card">${top.map(id=>{const nm=plById(id);return`<div class="kv"><span class="bxp">${nm?avatar(nm,id,"soc",22)+`<button class="pnm" data-ply="${esc(nm)}">${esc(nm)}</button>`:"Player "+esc(id)}</span><b>${sc[id].g}${sc[id].p?` <small class="tm">(${sc[id].p} pen)</small>`:""}</b></div>`}).join("")}${GL.some(x=>x.f&&x.k==="og")?`<div class="kv"><span class="tm">Own goals by opponents</span><b>${GL.filter(x=>x.f&&x.k==="og").length}</b></div>`:""}</div>`:"";
 const nx=gOf(k.n),oppN=nx?(nx.h===k.n?nx.a:nx.h):null,ok2=oppN&&teamKey(oppN),h2h=ok2?all.filter(g=>g.oid===String(ok2.id)):[];
 const hh=oppN?`<h2>Head to head · ${esc(oppN)}</h2>${h2h.length?`<div class="card">${h2h.map(g=>`<div class="kv"><span>${fd(g.t)} · ${g.ha==="@"?"@":"vs"} ${esc(g.on)} <small class="tm">${esc(SCOMP[g.c]||"")}</small></span><b class="${g.gf>g.ga?"won":g.gf<g.ga?"lost":""}">${g.res}</b></div>`).join("")}</div>`:`<div class="cempty" style="height:56px">No meetings yet this season.</div>`}`:"";
 return`${comp}<h2>Record</h2>${rec}<h2>Trends</h2>${trend}<h2>When goals come</h2>${pt}${htft?`<h2>Half-time and full-time</h2>${htft}`:""}<h2>Team vs opponents</h2>${cmp}<h2>Shot map</h2>${map}${scorers}${hh}<div class="tm note">Source: ESPN match summaries, Premier League and Champions League (${all.length} matches), updated ${fmt(Date.parse(d.at))}. Cup matches aren't included.</div>`}
document.addEventListener("click",e=>{const t=e.target;if(!t||!t.closest||!SHEET)return;
 const a=t.closest("[data-ssf]");if(a){e.stopPropagation();const[k,v]=a.dataset.ssf.split(":");(SHEET.ss=SHEET.ss||{})[k]=v;if(k!=="g"&&SHEET.ss.g!=="5"&&SHEET.ss.g!=="10")SHEET.ss.g="all";openPlayer(SHEET.n);return}
 const b=t.closest("[data-tsf]");if(b){e.stopPropagation();const[k,v]=b.dataset.tsf.split(":");(SHEET.ts2=SHEET.ts2||{})[k]=v;openTeam(SHEET.n,SHEET.tab)}},true);
document.addEventListener("change",e=>{const s=e.target;if(!s||!s.matches||!SHEET)return;if(s.matches("[data-ssfg]")){(SHEET.ss=SHEET.ss||{}).g=s.value;openPlayer(SHEET.n)}else if(s.matches("[data-tsfg]")){(SHEET.ts2=SHEET.ts2||{}).g=s.value;openTeam(SHEET.n,SHEET.tab)}},true);
document.addEventListener("click",e=>{const t=e.target;if(!t||!t.closest)return;const b=t.closest("[data-sot]");if(b){e.stopPropagation();SOCT=b.dataset.sot;renderGames();return}
 const s=t.closest("[data-sss]");if(s){e.stopPropagation();MSC.ss=s.dataset.sss;renderGames()}},true);
paGet("league");
