import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Hourglass } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { Cup, DraftRound, Result, Setup } from "./DraftSolo.jsx";

// Draft 8a2 contra un amigo (en línea): uno crea la sala y comparte el código, el otro se une; cada
// uno arma su equipo con la misma formación, modo y estilo, y cuando los dos confirman «Estoy listo»
// el servidor juega un partido (con prórroga y penales) y dice quién ganó. El ganador suma 30 al club.
export default function DraftAmigo() {
  const toast = useToast();
  const [s, setS] = useState({ loading: true, code: null, id: null, step: 0, draft: null, hasGuest: false, opponent: null });
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const busy = useRef(false);

  const load = useCallback(async (c) => {
    const r = await api.get(`/draft/room/${c}`);
    setS((x) => ({ ...x, loading: false, code: c, id: r.data.id, step: r.data.step, draft: r.data.draft, hasGuest: r.data.hasGuest, opponent: r.data.opponent }));
  }, []);

  useEffect(() => {
    api.get("/draft/room-active").then((r) => (r.data.code ? load(r.data.code) : setS((x) => ({ ...x, loading: false })))).catch(() => setS((x) => ({ ...x, loading: false })));
  }, [load]);

  // Mientras se espera al amigo (o a que confirme) se consulta la sala cada 3 segundos.
  useEffect(() => {
    if (!s.code || !(s.draft?.phase === "ready" || !s.hasGuest)) return undefined;
    const t = setInterval(() => load(s.code).catch(() => {}), 3000);
    return () => clearInterval(t);
  }, [s.code, s.draft?.phase, s.hasGuest, load]);

  const act = useCallback(async (action, payload = {}) => {
    if (busy.current) return false;
    busy.current = true;
    try {
      const r = await api.post(`/draft/${s.id}/${action}`, { step: s.step, ...payload });
      setS((x) => ({ ...x, step: r.data.step, draft: r.data.draft }));
      return true;
    } catch (e) {
      if (e.response?.status === 409 && e.response.data?.draft) setS((x) => ({ ...x, step: e.response.data.step, draft: e.response.data.draft }));
      else toast(e.response?.data?.error || "No se pudo hacer esa jugada");
      return false;
    } finally { busy.current = false; }
  }, [s.id, s.step, toast]);

  async function create(cfg) {
    const r = await api.post("/draft/room", cfg);
    setS((x) => ({ ...x, loading: false, code: r.data.code, id: r.data.id, step: r.data.step, draft: r.data.draft, hasGuest: false }));
  }
  async function join(e) {
    e.preventDefault(); setErr("");
    try {
      const r = await api.post("/draft/room/join", { code: code.trim() });
      await load(r.data.code);
    } catch (x) { setErr(x.response?.data?.error || "No se pudo entrar a la sala"); }
  }

  const d = s.draft;
  return (
    <Layout>
      <div className="mx-auto max-w-xl space-y-4">
        {s.loading && <p className="text-sm text-gray-500">Cargando…</p>}
        {!s.loading && !s.code && (
          <>
            <Setup onStart={create} label="Crear sala" title="8a2 · Contra un amigo" text="Eliges formación, modo y estilo, y le pasas el código a tu amigo. Cada uno arma su equipo y el servidor juega el partido: el que gana suma 30 puntos a su club (en clubes Total)." />
            <Card>
              <p className="t-eyebrow mb-2">¿Te pasaron un código?</p>
              <form onSubmit={join} className="flex gap-2">
                <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={5} placeholder="Código de la sala" className="min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 py-2 text-sm uppercase tracking-widest" />
                <button className="btn btn-secondary" disabled={code.trim().length < 5}>Entrar</button>
              </form>
              {err && <p className="mt-2 text-sm text-red-400" role="alert">{err}</p>}
            </Card>
          </>
        )}
        {s.code && d && d.phase !== "done" && (
          <Card variant="feature">
            <div className="flex items-center justify-between gap-3">
              <div><p className="t-eyebrow">Sala</p><p className="select-all font-mono text-2xl font-bold tracking-widest">{s.code}</p></div>
              <button onClick={() => navigator.clipboard?.writeText(s.code).then(() => toast("Código copiado"), () => {})} className="btn btn-secondary btn-sm inline-flex items-center gap-1.5"><Copy size={13} /> Copiar</button>
            </div>
            <p className="mt-1 text-xs text-gray-400">{s.hasGuest ? `Juegas contra ${s.opponent}.` : "Esperando que tu amigo entre con el código. Mientras, ve armando tu equipo."}</p>
          </Card>
        )}
        {d?.phase === "draft" && <DraftRound d={d} act={act} />}
        {d?.phase === "result" && <Result d={d} act={act} room />}
        {d?.phase === "ready" && (
          <Card className="fq-rise text-center">
            <Hourglass size={26} className="mx-auto text-accent" />
            <p className="mt-2 font-semibold">{s.hasGuest ? "Esperando que tu amigo confirme su equipo…" : "Esperando que tu amigo entre a la sala…"}</p>
            <p className="text-xs text-gray-500">Tu equipo ya está listo (media {d.average}). Puedes dejar esta pantalla abierta.</p>
          </Card>
        )}
        {d?.phase === "done" && <Cup d={d} onAgain={() => setS({ loading: false, code: null, id: null, step: 0, draft: null, hasGuest: false, opponent: null })} />}
      </div>
    </Layout>
  );
}
