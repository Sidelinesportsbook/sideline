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
