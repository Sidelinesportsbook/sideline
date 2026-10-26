/* ---------- username + password accounts, kept in this browser ----------
   Each account is stored on this device only (no server): sl_accts holds {username → salt + password hash}, and each
   account's data (balance, bets, slip) is kept under its username in sl_profiles while logged out, or as the current
   profile while logged in. Passwords are never stored as typed: they are hashed with PBKDF2-SHA-256 (150,000 rounds,
   a random salt per account) using the browser's built-in Web Crypto. After 5 wrong passwords, login pauses 30 seconds.
   The Claude version (signed in through Claude) keeps its own account system unchanged. */
const ACC_KEY="sl_accts",B64=a=>btoa(String.fromCharCode(...new Uint8Array(a))),UNB64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const accts=()=>{try{return JSON.parse(localStorage.getItem(ACC_KEY)||"{}")}catch(e){return{}}};
const saveAccts=a=>{try{localStorage.setItem(ACC_KEY,JSON.stringify(a))}catch(e){}};
async function pwHash(pw,salt){const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(pw),"PBKDF2",false,["deriveBits"]);
 return B64(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations:150000},k,256))}
let GMODE="login",AFAIL=0,ALOCK=0;
const localAuth=()=>!DB&&!!(window.crypto&&crypto.subtle);
const _showGate0=showGate;showGate=function(){if(!localAuth())return _showGate0();if(S.name){$("#gate").innerHTML="";return}if(!booted)return;
 const c=GMODE==="create",nA=Object.keys(accts()).length+Object.keys(profs()).length;
 $("#gate").innerHTML=`<div class="mod gate"><div class="mc"><div class="logo" style="justify-content:center">Sideline</div>
 <div class="atabs"><button data-gmode="login" class="${c?"":"on"}">Log in</button><button data-gmode="create" class="${c?"on":""}">Create account</button></div>
 <div class="tm gsub">${c?"Pick a username and password. Your account is saved in this browser, so log in with the same browser to get it back.":"Welcome back. Enter your username and password."}</div>
 <input id="un" placeholder="Username" maxlength="16" autocomplete="username" autocapitalize="off" spellcheck="false">
 <input id="pw" type="password" placeholder="Password" maxlength="64" autocomplete="${c?"new-password":"current-password"}">
 ${c?'<input id="pw2" type="password" placeholder="Confirm password" maxlength="64" autocomplete="new-password">':""}
 <div class="msg" id="gm"></div><button class="go" id="mkp">${c?"Create account · start with $100":"Log in"}</button>
 <div class="tm" style="font-size:11px;margin-top:10px">${!c&&!nA?"New here? Choose Create account. ":""}Play money only. No real money.</div></div></div>`;
 setTimeout(()=>{const u=$("#un");if(u)u.focus()},50)};
mkProfile=async function(){if(!localAuth())return;const gm=$("#gm"),btn=$("#mkp"),n=($("#un").value||"").trim(),pw=$("#pw").value||"",lc=n.toLowerCase(),A=accts();
 const say=t=>{gm.textContent=t};
 if(GMODE==="create"){const er=nameErr(n);if(er)return say(er);if(pw.length<6)return say("Use a password with at least 6 characters.");if(pw!==($("#pw2").value||""))return say("The two passwords don't match.");
  if(A[lc])return say("That username is already taken on this device. Choose Log in if it's yours.");
  btn.disabled=true;const salt=crypto.getRandomValues(new Uint8Array(16)),hash=await pwHash(pw,salt);A[lc]={n,salt:B64(salt),hash,t:Date.now()};saveAccts(A);
  const prev=profs()[lc];   /* a username used before passwords existed keeps its bets and balance */
  if(prev){S=prev;norm()}else{S.name=n}S.name=S.name||n;save();$("#gate").innerHTML="";render();toast(prev?"Password set. Welcome back, "+dn(S.name):"Account created. Welcome, "+dn(S.name));return}
 if(Date.now()<ALOCK)return say(`Too many attempts. Try again in ${Math.ceil((ALOCK-Date.now())/1000)} seconds.`);
 if(!n||!pw)return say("Enter your username and password.");
 const a=A[lc];btn.disabled=true;const ok=a?(await pwHash(pw,UNB64(a.salt)))===a.hash:false;btn.disabled=false;
 if(!ok){if(++AFAIL>=5){ALOCK=Date.now()+3e4;AFAIL=0}return say(!a&&profs()[lc]?"This username has no password yet. Choose Create account with the same username to set one (your bets are kept).":"Incorrect username or password.")}
 AFAIL=0;const p=profs()[lc];if(p){S=p;norm()}else{S.name=a.n}save();$("#gate").innerHTML="";render();toast("Welcome back, "+dn(S.name))};
document.addEventListener("click",e=>{const t=e.target&&e.target.closest&&e.target.closest("[data-gmode]");if(!t)return;e.preventDefault();e.stopPropagation();GMODE=t.dataset.gmode;showGate()},true);
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target&&e.target.closest&&e.target.closest("#gate input")){e.preventDefault();mkProfile()}});
/* changing a username elsewhere would orphan its password; on this device names are fixed once an account exists */
const _saveNameA=saveName;saveName=async function(){if(localAuth()&&accts()[(S.name||"").toLowerCase()])return toast("Usernames can't be changed once an account has a password.");return _saveNameA()};
