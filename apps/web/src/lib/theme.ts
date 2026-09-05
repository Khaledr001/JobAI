export const THEME_STORAGE_KEY = "jobhunter.theme";

export type Theme = "light" | "dark" | "system";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * Applies a theme by setting `data-theme` on <html>; `globals.css` keys the
 * whole token palette off that attribute. "system" *removes* it rather than
 * writing "system" -- the CSS default is `prefers-color-scheme`, so absence
 * is what "follow the OS" means, and it stays correct when the OS setting
 * changes while the page is open.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = theme;
  }
}

/**
 * Runs before first paint (injected into <head>) so an explicitly chosen
 * theme is applied before the browser paints -- without this, a dark-mode
 * user who picked "light" gets a dark flash on every navigation.
 * Deliberately tiny, dependency-free, and failure-tolerant: private-mode
 * localStorage throws, and a broken theme must never break the page.
 */
export const THEME_INIT_SCRIPT = `
try {
  var t = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch (e) {}
`.trim();
