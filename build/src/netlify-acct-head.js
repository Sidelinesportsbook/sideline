/* Public site: accounts with a username + password (Firebase Authentication) and each account's data in Cloud Firestore,
   so the same account opens on any phone or computer. Firebase stores only a salted, hashed password, throttles repeated
   wrong guesses and keeps people signed in securely. The username becomes a private sign-in id (<name>@players.sideline),
   lower-cased, so Player123 and player123 are the same account.
   The app already saves through a small window.claude.use("db"|"user") surface (the Claude version's storage); this file
   provides that surface over Firestore: the app's "data/users/<id>/state" document is users/<firebase uid>, readable and
   writable only by that signed-in account (see firestore.rules). */
window.SL_CLOUD=1;
(()=>{const cfg=window.FIREBASE_CONFIG;if(!cfg||!window.firebase){window.SL_CLOUD=0;return}firebase.initializeApp(cfg);
 const auth=firebase.auth(),fs=firebase.firestore();window.SL_AUTH=auth;window.SL_FS=fs;
 const ready=new Promise(r=>{const un=auth.onAuthStateChanged(u=>{un();r(u)})});
 const map=p=>{const m=/^data\/users\/[^/]+\/state$/.test(p);return m?fs.doc("users/"+auth.currentUser.uid):fs.doc(p)};
 const db={doc:p=>{const d=map(p);return{get:()=>d.get(),set:o=>d.set(o),onSnapshot:(a,b)=>d.onSnapshot(a,b||(()=>{}))}},collection:p=>fs.collection(p)};
 window.claude={use:async name=>{const u=await ready;if(!u)return null;if(name==="db")return db;
  if(name==="user")return{id:async()=>u.uid,me:async()=>({id:u.uid}),isOwner:()=>false,canEdit:async()=>false};return null}}})();
