import { useRef } from "react";
import { Download } from "lucide-react";

// Genera la tarjeta como SVG (nada de libs externas) y la exporta a PNG
// dibujándola en un <canvas> — funciona en cualquier navegador moderno sin
// agregar dependencias nuevas al proyecto.
//
// Carta vertical estilo "carta de jugador" (como las de Cartas.jsx) en vez de
// un banner horizontal: iniciales dentro de un círculo, cifras grandes abajo.
const W = 360;
const H = 500;

function cardSvg({ username, groupLabel, points, accuracy, streak, position }) {
  const posLine = position ? `#${position} en ${groupLabel}` : "Sin grupo activo";
  const initials = username.slice(0, 2).toUpperCase();
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#e8dd8a"/>
      <stop offset="55%" stop-color="#3fae9a"/>
      <stop offset="100%" stop-color="#123a30"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" rx="22" fill="url(#bg)"/>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="21" fill="none" stroke="#0f2f28" stroke-opacity="0.5" stroke-width="2"/>

  <text x="28" y="46" font-family="Arial, sans-serif" font-size="13" letter-spacing="3" fill="#0f2f28" font-weight="800">FUTOTAL</text>

  <circle cx="${W / 2}" cy="150" r="62" fill="#0f2f28" fill-opacity="0.85"/>
  <text x="${W / 2}" y="166" text-anchor="middle" font-family="Arial, sans-serif" font-size="46" fill="#e8dd8a" font-weight="800">${escapeXml(initials)}</text>

  <text x="${W / 2}" y="252" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#0f2f28" font-weight="800">${escapeXml(username)}</text>
  <text x="${W / 2}" y="276" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" fill="#0f2f28" fill-opacity="0.75">${escapeXml(posLine)}</text>

  <rect x="22" y="320" width="${W - 44}" height="1" fill="#0f2f28" fill-opacity="0.25"/>

  <g font-family="Arial, sans-serif" text-anchor="middle">
    <text x="${W * 0.22}" y="392" font-size="34" fill="#0f2f28" font-weight="800">${points}</text>
    <text x="${W * 0.22}" y="412" font-size="11" fill="#0f2f28" fill-opacity="0.7">puntos</text>

    <text x="${W * 0.5}" y="392" font-size="34" fill="#0f2f28" font-weight="800">${accuracy}%</text>
    <text x="${W * 0.5}" y="412" font-size="11" fill="#0f2f28" fill-opacity="0.7">aciertos</text>

    <text x="${W * 0.78}" y="392" font-size="34" fill="#0f2f28" font-weight="800">${streak}</text>
    <text x="${W * 0.78}" y="412" font-size="11" fill="#0f2f28" fill-opacity="0.7">racha</text>
  </g>

  <text x="${W / 2}" y="470" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#0f2f28" fill-opacity="0.6">futotal.app</text>
</svg>`.trim();
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
}

export default function PlayerCard({ user, stats, activeGroup, position }) {
  const svgRef = useRef(null);

  const svgMarkup = cardSvg({
    username: user.username,
    groupLabel: activeGroup?.name || "",
    points: stats.total_points ?? 0,
    accuracy: stats.accuracy ?? 0,
    streak: stats.current_streak ?? 0,
    position,
  });

  function download() {
    const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = W * 2;
      canvas.height = H * 2;
      const ctx = canvas.getContext("2d");
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0, W, H);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        const pngUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = `futotal-${user.username}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(pngUrl);
      }, "image/png");
    };
    img.src = url;
  }

  return (
    <div>
      <div
        ref={svgRef}
        className="rounded-2xl overflow-hidden border border-border max-w-[220px] mx-auto sm:mx-0"
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
      />
      <button
        onClick={download}
        className="mt-3 flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-card bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 transition-colors"
      >
        <Download size={13} /> Descargar tarjeta
      </button>
    </div>
  );
}
