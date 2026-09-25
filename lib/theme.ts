export const THEME_KEY = "decorra-theme";
export type Theme = "light" | "dark";

// Inlined as a blocking <script> at the top of <body> (see app/layout.tsx) so the
// right theme is applied before first paint — no flash of the wrong theme on load.
export const THEME_INIT_SCRIPT = `(function(){try{
  var t = localStorage.getItem("${THEME_KEY}");
  if (t !== "light" && t !== "dark") t = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
}catch(e){}})();`;

export function getTheme(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "light" ? "light" : "dark";
}

export function setTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Private browsing / storage disabled: theme still applies for this load.
  }
}
