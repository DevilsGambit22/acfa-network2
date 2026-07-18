export const THEME_PRESETS = {
  "chess-classic": { name: "Chess Classic", primaryColor: "#81b64c", accentColor: "#b8df78" },
  "gold-black": { name: "Gold & Black", primaryColor: "#d6a84b", accentColor: "#f0d18a" },
  "blue-white": { name: "Blue & White", primaryColor: "#3b82f6", accentColor: "#bfdbfe" },
  "crimson-black": { name: "Crimson & Black", primaryColor: "#dc2626", accentColor: "#fca5a5" },
  emerald: { name: "Emerald", primaryColor: "#10b981", accentColor: "#a7f3d0" },
  purple: { name: "Royal Purple", primaryColor: "#8b5cf6", accentColor: "#ddd6fe" },
  ocean: { name: "Ocean", primaryColor: "#0891b2", accentColor: "#a5f3fc" },
  sunset: { name: "Sunset", primaryColor: "#f97316", accentColor: "#fed7aa" }
};

function normalizeHex(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : fallback;
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return `${parseInt(clean.slice(0,2),16)}, ${parseInt(clean.slice(2,4),16)}, ${parseInt(clean.slice(4,6),16)}`;
}

export function applyTheme(settings = {}) {
  const primary = normalizeHex(settings.primaryColor, "#81b64c");
  const accent = normalizeHex(settings.accentColor, "#b8df78");
  const root = document.documentElement;
  root.style.setProperty("--theme-primary", primary);
  root.style.setProperty("--theme-accent", accent);
  root.style.setProperty("--theme-primary-rgb", hexToRgb(primary));
  root.style.setProperty("--theme-accent-rgb", hexToRgb(accent));
  document.body.dataset.themePreset = settings.themePreset || "custom";
}

export async function loadAndApplyTheme() {
  const result = await chrome.storage.local.get("settings");
  applyTheme(result.settings || {});
}
