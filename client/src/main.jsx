import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { GroupProvider } from "./context/GroupContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import "./index.css";

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
            <App />
          </GroupProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
