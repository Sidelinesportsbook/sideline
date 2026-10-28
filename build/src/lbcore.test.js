/* Tests for the leaderboard and profile rules (lbcore.js). They run on GitHub's servers before every publish
   (node build/src/lbcore.test.js; a failure stops the publish) and in the browser (runLbcoreTests(LBC)).
   Each case builds bets the way the app stores them and checks the figures the leaderboard, profile and daily summary show. */
function runLbcoreTests(LBC){const out=[],ok=(name,cond,info)=>out.push({name,pass:!!cond,info:cond?"":info||""}),eq=(a,b)=>Math.abs(a-b)<1e-6;
 const T0=Date.parse("2026-10-20T00:00:00Z"),H=36e5;
 /* official results: two finished games, one postponed, one in progress */
 const A={res:{e1:[110,100],e2:[95,99]},rp:{e1:{"P One":{pts:30,reb:5,ast:4,stl:1,blk:0,tpm:3},"P Two":{pts:8,reb:12,ast:2,stl:0,blk:1,tpm:0}},e2:{}},ppd:{e3:"postponed"},
  ev:{e1:{sp:"nba",iso:new Date(T0+10*H).toISOString(),end:new Date(T0+13*H).toISOString()},e2:{sp:"nba",iso:new Date(T0+11*H).toISOString(),end:new Date(T0+14*H).toISOString()},e3:{sp:"nba",iso:new Date(T0+12*H).toISOString()},e4:{sp:"nba",iso:new Date(T0+20*H).toISOString()}},
  lv:{e4:{"P Live":{pts:22,reb:3,ast:1,stl:0,blk:0,tpm:2}}}};
 const leg=(g,m,s,odds,x)=>Object.assign({g,m,s,line:0,pl:"",st:"",odds,r:"",d:""},x||{});
 const bet=(t,stake,legs,st,x)=>Object.assign({t,st:st||"open",stake,odds:legs.reduce((a,l)=>a*l.odds,1),ins:0,bx:1,sat:null,co:null,legs},x||{});
 const doc=(bets,upd)=>({uid:"u1",id:"p1",name:"Tester1",prof:true,upd:upd||T0+30*H,bets});
 const now=T0+40*H,run=(bets,reg,upd)=>LBC.verifyUser(doc(bets,upd),A,reg||{},now);
 /* 1. empty account */
 {const v=run([]),s=LBC.stats(v.recs);ok("empty account has no figures",v.recs.length===0&&s.settled===0&&s.net===0&&s.roi===null&&s.wr===null,JSON.stringify(s))}
 /* 2. home win settles from the official result, not the player's copy */
 {const v=run([bet(T0+9*H,10,[leg("e1","h","h",2)],"lost")]),s=LBC.stats(v.recs);ok("official result overrides the player's copy",s.w===1&&eq(s.net,10)&&v.fix===1,JSON.stringify(s))}
 /* 3. losing bet */
 {const s=LBC.stats(run([bet(T0+9*H,10,[leg("e2","h","h",3)],"lost")]).recs);ok("a lost bet is -stake",s.l===1&&eq(s.net,-10)&&eq(s.roi,-100),JSON.stringify(s))}
 /* 4. duplicate copies count once */
 {const b=bet(T0+9*H,10,[leg("e1","h","h",2)],"won"),v=run([b,{...b}]);ok("a duplicated bet counts once",v.recs.length===1&&v.bad.dup===1,JSON.stringify(v.bad))}
 /* 5. void (postponed) leaves staked, returns and ROI alone */
 {const s=LBC.stats(run([bet(T0+9*H,10,[leg("e3","h","h",2)],"void"),bet(T0+9*H,10,[leg("e1","h","h",2)],"won")]).recs);ok("voids are left out of staked and ROI",s.v===1&&eq(s.staked,10)&&eq(s.net,10)&&eq(s.roi,100),JSON.stringify(s))}
 /* 6. pending bet: counted as pending, never as profit */
 {const s=LBC.stats(run([bet(T0+19*H,10,[leg("e5","h","h",2)])]).recs);ok("an open bet is pending, not profit",s.pending===1&&s.settled===0&&s.net===0,JSON.stringify(s))}
 /* 7. placed after the game started: not counted */
 {const v=run([bet(T0+10*H+5*6e4,10,[leg("e1","h","h",2)],"won")]);ok("a bet placed after the start doesn't count",v.recs.length===0&&v.bad.late===1,JSON.stringify(v.bad))}
 /* 8. a cash-out counts at the amount taken, once */
 {const b=bet(T0+9*H,10,[leg("e2","h","h",3)],"cash",{co:{amt:14,t:T0+12*H}}),s=LBC.stats(run([b]).recs);ok("a cash-out counts at the amount taken",s.c===1&&eq(s.net,4)&&s.w===0&&s.l===0,JSON.stringify(s))}
 /* 9. impossible cash-out (more than the bet could pay) is rejected */
 {const v=run([bet(T0+9*H,10,[leg("e2","h","h",3)],"cash",{co:{amt:50,t:T0+12*H}})]);ok("an impossible cash-out is rejected",v.bad.cash===1,JSON.stringify(v.bad))}
 /* 10. a bet changed after the server first saw it is rejected */
 {const b=bet(T0+9*H,10,[leg("e1","h","h",2)],"won"),reg={};LBC.verifyUser(doc([b]),A,reg,now);const v=LBC.verifyUser(doc([{...b,stake:50}]),A,reg,now);ok("an edited bet is rejected",v.bad.edited===1&&v.recs.length===0,JSON.stringify(v.bad))}
 /* 11. multi with one leg on a game still in progress: pending (it used to vanish from the table) */
 {const v=run([bet(T0+9*H,10,[leg("e1","h","h",2),leg("e4","h","h",2)],"won")]),s=LBC.stats(v.recs);ok("a multi with a live leg stays as pending",s.pending===1&&s.settled===0,JSON.stringify({s,unv:v.unv}))}
 /* 12. multi already lost on a finished leg: lost straight away */
 {const s=LBC.stats(run([bet(T0+9*H,10,[leg("e2","h","h",2),leg("e4","h","h",2)],"lost")]).recs);ok("a multi lost on a finished leg settles as lost",s.l===1&&eq(s.net,-10),JSON.stringify(s))}
 /* 13. player over already passed in the live box score: won */
 {const s=LBC.stats(run([bet(T0+19*H,10,[leg("e4","p","o",2,{pl:"P Live",st:"pts",line:19.5})],"won")]).recs);ok("an over already passed live counts as won",s.w===1&&eq(s.net,10),JSON.stringify(s))}
 /* 14. player under during the game: still pending */
 {const s=LBC.stats(run([bet(T0+19*H,10,[leg("e4","p","u",2,{pl:"P Live",st:"pts",line:30.5})])]).recs);ok("an under stays pending until the final",s.pending===1,JSON.stringify(s))}
 /* 15. player props from the final box score, incl. combos and did-not-play */
 {const s=LBC.stats(run([bet(T0+9*H,10,[leg("e1","p","o",2,{pl:"P One",st:"pra",line:38.5})]),bet(T0+9*H,10,[leg("e1","p","o",2,{pl:"P Two",st:"dd",line:.5,s:"k"})]),bet(T0+9*H,10,[leg("e1","p","o",2,{pl:"Not Playing",st:"pts",line:5.5})])]).recs);
  ok("props settle from the box score (PRA 39 > 38.5 won; 8 pts + 12 reb is no double-double, lost); a player who didn't play is void",s.w===1&&s.l===1&&s.v===1,JSON.stringify(s))}
 /* 16. corrected result: the next check follows the official figure */
 {const b=bet(T0+9*H,10,[leg("e2","h","h",2)],"lost"),A2=JSON.parse(JSON.stringify(A));A2.res.e2=[101,99];const v=LBC.verifyUser(doc([b]),A2,{},now),s=LBC.stats(v.recs);ok("a corrected final result is followed",s.w===1&&eq(s.net,10),JSON.stringify(s))}
 /* 17. affordability: stakes beyond the bank are refused */
 {const v=run([bet(T0+9*H,500,[leg("e1","h","h",2)],"won")]);ok("an unaffordable stake is refused",v.bad.funds===1,JSON.stringify(v.bad))}
 /* 18. ranking: ties share a rank, the documented tie-breakers order the rest */
 {const u=(name,recs)=>({name,recs}),r=(x,k,ret,s)=>({t:s-H,s,p:"nba",n:1,k,r:ret,o:2,x,v:0});
  const R=LBC.rank([u("A",[r("w",10,20,T0)]),u("B",[r("w",10,20,T0)]),u("C",[r("l",10,0,T0)])],{},"net",1);ok("tied players share a rank",R.rows[0].rank===1&&R.rows[1].rank===1&&R.rows[2].rank===3,JSON.stringify(R.rows.map(x=>[x.u.name,x.rank])))}
 /* 19. period filter uses settlement time */
 {const r=x=>({t:T0,s:x,p:"nba",n:1,k:10,r:20,o:2,x:"w",v:0}),s=LBC.stats([r(Date.now()-40*864e5),r(Date.now()-2*864e5)],{period:"d30"});ok("periods count bets by when they settled",s.settled===1,JSON.stringify(s))}
 /* 20. fromBet: the profile's own records match the server's view of the same bets */
 {const b=bet(T0+9*H,10,[leg("e1","h","h",2)],"won",{sat:T0+13*H}),r=LBC.fromBet(b,()=>"nba",()=>T0+13*H);ok("a won bet's record is stake x odds at its settlement time",r.x==="w"&&eq(r.r,20)&&r.s===T0+13*H,JSON.stringify(r))}
 /* 21. daily totals: net is returns - stakes of the day's settled bets, voids aside */
 {const recs=[{t:0,s:Date.now(),p:"nba",n:1,k:10,r:25,o:2.5,x:"w",v:0},{t:0,s:Date.now(),p:"nba",n:1,k:5,r:0,o:2,x:"l",v:0},{t:0,s:Date.now(),p:"nba",n:1,k:4,r:4,o:2,x:"v",v:1}],s=LBC.stats(recs);ok("a day's net is returns - stakes, voids aside",eq(s.net,10)&&eq(s.staked,15)&&s.v===1,JSON.stringify(s))}
 /* 22. a bet removed from the public record after the server saw it keeps counting (settled and open alike) */
 {const won=bet(T0+9*H,10,[leg("e2","h","h",3)],"lost"),open=bet(T0+19*H,10,[leg("e4","h","h",2)]),reg={};LBC.verifyUser(doc([won,open]),A,reg,now);
  const v=LBC.verifyUser(doc([]),A,reg,now),s=LBC.stats(v.recs);ok("bets removed from the record still count",v.bad.removed===2&&s.l===1&&s.pending===1&&eq(s.net,-10),JSON.stringify({bad:v.bad,s}))}
 /* 23. a kept bet that is still in the record isn't counted twice */
 {const b=bet(T0+9*H,10,[leg("e1","h","h",2)],"won"),reg={};LBC.verifyUser(doc([b]),A,reg,now);const v=LBC.verifyUser(doc([b]),A,reg,now);ok("a kept bet still in the record counts once",v.recs.length===1&&v.bad.removed===0,JSON.stringify(v.bad))}
 return out}
if(typeof module!=="undefined"&&module.exports){module.exports=runLbcoreTests;
 if(require.main===module){const LBC=require("./lbcore.js"),res=runLbcoreTests(LBC),bad=res.filter(r=>!r.pass);
  res.forEach(r=>console.log((r.pass?"PASS ":"FAIL ")+r.name+(r.pass?"":"  "+r.info)));console.log(`LBCORE_TESTS ${res.length-bad.length}/${res.length} passed`);process.exit(bad.length?1:0)}}
