import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Se sirve como página estática dentro de la app principal, en /fichado/
  // (ver client/public/fichado/ y la tarjeta en Fútbol → Juegos). El juego
  // se llama "Fichado" de cara al usuario; el proyecto sigue viviendo en
  // la carpeta goltexto/ (nombre de trabajo original).
  base: "/fichado/",
});
