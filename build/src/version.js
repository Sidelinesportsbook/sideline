/* ---------- versions: when a fix goes live, tell people and ask them to refresh ----------
   BUILD is a fingerprint of the page code (data-only refreshes don't change it).
   1. Page already open when a new version is deployed: the public site checks version.json every minute, when the tab comes
      back into view and when the phone restores the page; a bar with the latest fix and a Refresh button appears.
   2. First visit after an update (any device): a bar says what was fixed, until the person dismisses it. */
const CHG=(()=>{try{return JSON.parse((document.getElementById("chg")||{}).textContent||"[]")}catch(e){return[]}})(),BUILD=((document.getElementById("bld")||{}).textContent||"").trim();
const fixKey=CHG[0]?CHG[0].d+"|"+CHG[0].t:"";
function updBar(html,btns){const old=$("#upd");if(old)old.remove();document.body.insertAdjacentHTML("beforeend",`<div id="upd" role="status"><span>${html}</span>${btns}<button id="updx" aria-label="Dismiss">×</button></div>`)}
function newVersionBar(fix){if($("#upd.nv"))return;updBar(`<b>New version available.</b> ${esc(fix||"Fixes and improvements are ready.")} Refresh to update.`,`<button id="updgo">Refresh</button>`);$("#upd").classList.add("nv")}
async function verCheck(){if(!BUILD||document.hidden||!/^https?:$/.test(location.protocol))return;
 try{const r=await fetch("version.json?t="+Date.now(),{cache:"no-store"});if(!r.ok)return;const v=await r.json();if(v&&v.v&&v.v!==BUILD)newVersionBar(v.fix)}catch(e){}}
setTimeout(verCheck,5000);setInterval(verCheck,6e4);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)verCheck()});addEventListener("pageshow",e=>{if(e.persisted)verCheck()});addEventListener("focus",verCheck);addEventListener("online",verCheck);
/* after an update: tell returning players what changed (new players just start on the latest version) */
setTimeout(()=>{try{const seen=localStorage.getItem("sl_fixseen"),back=!!(S&&S.name)||!!localStorage.getItem("sl_build");
 if(fixKey&&seen!==fixKey){if(back&&!$("#upd.nv"))updBar(`<b>Updated to the latest version.</b> ${esc(CHG[0].t)}`,`<button id="updnew">What's new</button>`);else localStorage.setItem("sl_fixseen",fixKey)}
 if(BUILD)localStorage.setItem("sl_build",BUILD)}catch(e){}},2500);
document.addEventListener("click",e=>{const t=e.target;if(!t)return;
 if(t.id==="updgo"){location.reload();return}
 if(t.id==="updx"||t.id==="updnew"){const b=$("#upd");if(b){if(!b.classList.contains("nv"))try{localStorage.setItem("sl_fixseen",fixKey)}catch(_){}b.remove()}if(t.id==="updnew")fbOpen()}});
/* feedback on phones: the desktop menu is hidden there, so the header gets its own button */
(()=>{const bal=document.querySelector("header .bal");if(bal&&!$("#mfb"))bal.insertAdjacentHTML("beforebegin",`<button id="mfb" data-fb="1" aria-label="Send feedback or report a bug"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Feedback</button>`)})();
/* the feedback window lists what was fixed recently, so whoever reported it knows to refresh */
const _fbRender0=fbRender;fbRender=function(k){_fbRender0(k);const mc=document.querySelector("#fbo .mc"),row=mc&&mc.querySelector(".row");if(!mc||!CHG.length)return;
 const html=`<div class="fbfix"><h2>Recently fixed and improved</h2>${CHG.slice(0,6).map(c=>`<div class="fbfi"><small>${fd(Date.parse(c.d+"T12:00Z"))}</small><span>${esc(c.t)}</span></div>`).join("")}<div class="tm">Reported one of these? <b>Refresh the website</b> (pull down on your phone, or press F5) to get the fixed version.</div></div>`;
 row?row.insertAdjacentHTML("beforebegin",html):mc.insertAdjacentHTML("beforeend",html)};
