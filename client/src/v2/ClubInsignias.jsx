import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import api from "../api.js";
import Card from "../components/Card.jsx";
import Crest, { parseCrest } from "../components/Crest.jsx";

// Color del uniforme del club: el color principal de su escudo. Sirve de anillo en los
// avatares de la tabla y de la ficha.
export function uniformColor(club) {
  return parseCrest(club)?.color || null;
}

// Escudo con piezas: cada insignia ganada enciende un quinto del aro que lo rodea.
function Ring({ total, lit, color }) {
  const r = 46;
  const gap = 4;
  const seg = (360 - gap * total) / total;
  const arc = (i) => {
    const a0 = ((i * (seg + gap) - 90) * Math.PI) / 180;
    const a1 = ((i * (seg + gap) + seg - 90) * Math.PI) / 180;
    const p = (a) => `${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`;
    return `M${p(a0)} A${r} ${r} 0 0 1 ${p(a1)}`;
  };
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <path key={i} d={arc(i)} fill="none" strokeWidth="4" strokeLinecap="round"
          stroke={i < lit ? (color || "currentColor") : "rgb(var(--c-border, 51 65 85))"} className={i < lit ? "badge-lit" : ""} style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
    </svg>
  );
}

export default function ClubInsignias({ club }) {
  const [badges, setBadges] = useState(null);
  useEffect(() => {
    setBadges(null);
    api.get(`/clubs/${club.id}/badges`).then((r) => setBadges(r.data.badges)).catch(() => setBadges([]));
  }, [club.id]);
  if (!badges) return null;
  const lit = badges.filter((b) => b.earned).length;
  return (
    <Card>
      <p className="t-eyebrow">Insignias del club</p>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0 text-accent">
          <Ring total={badges.length} lit={lit} color={uniformColor(club)} />
          <div className="absolute inset-0 flex items-center justify-center"><Crest group={club} size={52} /></div>
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold tabular-nums">{lit}<span className="text-base text-gray-500">/{badges.length}</span></p>
          <p className="text-xs text-gray-400">Se ganan entre todos y encienden una pieza del escudo.</p>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-border">
        {badges.map((b) => (
          <li key={b.key} className={`flex items-start gap-3 py-2 text-sm ${b.earned ? "" : "opacity-60"}`}>
            <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${b.earned ? "bg-accent/20 text-accent" : "bg-bg text-gray-500"}`}>{b.earned ? "✓" : <Lock size={11} />}</span>
            <span className="min-w-0"><b className="block">{b.label}</b><span className="text-xs text-gray-400">{b.text}</span></span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
