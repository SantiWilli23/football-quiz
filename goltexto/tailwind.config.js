/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    // Paleta reducida a blanco/negro/grises a propósito: nada de colores de
    // acento en toda la app (ver README). Sobrescribe la paleta default de
    // Tailwind para que sea imposible usar "bg-red-500" etc. por error.
    colors: {
      transparent: "transparent",
      current: "currentColor",
      white: "#ffffff",
      black: "#0a0a0a",
      gray: {
        50: "#fafafa",
        100: "#f2f2f2",
        200: "#e2e2e2",
        300: "#cbcbcb",
        400: "#a3a3a3",
        500: "#787878",
        600: "#565656",
        700: "#3d3d3d",
        800: "#262626",
        900: "#171717",
      },
    },
    extend: {
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
