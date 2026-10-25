/* Netlify build only: real Google sign-in through Firebase Authentication, accounts and usernames in Cloud Firestore.
   Gives the page the same small `window.claude.use("db"|"user")` surface it already uses, so the rest of the app is unchanged. */
(()=>{const cfg=window.FIREBASE_CONFIG;if(!cfg||!window.firebase)return;
 firebase.initializeApp(cfg);const auth=firebase.auth(),fs=firebase.firestore();
 const ready=new Promise(r=>{const un=auth.onAuthStateChanged(u=>{un();r(u)})});
 window.claude={use:async name=>{const u=await ready;if(!u)return null;
  if(name==="db")return fs;
  if(name==="user")return{id:async()=>u.uid,me:async()=>({id:u.uid}),isOwner:()=>false,canEdit:async()=>false};return null}};
 const signIn=async()=>{try{await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());location.reload()}catch(e){const m=document.querySelector("#gm")||document.querySelector("#pso .tm");if(m)m.textContent=e&&e.code==="auth/popup-closed-by-user"?"Sign-in was cancelled.":"Google sign-in didn't work. Try again, or continue with a username."}};
 /* every Google button and "Log in" opens Google's own sign-in popup instead of a link */
 document.addEventListener("click",e=>{const b=e.target&&e.target.closest&&e.target.closest(".gbtn:not(.alt)");if(!b)return;e.preventDefault();e.stopImmediatePropagation();signIn()},true);
 window.SIDELINE_SIGNOUT=()=>auth.signOut().then(()=>location.reload())})();
