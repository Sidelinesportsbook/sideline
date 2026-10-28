/* Public site: Log in / Create account screen for username + password accounts (runs after the app script).
   - Create account: a username not used before (any capitals), a password of 6+ characters typed twice.
     If this browser already has a profile under that username (from before online accounts), it moves online with its
     bets and balance; a profile that already had a browser password needs that same password.
   - Log in: the same username and password on any device opens the same account.
   - Changes from another signed-in device arrive here within seconds. */
(()=>{if(!window.SL_CLOUD||!window.SL_AUTH)return;const auth=window.SL_AUTH,fs=window.SL_FS;
 const mail=n=>n.toLowerCase().replace(/[^a-z0-9_]/g,"")+"@players.sideline";
 const ERR={"auth/email-already-in-use":"That username is taken. Choose Log in if it's yours.","auth/invalid-credential":"Incorrect username or password.","auth/wrong-password":"Incorrect username or password.","auth/user-not-found":"Incorrect username or password.","auth/invalid-login-credentials":"Incorrect username or password.","auth/too-many-requests":"Too many attempts. Wait a few minutes, then try again.","auth/weak-password":"Use a password with at least 6 characters.","auth/network-request-failed":"No connection. Check your internet and try again."};
 const msg=e=>ERR[e&&e.code]||"Something went wrong. Please try again.";
 let mode="login";claimName=async()=>"";
 /* the gate follows Firebase's answer about the session, never a timer:
      still restoring the session, or signed in and the account still loading -> no login form (a short "Signing you in"
      card only if this browser has nothing to show yet); signed in but the account couldn't load -> say so, with Try again;
      Firebase says nobody is signed in -> the login form. (A 1.2 s / 2.5 s timer used to show the form whenever loading was
      slower than that, so a still-valid session looked logged out.) */
 const card=h=>`<div class="mod gate"><div class="mc"><div class="logo" style="justify-content:center">Sideline</div>${h}</div></div>`;
 showGate=function(){if(UID){$("#gate").innerHTML="";return}const au=window.SL_AUTHU;
  if(au===undefined||(au&&!window.__bootEnd)){$("#gate").innerHTML=S.name?"":card(`<div class="tm" style="margin-top:12px"><span class="spn" style="display:inline-block;vertical-align:-3px;margin-right:8px"></span>Signing you in…</div>`);return}
  if(au&&window.__bootEnd){$("#gate").innerHTML=card(`<div class="tm gsub" style="margin-top:12px">You're signed in, but your account couldn't be loaded just now (no connection?). Your bets are safe.</div><button class="go" onclick="location.reload()">Try again</button>`);return}
  const c=mode==="create",pre=S.name||"";
  $("#gate").innerHTML=`<div class="mod gate"><div class="mc"><div class="logo" style="justify-content:center">Sideline</div>
  <div class="atabs"><button data-cmode="login" class="${c?"":"on"}">Log in</button><button data-cmode="create" class="${c?"on":""}">Create account</button></div>
  <div class="tm gsub">${c?(pre?`Add a password to <b>${esc(dn(pre))}</b> to keep your bets and use your account on any device.`:"Pick a username and password. Log in with them on any phone or computer. Every player is ranked on the public leaderboard by username, with their checked results."):"Log in with your username and password, on any device."}</div>
  <input id="un" placeholder="Username" maxlength="16" autocomplete="username" autocapitalize="off" spellcheck="false" value="${c?esc(pre):""}">
  <input id="pw" type="password" placeholder="Password" maxlength="64" autocomplete="${c?"new-password":"current-password"}">
  ${c?'<input id="pw2" type="password" placeholder="Confirm password" maxlength="64" autocomplete="new-password">':""}
  <div class="msg" id="gm"></div><button class="go" id="mkp">${c?"Create account":"Log in"}</button>
  <div class="tm" style="font-size:11px;margin-top:10px">${c?"":"Playing from before passwords? Choose Create account with your same username. "}Play money only. No real money.</div></div></div>`;
  setTimeout(()=>{const u=$(c&&pre?"#pw":"#un");if(u)u.focus()},50)};
 /* if this browser already holds a profile under the username, it travels with the new account */
 async function localProfileFor(n,pw){const lc=n.toLowerCase(),A=(typeof accts==="function"?accts():{})[lc],P=(typeof profs==="function"?profs():{})[lc],cur=S.name&&S.name.toLowerCase()===lc?S:null,prof=cur||P;
  if(!prof)return{ok:1};if(A){const h=await pwHash(pw,UNB64(A.salt));if(h!==A.hash)return{ok:0}}return{ok:1,prof}}
 mkProfile=async function(){const gm=$("#gm"),b=$("#mkp"),n=($("#un").value||"").trim(),pw=$("#pw").value||"",say=t=>{gm.textContent=t;b.disabled=false};
  if(mode==="create"){const er=nameErr(n);if(er)return say(er);if(pw.length<6)return say("Use a password with at least 6 characters.");if(pw!==($("#pw2").value||""))return say("The two passwords don't match.");
   b.disabled=true;const lp=await localProfileFor(n,pw);if(!lp.ok)return say("This browser already has that username with a different password. Enter that same password.");
   try{await auth.createUserWithEmailAndPassword(mail(n),pw)}catch(e){return say(msg(e))}
   const base=lp.prof?JSON.parse(JSON.stringify(lp.prof)):(()=>{const x=JSON.parse(JSON.stringify(S));x.name=n;return x})();base.name=lp.prof?lp.prof.name||n:n;
   try{await fs.doc("users/"+auth.currentUser.uid).set(base);localStorage.setItem("sl2",JSON.stringify(base))}catch(e){return say("Account created, but saving failed. Log in to finish.")}
   location.reload();return}
  if(!n||!pw)return say("Enter your username and password.");b.disabled=true;
  try{await auth.signInWithEmailAndPassword(mail(n),pw)}catch(e){return say(msg(e))}
  try{localStorage.removeItem("sl2")}catch(e){}location.reload()};
 document.addEventListener("click",e=>{const t=e.target&&e.target.closest&&e.target.closest("[data-cmode]");if(!t)return;e.preventDefault();e.stopPropagation();mode=t.dataset.cmode;showGate()},true);
 document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target&&e.target.closest&&e.target.closest("#gate input")){e.preventDefault();mkProfile()}});
 /* log out signs out of the account on this device; the account stays online */
 logOut=async function(){try{await auth.signOut()}catch(e){}try{localStorage.removeItem("sl2")}catch(e){}location.reload()};
 /* usernames are fixed once an account exists (the sign-in id is built from it) */
 saveName=async function(){toast("Usernames can't be changed once your account has a password.")};
 /* live sync: when another device saves, this one picks it up, unless it has unsaved changes of its own in flight */
 auth.onAuthStateChanged(u=>{if(!u)return;let first=true;fs.doc("users/"+u.uid).onSnapshot(d=>{if(first){first=false;return}if(!d.exists||d.metadata.hasPendingWrites)return;const x=d.data();if(!x||typeof x.bal!=="number")return;
  const mine=JSON.stringify(S),theirs=JSON.stringify(x);if(mine===theirs)return;if(Date.now()-(window.__slLastLocal||0)<1500)return;S=JSON.parse(theirs);norm();try{localStorage.setItem("sl2",theirs)}catch(e){}settleAll();render()},()=>{})});
 /* note local edits so a just-made change is never overwritten by an older copy arriving from the server */
 ["click","input","change"].forEach(ev=>document.addEventListener(ev,()=>{window.__slLastLocal=Date.now()},true));
 /* signed in but the app hasn't shown the gate: nothing to do; signed out: always show the gate (even with an old browser profile) */
 window.SL_ONAUTH=()=>showGate();if(window.SL_AUTHU!==undefined)showGate()})();
