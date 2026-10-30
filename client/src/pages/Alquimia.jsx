import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, RotateCcw, Target } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import { INICIALES, TOTAL, combinar, retoDelDia } from "../otro/recetas.js";
import { submitDaily, dailyMessage } from "../utils/dailyGames.js";

const KEY = "fq_alquimia";
const RETO = "fq_alquimia_reto";
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const read = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fb; } catch { return fb; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin storage */ } };
// Sin repetidos: una versión anterior podía guardar el mismo elemento dos veces.
const uniq = (list) => { const seen = new Set(); return list.filter((f) => f && !seen.has(f.n) && seen.add(f.n)); };
const loadFound = () => { const v = read(KEY, null); return Array.isArray(v) && v.length ? uniq(v) : INICIALES; };
const localDate = () => new Date().toLocaleDateString("en-CA");

// Alquimia de fútbol: arrastra un elemento sobre otro para juntarlos. Lo que descubres se guarda en
// este navegador. Cada día hay un reto (crear un elemento) que suma puntos al club. Mecánica propia,
// con recetas de fútbol; no usa código ni arte de otro juego.
export default function Alquimia() {
  const [found, setFound] = useState(loadFound);
  const [board, setBoard] = useState([]); // {id, n, e, x, y}
  const [msg, setMsg] = useState("");
  const [nuevo, setNuevo] = useState("");
  const [q, setQ] = useState("");
  const [fecha, setFecha] = useState(localDate);
  const [reto, setReto] = useState(null); // { fecha, n, e, niveles, hecho, texto, intentos }
  const area = useRef(null);
  const drag = useRef(null);
  const seq = useRef(1);
  const boardRef = useRef([]);
  const foundRef = useRef(found);
  const retoRef = useRef(null);

  useEffect(() => { foundRef.current = found; write(KEY, found); }, [found]);
  useEffect(() => { retoRef.current = reto; }, [reto]);

  // La fecha la manda el servidor (todos tienen el mismo reto aunque cambie la hora del equipo).
  useEffect(() => {
    let vivo = true;
    api.get("/daily-games/today").then((r) => { if (vivo && r.data?.date) setFecha(r.data.date); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  useEffect(() => {
    const t = retoDelDia(fecha);
    const g = read(RETO, null);
    setReto({ fecha, ...t, hecho: g?.fecha === fecha && !!g.hecho, texto: g?.fecha === fecha ? g.texto || "" : "", intentos: g?.fecha === fecha ? g.intentos || 0 : 0 });
  }, [fecha]);

  const say = (t) => { setMsg(t); setTimeout(() => setMsg((m) => (m === t ? "" : m)), 1800); };
  const upd = (fn) => { const nb = fn(boardRef.current); boardRef.current = nb; setBoard(nb); };
  const rect = () => area.current.getBoundingClientRect();

  const begin = (e, item, fromBoard) => {
    e.preventDefault();
    const r = rect();
    const id = fromBoard ? item.id : seq.current++;
    const dx = fromBoard ? e.clientX - r.left - item.x : 40;
    const dy = fromBoard ? e.clientY - r.top - item.y : 18;
    const base = fromBoard ? item : { id, n: item.n, e: item.e, x: e.clientX - r.left - dx, y: e.clientY - r.top - dy };
    upd((b) => b.filter((i) => i.id !== id).concat(base));
    drag.current = { id, dx, dy };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    const d = drag.current; if (!d) return;
    const r = rect();
    upd((b) => b.map((i) => (i.id === d.id ? { ...i, x: e.clientX - r.left - d.dx, y: e.clientY - r.top - d.dy } : i)));
  };

  const cumplir = async (res) => {
    const r0 = retoRef.current;
    const intentos = (r0?.intentos || 0);
    setReto((r) => ({ ...r, hecho: true }));
    write(RETO, { fecha: r0.fecha, hecho: true, intentos, texto: "" });
    const out = await submitDaily("alquimia", 1, intentos, { mode: "daily" });
    const texto = out ? dailyMessage(out) : "Reto cumplido. No pude guardar los puntos: revisa tu conexión.";
    setReto((r) => ({ ...r, texto }));
    write(RETO, { fecha: r0.fecha, hecho: true, intentos, texto });
  };

  const end = (e) => {
    const d = drag.current; if (!d) return;
    drag.current = null;
    const r = rect();
    const b = boardRef.current;
    const me = b.find((i) => i.id === d.id); if (!me) return;
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { upd((x) => x.filter((i) => i.id !== d.id)); return; }
    const other = b.find((i) => i.id !== d.id && Math.abs(i.x - me.x) < 70 && Math.abs(i.y - me.y) < 34);
    if (!other) return;
    const res = combinar(me.n, other.n);
    if (!res) { say("No pasa nada"); return; }
    if (!foundRef.current.some((f) => f.n === res.n)) { setFound((f) => (f.some((x) => x.n === res.n) ? f : f.concat(res))); setNuevo(res.n); setTimeout(() => setNuevo(""), 2200); }
    say(`${me.n} + ${other.n} = ${res.n}`);
    upd((x) => x.filter((i) => i.id !== d.id && i.id !== other.id).concat({ id: seq.current++, n: res.n, e: res.e, x: (me.x + other.x) / 2, y: (me.y + other.y) / 2 }));
    const rt = retoRef.current;
    if (rt && !rt.hecho) {
      const intentos = rt.intentos + 1;
      setReto({ ...rt, intentos });
      write(RETO, { fecha: rt.fecha, hecho: false, intentos, texto: "" });
      if (res.n === rt.n) cumplir(res);
    }
  };
  const reiniciar = () => { setFound(INICIALES); upd(() => []); };

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <Link to="/juegos" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white"><ArrowLeft size={16} /> Juegos</Link>
          <span className="text-sm tabular-nums text-gray-400">{found.length} / {TOTAL} descubiertos</span>
          <button type="button" onClick={reiniciar} className="btn btn-secondary btn-sm"><RotateCcw size={14} /> Reiniciar</button>
        </div>
        <h1 className="text-xl font-bold mb-3">Alquimia</h1>

        {reto && (
          <section aria-label="Reto del día" className={`mb-3 flex items-start gap-3 rounded-card border p-3 ${reto.hecho ? "border-accent bg-accent/10" : "border-border"}`}>
            <span className="mt-0.5 text-accent">{reto.hecho ? <Check size={20} /> : <Target size={20} />}</span>
            <div className="min-w-0 text-sm">
              <p className="font-semibold">Reto del día: crea <span className="whitespace-nowrap">{reto.e} {reto.n}</span></p>
              {reto.hecho
                ? <p className="text-gray-400">{reto.texto || "Reto cumplido."}</p>
                : <p className="text-gray-400">Dificultad {reto.niveles <= 6 ? "baja" : reto.niveles <= 7 ? "media" : "alta"}. Combinaciones de hoy: {reto.intentos}.</p>}
            </div>
          </section>
        )}

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
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" aria-label="Buscar elemento"
              className="mb-2 w-full rounded-card border border-border bg-bg px-3 py-1.5 text-sm focus:border-accent focus:outline-none" />
            <div className="flex flex-wrap gap-2">
              {[...found].reverse().filter((f) => norm(f.n).includes(norm(q))).map((f) => (
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
