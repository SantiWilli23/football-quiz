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
const THEME_KEY = "fq_theme";

// La forma es un eje aparte del color: "redondeada" es el estilo de
// siempre (border-radius normal); "cancha" corta la esquina de tarjetas,
// filas y botones en vez de redondearla — se combina con cualquiera de
// los tres temas de color de arriba.
export const SHAPES = [
  { id: "redondeada", label: "Redondeada" },
  { id: "cancha", label: "Cancha (esquina cortada)" },
];
const SHAPE_IDS = SHAPES.map((s) => s.id);
const DEFAULT_SHAPE = "redondeada";
const SHAPE_KEY = "fq_shape";

// Mismos helpers que usa el script inline de index.html para no repintar
// con la elección equivocada un instante antes de que React monte.
export function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return THEME_IDS.includes(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function readStoredShape() {
  try {
    const stored = localStorage.getItem(SHAPE_KEY);
    return SHAPE_IDS.includes(stored) ? stored : DEFAULT_SHAPE;
  } catch {
    return DEFAULT_SHAPE;
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

function applyShape(shapeId) {
  document.documentElement.setAttribute("data-shape", shapeId);
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme);
  const [shape, setShapeState] = useState(readStoredShape);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Sin localStorage (privado/incógnito) el tema simplemente no persiste.
    }
  }, [theme]);

  useEffect(() => {
    applyShape(shape);
    try {
      localStorage.setItem(SHAPE_KEY, shape);
    } catch {
      // Idem.
    }
  }, [shape]);

  function setTheme(themeId) {
    if (THEME_IDS.includes(themeId)) setThemeState(themeId);
  }

  function setShape(shapeId) {
    if (SHAPE_IDS.includes(shapeId)) setShapeState(shapeId);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES, shape, setShape, shapes: SHAPES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de ThemeProvider");
  return ctx;
}
