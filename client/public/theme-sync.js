// Sincroniza los juegos standalone de Cotrero con el tema elegido en
// Configuración (Nocturno / Azul clásico / Bengala) — mismo storage key y
// mismos valores que usa el resto de la app (ver client/src/index.css y
// client/src/context/ThemeContext.jsx). No depende de Tailwind ni de React:
// solo pisa las variables CSS que cada página ya declara en su propio
// :root, así no hace falta tocar ningún selector existente.
//
// Cada página que lo use debe declarar, ANTES de este script, cuál de los
// dos esquemas de nombres de variables tiene:
//   window.__COTRERO_THEME_SCHEME = "especialista"  → client/public/cotrero/
//   (cualquier otro valor, o nada)                   → cotrero.html / cotrero-medio.html
(function () {
  var THEME_KEY = "fq_theme";
  var scheme = window.__COTRERO_THEME_SCHEME || "simple";

  // Mismos valores que client/src/index.css, pasados de rgb(a b c) a hex/rgba
  // (acá no hay Tailwind que arme el rgb(var(--x) / alpha) por nosotros).
  var PALETTES = {
    nocturno: {
      bg: "#0E1317", panel: "#161D23", panelHi: "#1E272E",
      text: "#E9EFF1", textMuted: "#A8B4BB", textDim: "#61727D",
      accent: "#2FB673", accentDark: "#1E6E49", accentLight: "#6FD9A8",
      blue: "#4FB3E8", gold: "#F0A93E", goldDark: "#8A6423",
      good: "#2FB673", bad: "#E0664F",
    },
    azul: {
      bg: "#262B35", panel: "#2B3444", panelHi: "#354254",
      text: "#F2F2F0", textMuted: "#A8A9AC", textDim: "#6F7074",
      accent: "#3B9DD6", accentDark: "#215E82", accentLight: "#7CC4EA",
      blue: "#3B9DD6", gold: "#D9A441", goldDark: "#8A6423",
      good: "#3FAE9A", bad: "#F0907E",
    },
    "cancha-noche": {
      bg: "#091C13", panel: "#0F281B", panelHi: "#143222",
      text: "#EEF5EC", textMuted: "#A8C4B2", textDim: "#769682",
      accent: "#E8DD8A", accentDark: "#BAAE5C", accentLight: "#F4ECB0",
      blue: "#6EBEE6", gold: "#E8DD8A", goldDark: "#7d7433",
      good: "#4AC880", bad: "#E86C56",
    },
    bengala: {
      bg: "#F6F6F8", panel: "#FFFFFF", panelHi: "#FFFFFF",
      text: "#0F1115", textMuted: "#5A616E", textDim: "#ABB1BC",
      accent: "#FF4D17", accentDark: "#CC3D12", accentLight: "#FF8A5E",
      blue: "#3B82F6", gold: "#F0B429", goldDark: "#CC3D12",
      good: "#00B37A", bad: "#E5484D",
    },
  };

  function readTheme() {
    try {
      var t = localStorage.getItem(THEME_KEY);
      return PALETTES[t] ? t : "nocturno";
    } catch (e) {
      return "nocturno";
    }
  }

  function hexToRgba(hex, alpha) {
    var h = hex.replace("#", "");
    var r = parseInt(h.substring(0, 2), 16);
    var g = parseInt(h.substring(2, 4), 16);
    var b = parseInt(h.substring(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function apply() {
    var p = PALETTES[readTheme()];
    var root = document.documentElement.style;

    if (scheme === "especialista") {
      // El acento de Cotrero sigue el tema elegido (antes era un dorado propio).
      root.setProperty("--gold", p.accent);
      root.setProperty("--gold-light", p.accentLight);
      root.setProperty("--gold-dim", p.accentDark);
      root.setProperty("--gold-subtle", hexToRgba(p.accent, 0.12));
      root.setProperty("--gold-border", hexToRgba(p.accent, 0.28));
      root.setProperty("--black", p.bg);
      root.setProperty("--surface", p.panel);
      root.setProperty("--surface-2", p.panelHi);
      root.setProperty("--surface-3", hexToRgba(p.text, 0.06));
      root.setProperty("--border", hexToRgba(p.text, 0.12));
      root.setProperty("--text", p.text);
      root.setProperty("--text-muted", p.textMuted);
      root.setProperty("--text-dim", p.textDim);
      root.setProperty("--success", p.good);
      root.setProperty("--danger", p.bad);
      root.setProperty("--rare", p.blue);
    } else {
      root.setProperty("--bg", p.bg);
      root.setProperty("--panel", p.panel);
      root.setProperty("--border", hexToRgba(p.text, 0.12));
      root.setProperty("--panel-border", hexToRgba(p.text, 0.12));
      root.setProperty("--text-faint", p.textDim);
      // Superposiciones translúcidas (fondos de tarjetas, líneas de la cancha):
      // blanco sobre fondo oscuro, negro sobre el tema claro.
      root.setProperty("--ov", readTheme() === "bengala" ? "15,17,21" : "255,255,255");
      root.setProperty("--accent", p.accent);
      root.setProperty("--accent2", p.accentLight);
      root.setProperty("--accent-dark", p.accentDark);
      root.setProperty("--accent-bg", hexToRgba(p.accent, 0.16));
      root.setProperty("--teal", p.good);
      root.setProperty("--teal2", p.accentLight);
      root.setProperty("--teal-dark", p.accentDark);
      root.setProperty("--teal-bg", hexToRgba(p.good, 0.16));
      root.setProperty("--gold", p.gold);
      root.setProperty("--gold2", p.accentLight);
      root.setProperty("--gold-dark", p.goldDark);
      root.setProperty("--gold-dim", p.goldDark);
      root.setProperty("--gold-bg", hexToRgba(p.gold, 0.16));
      root.setProperty("--text", p.text);
      root.setProperty("--text-dim", p.textMuted);
      root.setProperty("--text-dim2", p.textDim);
      root.setProperty("--good", p.good);
      root.setProperty("--bad", p.bad);
    }

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", p.bg);
  }

  apply();
  // Si Configuración está abierta en otra pestaña y cambian el tema ahí,
  // esta pestaña se actualiza sola sin necesidad de recargar.
  window.addEventListener("storage", function (e) {
    if (!e.key || e.key === THEME_KEY) apply();
  });
})();
