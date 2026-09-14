import { useRef } from "react";
import { Download } from "lucide-react";

// Genera la tarjeta como SVG (nada de libs externas) y la exporta a PNG
// dibujándola en un <canvas> — funciona en cualquier navegador moderno sin
// agregar dependencias nuevas al proyecto.
function cardSvg({ username, groupLabel, points, accuracy, streak, position }) {
  const posLine = position ? `#${position} en ${groupLabel}` : "Sin grupo activo";
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f2f28"/>
      <stop offset="100%" stop-color="#123a30"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" rx="24" fill="url(#bg)"/>
  <rect x="1" y="1" width="638" height="358" rx="23" fill="none" stroke="#3fae9a" stroke-opacity="0.4" stroke-width="2"/>
  <text x="40" y="70" font-family="Arial, sans-serif" font-size="14" letter-spacing="3" fill="#3fae9a" font-weight="700">FUTOTAL</text>
  <text x="40" y="120" font-family="Arial, sans-serif" font-size="34" fill="#ffffff" font-weight="800">${escapeXml(username)}</text>
  <text x="40" y="148" font-family="Arial, sans-serif" font-size="15" fill="#9fb3ae">${escapeXml(posLine)}</text>

  <g font-family="Arial, sans-serif">
    <text x="40" y="220" font-size="40" fill="#3fae9a" font-weight="800">${points}</text>
    <text x="40" y="242" font-size="12" fill="#9fb3ae">puntos totales</text>

    <text x="220" y="220" font-size="40" fill="#ffffff" font-weight="800">${accuracy}%</text>
    <text x="220" y="242" font-size="12" fill="#9fb3ae">de aciertos</text>

    <text x="400" y="220" font-size="40" fill="#d9a441" font-weight="800">${streak}</text>
    <text x="400" y="242" font-size="12" fill="#9fb3ae">racha actual</text>
  </g>

  <text x="40" y="320" font-family="Arial, sans-serif" font-size="12" fill="#5c716c">futotal.app</text>
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
      canvas.width = 640 * 2;
      canvas.height = 360 * 2;
      const ctx = canvas.getContext("2d");
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0, 640, 360);
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
        className="rounded-2xl overflow-hidden border border-border"
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
