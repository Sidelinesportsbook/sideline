/* Netlify build: username + PIN sign-up / log-in screen (runs after the app script, replacing its username screen) */
(()=>{if(!window.SL_FS)return;const fs=window.SL_FS;
 const sha=async s=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,"0")).join("");
 claimName=async()=>"";
 showGate=function(){if(S.name&&DB){$("#gate").innerHTML="";return}if(!booted)return;
  $("#gate").innerHTML=`<div class="mod gate"><div class="mc"><div class="logo" style="justify-content:center">Sideline</div><h2 style="margin-top:14px">Play with your username</h2><div class="tm gsub">New here? Pick a username and a 4-digit PIN. Already playing? Enter the same ones to load your account on this device.</div><input id="un" placeholder="Username" maxlength="16" autocomplete="username"><input id="upin" placeholder="4-digit PIN" maxlength="4" inputmode="numeric" type="password" autocomplete="current-password" style="width:100%;margin:4px 0;text-align:center"><div class="msg" id="gm"></div><button class="go" id="mkp">Continue</button><div class="tm" style="font-size:11px;margin-top:10px">Play money only. No real money. Keep your PIN private: anyone with your username and PIN can open your account.</div></div></div>`};
 mkProfile=async function(){const n=($("#un").value||"").trim(),pin=($("#upin").value||"").trim(),m=$("#gm"),b=$("#mkp");const er=nameErr(n);if(er){m.textContent=er;return}if(!/^\d{4}$/.test(pin)){m.textContent="Your PIN must be exactly 4 digits.";return}
  b.disabled=true;m.textContent="Checking…";const lc=n.toLowerCase(),key=await sha(lc+":"+pin);
  try{const nm=await fs.doc("names/"+lc).get(),acc=await fs.doc("accounts/"+key).get();
   if(nm.exists&&!acc.exists){b.disabled=false;m.textContent="That username is taken, or the PIN is wrong. Check your PIN, or choose a different username.";return}
   if(!nm.exists){await fs.doc("names/"+lc).set({t:Date.now()});const st=JSON.parse(JSON.stringify(S));st.name=n;st.joined=st.joined||Date.now();await fs.doc("accounts/"+key).set(st)}
   try{localStorage.setItem("sl_key",key);localStorage.removeItem("sl2")}catch(e){}location.reload()}
  catch(e){b.disabled=false;m.textContent="Couldn't reach the account server. Check your connection and try again."}};
 if(booted)showGate()})();
