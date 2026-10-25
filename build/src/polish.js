/* ---------- polish: small touches that make the app feel calmer ----------
   - Home hides the header spin button (the welcome card already has it)
   - the live-data line only shows while games are actually in play (or when ESPN can't be reached)
   - a live score that changes glows briefly, so the change is noticed without jumping
   - a selection added to the slip slides in */
const _liveStatus0=liveStatus;liveStatus=function(){if(POLL&&(POLL.state==="ok"||POLL.state==="idle")&&!POLL.live)return"";return _liveStatus0()};
const LSC={};
const _renderGamesPol=renderGames;renderGames=function(){_renderGamesPol();
 document.querySelectorAll("#games .lvc").forEach(c=>{const id=c.dataset.open,v=LIVE[id];if(!v)return;const k=v.h+"-"+v.a;if(LSC[id]&&LSC[id]!==k)c.querySelectorAll(".lvr b").forEach(b=>{b.classList.remove("bump");void b.offsetWidth;b.classList.add("bump")});LSC[id]=k})};
let SLN=0;const _renderSlipPol=renderSlip;renderSlip=function(m){_renderSlipPol(m);const rows=document.querySelectorAll("#slip .leg");if(rows.length>SLN&&SLN>=0)rows[rows.length-1].classList.add("legin");SLN=rows.length};
const _renderPol=render;render=function(m){_renderPol(m);document.body.classList.toggle("home",pg==="bets"&&!view)};
/* ---------- more information at a glance ----------
   - team season records beside the names on game cards (W-L for NBA, W-D-L for soccer)
   - league logos on the sport tabs
   - win-probability bar in each NBA team's own colour (soccer: neutral tones, no team colours published)
   - a coloured status strip on every bet card */
function teamRec(n,sp){if(sp==="nba"){const id=Object.keys(TM).find(k=>TM[k].n===n),t=id&&(TMD.nba||{})[id];return t&&t.w!=null?`${t.w}-${t.l}`:""}
 const t=Object.values(TMD.soc||{}).find(x=>x.n===n||SAL0[x.n]===n);return t&&t.w!=null?`${t.w}-${t.d}-${t.l}`:""}
const LEAGUE_LOGO={nba:"https://a.espncdn.com/i/teamlogos/leagues/500/nba.png",epl:"https://a.espncdn.com/i/leaguelogos/soccer/500/23.png",ucl:"https://a.espncdn.com/i/leaguelogos/soccer/500/2.png"};
const teamCol=n=>{const t=TBY[n];return t?"#"+t.c:null};
const _renderGamesPol2=renderGames;renderGames=function(){_renderGamesPol2();
 if(!view)document.querySelectorAll("#games .card .open .tr").forEach(tr=>{if(tr.querySelector(".trc"))return;const b=tr.querySelector("[data-team]"),g=GM[(tr.closest("[data-open]")||{}).dataset&&tr.closest("[data-open]").dataset.open];if(!b||!g)return;const r=teamRec(b.dataset.team,g.sp);if(r)b.insertAdjacentHTML("afterend",`<small class="trc">${r}</small>`)});
 const g=view&&GM[view];if(g&&g.sp!=="nba"){const bar=$("#games .pbar");if(bar){const is=bar.querySelectorAll("i"),ch=teamColour(g.h);let ca=teamColour(g.a);if(ch&&ca&&colDist(ch,ca)<90)ca=teamColour(g.a,1);if(ch&&is[0])is[0].style.background=ch;if(is[1])is[1].style.background="#4a4e57";if(ca&&is[2])is[2].style.background=ca;bar.classList.add("tcol")}}
 if(g&&g.sp==="nba"){
  /* basketball starts with a tip-off, not a kick-off */
  document.querySelectorAll("#games .kv > span:first-child").forEach(sp=>{if(sp.textContent.trim()==="Kick-off")sp.textContent="Tip-off"});
  const bar=$("#games .pbar");if(bar){const is=bar.querySelectorAll("i"),ch=teamColour(g.h);let ca=teamColour(g.a);
   /* two teams in near-identical colours (e.g. Jazz and Lakers purple): the away team switches to its other official colour */
   if(ch&&ca&&colDist(ch,ca)<90)ca=teamColour(g.a,1);
   if(is[0]&&ch)is[0].style.background=ch;if(is[1]&&ca)is[1].style.background=ca;bar.classList.add("tcol")}}};
function colDist(a,b){const p=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),x=p(a),y=p(b);return Math.sqrt(x.reduce((s,v,i)=>s+(v-y[i])**2,0))}
const _renderTabsPol=renderTabs;renderTabs=function(){_renderTabsPol();document.querySelectorAll("#tabs [data-tab]").forEach(b=>{const u=LEAGUE_LOGO[b.dataset.tab];if(u&&!b.querySelector(".lgl"))b.insertAdjacentHTML("afterbegin",`<img class="lgl" src="${u}" alt="" width="18" height="18">`)})};
const _betCardPol=betCard;betCard=function(b,i){return _betCardPol(b,i).replace('<div class="bc"',`<div class="bc bs-${b.st==="open"?(betState(b)||"open").toLowerCase():b.st}"`)};
/* ---------- club colours for every team ----------
   NBA colours come with the team data; soccer clubs use ESPN's official colours (primary = home colour, then the second
   colour). A colour too dark to see on the dark background falls back to the second colour, then to neutral grey. */
function socColMap(){if(window.__SCOL)return window.__SCOL;let raw={};try{raw=JSON.parse((document.getElementById("scol")||{}).textContent||"{}")}catch(e){}
 const m={};for(const k in raw){m[k]=raw[k];if(SAL0[k])m[SAL0[k]]=raw[k]}return window.__SCOL=m}
function socCol(n){if(!n)return;const m=socColMap();let c=m[n];if(!c){try{const k=Object.keys(m).find(x=>teq(x,n));c=k&&m[k]}catch(e){}}return c&&c.c?{n,c:c.c,c2:c.c2||"ffffff"}:undefined}
const colLum=h=>{const p=[0,2,4].map(i=>parseInt(String(h).replace("#","").slice(i,i+2),16));return .2126*p[0]+.7152*p[1]+.0722*p[2]};
function teamColour(n,alt){const t=TBY[n]||socCol(n);if(!t)return null;const a=[alt?t.c2:t.c,alt?t.c:t.c2].filter(Boolean).map(x=>"#"+String(x).replace("#",""));return a.find(x=>colLum(x)>45)||"#8f939b"}
