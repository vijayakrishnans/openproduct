// Light, dark, or follow the device (builder-profiles dark mode, OP-23).
// The choice lives in a plain cookie so the inline script in <head> can
// apply it before the first paint (Next's "preventing flash" pattern).

export const THEME_COOKIE = "op_theme";
export const THEMES = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof THEMES)[number];

/**
 * Runs in <head> before anything paints: read the cookie, resolve "system"
 * through matchMedia, and set data-theme on <html> to "light" or "dark".
 */
export const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark|system)/);var c=m?m[1]:"system";var d=c==="dark"||(c==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light");document.documentElement.setAttribute("data-theme-choice",c)}catch(e){}})()`;

export function nextTheme(current: ThemeChoice): ThemeChoice {
  return THEMES[(THEMES.indexOf(current) + 1) % THEMES.length]!;
}
