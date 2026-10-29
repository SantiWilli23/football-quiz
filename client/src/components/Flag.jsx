import { useState } from "react";

// Las banderas emoji se ven como letras («CL») en Windows. Se convierten a su código y se dibuja la
// imagen de flagcdn; si no carga (sin señal), vuelve el emoji.
export function flagCode(emoji) {
  if (!emoji) return null;
  const cps = Array.from(emoji).map((c) => c.codePointAt(0));
  const ri = cps.filter((c) => c >= 0x1f1e6 && c <= 0x1f1ff);
  if (ri.length === 2) return ri.map((c) => String.fromCharCode(97 + c - 0x1f1e6)).join("");
  // Inglaterra, Escocia y Gales: bandera negra + letras etiqueta (U+E0061…) → gb-eng, gb-sct, gb-wls
  const tags = cps.filter((c) => c >= 0xe0061 && c <= 0xe007a);
  if (cps[0] === 0x1f3f4 && tags.length) return tags.map((c) => String.fromCharCode(97 + c - 0xe0061)).join("").replace(/^gb/, "gb-");
  return null;
}
export const flagUrl = (emoji, w = 40) => { const c = flagCode(emoji); return c ? `https://flagcdn.com/w${w}/${c}.png` : null; };

export default function Flag({ emoji, size = 18, className = "" }) {
  const [bad, setBad] = useState(false);
  const url = flagUrl(emoji, size > 24 ? 80 : 40);
  if (!url || bad) return <span className={className} style={{ fontSize: size * 0.9, lineHeight: 1 }} aria-hidden="true">{emoji}</span>;
  return <img src={url} alt="" width={size} height={Math.round(size * 0.75)} loading="lazy" onError={() => setBad(true)} className={`inline-block shrink-0 rounded-[2px] object-cover ${className}`} style={{ width: size, height: Math.round(size * 0.75) }} />;
}
