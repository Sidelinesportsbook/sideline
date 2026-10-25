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
 const g=view&&GM[view];if(g&&g.sp==="nba"){const bar=$("#games .pbar");if(bar){const is=bar.querySelectorAll("i"),ch=teamCol(g.h),ca=teamCol(g.a);if(is[0]&&ch)is[0].style.background=ch;if(is[1]&&ca)is[1].style.background=ca;bar.classList.add("tcol")}}};
const _renderTabsPol=renderTabs;renderTabs=function(){_renderTabsPol();document.querySelectorAll("#tabs [data-tab]").forEach(b=>{const u=LEAGUE_LOGO[b.dataset.tab];if(u&&!b.querySelector(".lgl"))b.insertAdjacentHTML("afterbegin",`<img class="lgl" src="${u}" alt="" width="18" height="18">`)})};
const _betCardPol=betCard;betCard=function(b,i){return _betCardPol(b,i).replace('<div class="bc"',`<div class="bc bs-${b.st==="open"?(betState(b)||"open").toLowerCase():b.st}"`)};
