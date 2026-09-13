import { createContext, useContext, useEffect, useState } from "react";

// Nocturno es el tema por default para usuarios nuevos (y para cualquiera
// que todavía no haya guardado una preferencia). Azul es la paleta que ya
// tenía la app. Bengala es la opción clara.
export const THEMES = [
  { id: "nocturno", label: "Nocturno", swatch: ["#0E1317", "#2FB673", "#F0A93E"] },
  { id: "azul", label: "Azul clásico", swatch: ["#262b35", "#3b9dd6", "#d9a441"] },
  { id: "bengala", label: "Bengala", swatch: ["#F6F6F8", "#FF4D17", "#00B37A"] },
];
const THEME_IDS = THEMES.map((t) => t.id);
const DEFAULT_THEME = "nocturno";
const STORAGE_KEY = "fq_theme";

// Mismo helper que usa el script inline de index.html para no repintar con
// el tema equivocado un instante antes de que React monte.
export function readStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return THEME_IDS.includes(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function applyTheme(themeId) {
  document.documentElement.setAttribute("data-theme", themeId);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const color = getComputedStyle(document.documentElement).getPropertyValue("--theme-color").trim();
    if (color) meta.setAttribute("content", color);
  }
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Sin localStorage (privado/incógnito) el tema simplemente no persiste.
    }
  }, [theme]);

  function setTheme(themeId) {
    if (THEME_IDS.includes(themeId)) setThemeState(themeId);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de ThemeProvider");
  return ctx;
}
