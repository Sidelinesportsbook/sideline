/* ---------- stable screens: the page stays where you are ----------
   The cause of the jumps: every section (games, market tabs, bets, slip, profile, past games, leaderboard, player and team
   sheets) was redrawn by replacing all of its HTML, on every tap and on every live update. That destroyed every element in it,
   so horizontal tab strips snapped back to their first tab ("Main"), inner scroll boxes went back to the top, open sections
   closed, and the browser lost its place on the page. Going back from a game also always jumped to the top.
   Now the same sections are updated in place: the new HTML is compared with what's on screen and only what changed is
   touched (morph), so the elements you're looking at, their scroll positions, open/closed state and focus all survive,
   and the browser's own scroll anchoring keeps the item in view when content above it grows or shrinks.
   A section is rebuilt from scratch only when you move to a different screen (another page, game, player or team).
   Each screen also remembers how far down you were, so Back and the page menus return you there. */
const NAT_HTML=Object.getOwnPropertyDescriptor(Element.prototype,"innerHTML");
const fc=n=>(n.getAttribute("class")||"").split(" ")[0];
const sameNode=(a,b)=>a.nodeType===b.nodeType&&(a.nodeType!==1||(a.tagName===b.tagName&&a.id===b.id&&fc(a)===fc(b)&&(a.dataset.open||"")===(b.dataset.open||"")&&(a.dataset.lbu||"")===(b.dataset.lbu||"")));
function morphNode(a,b){if(a.nodeType!==1){if(a.nodeValue!==b.nodeValue)a.nodeValue=b.nodeValue;return}
 for(const at of [...a.attributes])if(!b.hasAttribute(at.name)&&!(at.name==="open"&&a.tagName==="DETAILS"))a.removeAttribute(at.name);   /* an open section stays open */
 for(const at of b.attributes)if(a.getAttribute(at.name)!==at.value)a.setAttribute(at.name,at.value);
 const t=a.tagName;
 if(t==="INPUT"){if(a!==document.activeElement){const v=b.getAttribute("value")||"";if(a.value!==v&&a.type!=="checkbox"&&a.type!=="radio")a.value=v}a.checked=b.hasAttribute("checked");return}
 if(t==="TEXTAREA"){if(a!==document.activeElement&&a.value!==b.textContent)a.value=b.textContent;return}
 morphKids(a,b);
 if(t==="SELECT"){const o=[...b.options].find(x=>x.hasAttribute("selected"))||b.options[0];if(o&&a.value!==o.value)a.value=o.value}}
/* children are paired in order; an extra element another feature inserted after the last update (a note, a label) is
   skipped over by looking a few nodes ahead for an exact match, so everything after it still pairs with itself */
const exact=(a,b)=>sameNode(a,b)&&(a.nodeType!==1||(a.getAttribute("class")||"")===(b.getAttribute("class")||""));
function morphKids(a,b){let x=a.firstChild,y=b.firstChild;
 while(y){const ny=y.nextSibling;let m=null;
  if(x&&!exact(x,y)){let z=x.nextSibling;for(let i=0;z&&i<6;i++,z=z.nextSibling)if(exact(z,y)){m=z;break}}
  if(m){while(x!==m){const nx=x.nextSibling;a.removeChild(x);x=nx}}
  if(x&&sameNode(x,y)){morphNode(x,y);x=x.nextSibling}else a.insertBefore(y,x);y=ny}
 while(x){const nx=x.nextSibling;a.removeChild(x);x=nx}}
/* sections updated in place, each with the screen it belongs to (a different screen = a fresh start) */
const STABLE={games:()=>pg+"|"+(view||""),tabs:()=>pg,slip:()=>"",bets:()=>"",pf:()=>"",pl:()=>"",past:()=>"",lb:()=>"",
 psw:()=>typeof SHEET!=="undefined"&&SHEET?SHEET.kind+"|"+SHEET.n:"",lbp:()=>LB.open||""};
function stableAll(){Object.keys(STABLE).forEach(id=>{const el=document.getElementById(id);if(!el||el.__st)return;el.__st=1;
 Object.defineProperty(el,"innerHTML",{configurable:true,get(){return NAT_HTML.get.call(this)},set(h){const k=STABLE[id]();
  if(this.__k!==k||!h||!this.firstChild){this.__k=k;NAT_HTML.set.call(this,h);return}
  const tp=document.createElement("template");NAT_HTML.set.call(tp,h);morphKids(this,tp.content)}})})}
stableAll();const _renderNav=render;render=function(m){stableAll();_renderNav(m);stableAll()};
/* how far down each screen was, so returning to it puts you back there */
const SCROLLMEM={},navKey=()=>pg+"|"+(view||"");
addEventListener("scroll",()=>{SCROLLMEM[navKey()]=scrollY},{passive:true});
/* also the moment anything is tapped, before any handler changes the screen (window capture runs before every other listener) */
["pointerdown","click"].forEach(ev=>window.addEventListener(ev,()=>{SCROLLMEM[navKey()]=scrollY},true));
function navRestore(top){scrollTo(0,top?0:SCROLLMEM[navKey()]||0)}
