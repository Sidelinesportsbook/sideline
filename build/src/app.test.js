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
