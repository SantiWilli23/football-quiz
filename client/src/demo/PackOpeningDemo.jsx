import { useState } from "react";
import FigCard from "./FigCard.jsx";

// Apertura de sobre de la Demo: el sobre se rasga al tocarlo y las cartas salen boca abajo; se
// da vuelta cada una con un toque (el brillo de la rareza aparece al revelarla) o todas juntas.
export default function PackOpeningDemo({ cards }) {
  const [torn, setTorn] = useState(false);
  const [up, setUp] = useState(() => new Set());
  const flip = (i) => setUp((s) => { const x = new Set(s); x.add(i); return x; });
  const all = () => setUp(new Set(cards.map((_, i) => i)));
  const best = cards.reduce((b, c) => (["bronce", "plata", "oro", "estrella"].indexOf(c.tier) > ["bronce", "plata", "oro", "estrella"].indexOf(b) ? c.tier : b), "bronce");

  if (!torn) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <button type="button" onClick={() => setTorn(true)} aria-label="Abrir el sobre" className="group relative h-64 w-44 rounded-2xl border-2 border-accent/70 text-center shadow-2xl transition-transform hover:-rotate-2 hover:scale-105"
          style={{ background: "linear-gradient(160deg, var(--acc, #2fb673), #0f3d2a 70%)", clipPath: "polygon(0 6%, 8% 0, 16% 6%, 24% 0, 32% 6%, 40% 0, 48% 6%, 56% 0, 64% 6%, 72% 0, 80% 6%, 88% 0, 100% 6%, 100% 100%, 0 100%)" }}>
          <span className="block pt-16 text-5xl font-black tracking-widest text-white/90" style={{ fontFamily: "var(--f-d, inherit)" }}>FT</span>
          <span className="mt-3 block text-xs font-bold uppercase tracking-[.3em] text-white/70">{cards.length} cartas</span>
        </button>
        <p className="text-sm text-gray-400">Toca el sobre para abrirlo</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {cards.map((c, i) => (
          <div key={i} className={`fig-flip ${up.has(i) ? "up" : ""} fig-glow-${c.tier}`}>
            <div className="fig-inner">
              <button type="button" className="fig-front block w-full" onClick={() => flip(i)} aria-label={`Dar vuelta la carta ${i + 1}`}><FigCard back c={c} /></button>
              <div className="fig-rev"><FigCard c={c} /></div>
            </div>
          </div>
        ))}
      </div>
      {up.size < cards.length
        ? <button type="button" onClick={all} className="p-btn ghost w-full">Revelar todas</button>
        : <p className="text-center text-sm text-gray-400">La mejor del sobre: <b className="capitalize text-white">{best}</b></p>}
    </div>
  );
}
