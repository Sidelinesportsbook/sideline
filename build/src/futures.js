/* ---------- Special Bets: futures and outright markets ----------
   Prices: PointsBet (AU) futures exactly as published (futures-data.ps1 -> futures.json, refreshed with the site every
   30 minutes); every competition, market and selection keeps PointsBet's own id. A market PointsBet shows as not open is
   "suspended"; one it no longer lists is "closed" and keeps its last prices for reference. Nothing here is estimated.
   Bets are taken only on markets the app can settle from official results (futures-settle.ps1, mirrored in fSettles below):
   league winner / top 4 / relegated from ESPN's final table, cup winners from the final, NBA champion and conference winners
   from the series, Super Bowl and AFC / NFC champions from the game. Other markets (awards, top scorer and so on) show their
   prices with a note. A futures bet is a single, has no cash-out (there's no live value to base one on) and settles when the
   official result is published (futures-results.json); it can stay open for months. */
var FUT={d:null,res:{},at:0,err:"",busy:0},FV={sp:"all",comp:"",kind:"all",q:"",mk:"",sel:"",all:0};
var FLEAGUE={epl:1,laliga:1,seriea:1,bund:1,ligue1:1},FCUP={ucl:1,uel:1,uecl:1,fac:1,lgc:1,wc:1};
function fSettles(c,mn){if(FLEAGUE[c])return mn==="Outright Winner"||(c==="epl"&&(mn==="To Finish Top 4"||mn==="To Be Relegated"));if(FCUP[c])return mn==="Outright Winner";
 if(c==="nba")return/^(Outright Winner|Eastern Conference Winner|Western Conference Winner)$/.test(mn);if(c==="nfl")return/^Super Bowl [IVXLC]+$|^(AFC|NFC) Championship Winner$/.test(mn);return false}
/* what the page offers: no Scottish Premiership or World Cup; the NBA's champion, conference winners and individual awards; the
   NFL's Super Bowl winner only. Hidden markets stay in futures.json, so a bet already placed on one still settles and shows. */
var FHIDE={spl:1,wc:1};
function fShow(c,m){if(FHIDE[c.id])return false;if(c.id==="nba")return m.k==="award"||/^(Outright Winner|Eastern Conference Winner|Western Conference Winner)$/.test(m.n);if(c.id==="nfl")return/^Super Bowl [IVXLC]+$/.test(m.n);return true}
function fComps(){return FUT.d?FUT.d.comps.filter(c=>c.events.some(e=>e.markets.some(m=>fShow(c,m)))):[]}
const FSPN={basketball:"Basketball",soccer:"Soccer",football:"American football"},FKIND=[["all","All markets"],["champion","Winners"],["award","Awards"],["leader","Leaders"],["finish","Finishing position"],["other","Other"]];
const FSTN={open:"Open",suspended:"Suspended",closed:"Closed"};
async function futLoad(force){if(FUT.busy||(!force&&FUT.d&&Date.now()-FUT.at<3e5))return;FUT.busy=1;
 const get=f=>fetch(paBase()+f+"?t="+Date.now(),{cache:"no-store"}).then(x=>x.ok?x.json():null).catch(()=>null);
 try{const[d,r]=await Promise.all([get("futures.json"),get("futures-results.json")]);if(!d||!Array.isArray(d.comps))throw 0;FUT.d=d;FUT.res=(r&&r.res)||{};FUT.at=Date.now();FUT.err=""}
 catch(e){FUT.err=window.claude&&!window.SL_CLOUD?"Special Bets are on the public site (sidelinesportsbook.github.io/sideline).":"Couldn't load futures prices right now. Trying again shortly."}
 FUT.busy=0;futSettle();if(cur==="spec"&&!view&&pg==="bets")renderGames()}
setInterval(()=>{if(cur==="spec"&&!document.hidden)futLoad(true)},3e5);
/* names: the same tidy-up as the settlement script, to find a selection's logo (display only; bets use PointsBet ids) */
const fNz=s=>(" "+String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9 ]/g," ")+" ").replace(/ man /g," manchester ").replace(/ utd /g," united ").replace(/ st /g," saint ").replace(/ psg /g," paris saint germain ").replace(/ (fc|afc|cf|sc|ac|club|de|the|calcio) /g," ").replace(/\s+/g," ").trim();
var FTEAM=null;function fTeam(n){if(!FTEAM){FTEAM={};const add=x=>{if(x)FTEAM[fNz(x)]=x};Object.values(TM).forEach(t=>add(t.n));Object.keys(SOCTID).forEach(add);Object.values(TMD.soc||{}).forEach(t=>add(SAL0[t.n]||t.n))}
 const k=fNz(n);if(FTEAM[k])return FTEAM[k];const w=k.split(" ");const hit=Object.keys(FTEAM).filter(x=>w.every(p=>(" "+x+" ").includes(" "+p+" ")));return hit.length===1?FTEAM[hit[0]]:null}
function fSelArt(c,s){const tm=fTeam(s.n);if(tm)return mLogo({n:tm},26);if(c.sport==="basketball"&&NBAP[s.n])return avatar(s.n,null,"nba",26);return`<span class="fsi">${esc(String(s.n).split(" ").map(w=>w[0]).join("").slice(0,3).toUpperCase())}</span>`}
function fFind(mk){if(!FUT.d)return null;for(const c of FUT.d.comps)for(const e of c.events)for(const m of e.markets)if(m.id===mk&&fShow(c,m))return{c,e,m};return null}
const fEnds=e=>{const t=Date.parse(e.ends);return isNaN(t)?"":new Date(t).toLocaleDateString("en-AU",{month:"long",year:"numeric"})};
function fStatus(m){return`<span class="fst2 ${m.st}">${FSTN[m.st]||m.st}</span>`}
/* the page */
function specPage(){if(!FUT.d)return`<div class="card fhd"><h2 class="dsti">Special Bets</h2><div class="tm">${FUT.err?esc(FUT.err):"Loading futures prices…"}</div></div>${FUT.err?"":skel(120,120,120)}`;
 const D=FUT.d,upd=`Prices: ${esc(D.src)} · updated ${fmt(Date.parse(D.fetched))}${Date.now()-Date.parse(D.fetched)>2*36e5?' · <b class="lost">may be out of date</b>':""}`;
 const head=`<div class="card fhd"><h2 class="dsti">Special Bets</h2><div class="tm">Futures are bets on what's decided over a whole season or tournament: who wins the league, the cup or the championship. They stay open until the result is official, often for months, and have no cash-out.</div><div class="tm note" style="margin:6px 0 0">${upd}</div></div>`;
 if(FV.mk){const F=fFind(FV.mk);if(F)return head+fMarketView(F);FV.mk=""}
 const CS=fComps(),sps=[...new Set(CS.map(c=>c.sport))],q=FV.q.trim().toLowerCase();
 const comps=CS.filter(c=>(FV.sp==="all"||c.sport===FV.sp)&&(!FV.comp||c.id===FV.comp)),kinds=new Set(CS.flatMap(c=>c.events.flatMap(e=>e.markets.filter(m=>fShow(c,m)).map(m=>m.k))));
 const chip=(k,v,l)=>`<button data-fv="${k}:${v}" class="${String(FV[k])===String(v)?"on":""}">${l}</button>`;
 const filt=`<div class="card fflt"><div class="gbf">${chip("sp","all","All sports")}${sps.map(s=>chip("sp",s,FSPN[s]||s)).join("")}</div>
  <div class="gbf">${FKIND.filter(([k])=>k==="all"||kinds.has(k)).map(([k,l])=>chip("kind",k,l)).join("")}</div>
  <div class="ffrow"><select class="scsel" data-fvc="1" aria-label="Competition"><option value="">All competitions</option>${CS.filter(c=>FV.sp==="all"||c.sport===FV.sp).map(c=>`<option value="${c.id}"${FV.comp===c.id?" selected":""}>${esc(c.n)}</option>`).join("")}</select>
  <input class="fq" data-fq="1" placeholder="Search a team, player or market" value="${esc(FV.q)}" aria-label="Search futures"></div></div>`;
 let body="";comps.forEach(c=>{const mks=[];c.events.forEach(e=>e.markets.forEach(m=>{if(!fShow(c,m)||FV.kind!=="all"&&m.k!==FV.kind)return;if(q&&!(c.n+" "+m.n).toLowerCase().includes(q)&&!m.sel.some(s=>s.n.toLowerCase().includes(q)))return;mks.push({e,m})}));if(!mks.length)return;
  const lead=mks.find(x=>x.m.k==="champion"&&x.m.st!=="closed")||mks[0],top=lead.m.sel.filter(s=>!q||s.n.toLowerCase().includes(q)||(c.n+" "+lead.m.n).toLowerCase().includes(q)).slice(0,3);
  body+=`<div class="card fcmp"><div class="fch">${LEAGUE_LOGO[c.id]?`<img src="${LEAGUE_LOGO[c.id]}" alt="" width="22" height="22">`:""}<b>${esc(c.n)}</b><small class="tm">${FSPN[c.sport]||""} · ${mks.length} market${mks.length===1?"":"s"}</small></div>
   <button class="flead" data-fmk="${lead.m.id}"><span><b>${esc(lead.m.n)}</b>${fStatus(lead.m)}<small class="tm">Decided by ${fEnds(lead.e)}</small></span><span class="ftop">${top.map(s=>`<span>${fSelArt(c,s)}<em>${esc(s.n)}</em><b>${f2(s.p)}</b></span>`).join("")}</span><span class="more">All ${lead.m.sel.length} ›</span></button>
   ${mks.length>1?`<div class="fmks">${mks.filter(x=>x!==lead).map(x=>`<button data-fmk="${x.m.id}" class="${x.m.st!=="open"?"off":""}">${esc(x.m.n)}${x.m.st!=="open"?` <small>(${FSTN[x.m.st]})</small>`:""}</button>`).join("")}</div>`:""}</div>`});
 return head+filt+(body||`<div class="cempty">No futures match these filters.</div>`)}
function fMarketView(F){const{c,e,m}=F,can=fSettles(c.id,m.n),res=FUT.res[m.id],q=FV.q.trim().toLowerCase(),list=m.sel.filter(s=>!q||s.n.toLowerCase().includes(q)),show=FV.all?list:list.slice(0,30);
 const mine=S.bets.filter(b=>b.legs[0]&&b.legs[0].m==="fut"&&b.legs[0].fut&&b.legs[0].fut.mk===m.id);
 const note=res?`<div class="fnote won">Settled: ${esc(res.names.join(", "))} (${esc(res.how)}).</div>`:m.st==="closed"?`<div class="fnote">PointsBet has closed this market. The last prices are shown for reference.</div>`:m.st==="suspended"?`<div class="fnote">PointsBet has suspended this market, so no bets can be placed for now.</div>`
  :can?`<div class="fnote">Settles from the official result: ${c.id in FLEAGUE?"ESPN's final table":c.id==="nba"?"the NBA series result":c.id==="nfl"?"the game's result":"the winner of the final"}. Single bets only; no cash-out.</div>`:`<div class="fnote">Prices for reference: the app doesn't take bets on this market because its result can't be confirmed automatically from official data.</div>`;
 const rows=show.map(s=>{const ok=can&&m.st==="open"&&s.st==="open"&&!res,op=FV.sel===s.id,won=res&&res.win.includes(s.id);
  return`<div class="fsel${op?" op":""}${won?" fwin":""}"><span class="fsn">${fSelArt(c,s)}<b>${esc(s.n)}</b>${s.st!=="open"&&m.st==="open"?' <small class="tm">suspended</small>':""}${won?' <span class="chip c-won">WINNER</span>':""}</span>${ok?`<button class="o${op?" on":""}" data-fsel="${s.id}"><b>${f2(s.p)}</b></button>`:`<b class="fpx">${f2(s.p)}</b>`}</div>${op?fBetPanel(c,e,m,s):""}`}).join("");
 return`<button class="back" data-fback="1">‹ All futures</button><div class="card fmk"><div class="fch">${LEAGUE_LOGO[c.id]?`<img src="${LEAGUE_LOGO[c.id]}" alt="" width="22" height="22">`:""}<b>${esc(c.n)}</b>${fStatus(m)}</div><h2 class="dsti" style="font-size:20px">${esc(m.n)}</h2><div class="tm">${esc(e.n)} · decided by ${fEnds(e)}</div>${note}
 ${m.sel.length>12?`<input class="fq" data-fq="1" placeholder="Find a ${c.sport==="basketball"&&m.k!=="champion"?"player":"team"}" value="${esc(FV.q)}" aria-label="Find a selection" style="margin-top:8px">`:""}
 <div class="fsels">${rows||'<div class="dsem">No selection matches.</div>'}</div>${list.length>30&&!FV.all?`<button class="dsmore" data-fall="1">Show all ${list.length}</button>`:""}
 ${mine.length?`<h2>Your bets on this market</h2>${mine.map(b=>`<div class="kv"><span>${esc(b.legs[0].bt||b.legs[0].d)} @ ${f2(b.odds)} · ${$$(b.stake)}</span><b class="${b.st==="won"?"won":b.st==="lost"?"lost":""}">${b.st==="open"?"Open":b.st==="won"?"Won "+$$(b.stake*b.odds):"Lost"}</b></div>`).join("")}`:""}</div>`}
function fBetPanel(c,e,m,s){const v=Math.max(2.5,+(FV.stk||5));return`<div class="fbet"><label>Stake <input type="number" id="fstk" min="2.5" step="0.5" value="${v}" inputmode="decimal"></label><span class="tm">Returns <b id="fret">${$$(v*s.p)}</b> if ${esc(s.n)} ${m.k==="finish"?(/Relegat/.test(m.n)?"go down":"finish in the top 4"):"win"}</span><button class="go" data-fplace="${s.id}">Place bet · ${$$(v)}</button><div class="msg" id="fmsg"></div></div>`}
function fPlace(selId){const F=fFind(FV.mk);if(!F)return;const{c,e,m}=F,s=m.sel.find(x=>x.id===selId),st=Math.floor((+(($("#fstk")||{}).value)||0)*100)/100,say=t=>{const x=$("#fmsg");if(x)x.textContent=t};
 if(!s)return;if(!fSettles(c.id,m.n)||m.st!=="open"||s.st!=="open"||FUT.res[m.id])return say("This market isn't open for bets right now.");
 if(Date.now()-Date.parse(FUT.d.fetched)>2*36e5)return say("These prices are more than two hours old. Try again once they've refreshed.");
 if(!(st>=2.5))return say("Minimum stake is $2.50.");if(st>S.bal+1e-9)return say("Not enough balance.");
 const spk=c.sport==="basketball"?"nba":c.sport==="football"?"nfl":SP[c.id]?c.id:"soc";
 S.bets.push({legs:[{g:"fut:"+spk+":"+m.id,m:"fut",s:s.id,line:0,odds:s.p,d:`${s.n} – ${c.n} ${m.n}`,bt:s.n,r:null,fut:{c:c.id,cn:c.n,sp:spk,mk:m.id,mn:m.n,ev:e.id,ends:e.ends}}],stake:st,odds:s.p,st:"open",bx:1,t:Date.now()});
 S.bal=Math.round((S.bal-st)*100)/100;FV.sel="";save();render();toast(`Bet placed: ${s.n} @ ${f2(s.p)}`)}
/* settlement on this device from the published official results (the leaderboard checks the same results on the server) */
function futSettle(){let ch=false;S.bets.forEach(b=>{if(b.st!=="open"||!b.legs[0]||b.legs[0].m!=="fut")return;const l=b.legs[0],r=FUT.res[l.fut&&l.fut.mk];if(!r)return;
  const w=r.win.includes(String(l.s));l.r=w?"w":"l";b.st=w?"won":"lost";b.sat=Date.now();if(w)credit(b.stake*b.odds);else S.lpend=Math.round(((S.lpend||0)+b.stake)*100)/100;ch=true});
 if(ch){save();render()}}
/* a futures leg in the bet lists and trackers: what it's waiting for */
const _legProgF=legProg;legProg=function(l){if(l.m!=="fut")return _legProgF(l);const f=l.fut||{},d=Date.parse(f.ends);
 return{st:l.r?(l.r==="w"?"hit":"miss"):"live",lab:l.r?(l.r==="w"?"Won":"Lost"):"Open",pct:0,txt:l.r?"Settled on the official result":`Futures bet · settles when the result is official${isNaN(d)?"":" (around "+new Date(d).toLocaleDateString("en-AU",{month:"long",year:"numeric"})+")"}`}};
const _renderGamesF=renderGames;renderGames=function(){if(!view&&cur==="spec"&&pg==="bets"){$("#games").innerHTML=specPage();futLoad();return}return _renderGamesF.apply(this,arguments)};
document.addEventListener("click",e=>{const t=e.target;if(!t||!t.closest)return;
 const a=t.closest("[data-fv]");if(a){e.stopPropagation();const[k,v]=a.dataset.fv.split(":");FV[k]=v;if(k==="sp")FV.comp="";renderGames();return}
 const m=t.closest("[data-fmk]");if(m){e.stopPropagation();FV.mk=m.dataset.fmk;FV.sel="";FV.all=0;FV.q="";renderGames();scrollTo(0,($("#games")||{}).offsetTop-70||0);return}
 if(t.closest("[data-fback]")){e.stopPropagation();FV.mk="";FV.sel="";FV.q="";renderGames();return}
 if(t.closest("[data-fall]")){e.stopPropagation();FV.all=1;renderGames();return}
 const s=t.closest("[data-fsel]");if(s){e.stopPropagation();FV.sel=FV.sel===s.dataset.fsel?"":s.dataset.fsel;renderGames();return}
 const p=t.closest("[data-fplace]");if(p){e.stopPropagation();fPlace(p.dataset.fplace)}},true);
document.addEventListener("input",e=>{const t=e.target;if(!t||!t.matches)return;if(t.matches("[data-fq]")){FV.q=t.value;clearTimeout(t._t);t._t=setTimeout(renderGames,200)}
 else if(t.id==="fstk"){FV.stk=t.value;const F=fFind(FV.mk),s=F&&F.m.sel.find(x=>x.id===FV.sel),r=$("#fret");if(s&&r)r.textContent=$$((+t.value||0)*s.p);const b=$("[data-fplace]");if(b)b.textContent="Place bet · "+$$(+t.value||0)}},true);
document.addEventListener("change",e=>{const t=e.target;if(t&&t.matches&&t.matches("[data-fvc]")){FV.comp=t.value;renderGames()}},true);
futLoad();
