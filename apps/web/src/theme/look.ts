import { parseThemeChoice, resolveTheme, type ThemeChoice } from "@leximon/view-model";

const THEME_KEY = "leximon.theme";
const LOOK_KEY = "leximon.look";

/**
 * Runs before the first paint, so that a page never shows in the wrong look or theme. « Le Livre »
 * stays behind `?look=livre`, which this browser remembers until `?look=planche`.
 */
export const LOOK_SCRIPT = `(function(){try{
var root=document.documentElement,dark=matchMedia("(prefers-color-scheme: dark)");
var asked=new URLSearchParams(location.search).get("look");
if(asked==="livre")localStorage.setItem("${LOOK_KEY}","livre");
if(asked==="planche")localStorage.removeItem("${LOOK_KEY}");
if(localStorage.getItem("${LOOK_KEY}")==="livre")root.dataset.look="livre";
function apply(){var c=localStorage.getItem("${THEME_KEY}");root.dataset.theme=c==="light"||c==="dark"?c:dark.matches?"dark":"light"}
apply();dark.addEventListener("change",apply)
}catch(e){}})()`;

export function showsThemeChoice(): boolean {
  return document.documentElement.dataset.look === "livre";
}

export function readThemeChoice(): ThemeChoice {
  try {
    return parseThemeChoice(window.localStorage.getItem(THEME_KEY));
  } catch {
    return "device";
  }
}

export function writeThemeChoice(choice: ThemeChoice): void {
  try {
    window.localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Not remembered for the next visit; the choice still applies to this one.
  }
  const deviceIsDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = resolveTheme(choice, deviceIsDark);
}
