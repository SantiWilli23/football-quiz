import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RotateCcw } from "lucide-react";
import Layout from "../components/Layout.jsx";
import { INICIALES, TOTAL, combinar } from "../otro/recetas.js";

const KEY = "fq_alquimia";
const load = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(v) && v.length) return v;
  } catch { /* sin storage */ }
  return INICIALES;
};

// Alquimia: arrastra un elemento sobre otro para juntarlos. Lo que descubres se guarda en este
// navegador. (Mecánica propia, con recetas de fútbol; no usa código ni arte de otro juego.)
export default function Alquimia() {
  const [found, setFound] = useState(load);
  const [board, setBoard] = useState([]); // {id, n, e, x, y}
  const [msg, setMsg] = useState("");
  const [nuevo, setNuevo] = useState("");
  const area = useRef(null);
  const drag = useRef(null);
  const seq = useRef(1);

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(found)); } catch { /* sin storage */ } }, [found]);
  const say = (t) => { setMsg(t); setTimeout(() => setMsg((m) => (m === t ? "" : m)), 1800); };

  const rect = () => area.current.getBoundingClientRect();
  const begin = (e, item, fromBoard) => {
    e.preventDefault();
    const r = rect();
    const id = fromBoard ? item.id : seq.current++;
    const base = fromBoard ? item : { id, n: item.n, e: item.e, x: e.clientX - r.left - 40, y: e.clientY - r.top - 18 };
    setBoard((b) => (fromBoard ? b.filter((i) => i.id !== id).concat(item) : b.concat(base)));
    drag.current = { id, dx: fromBoard ? e.clientX - r.left - item.x : 40, dy: fromBoard ? e.clientY - r.top - item.y : 18 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (!fromBoard) { drag.current.el = null; }
  };
  const move = (e) => {
    const d = drag.current; if (!d) return;
    const r = rect();
    setBoard((b) => b.map((i) => (i.id === d.id ? { ...i, x: e.clientX - r.left - d.dx, y: e.clientY - r.top - d.dy } : i)));
  };
  const end = (e) => {
    const d = drag.current; if (!d) return;
    drag.current = null;
    const r = rect();
    setBoard((b) => {
      const me = b.find((i) => i.id === d.id); if (!me) return b;
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return b.filter((i) => i.id !== d.id);
      const other = b.find((i) => i.id !== d.id && Math.abs(i.x - me.x) < 70 && Math.abs(i.y - me.y) < 34);
      if (!other) return b;
      const res = combinar(me.n, other.n);
      if (!res) { say("No pasa nada"); return b; }
      const isNew = !found.some((f) => f.n === res.n);
      if (isNew) { setFound((f) => f.concat(res)); setNuevo(res.n); setTimeout(() => setNuevo(""), 2200); }
      say(`${me.n} + ${other.n} = ${res.n}`);
      return b.filter((i) => i.id !== d.id && i.id !== other.id).concat({ id: seq.current++, n: res.n, e: res.e, x: (me.x + other.x) / 2, y: (me.y + other.y) / 2 });
    });
  };
  const reiniciar = () => { setFound(INICIALES); setBoard([]); };

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <Link to="/otro" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white"><ArrowLeft size={16} /> Otro</Link>
          <span className="text-sm tabular-nums text-gray-400">{found.length} / {TOTAL} descubiertos</span>
          <button type="button" onClick={reiniciar} className="btn btn-secondary btn-sm"><RotateCcw size={14} /> Reiniciar</button>
        </div>
        <h1 className="text-xl font-bold mb-3">Alquimia de fútbol</h1>
        <div className="grid gap-3 md:grid-cols-[1fr_240px]">
          <div ref={area} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
            className="relative h-[420px] overflow-hidden rounded-card border border-border bg-bg select-none touch-none">
            {board.length === 0 && <p className="absolute inset-0 grid place-items-center text-sm text-gray-500 pointer-events-none">Arrastra elementos aquí y junta dos</p>}
            {board.map((i) => (
              <div key={i.id} onPointerDown={(e) => begin(e, i, true)} style={{ left: i.x, top: i.y }}
                className="absolute cursor-grab rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm font-medium whitespace-nowrap shadow">
                <span className="mr-1">{i.e}</span>{i.n}
              </div>
            ))}
            {msg && <p role="status" className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs">{msg}</p>}
            {nuevo && <p role="status" className="absolute top-2 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-black">¡Nuevo: {nuevo}!</p>}
          </div>
          <aside aria-label="Elementos descubiertos" className="rounded-card border border-border p-2 max-h-[420px] overflow-auto">
            <div className="flex flex-wrap gap-2">
              {found.map((f) => (
                <button key={f.n} type="button" onPointerDown={(e) => begin(e, f, false)} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
                  className="touch-none cursor-grab rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm font-medium">
                  <span className="mr-1">{f.e}</span>{f.n}
                </button>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
