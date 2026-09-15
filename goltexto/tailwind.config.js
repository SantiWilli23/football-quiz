/** @type {import('tailwindcss').Config} */

// Mismo sistema de temas que el resto de Futotal (ver client/tailwind.config.js
// y client/src/index.css): los colores se resuelven en tiempo de EJECUCIÓN
// contra variables CSS, no quedan fijos en el build — así el tema elegido en
// Configuración (Nocturno/Azul/Bengala) también cambia Fichado.
function withOpacity(variable) {
  return ({ opacityValue }) =>
    opacityValue === undefined ? `rgb(var(${variable}))` : `rgb(var(${variable}) / ${opacityValue})`;
}

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: withOpacity("--c-bg"),
        panel: withOpacity("--c-panel"),
        border: withOpacity("--c-border"),
        white: withOpacity("--c-white"),
        black: withOpacity("--c-onaccent"),
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
      },
      borderRadius: {
        card: "var(--radius-card)",
      },
      fontFamily: {
        sans: ["Archivo", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
