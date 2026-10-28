import { useEffect, useRef, useState } from "react";
import { Trophy } from "lucide-react";
import api from "../api.js";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const monthName = (m) => `${MONTHS[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`;
const PLACE = { 1: "Campeón del mes", 2: "Segundo del mes", 3: "Tercero del mes" };

// Confeti en un canvas: solo en la ceremonia de podio y se apaga con prefers-reduced-motion.
function Confetti() {
  const ref = useRef(null);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const w = (canvas.width = canvas.offsetWidth);
    const h = (canvas.height = canvas.offsetHeight);
    const colors = ["#2fb673", "#f5c542", "#4fb3e8", "#e8554e", "#c9a9e8"];
    const bits = Array.from({ length: 90 }, () => ({ x: Math.random() * w, y: -Math.random() * h, r: 3 + Math.random() * 4, c: colors[(Math.random() * colors.length) | 0], v: 1.5 + Math.random() * 2.5, s: Math.random() * 2 - 1 }));
    let raf;
    let frames = 0;
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const b of bits) {
        b.y += b.v; b.x += b.s;
        ctx.fillStyle = b.c;
        ctx.fillRect(b.x, b.y, b.r, b.r * 1.6);
      }
      if (++frames < 260) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />;
}

// Cierre de mes: ceremonia del podio con trofeo y Sobre Élite (si ese es tu club principal), o un
// «fin de mes» tranquilo si no quedaste en el podio. Una vez vista, no vuelve a salir.
export default function Ceremonia() {
  const [list, setList] = useState([]);
  useEffect(() => { api.get("/clubs/ceremony").then((r) => setList(r.data.ceremonies)).catch(() => {}); }, []);
  const c = list[0];
  if (!c) return null;

  async function close() {
    try { await api.post("/clubs/ceremony/seen", { groupId: c.groupId, month: c.month }); } catch { /* se reintenta la próxima vez */ }
    setList((l) => l.slice(1));
  }

  return (
    <div className="fixed inset-0 z-[9995] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Fin de mes">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-panel p-6 text-center celebrate-pop">
        {c.place && <Confetti />}
        <p className="t-eyebrow relative">Fin de mes · {c.club}</p>
        <p className="relative text-sm text-gray-400">{monthName(c.month)}</p>
        {c.place ? (
          <>
            <div className="relative mx-auto mt-4 flex h-24 w-24 items-center justify-center rounded-full bg-amber/20 text-amber" style={{ boxShadow: "0 0 40px rgb(var(--c-amber) / .35)" }}>
              <Trophy size={52} />
            </div>
            <h2 className="relative mt-3 text-2xl font-extrabold">{PLACE[c.place]}</h2>
            <p className="relative text-sm text-gray-400">El trofeo ya está en tu vitrina.</p>
            {c.elite && <p className="relative mt-3 rounded-xl border border-accent/50 bg-accent/10 px-3 py-2 text-sm">Ganaste un <b>Sobre Élite</b>: una carta de 90 o más asegurada. Lo abres en Cartas.</p>}
            {!c.elite && <p className="relative mt-3 text-xs text-gray-500">El Sobre Élite solo sale del club que marcaste como principal.</p>}
          </>
        ) : (
          <>
            <h2 className="relative mt-4 text-xl font-bold">Cerró el mes</h2>
            <p className="relative mt-1 text-sm text-gray-400">Esta vez no quedaste en el podio. El mes nuevo arranca de cero: otra tabla, otra chance.</p>
          </>
        )}
        <button onClick={close} className="btn btn-primary relative mt-5 w-full">{list.length > 1 ? "Siguiente" : "Seguir"}</button>
      </div>
    </div>
  );
}
