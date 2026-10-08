import { useEffect, useState } from "react";
import api from "../api.js";

// Imágenes por nombre (cara de un futbolista, escudo de un club). Se piden al servidor
// una sola vez por sesión; mientras llegan, o si no hay, se muestra un reemplazo.
const cache = new Map(); // "tipo|nombre" -> Promise<url|null>

function mediaOf(kind, name) {
  const key = `${kind}|${name}`;
  if (!cache.has(key)) {
    cache.set(key, api.get(`/media/${kind}`, { params: { name } }).then((r) => r.data.url || null).catch(() => null));
  }
  return cache.get(key);
}

function useMedia(kind, name) {
  const [src, setSrc] = useState(null);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    let alive = true;
    setSrc(null);
    setBroken(false);
    if (name) mediaOf(kind, name).then((u) => alive && setSrc(u));
    return () => { alive = false; };
  }, [kind, name]);
  return [broken ? null : src, () => setBroken(true)];
}

const initials = (name) => name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

// Cara del futbolista; sin foto, sus iniciales.
export default function PlayerFace({ name, size = 40, className = "" }) {
  const [src, onError] = useMedia("player", name);
  const style = { width: size, height: size };
  if (src) {
    return <img src={src} alt="" style={style} className={`rounded-full object-cover object-top bg-black/25 shrink-0 ${className}`} onError={onError} />;
  }
  return (
    <span style={{ ...style, fontSize: Math.max(10, size * 0.32) }} className={`rounded-full bg-black/25 font-bold flex items-center justify-center shrink-0 ${className}`} aria-hidden="true">
      {name ? initials(name) : ""}
    </span>
  );
}

// Escudo de un club; sin escudo, un círculo con las iniciales.
export function ClubCrest({ name, size = 32, className = "" }) {
  const [src, onError] = useMedia("club", name);
  const style = { width: size, height: size };
  if (src) {
    return <img src={src} alt="" style={style} className={`object-contain shrink-0 ${className}`} onError={onError} />;
  }
  return (
    <span style={{ ...style, fontSize: Math.max(9, size * 0.3) }} className={`rounded-full border border-border bg-panel font-bold text-gray-400 flex items-center justify-center shrink-0 ${className}`} aria-hidden="true">
      {name ? initials(name) : ""}
    </span>
  );
}
