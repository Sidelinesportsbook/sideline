/* ---------- team profiles (NBA + soccer): standings, records, results, fixtures, roster; same sheet as player pages ---------- */
const TMD=JSON.parse((document.getElementById("tmd")||{}).textContent||"null")||{nba:{},soc:{},tables:{}};
const SOCTID={};(DATA.soc||[]).forEach(x=>{const n=SAL0[x.tm]||x.tm;if(!SOCTID[n])SOCTID[n]={tid:x.tid,src:x.src}});
function teamKey(name){if(!name)return null;const nb=Object.keys(TM).find(k=>TM[k].n===name);if(nb)return{sp:"nba",id:nb,n:name};
 const s=SOCTID[name];if(s)return{sp:"soc",id:s.tid,n:name,src:s.src};const t=Object.values(TMD.soc||{}).find(x=>(SAL0[x.n]||x.n)===name);return t?{sp:"soc",id:t.id,n:name,src:t.lg}:null}
const tlink=name=>teamKey(name)?`<button class="tnm" data-team="${esc(name)}">${esc(name)}</button>`:esc(name);
const socName=id=>{const t=(TMD.soc||{})[id];if(t)return SAL0[t.n]||t.n;const x=(DATA.soc||[]).find(p=>p.tid===String(id));return x?SAL0[x.tm]||x.tm:null};
const tmUpdated=()=>TMD.at?fmt(Date.parse(TMD.at)):"not yet synced";
const tmStale=()=>!TMD.at||Date.now()-Date.parse(TMD.at)>STALE;
const tNote=src=>`<div class="tm note">Season ${src==="soc"?"2026-27":SEASON.current} · Source: ESPN standings and schedules · Updated ${tmUpdated()}${tmStale()?' · <b class="lost">may be out of date</b>':""}</div>`;
const ord=n=>{n=+n;const s=n%100>10&&n%100<14?"th":["th","st","nd","rd"][n%10]||"th";return n+s};
const kc=(lab,val,cls)=>`<div class="sc"><small>${lab}</small><b class="${cls||""}">${val==null||val===""?"–":val}</b></div>`;
const sgnN=v=>v==null?"–":(v>0?"+":"")+(Math.round(v*10)/10);
const formChips=f=>f.map(r=>`<span class="fc ${r==="W"?"fw":r==="L"?"fl":"fd"}">${r}</span>`).join("");
function fixRows(fx,sp){if(!fx||!fx.length)return'<div class="cempty" style="height:64px">No upcoming fixtures published</div>';
 return fx.map(s=>{const[iso,opp,ha,comp]=s.split("|"),on=sp==="nba"?abTeam(opp):opp,gm=G.find(g=>!g.leg&&Math.abs(g.ts-Date.parse(iso))<12*36e5&&(g.h===on||g.a===on||teq(g.h,on)||teq(g.a,on)));
  return`<div class="kv"><span><b>${fmt(Date.parse(iso))}</b><small class="tm" style="display:block">${ha==="@"?"@":"vs"} ${tlink(on)}${comp?" · "+esc(comp):""}</small></span>${gm?`<button class="more" data-open="${gm.id}">Bet ›</button>`:""}</div>`}).join("")}
function resRows(res,sp){if(!res||!res.length)return'<div class="cempty" style="height:64px">No results this season yet</div>';
 return res.map(s=>{const[d,opp,ha,r,comp]=s.split("|"),on=sp==="nba"?abTeam(opp):opp;return`<div class="kv"><span>${fd(Date.parse(d+"T12:00Z"))} · ${ha==="@"?"@":"vs"} ${tlink(on)}${comp?`<small class="tm"> · ${esc(comp)}</small>`:""}</span><b class="${r[0]==="W"?"won":r[0]==="L"?"lost":""}">${esc(r)}</b></div>`}).join("")}
function marginChart(res){const rs=(res||[]).slice().reverse().map(s=>s.split("|")),v=rs.map(r=>{const m=r[3].match(/(\d+)-(\d+)/);if(!m)return 0;const d=Math.abs(+m[1]-+m[2]);return r[3][0]==="W"?d:r[3][0]==="L"?-d:0});
 return rs.length?barSvg(v,{signed:1,w:Math.min(660,innerWidth-80),h:150,xl:rs.map(r=>fd(Date.parse(r[0]+"T12:00Z")).split(" ")[0]),tips:rs.map((r,i)=>`${fd(Date.parse(r[0]+"T12:00Z"))} ${r[2]==="@"?"@":"vs"} ${r[1]} · ${r[3]} (${v[i]>0?"+":""}${v[i]})`),label:"Winning margin per game"}):""}
function teamTabs(cur,tabs){return`<div class="pst" style="margin:14px 0 4px">${tabs.map(([k,l])=>`<button data-tt="${k}" class="${k===cur?"on":""}">${l}</button>`).join("")}</div>`}
function nbaTeam(k,tab){const t=(TMD.nba||{})[k.id],tm=TM[k.id],g=gOf(k.n),roster=DATA.pl.filter(p=>p.t===k.id);
 const hdr=`<div class="psh">${bd(k.n,54)}<div><div class="psn">${esc(k.n)}</div><div class="tm">NBA${t&&t.conf?" · "+esc(t.conf):""}${t&&t.div?" · "+esc(t.div)+" Division":""}</div><div class="tm">${t?`${t.w}-${t.l}${t.seed?` · #${t.seed} in the ${/West/.test(t.conf||"")?"West":"East"}`:""}`:"Record not available yet"}</div></div></div>`;
 let body="";
 if(tab==="ov"){body=!t?'<div class="cempty">Season statistics are not available yet.</div>':
   `<div class="sg" style="margin-top:12px">${kc("Record",`${t.w}-${t.l}`)}${kc("Win %",t.pct!=null?(t.pct*100).toFixed(1)+"%":null)}${kc("Conference",t.seed?"#"+t.seed:null)}${kc("Points / game",t.ppg!=null?f1(t.ppg):null)}${kc("Allowed / game",t.oppg!=null?f1(t.oppg):null)}${kc("Point diff",sgnN(t.diff),t.diff>0?"won":t.diff<0?"lost":"")}${kc("Streak",t.streak,/^W/.test(t.streak||"")?"won":/^L/.test(t.streak||"")?"lost":"")}${kc("Home",t.home)}${kc("Road",t.road)}${kc("Last 10",t.l10)}</div>
   ${(t.res||[]).length?`<h2>Recent form</h2><div class="frm">${formChips((t.res||[]).slice(0,5).reverse().map(s=>s.split("|")[3][0]))}</div><h2>Game by game</h2>${teamChart(t.res,"nba")}`:""}${nextBtn(g)}`}
 else if(tab==="fx")body=`<h2>Upcoming</h2>${fixRows(t&&t.fx,"nba")}<h2>Results</h2>${resRows(t&&t.res,"nba")}`;
 else if(tab==="st"){const conf=t&&/West/.test(t.conf)?"nba-West":"nba-East",rows=(TMD.tables||{})[conf]||[];
  body=rows.length?`<h2>${conf==="nba-West"?"Western":"Eastern"} Conference</h2><div class="tw"><table class="tb"><thead><tr><th>#</th><th style="text-align:left">Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr></thead><tbody>${rows.map(r=>{const[s,id,ab,w,l,pct,gb]=r.split("|"),n=(TM[id]||{}).n||ab;return`<tr class="${id===k.id?"me":""}"><td>${s}</td><td style="text-align:left">${tlink(n)}</td><td>${w}</td><td>${l}</td><td>${pct?(+pct).toFixed(3).replace(/^0/,""):"–"}</td><td>${gb==="0"||gb==="0.0"?"–":gb}</td></tr>`}).join("")}</tbody></table></div>`:'<div class="cempty">Standings are not available yet.</div>'}
 else body=`<div class="card" style="margin-top:12px">${roster.sort((x,y)=>((y.c27||{}).min||0)-((x.c27||{}).min||0)).map(p=>{const a=p.c27;return`<button class="rr" data-ply="${esc(p.n)}"><span class="rj">${esc(p.j||"–")}</span><span class="rn"><b>${esc(p.n)}</b><small>${esc(p.pos||"")}${p.inj?` · <em class="bad">${esc(p.inj)}</em>`:""}</small></span><span class="ra">${a?`${f1(a.pts)}<small> pts</small>${f1(a.reb)}<small> reb</small>${f1(a.ast)}<small> ast</small>`:'<small>No games played this season</small>'}</span></button>`}).join("")}</div>`;
 return hdr+teamTabs(tab,[["ov","Overview"],["fx","Results & fixtures"],["st","Standings"],["ro","Roster"]])+body+tNote("nba")}
function socTeam(k,tab){const t=(TMD.soc||{})[k.id],lg=(t&&t.lg)||k.src,g=gOf(k.n);
 const hdr=`<div class="psh">${bd(k.n,54)}<div><div class="psn">${esc(k.n)}</div><div class="tm">${esc(compN(lg))}${t&&t.pos?` · ${ord(t.pos)} place`:""}</div>${t&&t.ucl?`<div class="tm">Champions League · ${ord(t.ucl.pos)} in the league phase</div>`:""}</div></div>`;
 let body="";
 if(tab==="ov"){body=!t?'<div class="cempty">League statistics are not available yet.</div>':
   `<div class="sg" style="margin-top:12px">${kc("Position",t.pos?"#"+t.pos:null)}${kc("Points",t.pts)}${kc("Played",t.gp)}${kc("W-D-L",t.gp!=null?`${t.w}-${t.d}-${t.l}`:null)}${kc("Goals for",t.gf)}${kc("Goals against",t.ga)}${kc("Goal diff",t.gd==null?null:(t.gd>0?"+":"")+t.gd,t.gd>0?"won":t.gd<0?"lost":"")}</div>
   ${t.form?`<h2>League form</h2><div class="frm">${formChips(String(t.form).split(""))}</div>`:""}${(t.res||[]).length?`<h2>Game by game</h2>${teamChart(t.res,"soc")}`:""}
   ${t.ucl?`<h2>Champions League</h2><div class="sg">${kc("Position","#"+t.ucl.pos)}${kc("Points",t.ucl.pts)}${kc("Played",t.ucl.gp)}${kc("W-D-L",`${t.ucl.w}-${t.ucl.d}-${t.ucl.l}`)}${kc("Goal diff",(t.ucl.gd>0?"+":"")+t.ucl.gd,t.ucl.gd>0?"won":t.ucl.gd<0?"lost":"")}</div>`:""}${nextBtn(g)}`}
 else if(tab==="fx")body=`<h2>Upcoming</h2>${fixRows(t&&t.fx,"soc")}<h2>Results</h2>${resRows(t&&t.res,"soc")}`;
 else if(tab==="st"){const tbl=(id,title)=>{const rows=(TMD.tables||{})[id]||[];return rows.length?`<h2>${title}</h2><div class="tw"><table class="tb"><thead><tr><th>#</th><th style="text-align:left">Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead><tbody>${rows.map(r=>{const[p,id2,nm,gp,w,d,l,gf,ga,gd,pts]=r.split("|"),n=socName(id2)||nm;return`<tr class="${id2===String(k.id)?"me":""}"><td>${p}</td><td style="text-align:left">${tlink(n)}</td><td>${gp}</td><td>${w}</td><td>${d}</td><td>${l}</td><td class="${+gd>0?"won":+gd<0?"lost":""}">${+gd>0?"+":""}${gd}</td><td><b>${pts}</b></td></tr>`}).join("")}</tbody></table></div>`:""};
  body=(tbl(lg,compN(lg))+(t&&t.ucl?tbl("uefa.champions","Champions League"):""))||'<div class="cempty">Standings are not available yet.</div>'}
 else body=socTeamCard(k.n);
 return hdr+teamTabs(tab,[["ov","Overview"],["fx","Results & fixtures"],["st","Standings"],["ro","Squad"]])+body+tNote("soc")}
function openTeam(name,tab){const k=teamKey(name);if(!k)return;SHEET={kind:"team",n:name,tab:tab||"ov"};
 const html=sheetWrap(name,k.sp==="nba"?nbaTeam(k,SHEET.tab):socTeam(k,SHEET.tab)),old=$("#pso .ps"),keep=old&&tab;$("#psw").innerHTML=html;if(keep){const m=$("#pso .ps");m.style.animation="none";$("#pso").style.animation="none"}}
function teamSearch(q){if(!q||q.length<2)return"";const ns=cur==="nba"?Object.values(TM).map(t=>t.n):[...new Set(Object.keys(SOCTID).filter(n=>cur==="epl"?SOCTID[n].src==="eng.1":G.some(g=>g.sp==="ucl"&&!g.leg&&(g.h===n||g.a===n))))];
 const hit=ns.filter(n=>n.toLowerCase().includes(q)).slice(0,6);return hit.length?`<div class="card"><h2 style="margin-top:0">Teams</h2>${hit.map(n=>`<button class="rr" data-team="${esc(n)}"><span class="rj">${bd(n,24)}</span><span class="rn"><b>${esc(n)}</b><small>${cur==="nba"?"NBA":esc(compN(SOCTID[n].src))}</small></span><span class="ra"><small>Team ›</small></span></button>`).join("")}</div>`:""}
