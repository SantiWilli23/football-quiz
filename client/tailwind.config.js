/** @type {import('tailwindcss').Config} */

// Sistema de temas: los mismos nombres de clase de siempre (bg-bg, bg-panel,
// bg-accent, text-white, bg-blue-500, etc.) pero resueltos en tiempo de
// EJECUCIÓN contra variables CSS, no en tiempo de build contra un hex fijo.
// Así el usuario puede cambiar de tema desde Configuración sin que haga
// falta recompilar nada — ver client/src/index.css (los valores de cada
// tema) y client/src/context/ThemeContext.jsx (cómo se aplican).
//
// Cada variable CSS guarda un triplete RGB sin comas ("R G B"), para que
// Tailwind pueda seguir generando las variantes de opacidad (bg-accent/10,
// bg-red-500/80, etc.) con la función `rgb(var(--x) / <alpha-value>)`.
function withOpacity(variable) {
  return ({ opacityValue }) =>
    opacityValue === undefined ? `rgb(var(${variable}))` : `rgb(var(${variable}) / ${opacityValue})`;
}

// Antes existían clases como blue-400/blue-500/blue-600 que ya apuntaban
// todas al mismo hex (no había una escala real). Se mantiene ese mismo
// comportamiento: las cuatro claves de cada color resuelven a la misma
// variable.
const scale = (variable) => ({
  400: withOpacity(variable),
  500: withOpacity(variable),
  600: withOpacity(variable),
  DEFAULT: withOpacity(variable),
});

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: withOpacity("--c-bg"),
        panel: withOpacity("--c-panel"),
        border: withOpacity("--c-border"),

        // "white" es el color de texto/primer plano del tema, no blanco puro
        // — se llama así porque así nació (ver comentario en index.css) y
        // cambiarle el nombre habría significado tocar cientos de clases.
        // "onaccent" es el texto que va SOBRE un botón bg-accent: oscuro en
        // los temas oscuros, claro en los temas claros.
        white: withOpacity("--c-white"),
        onaccent: withOpacity("--c-onaccent"),

        gray: {
          200: withOpacity("--c-gray-200"),
          300: withOpacity("--c-gray-300"),
          400: withOpacity("--c-gray-400"),
          500: withOpacity("--c-gray-500"),
          600: withOpacity("--c-gray-600"),
          700: withOpacity("--c-gray-700"),
          800: withOpacity("--c-gray-800"),
          900: withOpacity("--c-gray-900"),
        },

        accent: {
          DEFAULT: withOpacity("--c-accent"),
          dark: withOpacity("--c-accent-dark"),
          light: withOpacity("--c-accent-light"),
        },

        blue: scale("--c-blue"),
        purple: scale("--c-purple"),
        emerald: scale("--c-emerald"),
        amber: scale("--c-amber"),
        orange: scale("--c-orange"),
        red: scale("--c-red"),
      },
      borderRadius: {
        // También por variable: el tema Bengala pide esquinas bien redondeadas,
        // los otros dos casi sin redondeo.
        card: "var(--radius-card)",
      },
      fontFamily: {
        sans: ["Archivo", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
