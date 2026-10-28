/* ---------- profile charts: drawn at real pixel size (no stretched text); green above zero, red below ---------- */
const CH={h:190,pl:50,pr:14,pt:14,pb:26};
/* when a game was played, in the viewer's own timezone: its exact start time where the data has it (game logs carry it as
   their last field), otherwise midday UTC on its listed date */
function gTime(d,iso){return iso&&/^\d{4}-\d\d-\d\dT\d/.test(iso)?Date.parse(iso):Date.parse(d+"T12:00Z")}
function rowIso(f){return f.find(x=>/^\d{4}-\d\d-\d\dT\d/.test(x||""))}
function nice(lo,hi,n){n=n||4;if(!(hi>lo)){lo-=1;hi+=1}const sp=(hi-lo)/n,mg=Math.pow(10,Math.floor(Math.log10(sp))),st=[1,2,2.5,5,10].map(x=>x*mg).find(x=>x>=sp),a=Math.floor(lo/st)*st,b=Math.ceil(hi/st)*st,t=[];for(let v=a;v<=b+st/2;v+=st)t.push(Math.round(v*100)/100);return t}
const money0=v=>(v<0?"-":"")+"$"+Math.abs(v).toLocaleString("en-AU",{minimumFractionDigits:Math.abs(v)<10&&v%1?2:0,maximumFractionDigits:Math.abs(v)<10&&v%1?2:0});
function chartW(){const e=$("#pf"),w=e&&e.clientWidth||360;return Math.max(240,Math.min(1060,w-32-30))}
/* straight lines between the real values: a curve would suggest figures between two bets that never existed */
function linePath(xs,ys){return xs.map((x,i)=>(i?"L":"M")+x.toFixed(1)+","+ys[i].toFixed(1)).join("")}
/* (kept for reference) monotone cubic curve through the points (Fritsch-Carlson) */
function smoothPath(xs,ys){const n=xs.length;if(n<3)return xs.map((x,i)=>(i?"L":"M")+x.toFixed(1)+","+ys[i].toFixed(1)).join("");
 const dx=[],m=[],t=[];for(let i=0;i<n-1;i++){dx.push(xs[i+1]-xs[i]);m.push((ys[i+1]-ys[i])/(dx[i]||1))}
 t[0]=m[0];t[n-1]=m[n-2];for(let i=1;i<n-1;i++)t[i]=m[i-1]*m[i]<=0?0:3*(dx[i-1]+dx[i])/((2*dx[i]+dx[i-1])/m[i-1]+(dx[i]+2*dx[i-1])/m[i]);
 let d="M"+xs[0].toFixed(1)+","+ys[0].toFixed(1);for(let i=0;i<n-1;i++){const h=dx[i]/3;d+="C"+(xs[i]+h).toFixed(1)+","+(ys[i]+t[i]*h).toFixed(1)+" "+(xs[i+1]-h).toFixed(1)+","+(ys[i+1]-t[i+1]*h).toFixed(1)+" "+xs[i+1].toFixed(1)+","+ys[i+1].toFixed(1)}return d}
const tipAttr=a=>`data-tip="${esc(JSON.stringify(a))}"`;
function lineSvg(pts,o){o=o||{};if(pts.length<2)return`<div class="cempty">${o.empty||"Not enough activity yet."}</div>`;
 const W=o.w||chartW(),H=o.h||CH.h,{pl,pr,pt,pb}=CH,vs=pts.map(p=>p.v),lo=Math.min(...vs,o.zero?0:Infinity),hi=Math.max(...vs,o.zero?0:-Infinity),tk=nice(lo,hi),y0=tk[0],y1=tk[tk.length-1],
  X=i=>pl+i*(W-pl-pr)/(pts.length-1),Y=v=>pt+(1-(v-y0)/(y1-y0||1))*(H-pt-pb),d=linePath(pts.map((p,i)=>X(i)),pts.map(p=>Y(p.v))),
  id="c"+Math.random().toString(36).slice(2,8),zy=o.zero?Y(0):H-pb,last=pts[pts.length-1],xe=X(pts.length-1);
 const grid=tk.map(v=>`<line x1="${pl}" x2="${W-pr}" y1="${Y(v)}" y2="${Y(v)}" class="${o.zero&&v===0?"zl":"gl"}"/><text x="${pl-8}" y="${Y(v)+4}" class="ax" text-anchor="end">${money0(v)}</text>`).join("");
 const area=`${d}L${xe},${zy}L${X(0)},${zy}Z`;let body;
 if(o.zero)body=`<defs><clipPath id="${id}a"><rect x="0" y="0" width="${W}" height="${zy}"/></clipPath><clipPath id="${id}b"><rect x="0" y="${zy}" width="${W}" height="${H}"/></clipPath></defs>
  <path d="${area}" fill="var(--ov)" opacity=".16" clip-path="url(#${id}a)"/><path d="${area}" fill="var(--un)" opacity=".16" clip-path="url(#${id}b)"/>
  <path d="${d}" class="ln" stroke="var(--ov)" clip-path="url(#${id}a)"/><path d="${d}" class="ln" stroke="var(--un)" clip-path="url(#${id}b)"/>`;
 else body=`<path d="${area}" fill="var(--acc)" opacity=".12"/><path d="${d}" class="ln" stroke="var(--acc)"/>`;
 const ix=[...new Set([0,Math.round((pts.length-1)/2),pts.length-1])],xl=ix.map((i,k)=>`<text x="${X(i)}" y="${H-7}" class="ax" text-anchor="${k===0?"start":k===ix.length-1?"end":"middle"}">${fd(pts[i].t)}</text>`).join("");
 const ec=o.zero?(last.v>=0?"var(--ov)":"var(--un)"):"var(--acc)";
 return`<svg class="ch" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label||"Line chart")}" ${tipAttr(pts.map((p,i)=>[+X(i).toFixed(1),+Y(p.v).toFixed(1),p.lab]))}>${grid}${body}${pts.length<=60?pts.slice(0,-1).map((p,i)=>`<circle cx="${X(i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="2.6" class="lpt"/>`).join(""):""}<circle cx="${xe}" cy="${Y(last.v)}" r="4.5" fill="${ec}" stroke="var(--card)" stroke-width="2"/>${xl}<line class="hv" x1="0" x2="0" y1="${pt}" y2="${H-pb}"/><circle class="hd" r="4.5" cx="-20" cy="-20"/></svg>`}
function barSvg(v,o){o=o||{};if(!v.length)return`<div class="cempty">${o.empty||"No settled bets yet."}</div>`;
 const W=o.w||chartW(),H=o.h||CH.h,{pl,pr,pt,pb}=CH,lo=Math.min(0,...v),hi=Math.max(0,...v),tk=nice(lo,hi>lo?hi:lo+1),y0=tk[0],y1=tk[tk.length-1],
  Y=x=>pt+(1-(x-y0)/(y1-y0||1))*(H-pt-pb),bw=(W-pl-pr)/v.length,gap=Math.min(8,bw*.28),w=Math.min(28,Math.max(2,bw-gap)),rx=Math.min(4,w/2);   /* bars never wider than 28px, centred in their slot */
 const grid=tk.map(t=>`<line x1="${pl}" x2="${W-pr}" y1="${Y(t)}" y2="${Y(t)}" class="${t===0?"zl":"gl"}"/><text x="${pl-8}" y="${Y(t)+4}" class="ax" text-anchor="end">${o.money?money0(t):t}</text>`).join("");
 const bars=v.map((x,i)=>{if(!x)return"";const y=Math.min(Y(x),Y(0)),h=Math.max(2,Math.abs(Y(x)-Y(0)));return`<rect x="${(pl+i*bw+(bw-w)/2).toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${rx}" fill="${o.signed?(x>0?"var(--ov)":"var(--un)"):"var(--acc)"}"/>`}).join("");
 const step=Math.max(1,Math.ceil(v.length*30/(W-pl-pr))),xl=o.xl?o.xl.map((t,i)=>i%step&&i!==v.length-1?"":`<text x="${pl+i*bw+bw/2}" y="${H-7}" class="ax" text-anchor="middle">${t}</text>`).join(""):"";
 return`<svg class="ch" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label||"Bar chart")}" ${tipAttr(v.map((x,i)=>[+(pl+i*bw+bw/2).toFixed(1),+Y(x).toFixed(1),o.tips?o.tips[i]:String(x)]))}>${grid}${bars}${xl}<line class="hv" x1="0" x2="0" y1="${pt}" y2="${H-pb}"/></svg>`}
/* the profile charts use the same records as the stat cards and the leaderboard (lbcore fromBet), so the line, the bars and
   the totals can't disagree: a bet counts when it settles, at its settlement time, and its profit is return - stake (won =
   stake x final odds, a cash-out the amount taken, a refund 0); voids are left out. (They used to group bets by the day they
   were placed and leave cash-outs out of the per-bet chart while its average still included them.) */
const PLW={w:"won",l:"lost",c:"cashed out",r:"refunded"};
function plSet(){let R=null;try{R=myRecs()}catch(e){}return(R||[]).filter(r=>r.x&&r.x!=="v").sort((a,b)=>a.s-b.s||a.t-b.t)}
const plNet=r=>Math.round((r.r-r.k)*100)/100;
function cumPL(R){R=R||plSet();if(!R.length)return[];let c=0;const out=[{t:R[0].s,v:0,lab:"Start · $0.00"}];
 R.forEach(r=>{const p=plNet(r);c=Math.round((c+p)*100)/100;out.push({t:r.s,v:c,lab:`${fd(r.s)} · ${r.n>1?"Multi":"Single"} ${PLW[r.x]} ${p?sgn(p):"$0.00"} · total ${sgn(c)}`})});return out}
/* the last 14 calendar days in your own timezone, by the day each bet settled */
function dailyPL(R){R=R||plSet();const d0=new Date(),days=[...Array(14).keys()].map(i=>new Date(d0.getFullYear(),d0.getMonth(),d0.getDate()-13+i)),key=t=>new Date(t).toDateString(),ix={};days.forEach((d,i)=>ix[d.toDateString()]=i);
 const v=new Array(14).fill(0),n=new Array(14).fill(0);R.forEach(r=>{const i=ix[key(r.s)];if(i!==undefined){v[i]=Math.round((v[i]+plNet(r))*100)/100;n[i]++}});
 return{v,n,lab:days.map(d=>String(d.getDate())),tips:days.map((d,i)=>`${fd(d.getTime())} · ${n[i]?n[i]+" settled · "+sgn(v[i]):"no bets settled"}`)}}
function plCharts(o){const R=plSet(),cum=cumPL(R),dl=dailyPL(R),pl=R.map(plNet),net=Math.round(pl.reduce((a,b)=>a+b,0)*100)/100,last=pl.length;
 return`<div class="card"><div class="chh"><h2>Profit / loss</h2><b class="${net>0?"won":net<0?"lost":""}">${sgn(net)}</b></div>${lineSvg(cum,{zero:1,label:"Cumulative profit and loss",empty:"Your profit line starts after your first settled bet."})}<div class="pl"><span>Running total, in the order bets settled</span><span>${last} settled</span></div></div>
 <div class="card"><div class="chh"><h2>Daily profit / loss</h2><span class="tm">Last 14 days · by the day bets settled</span></div>${dl.n.some(x=>x)?barSvg(dl.v,{signed:1,money:1,xl:dl.lab,tips:dl.tips,label:"Daily profit and loss"}):'<div class="cempty">No bets settled in the last 14 days.</div>'}</div>
 <div class="card"><div class="chh"><h2>Result per settled bet</h2><span class="tm">${last?last+" bet"+(last===1?"":"s")+", oldest first":""}</span></div>${barSvg(pl,{signed:1,money:1,tips:R.map((r,i)=>`${fd(r.s)} · ${r.n>1?"Multi":"Single"} ${PLW[r.x]} ${sgn(pl[i])}`),label:"Profit or loss per bet",empty:"No settled bets yet."})}${last?`<div class="pl"><span>Best <b class="won">${sgn(Math.max(0,...pl))}</b></span><span>Worst <b class="${Math.min(0,...pl)<0?"lost":""}">${sgn(Math.min(0,...pl))}</b></span><span>Average <b class="${net>0?"won":net<0?"lost":""}">${sgn(net/last)}</b></span></div>`:""}</div>
 <div class="card"><div class="chh"><h2>Balance</h2><b>${$$(S.bal)}</b></div>${lineSvg((S.hist||[]).map(h=>({t:h.t,v:h.b,lab:`${fd(h.t)} · ${$$(h.b)}`})),{label:"Balance over time",empty:"Your balance history starts with your first bet."})}</div>`}
(()=>{let tip=null;const hide=()=>{if(tip)tip.hidden=true;document.querySelectorAll("svg.ch.on").forEach(s=>s.classList.remove("on"))};
 /* hover with a mouse, tap or drag with a finger */
 const move=e=>{const s=e.target&&e.target.closest?e.target.closest("svg.ch[data-tip]"):null;if(!s){if(e.type==="pointermove"||!(e.target.closest&&e.target.closest("#ctip")))hide();return}
  if(!tip){tip=document.createElement("div");tip.id="ctip";document.body.appendChild(tip)}
  const P=JSON.parse(s.dataset.tip),r=s.getBoundingClientRect(),x=e.clientX-r.left;let b=P[0];P.forEach(p=>{if(Math.abs(p[0]-x)<Math.abs(b[0]-x))b=p});
  s.classList.add("on");const hv=s.querySelector(".hv"),hd=s.querySelector(".hd");if(hv){hv.setAttribute("x1",b[0]);hv.setAttribute("x2",b[0])}if(hd){hd.setAttribute("cx",b[0]);hd.setAttribute("cy",b[1])}
  tip.textContent=b[2];tip.hidden=false;tip.style.left=Math.min(innerWidth-90,Math.max(90,r.left+b[0]))+"px";tip.style.top=(r.top+Math.max(16,b[1]))+"px"};document.addEventListener("pointermove",move);document.addEventListener("pointerdown",move);addEventListener("scroll",hide,{passive:true,capture:true});
 document.addEventListener("pointerleave",hide);let rt=0;addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(()=>{if(pg==="pf")renderProfile()},150)})})();
