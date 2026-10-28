/* In-page tests for the chart, profile and daily-summary calculations, and integrity checks of the published data against
   its own sources. Run in the app page (local preview or the live site): (0,eval)(await (await fetch(".../app.test.js")).text());
   await runAppTests() -> [{name, pass, info}]. Nothing here writes to an account or to the database: profile tests swap in
   test bets for the length of the test and put the real ones back. */
async function runAppTests(o){o=o||{};const out=[],ok=(name,cond,info)=>out.push({name,pass:!!cond,info:cond?"":String(info||"")}),eq=(a,b,t)=>Math.abs(a-b)<=(t||1e-6);
 /* rolling averages: counts are the mean of the window; percentages are made / attempted over it; nothing before a full window */
 {const gs=[{v:10,m:2,a:4},{v:20,m:0,a:0},{v:30,m:3,a:6},{v:null,m:0,a:0}],r=rolling(gs,2,false),p=rolling(gs,2,true);
  ok("rolling average: first full window, mean of values",r[0]===null&&eq(r[1],15)&&eq(r[2],25)&&eq(r[3],30),JSON.stringify(r));
  ok("rolling percentage: made ÷ attempted over the window",p[0]===null&&eq(p[1],50)&&eq(p[2],50)&&eq(p[3],50),JSON.stringify(p))}
 /* splits: percentages from totals, never an average of game percentages */
 {const row=(pts,fgm,fga)=>["2026-10-20","X","vs","W 1-0","30",pts,"5","5","1","1","0","2",fgm,fga,"2","2","2","e1"],a=aggRows([row(10,1,10),row(30,9,10)]);
  ok("FG% is total made ÷ total attempted",eq(a.fg,50)&&eq(a.pts,20),JSON.stringify(a))}
 /* team ratings: possessions = FGA − OREB + TOV + 0.44 × FTA */
 {const g=tGame({e:"1",d:"2026-10-20",o:"X",ha:"vs",pf:110,pa:100,q:[25,25,30,30],oq:[25,25,25,25],s:["40-90","10-30","20-25","45","10","25","8","5","12","40","10","20"],os:["38-85","12-32","12-16","40","8","20","7","4","14","36","12","18"]});
  ok("possessions estimate formula",eq(g.poss,90-10+12+.44*25),g.poss);const A=tAgg([g]);ok("offensive rating = 100 × points ÷ possessions",eq(A.ortg,110/g.poss*100),A.ortg)}
 /* court zones from ESPN coordinates (rim at x 25, y 1) */
 ok("zones: restricted area, paint, mid-range, corner 3, above the break",zoneOf({x:25,y:2,v:2})==="ra"&&zoneOf({x:25,y:12,v:2})==="pt"&&zoneOf({x:8,y:12,v:2})==="mid"&&zoneOf({x:1,y:3,v:3})==="c3"&&zoneOf({x:25,y:26,v:3})==="ab3");
 /* the FG% zone chart: finer zones agree with the five, left / right follow ESPN's x, figures are made / attempted */
 {const fam=[],bad=[];for(let x=0.25;x<50;x+=0.5)for(let y=HY+0.1;y<CHALF;y+=0.5){const v=(y<=BRK?(x<3||x>47):Math.hypot(x-25,y-HY)>23.75)?3:2,s={x,y,v},d=dzoneOf(s);if(!d||DZF[d]!==zoneOf(s))fam.push(x+","+y)}
  ok("zone chart: every court spot has exactly one finer zone, inside its main zone",!fam.length,fam.slice(0,5).join(" "));
  ok("zone chart: left and right follow ESPN's x across the court",dzoneOf({x:1,y:3,v:3})==="c3l"&&dzoneOf({x:49,y:3,v:3})==="c3r"&&dzoneOf({x:8,y:12,v:2})==="ml"&&dzoneOf({x:42,y:12,v:2})==="mr"&&dzoneOf({x:25,y:18,v:2})==="mc"&&dzoneOf({x:5,y:30,v:3})==="a3l"&&dzoneOf({x:45,y:30,v:3})==="a3r"&&dzoneOf({x:25,y:30,v:3})==="a3c"&&dzoneOf({x:25,y:44,v:3})===null);
  const sh=[{x:25,y:2,v:2,m:1},{x:25,y:2,v:2,m:0},{x:1,y:3,v:3,m:1},{x:1,y:3,v:3,m:1},{x:1,y:3,v:3,m:0},{x:25,y:60,v:3,m:1}],Z=dzoneStats(sh);
  ok("zone chart: makes, attempts and points per zone; nothing beyond half court",Z.ra.m===1&&Z.ra.a===2&&Z.ra.pts===2&&Z.c3l.m===2&&Z.c3l.a===3&&Z.c3l.pts===6&&Object.values(Z).reduce((a,s)=>a+s.a,0)===5,JSON.stringify(Z));
  ok("zone chart: colour scale red at the low figure, yellow at the middle, green at the high, clamped",zHue(ZSCALE.mid[0],"mid")===0&&zHue(ZSCALE.mid[1],"mid")===60&&zHue(ZSCALE.mid[2],"mid")===120&&zHue(5,"ab3")===0&&zHue(95,"ra")===120&&zHue(32,"ab3")>0&&zHue(32,"ab3")<60);
  /* drawn chart: each zone's shape holds the court spots that belong to it, labels are the rounded made / attempted, small samples stay grey */
  const many=[];for(let i=0;i<20;i++)many.push({x:8,y:12,v:2,m:i<9?1:0});many.push({x:49,y:3,v:3,m:1},{x:49,y:3,v:3,m:0});const k=10,svgS=courtSvg(many,{w:500,v:"zones",tip:()=>""}),host=document.createElement("div");host.style.cssText="position:fixed;left:-9999px;width:500px";host.innerHTML=svgS;document.body.appendChild(host);
  const svg=host.querySelector("svg"),paths=[...host.querySelectorAll(".dzg path")],order=["a3l","a3c","a3r","ml","mc","mr","c3l","c3r","pt","ra"],pt=svg.createSVGPoint(),miss=[];
  for(let x=0.6;x<50;x+=1.3)for(let y=HY+0.6;y<CHALF;y+=1.3){const v=(y<=BRK?(x<3||x>47):Math.hypot(x-25,y-HY)>23.75)?3:2,z=dzoneOf({x,y,v}),near=Math.abs(x-17)<.4||Math.abs(x-33)<.4||Math.abs(x-3)<.4||Math.abs(x-47)<.4||Math.abs(x-25)<.4&&y<=BRK||Math.abs(y-FTY)<.4||Math.abs(y-BRK)<.4||Math.abs(Math.hypot(x-25,y-HY)-23.75)<.4||Math.hypot(x-25,y-HY)<5;if(near)continue;
   pt.x=x*k;pt.y=(y-CBASE)*k;const hit=order.filter((zz,i)=>paths[i].isPointInFill(pt)),top=hit.includes("ra")?"ra":hit.includes("pt")?"pt":hit[0];if(hit.filter(h=>h!=="pt"&&h!=="ra").length>1||top!==z)miss.push(`${x.toFixed(1)},${y.toFixed(1)}:${z}/${hit.join("+")}`)}
  const labs=[...host.querySelectorAll(".dzl")].map(t=>t.textContent.trim()),lo=paths[order.indexOf("c3r")];host.remove();
  ok("zone chart: drawn zones match the zone rules and don't overlap",!miss.length,miss.slice(0,6).join(" "));
  ok("zone chart: label is made ÷ attempted, rounded (9/20 = 45%)",labs.includes("45%"),labs.join(","));
  {const D=[{d:2,m:1,x:25,y:3},{d:3,m:0,x:25,y:4},{d:4,m:1,x:25,y:5},{d:22,m:0,x:3,y:8},{d:23,m:1,x:3,y:9},{d:null,m:1,x:25,y:HY+30}],B=distBands(D);
   ok("shot distance: bands hold every attempt once (0-3, 4-9 ... 28+), using ESPN's distance or the coordinates",B.reduce((a,b)=>a+b.a,0)===D.length&&B[0].a===2&&B[0].m===1&&B[1].a===1&&B[3].a===1&&B[4].a===1&&B[5].a===1&&B[5].m===1,JSON.stringify(B))}  ok("zone chart: a zone with under 5 attempts is grey, not coloured",lo.classList.contains("dzlo")&&!lo.getAttribute("style"),lo.outerHTML.slice(0,120))}
 /* play-by-play score: added up from scoring plays when they match the official score; ESPN's own otherwise */
 {const mc={fin:1,sc:{h:5,a:2},psum:{h:5,a:2,df:1},pbp:[]},f=pbScore(mc),bad=pbScore({fin:1,sc:{h:6,a:2},psum:{h:5,a:2}}),live=pbScore({fin:0,sc:{h:7,a:2},psum:{h:5,a:2}});
  ok("rebuilt running score used when it matches the official score",f.ok&&f({ch:3,ca:2,h:4,a:2})==="2–3");ok("ESPN's own score kept when the totals disagree",!bad.ok&&bad({ch:3,ca:2,h:4,a:2})==="2–4");ok("live: rebuilt score kept while the feed is behind",live.ok)}
 /* dates: exact start time in the viewer's timezone when the data has it */
 ok("game date uses the exact start time",gTime("2026-10-23","2026-10-23T23:30Z")===Date.parse("2026-10-23T23:30Z")&&gTime("2026-10-23",undefined)===Date.parse("2026-10-23T12:00Z"));
 /* profile charts and daily summary: swap in test bets, compare the chart totals with the cards, put the real bets back */
 {const real=S.bets,now=Date.now(),day=864e5,mk=(st,stake,odds,ago,x)=>Object.assign({t:now-ago-36e5,st,stake,odds,legs:[{g:"t"+Math.random(),m:"h",s:"h",odds,r:""}],sat:st==="open"?null:now-ago},x||{});
  try{S.bets=[mk("won",10,2.5,3*day),mk("lost",5,3,2*day),mk("cash",8,4,day,{co:{amt:12,t:now-day}}),mk("void",6,2,1e5),mk("won",4,2,6e4),mk("lost",3,2,5e4),mk("open",7,3,0)];
   const R=plSet(),cum=cumPL(R),dl=dailyPL(R),s=LBC.stats(myRecs()),net=Math.round(R.reduce((a,r)=>a+(r.r-r.k),0)*100)/100;
   ok("profit line ends on the card's net profit",eq(cum[cum.length-1].v,s.net,.005)&&eq(net,s.net,.005),`${cum[cum.length-1].v} vs ${s.net}`);
   ok("per-bet chart includes cash-outs and leaves voids out",R.length===5&&R.some(r=>r.x==="c")&&!R.some(r=>r.x==="v"),R.map(r=>r.x).join(""));
   ok("daily bars add up to the net of bets settled in those 14 days",eq(dl.v.reduce((a,b)=>a+b,0),s.net,.005),dl.v.join(","));
   ok("daily bars sit on the day each bet settled (voids left out)",dl.n[13]===2&&dl.n[12]===1&&dl.n[11]===1&&dl.n[10]===1,dl.n.join(","));
   const M=dsMine();ok("today: settled today counted, open bets apart",M.w===1&&M.l===1&&M.v===1&&eq(M.net,1)&&M.open===1&&eq(M.openStake,7),JSON.stringify(M))}
  finally{S.bets=real}}
 /* data integrity: NBA season logs against the season averages, team files against the standings */
 if(o.data!==false){const P=Object.values(NBAP).filter(p=>p.c27&&p.c27.gp).slice(0,o.n||60);let bad=[],n=0;
  for(const p of P){let d;try{d=await (await fetch(paBase()+"pa/"+p.id+".json")).json()}catch(e){continue}n++;const rows=d.lg.map(r=>r.split("|")),a=aggRows(rows);
   if(rows.length!==p.c27.gp||!eq(a.pts,p.c27.pts,.011)||!eq(a.reb,p.c27.reb,.011)||!eq(a.ast,p.c27.ast,.011)||new Set(rows.map(r=>r[17])).size!==rows.length)bad.push(p.n)}
  ok(`NBA game logs match season averages (${n} players)`,n&&!bad.length,bad.slice(0,5).join(", "));
  let tb=[],tn=0;for(const [id,t] of Object.entries(TMD.nba||{})){let d;try{d=await (await fetch(paBase()+"pa/t"+id+".json")).json()}catch(e){continue}tn++;const w=d.g.filter(g=>g.pf>g.pa).length;if(w!==t.w||d.g.length-w!==t.l)tb.push(t.n)}
  ok(`NBA team files match the standings (${tn} teams)`,tn&&!tb.length,tb.join(", "));
  let sb=[],sn=0;for(const [id,t] of Object.entries(TMD.soc||{})){if(t.lg!=="eng.1")continue;let d;try{d=await (await fetch(paBase()+"pa/st"+id+".json")).json()}catch(e){continue}sn++;const g=d.g.filter(x=>x.c==="eng.1"),w=g.filter(x=>x.gf>x.ga).length,dr=g.filter(x=>x.gf===x.ga).length;
   if(g.length!==t.gp||w!==t.w||dr!==t.d||g.reduce((a,x)=>a+x.gf,0)!==t.gf||g.reduce((a,x)=>a+x.ga,0)!==t.ga)sb.push(t.n)}
  ok(`Premier League team files match the table (${sn} clubs)`,sn&&!sb.length,sb.join(", "))}
 return out}
