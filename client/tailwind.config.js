/** @type {import('tailwindcss').Config} */

// Tema "Paleta unificada": el mismo esquema de color en toda la app —
// Futotal, Draft Europeo 8a2 y Cotrero — en vez de que cada uno tenga su
// propia identidad. Fondo gris azulado oscuro con tres acentos: azul
// (marca/CTA principal, antes lo llevaba el amarillo), verde azulado
// (secundario) y dorado (valores especiales: puntajes, rachas, ratings).
// Reemplaza al tema "Pizarra" (verde pizarrón + amarillo).
//
// Los nombres de las claves (yellow/blue/green/pink/red/orange) se
// mantienen aunque el color de fondo haya cambiado, para no tener que tocar
// las ~20 referencias a chalk.* / CHALK.* ya esparcidas por la app — sólo
// cambia qué significan.
const chalk = {
  board: "#2a2c30",
  boardLight: "#34363b",
  line: "#45474c",
  white: "#f2f2f0",
  yellow: "#d9a441",
  blue: "#3b9dd6",
  green: "#3fae9a",
  pink: "#f0c674",
  red: "#f0907e",
  orange: "#8a6423",
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

        // Grises neutros (con un toque frío, no verdes) para lo que caiga
        // fuera de la paleta con nombre.
        gray: {
          // El 200 es el borde por defecto de Tailwind: hoy nadie lo dibuja con
          // ancho, pero si alguien agrega un borde sin clase de color, que
          // herede el borde del tema y no un gris claro que rompería el fondo.
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
          DEFAULT: chalk.blue,
          dark: "#215e82",
          light: "#7cc4ea",
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
