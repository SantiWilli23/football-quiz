import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Se sirve como página estática dentro de la app principal, en /goltexto/
  // (ver client/public/goltexto/ y la tarjeta en Dashboard "Juegos").
  base: "/goltexto/",
});
