/** @type {import('tailwindcss').Config} */

// Misma paleta que el resto de Futotal (ver client/tailwind.config.js), para
// que Fichado se sienta parte de la misma app y no un proyecto aparte.
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#262b35",
        panel: "#2b3444",
        border: "#45474c",
        white: "#f2f2f0",
        black: "#262b35",
        gray: {
          200: "#45474c",
          300: "#c9cacc",
          400: "#a8a9ac",
          500: "#8a8b8e",
          600: "#6f7074",
          700: "#57585c",
          800: "#45474c",
          900: "#1e2023",
        },
        accent: {
          DEFAULT: "#3b9dd6",
          dark: "#215e82",
          light: "#7cc4ea",
        },
      },
      borderRadius: {
        card: "4px",
      },
      fontFamily: {
        sans: ["Archivo", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
