/* ---------- live games, player photos and form in the betting area ----------
   Live cards: ESPN's own score, period and clock, quarter or half scores and (soccer) goals and cards. A card opens the
   match page, which becomes a live box score while the game is in play. Player photos come from the same verified sources
   as the profiles (NBA: ESPN by athlete id; soccer: Wikimedia Commons matched by ESPN id or name + current club), with an
   initials avatar wherever no verified photo exists. */
function avatarUrl(n,id,sp){const k=plName(n,id),p=k&&NBAP[k],s=k&&!p&&SOCP[k];return p?photoUrl("nba",p.id):s?photoUrl("soc",s.id):sp==="nba"&&id?photoUrl("nba",id):""}
function avatar(n,id,sp,z){z=z||28;const u=avatarUrl(n,id,sp),ini=String(n||"?").replace(/[^\p{L} ]/gu,"").split(" ").filter(Boolean).map(w=>w[0]).slice(0,2).join("").toUpperCase();
 return`<span class="pav" style="width:${z}px;height:${z}px;font-size:${Math.round(z*.36)}px"><i>${esc(ini)}</i>${u?`<img src="${esc(u)}" alt="" loading="lazy" decoding="async">`:""}</span>`}
document.addEventListener("error",e=>{const t=e.target;if(t&&t.tagName==="IMG"&&t.parentNode&&t.parentNode.classList&&t.parentNode.classList.contains("pav"))t.remove()},true);
/* photos wherever players are listed: rosters, search results, bet legs, match pages */
function decorate(root){if(!root||!root.querySelectorAll)return;const all=s=>[...(root.matches&&root.matches(s)?[root]:[]),...root.querySelectorAll(s)];
 all(".rr[data-ply]:not([data-av])").forEach(b=>{b.dataset.av=1;const rj=b.querySelector(".rj");if(rj){const j=rj.textContent.trim();rj.innerHTML=avatar(b.dataset.ply,null,null,34)+(j&&j!=="–"&&!/^\s*$/.test(j)?`<em>${esc(j)}</em>`:"")}});
 all(".lg2 .pnm[data-ply]:not([data-av]),.mleg .pnm[data-ply]:not([data-av]),.ldh .pnm[data-ply]:not([data-av])").forEach(b=>{b.dataset.av=1;b.insertAdjacentHTML("afterbegin",avatar(b.dataset.ply,null,null,20))})}
new MutationObserver(ms=>{for(const m of ms)m.addedNodes.forEach(x=>{if(x.nodeType===1)decorate(x)})}).observe(document.body,{childList:true,subtree:true});
/* ---------- live scoreboard cards on the games list ---------- */
const liveQ=v=>String(v&&v.q||"Live").replace(/ - /g," ");
function liveCard(g,m,v){const soc=SP[g.sp].m==="soc",order=soc?["h","a"]:["a","h"],sc={h:v.h,a:v.a},nm={h:g.h,a:g.a},lead=sc.h>sc.a?"h":sc.a>sc.h?"a":"";
 const same=m&&g.id==="e"+m.id,ls=same&&m.h.ls&&m.h.ls.length?{h:m.h.ls,a:m.a.ls}:null,np=ls?Math.max(ls.h.length,ls.a.length):0,ph=i=>soc?(i?"2H":"1H"):i<4?"Q"+(i+1):"OT"+(i>4?i-3:"");
 const head=np?`<div class="lvr lvh"><span></span><span></span>${Array.from({length:np},(_,i)=>`<small>${ph(i)}</small>`).join("")}<small>${soc?"":"T"}</small></div>`:"";
 const row=k=>`<div class="lvr${lead===k?" lead":""}">${bd(nm[k],30)}<span class="lvn">${tlink(nm[k])}</span>${np?Array.from({length:np},(_,i)=>`<small>${ls[k][i]??""}</small>`).join(""):""}<b>${sc[k]}</b></div>`;
 const evs=same&&m.evs&&m.evs.length?`<div class="lve">${m.evs.slice(-3).map(e=>`<span>${/card/i.test(e.type)?(/red/i.test(e.type)?"🟥":"🟨"):"⚽"} ${esc(e.min)} ${esc(e.who)}</span>`).join("")}</div>`:"";
 return`<div class="lvc" data-open="${g.id}"><div class="lvt"><span class="lvb"><i></i>LIVE</span><b>${esc(liveQ(v))}</b><span class="tm">${esc(SP[g.sp].n)}</span></div>
 <div class="lvg" style="--np:${np}">${head}${order.map(row).join("")}</div>${evs}
 <div class="lvf"><span></span><span class="more">Live box score ›</span></div></div>`}
/* finished games leave the games list (they live in Past games); postponed or abandoned ones too */
const gameDone=g=>{const m=evOf(g);return!!(RES[g.id]||(m&&(m.state==="post"||m.state==="void")))};
const _renderGames1=renderGames;renderGames=function(){_renderGames1();if(view)return;
 document.querySelectorAll("#games [data-open]").forEach(el=>{const g=GM[el.dataset.open];if(g&&gameDone(g)){const c=el.closest(".card");if(c)c.remove()}});
 if(!document.querySelector("#games .card")){const gs=$("#games");if(gs&&!gs.querySelector(".gempty"))gs.insertAdjacentHTML("beforeend",`<div class="card gempty">No upcoming or live games right now. Finished games are in <button class="tnm" data-pg="past">Past games</button>.</div>`)}
 document.querySelectorAll("#games [data-open]").forEach(el=>{const g=GM[el.dataset.open],v=g&&LIVE[g.id];if(!g||!v||RES[g.id])return;const card=el.closest(".card");if(card){card.classList.add("lvcard");card.innerHTML=liveCard(g,evOf(g),v)}})};
/* ---------- betting area: who the player is and how they've gone against this line ---------- */
const FIX={nba:{pts:5,reb:6,ast:7,tpm:8,stl:9,blk:10},soc:{g:5,sa:6,ss:7,sot:8,ft:9}};
function formStrip(n,st,line,oo,uo){const p=NBAP[n],s=!p&&SOCP[n];const rows=p?uniqLog(p.lg).filter(r=>nbaSeasonOf(r[0])===SEASON.current):s?uniqLog(s.lg):[];
 const IX=p?FIX.nba:FIX.soc,keys=COMB[st]||[st];if(!keys.every(k=>IX[k]!=null))return"";
 const fair=oo>1&&uo>1?Math.round((1/oo)/(1/oo+1/uo)*100):null;
 if(!rows.length)return`<div class="pfm"><span class="tm">No games this season yet</span>${fair!=null?`<span class="tm">Fair chance of over ${fair}%</span>`:""}</div>`;
 const val=r=>keys.reduce((a,k)=>a+NV(r[IX[k]]),0),vs=rows.map(val),l5=vs.slice(0,5),hit=x=>line!=null&&x>line,h5=l5.filter(hit).length,hs=vs.filter(hit).length,avg=vs.reduce((a,b)=>a+b,0)/vs.length;
 return`<div class="pfm"><span class="pfl">Last ${l5.length}</span>${l5.slice().reverse().map((x,i)=>`<span class="pfc ${line==null?"":hit(x)?"h":"m"}" title="${esc(rows[l5.length-1-i][0])} ${rows[l5.length-1-i][2]==="@"?"@":"vs"} ${esc(rows[l5.length-1-i][1])}">${x}</span>`).join("")}
 ${line!=null?`<span class="pfs">Hit <b class="${h5/l5.length>=.5?"won":"lost"}">${h5}/${l5.length}</b> · season <b>${hs}/${vs.length}</b></span>`:""}<span class="pfs">Avg <b>${f1(avg)}</b></span>${fair!=null?`<span class="pfs">Fair chance <b>${fair}%</b></span>`:""}</div>`}
const _renderDetail1=renderDetail;renderDetail=function(){_renderDetail1();const g=GM[view];if(!g||!SL[dtab]||dtab==="main")return;
 document.querySelectorAll("#games .card").forEach(c=>{const pn=c.querySelector(".pn"),b=pn&&pn.querySelector(".pnm[data-ply]");if(!b||pn.dataset.pf)return;pn.dataset.pf=1;const n=b.dataset.ply,P=PLY.find(x=>x.n===n);
  const crest=pn.querySelector(".tlg,svg.lg");if(crest)crest.outerHTML=`<button class="pavb" data-ply="${esc(n)}" aria-label="Open ${esc(n)}'s profile">${avatar(n,null,null,44)}${P?`<span class="pavt">${bd(P.tm,18)}</span>`:""}</button>`;
  const o=c.querySelector(`.o[data-st="${dtab}"][data-s="o"]`),u=c.querySelector(`.o[data-st="${dtab}"][data-s="u"]`),line=o?parseFloat(o.dataset.l):null,od=x=>x?parseFloat((x.querySelector("b")||{}).textContent):0;
  const st=c.querySelector(".tm[style]");const html=formStrip(n,dtab,isNaN(line)?null:line,od(o),od(u));if(html)(st||pn).insertAdjacentHTML("afterend",html)})};
/* the live match page refreshes its box score every 30 seconds while the game is in play */
setInterval(()=>{if(!view||pg!=="bets"||document.hidden)return;const g=GM[view],m=evOf(g);if(!g||!m||m.state!=="in")return;liveRefresh(g,m)},3e4);
