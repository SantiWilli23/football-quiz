import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { GroupProvider } from "./context/GroupContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import { applyStoredDensity } from "./utils/density.js";
import "./index.css";
import { polyfillCountryFlagEmojis } from "country-flag-emoji-polyfill";
import flagFontUrl from "country-flag-emoji-polyfill/dist/TwemojiCountryFlags.woff2?url";

applyStoredDensity();

// Windows no trae banderas emoji (muestra "AR", "NL"...): si el navegador no
// las dibuja, se carga una fuente solo con banderas (servida desde la app).
polyfillCountryFlagEmojis("Twemoji Country Flags", flagFontUrl);

// Registrar el service worker de una vez (no solo cuando el usuario activa
// push, como era antes) para que la PWA sea instalable y funcione el modo
// offline básico desde la primera visita.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* si falla, la app sigue funcionando normal sin PWA */
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <GroupProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </GroupProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
