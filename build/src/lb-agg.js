/* Leaderboard, built on GitHub's servers after each data refresh (node build/src/lb-agg.js).
   Reads the opted-in players' bet records (Firestore lb/<account id>, readable by anyone, writable only by that signed-in
   account), checks every bet against the official results archive (data/results-archive.json, kept by live-feed.ps1)
   with lbcore.js, and writes data/leaderboard.json for the site. Accounts that haven't joined are never read.
   data/lb-registry.json is the server's memory between runs (when it first saw each bet, and its contents then).
   Published per player: a public id (a hash of the account id), username, the checked records and, only when the
   player shows their profile, their 15 latest settled bets. Never emails, passwords, balances or open slips. */
const fs=require("fs"),path=require("path"),crypto=require("crypto"),LBC=require("./lbcore.js");
const R=path.join(__dirname,".."),D=path.join(R,"data");
const readJ=(f,d)=>{try{return JSON.parse(fs.readFileSync(f,"utf8").replace(/^﻿/,""))}catch(e){return d}};
const writeJ=(f,o)=>{fs.writeFileSync(f+".tmp",JSON.stringify(o));fs.renameSync(f+".tmp",f)};
const cfg=readJ(path.join(R,"firebase-config.json"),null)||readJ(path.join(D,"firebase-config.json"),null);
const pubId=uid=>crypto.createHash("sha256").update("sideline:"+uid).digest("hex").slice(0,16);
async function readDocs(){const out=[];let tok="";
 do{const u=`https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/lb?pageSize=300&key=${cfg.apiKey}${tok?"&pageToken="+encodeURIComponent(tok):""}`;
  const r=await fetch(u);if(!r.ok)throw new Error("Firestore "+r.status+" "+(await r.text()).slice(0,200));const j=await r.json();
  (j.documents||[]).forEach(d=>{const f=d.fields||{},uid=d.name.split("/").pop(),s=k=>f[k]&&f[k].stringValue;let bets=[];try{bets=JSON.parse(s("j")||"[]")}catch(e){}
   out.push({uid,id:pubId(uid),name:s("name")||"",prof:!!(f.prof&&f.prof.booleanValue),upd:f.upd&&f.upd.timestampValue?Date.parse(f.upd.timestampValue):Date.parse(d.updateTime),bets})});
  tok=j.nextPageToken||""}while(tok);return out}
(async()=>{if(!cfg)throw new Error("no firebase-config.json");
 const A=readJ(path.join(D,"results-archive.json"),{res:{},rp:{},ppd:{},ev:{}});["res","rp","ppd","ev"].forEach(k=>A[k]=A[k]||{});
 /* games in progress from the live feed: their start time (so bets on them are checked and shown as pending) and the live
    box score (a player "over" already passed is won, as the app settles it). Finals come only from the archive. */
 const F=readJ(path.join(D,"feed.json"),{});A.lv={};Object.entries(F.ev||{}).forEach(([id,e])=>{const g="e"+id;if(e&&e.iso&&!A.ev[g]&&(e.state==="in"||e.state==="post"))A.ev[g]={sp:e.sp,iso:e.iso}});
 Object.entries(F.live||{}).forEach(([g,v])=>{if(v&&v.p&&!A.res[g])A.lv[g]=v.p});
 const REG=readJ(path.join(D,"lb-registry.json"),{}),docs=await readDocs(),out=LBC.aggregate(docs,A,REG,Date.now());
 writeJ(path.join(D,"leaderboard.json"),out);writeJ(path.join(D,"lb-registry.json"),REG);
 /* the same memory, by public id, for the page's live ranking (it holds only what the public bet records already show) */
 const PUB={};docs.forEach(d=>{if(REG[d.uid])PUB[d.id]=REG[d.uid]});writeJ(path.join(D,"lb-reg.json"),PUB);
 console.log(`LEADERBOARD_OK ${out.users.length} players, ${out.users.reduce((q,u)=>q+u.recs.filter(r=>r.x).length,0)} settled bets checked, results for ${Object.keys(A.res).length} games`)})()
 .catch(e=>{console.error("Leaderboard not updated: "+e.message);process.exit(1)});
