const LOOK_KEY = "leximon.look";

/**
 * Runs before the first paint, so that a page never shows in the wrong look. « La Bibliothèque »
 * stays behind `?look=bibliotheque`, which this browser remembers until `?look=actuel`.
 */
export const LOOK_SCRIPT = `(function(){try{
var asked=new URLSearchParams(location.search).get("look");
if(asked==="bibliotheque")localStorage.setItem("${LOOK_KEY}","bibliotheque");
if(asked==="actuel")localStorage.removeItem("${LOOK_KEY}");
if(localStorage.getItem("${LOOK_KEY}")==="bibliotheque")document.documentElement.dataset.look="bibliotheque";
}catch(e){}})()`;

export function isLibraryLook(): boolean {
  return document.documentElement.dataset.look === "bibliotheque";
}
