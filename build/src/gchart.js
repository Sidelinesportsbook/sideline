/* ---------- game-by-game charts (players and teams) ----------
   One bar per game, oldest on the left. Player charts: green = hit, red = miss against the selected line (over = more than the line).
   Team charts: green = win, red = loss, grey = draw. The figure sits on each bar; tap or hover a bar for the full game. */
const gbW=()=>{const m=$("#pso .ps");return Math.max(280,m?m.clientWidth-40:Math.min(innerWidth-8,720)-40)};
const gbDate=t=>new Date(t).toLocaleDateString("en-AU",{day:"numeric",month:"short"});
function gbChart(gs,o){o=o||{};if(!gs.length)return`<div class="cempty">${o.empty||"No games played yet this season."}</div>`;
 const W=gbW(),n=gs.length,H=W<440?220:256,hasL=o.line!=null,pl=30,pr=hasL?50:10,pt=22,pb=42,iw=W-pl-pr,ih=H-pt-pb;
 const vs=gs.map(g=>g.v).filter(v=>v!=null),lo=Math.min(0,...vs),hi=Math.max(hasL?o.line:0,1,...vs);
 const tk=nice(lo,hi+(hi-lo)*.08,4),y0=tk[0],y1=tk[tk.length-1],Y=v=>pt+(1-(v-y0)/(y1-y0||1))*ih,zy=Y(Math.max(0,y0));
 const bw=iw/n,w=Math.min(46,Math.max(7,bw*.64)),fs=w<15?9.5:11.5,every=Math.max(1,Math.ceil(26/bw)),everyD=Math.max(1,Math.ceil(40/bw));
 const kind=g=>g.v==null?"na":o.by==="res"?(g.res[0]==="W"?"h":g.res[0]==="L"?"m":"d"):!hasL?"n":(o.k?g.v>=o.line:g.v>o.line)?"h":"m";
 const word={h:o.by==="res"?"Win":"Hit",m:o.by==="res"?"Loss":"Miss",d:"Draw",n:"",na:"No data"};
 const grid=tk.map(v=>`<line x1="${pl}" x2="${W-pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="${v===0&&lo<0?"gbz0":"gbg"}"/><text x="${pl-7}" y="${(Y(v)+3.5).toFixed(1)}" class="gbax" text-anchor="end">${v}</text>`).join("");
 const bars=gs.map((g,i)=>{const cx=pl+i*bw+bw/2,x=cx-w/2,k=kind(g),tip=`${fmtD(g.t)} · ${g.ha==="@"?"@":"vs"} ${g.opp}${g.res?" · "+g.res:""} · ${g.v==null?"no data":g.v+" "+(o.unit||"")}${hasL?" · line "+o.line:""}${k!=="n"&&k!=="na"?" · "+word[k].toUpperCase():""}`;
  const lab=`<text x="${cx.toFixed(1)}" y="${H-pb+15}" class="gbop" text-anchor="middle">${i%every&&i!==n-1?"":esc((g.ha==="@"&&bw>=42?"@":"")+g.short)}</text>${i%everyD&&i!==n-1?"":`<text x="${cx.toFixed(1)}" y="${H-pb+29}" class="gbdt" text-anchor="middle">${gbDate(g.t)}</text>`}`;
  if(g.v==null)return`<g class="gbb" style="--i:${i}" data-gt="${esc(tip)}"><rect class="gbhit" x="${(pl+i*bw).toFixed(1)}" y="${pt}" width="${bw.toFixed(1)}" height="${ih}"/><rect class="gbr na" x="${x.toFixed(1)}" y="${(zy-6).toFixed(1)}" width="${w.toFixed(1)}" height="6" rx="2"/><text x="${cx.toFixed(1)}" y="${(zy-10).toFixed(1)}" class="gbv mut" text-anchor="middle" font-size="${fs}">–</text>${lab}</g>`;
  const top=Math.min(Y(g.v),zy),h=Math.max(2,Math.abs(Y(g.v)-zy)),neg=g.v<0,inside=neg&&h>=fs+8,ty=neg?(inside?top+h-6:zy-6):top-6;   /* below-zero values sit inside the bar end (or above the zero line), never on the labels underneath */
  return`<g class="gbb" style="--i:${i}" data-gt="${esc(tip)}"><rect class="gbhit" x="${(pl+i*bw).toFixed(1)}" y="${pt}" width="${bw.toFixed(1)}" height="${ih}"/><rect class="gbr ${k}${neg?" neg":""}" x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(4,w/3).toFixed(1)}"/><text x="${cx.toFixed(1)}" y="${ty.toFixed(1)}" class="gbv${inside?" in":""}" text-anchor="middle" font-size="${fs}">${g.v}</text>${lab}</g>`}).join("");
 const line=hasL?`<line x1="${pl}" x2="${W-pr+4}" y1="${Y(o.line).toFixed(1)}" y2="${Y(o.line).toFixed(1)}" class="gbl"/><rect x="${W-pr+6}" y="${(Y(o.line)-9).toFixed(1)}" width="${pr-8}" height="18" rx="9" class="gblp"/><text x="${(W-pr+6+(pr-8)/2).toFixed(1)}" y="${(Y(o.line)+4).toFixed(1)}" class="gblt" text-anchor="middle">${o.line}</text>`:"";
 return`<div class="gbw"><svg class="gb" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(o.label||"Game by game")}">${grid}${bars}${line}</svg></div>`}
const fmtD=t=>new Date(t).toLocaleDateString("en-AU",{weekday:"short",day:"numeric",month:"short"});
/* one header for every chart: what's shown, the hit rate and the sample behind it */
function gbHead(title,sub,rate,rateSub,cls){return`<div class="gbhd"><div><small>${esc(sub)}</small><b>${title}</b></div>${rate!=null?`<div class="gbhr"><b class="${cls||""}">${rate}</b><small>${rateSub}</small></div>`:""}</div>`}
const GF=[["all","Season"],["5","L5"],["10","L10"],["h","Home"],["a","Away"]];
function gbFilter(rows,f){return f==="5"?rows.slice(0,5):f==="10"?rows.slice(0,10):f==="h"?rows.filter(r=>r[2]!=="@"):f==="a"?rows.filter(r=>r[2]==="@"):rows}
const gbStats=vs=>{const v=vs.filter(x=>x!=null);if(!v.length)return"";const s=v.slice().sort((a,b)=>a-b),avg=v.reduce((a,b)=>a+b,0)/v.length,med=v.length%2?s[(v.length-1)/2]:(s[v.length/2-1]+s[v.length/2])/2;
 return`<div class="gbs"><span>Average <b>${f1(avg)}</b></span><span>Median <b>${med}</b></span><span>High <b>${s[s.length-1]}</b></span><span>Low <b>${s[0]}</b></span></div>`};
/* player view: market tabs, sample filters, the chart, then the full game log */
function gbView(rows,cols,sel,ln,hdr,o){o=o||{};const c=cols.find(x=>x.k===sel)||cols[0],val=r=>{const x=c.f?c.f(r):r[c.i];return x===""||x==null||isNaN(+x)?null:+x};
 const f=SHEET.gf||"all",fr=gbFilter(rows,f),gs=fr.slice().reverse().map(r=>({t:Date.parse(r[0]+"T12:00Z"),opp:r[1],short:r[1],ha:r[2],res:r[3],v:val(r)}));
 const rate=rs=>{const v=rs.map(val).filter(x=>x!=null),h=v.filter(x=>ln!=null&&x>ln).length;return{n:v.length,h,p:v.length?Math.round(h/v.length*100):0}},a=rate(fr),all=rate(rows);
 const title=ln!=null?`${c.lab} · Over ${ln}`:c.lab,cls=a.p>=55?"won":a.p<45?"lost":"";
 const head=gbHead(title,o.sub||"Game by game",ln!=null&&a.n?a.p+"%":null,`${a.h} of ${a.n} hit${f!=="all"?` · season ${all.h}/${all.n}`:""}`,cls);
 const tabs=`<div class="pst gbt">${cols.map(x=>`<button data-pst="${x.k}" class="${x.k===c.k?"on":""}">${x.lab}</button>`).join("")}</div>`;
 const fil=`<div class="gbf">${GF.map(([k,l])=>`<button data-gf="${k}" class="${f===k?"on":""}">${l}${k==="all"?" ("+rows.length+")":""}</button>`).join("")}</div>`;
 const cls2=x=>ln==null||x==null?"":x>ln?"ov":"un";
 const table=`<div class="tw"><table class="tb"><thead><tr><th>Date</th><th>Opp</th><th>Result</th>${hdr.map(h=>`<th class="${h.k===c.k?"selc":""}">${h.lab}</th>`).join("")}</tr></thead><tbody>${fr.map(r=>`<tr${o.mx?o.mx(r):""}><td>${fd(Date.parse(r[0]+"T12:00Z"))}</td><td>${r[2]==="@"?"@":"vs"} ${esc(r[1])}</td><td class="${r[3][0]==="W"?"won":r[3][0]==="L"?"lost":""}">${esc(r[3])}</td>${hdr.map(h=>{const raw=h.f?h.f(r):r[h.i],x=raw===""||raw==null?"–":raw;return`<td class="${h.k===c.k?"selc "+cls2(x==="–"?null:+x):""}">${h.k===c.k?`<b>${x}</b>`:x}</td>`}).join("")}</tr>`).join("")}</tbody></table></div>`;
 return`<div class="gbc">${tabs}${fil}${head}${fr.length?gbChart(gs,{line:ln,unit:c.lab,label:`${c.lab}, game by game`})+gbStats(gs.map(g=>g.v)):`<div class="cempty">No ${f==="h"?"home":f==="a"?"away":""} games in this sample.</div>`}</div>
 <h2>Game log</h2>${table}`}
/* compact season stat row */
const gbRow=items=>`<div class="gbrow">${items.filter(x=>x).map(([l,v])=>`<div><small>${l}</small><b>${v==null||v===""?"–":v}</b></div>`).join("")}</div>`;
/* headshot with the team crest underneath (shown if the photo isn't available) */
/* player photos: NBA from ESPN; soccer from Wikimedia Commons, only where the photo is verified to be the same player (see soc-photos.ps1) */
const SPH=(()=>{try{return JSON.parse((document.getElementById("sph")||{}).textContent||"{}")}catch(e){return{}}})();
const photoUrl=(sp,id)=>!id?"":sp==="nba"?`https://a.espncdn.com/i/headshots/nba/players/full/${id}.png`:SPH[id]?`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(SPH[id])}?width=240`:"";
const photoCredit=id=>SPH[id]?`<div class="tm note">Photo: <a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(SPH[id])}" target="_blank" rel="noopener">Wikimedia Commons</a></div>`:"";
const headshot=(sp,id,team)=>{const u=photoUrl(sp,id);return`<span class="phs${sp!=="nba"&&u?" soc":""}">${bd(team,58)}${u?`<img src="${esc(u)}" alt="" loading="lazy">`:""}</span>`};
/* team chart: results game by game; metric tabs per sport */
let TMC={nba:"mg",soc:"gf"};
const TMM={nba:[["mg","Margin"],["pf","Points scored"],["pa","Points allowed"],["tot","Total points"]],soc:[["gf","Goals scored"],["ga","Goals conceded"],["tot","Total goals"],["mg","Goal difference"]]};
function teamChart(res,sp){const rs=(res||[]).slice(0,15).map(s=>s.split("|"));if(!rs.length)return"";const key=sp==="nba"?"nba":"soc",m=TMM[key].find(x=>x[0]===TMC[key])||TMM[key][0];
 const sc=r=>{const x=String(r[3]).match(/(\d+)-(\d+)/);if(!x)return null;const a=+x[1],b=+x[2],w=r[3][0]==="W",l=r[3][0]==="L";return w?[Math.max(a,b),Math.min(a,b)]:l?[Math.min(a,b),Math.max(a,b)]:[a,b]};
 const v=r=>{const s=sc(r);if(!s)return null;return m[0]==="mg"?s[0]-s[1]:m[0]==="pf"||m[0]==="gf"?s[0]:m[0]==="pa"||m[0]==="ga"?s[1]:s[0]+s[1]};
 const short=n=>sp==="nba"?n:((Object.values(TMD.soc||{}).find(t=>t.n===n||SAL0[t.n]===n)||{}).ab||String(n).split(" ")[0].slice(0,4).toUpperCase());
 const gs=rs.slice().reverse().map(r=>({t:Date.parse(r[0]+"T12:00Z"),opp:sp==="nba"?abTeam(r[1]):r[1],short:short(r[1]),ha:r[2],res:r[3],v:v(r)})),w=gs.filter(g=>g.res[0]==="W").length,l=gs.filter(g=>g.res[0]==="L").length,d=gs.length-w-l;
 const vals=gs.map(g=>g.v).filter(x=>x!=null),avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
 return`<div class="gbc"><div class="pst gbt">${TMM[key].map(([k,lab])=>`<button data-tmc="${k}" class="${k===m[0]?"on":""}">${lab}</button>`).join("")}</div>
 ${gbHead(m[1],`Last ${gs.length} games · all competitions`,`${w}-${sp==="nba"?"":d+"-"}${l}`,`${sp==="nba"?"W-L":"W-D-L"} · average ${avg==null?"–":(m[0]==="mg"&&avg>0?"+":"")+f1(avg)}`,w>l?"won":l>w?"lost":"")}
 ${gbChart(gs,{by:"res",unit:m[1].toLowerCase(),label:m[1]+" by game"})}</div>`}
/* tooltips: hover on desktop, tap on touch; positioned on the bar itself */
(()=>{let tip=null,on=null;const hide=()=>{if(tip)tip.hidden=true;if(on){on.classList.remove("on");on=null}};
 const show=g=>{if(!tip){tip=document.createElement("div");tip.id="gtip";document.body.appendChild(tip)}if(on&&on!==g)on.classList.remove("on");on=g;g.classList.add("on");
  const b=(g.querySelector(".gbr")||g).getBoundingClientRect();tip.textContent=g.dataset.gt;tip.hidden=false;const tw=tip.offsetWidth;
  tip.style.left=Math.min(innerWidth-tw-8,Math.max(8,b.left+b.width/2-tw/2))+"px";tip.style.top=Math.max(8,b.top-tip.offsetHeight-8)+"px"};
 document.addEventListener("pointerover",e=>{const g=e.target.closest&&e.target.closest(".gbb");if(g&&e.pointerType!=="touch")show(g)});
 document.addEventListener("pointerout",e=>{const g=e.target.closest&&e.target.closest(".gbb");if(g&&e.pointerType!=="touch"&&!g.contains(e.relatedTarget))hide()});
 document.addEventListener("pointerdown",e=>{const g=e.target.closest&&e.target.closest(".gbb");if(g)show(g);else hide()});
 document.addEventListener("scroll",hide,true);new MutationObserver(()=>{if(on&&!document.contains(on))hide()}).observe(document.body,{childList:true,subtree:true})})();
document.addEventListener("click",e=>{const t=e.target;if(!t||!t.closest)return;
 const f=t.closest("[data-gf]");if(f&&SHEET&&SHEET.kind==="player"){e.stopPropagation();SHEET.gf=f.dataset.gf;openPlayer(SHEET.n);return}
 const m=t.closest("[data-tmc]");if(m&&SHEET&&SHEET.kind==="team"){e.stopPropagation();const k=teamKey(SHEET.n);TMC[k&&k.sp==="nba"?"nba":"soc"]=m.dataset.tmc;const y=($("#pso .ps")||{}).scrollTop||0;openTeam(SHEET.n,SHEET.tab);const p=$("#pso .ps");if(p){p.style.animation="none";$("#pso").style.animation="none";p.scrollTop=y}}},true);
/* re-draw an open chart at the new width when the window is resized */
addEventListener("resize",(()=>{let t=0;return()=>{clearTimeout(t);t=setTimeout(()=>{if(!$("#pso .gb")||!SHEET)return;const y=$("#pso .ps").scrollTop;if(SHEET.kind==="player")openPlayer(SHEET.n);else openTeam(SHEET.n,SHEET.tab);const p=$("#pso .ps");if(p){p.style.animation="none";$("#pso").style.animation="none";p.scrollTop=y}},200)}})());
