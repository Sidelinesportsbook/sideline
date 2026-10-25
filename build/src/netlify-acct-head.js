/* Netlify build: accounts by username + 4-digit PIN, stored in Cloud Firestore (no Google or Claude sign-in for players).
   The account key is a SHA-256 of "username:pin", so the PIN is never stored; the page reaches Firestore through the same
   small window.claude.use("db"|"user") surface the rest of the app already uses. */
window.SL_NETLIFY=1;
(()=>{const cfg=window.FIREBASE_CONFIG;if(!cfg||!window.firebase)return;firebase.initializeApp(cfg);const fs=firebase.firestore();window.SL_FS=fs;
 let key=null;try{key=localStorage.getItem("sl_key")}catch(e){}
 /* map the app's "data/users/<id>/state" document onto accounts/<key>; everything else passes straight through */
 const db={doc:p=>/^data\/users\/[^/]+\/state$/.test(p)?fs.doc("accounts/"+key):fs.doc(p),collection:p=>fs.collection(p)};
 window.claude={use:async name=>{if(!key)return null;if(name==="db")return db;if(name==="user")return{id:async()=>key,me:async()=>({id:key}),isOwner:()=>false,canEdit:async()=>false};return null}}})();
