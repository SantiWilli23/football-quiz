/** @type {import('tailwindcss').Config} */

// Tema "Pizarra". Además de los tokens propios (bg, panel, border, accent), acá
// se redefinen las paletas de Tailwind que la app ya venía usando como
// semánticas: blue para "¿Quién es más?", purple para el modo especial, orange
// para la racha, red para los errores. En vez de cambiar esas clases en veinte
// archivos, se cambia qué significan: cada una pasa a ser la tiza equivalente.
// Si alguna vez se vuelve a un tema de pantalla, se revierte este bloque y
// listo — no hay que tocar los componentes.
const chalk = {
  board: "#10231b",
  boardLight: "#14291f",
  line: "#2f5243",
  white: "#dff0e6",
  yellow: "#f2c14e",
  blue: "#8fc4e8",
  green: "#a3dda8",
  pink: "#e8a8d8",
  red: "#f0907e",
  orange: "#f2a65a",
};

// Una tiza con sus variantes de opacidad ya resueltas, para que clases como
// `bg-red-500/10` sigan funcionando igual que antes.
const scale = (hex) => ({
  400: hex,
  500: hex,
  600: hex,
  DEFAULT: hex,
});

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: chalk.board,
        panel: chalk.boardLight,
        border: chalk.line,

        // El blanco puro quema sobre verde oscuro: el "blanco" del tema es tiza.
        // Y el negro es el propio pizarrón, para el texto sobre botones amarillos.
        white: chalk.white,
        black: chalk.board,

        // Los grises de Tailwind son fríos y desentonan con el verde; se
        // reemplazan por tiza cada vez más gastada.
        gray: {
          // El 200 es el borde por defecto de Tailwind: hoy nadie lo dibuja con
          // ancho, pero si alguien agrega un borde sin clase de color, que
          // herede tiza y no un gris claro que rompería el pizarrón.
          200: "#2f5243",
          300: "#c5dcd0",
          400: "#a8c9b6",
          500: "#7fa691",
          600: "#5d8471",
          700: "#456354",
          800: "#2f5243",
          900: "#1b3a2c",
        },

        accent: {
          DEFAULT: chalk.yellow,
          dark: "#d9a832",
          light: "#f7d47e",
        },

        blue: scale(chalk.blue),
        purple: scale(chalk.pink),
        emerald: scale(chalk.green),
        amber: scale(chalk.yellow),
        orange: scale(chalk.orange),
        red: scale(chalk.red),
      },
      borderRadius: {
        // Casi sin redondeo: en un pizarrón las cosas se marcan con regla.
        card: "4px",
      },
      fontFamily: {
        sans: ["Archivo", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
