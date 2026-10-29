import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Crown, Share2, Shield, Star, Trophy } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import { useToast } from "../context/ToastContext.jsx";

// Cotrero rehecho (Futotal 2.0): la carrera vive en el servidor. El teléfono muestra el estado y
// manda la elección; el azar y el puntaje los pone el servidor. `game` es «cotrero» (simple, con
// ritmo Intensa / Normal / Exprés) o «cotrero_medio» (reputación, convocatoria y resumen final).
const NATIONS = ["Chile", "Argentina", "Uruguay", "Perú", "Colombia", "Brasil", "Paraguay", "Ecuador", "Venezuela", "Bolivia", "España", "Italia"];
const POS = { GK: "Arquero", DEF: "Defensa", MID: "Medio", FWD: "Delantero" };
const MODES = [["intensa", "Intensa", "Dos decisiones por temporada"], ["normal", "Normal", "Una por temporada"], ["expres", "Exprés", "Una cada 3 temporadas"]];
const PROFILES = [["velocidad", "Velocidad", "Más goles y se retira antes"], ["tecnica", "Técnica", "Más asistencias"], ["fisico", "Físico", "Menos lesiones"]];
const ROLE = { titular: "Titular", rotacion: "Rotación", suplente: "Suplente" };
const ATTR = { def: "Definición", pas: "Pase", reg: "Regate", fis: "Físico", men: "Mentalidad" };
const field = "w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm";

function useCareer(game) {
  const toast = useToast();
  const [state, setState] = useState({ loading: true, id: null, step: 0, career: null });
  const busy = useRef(false);
  useEffect(() => {
    api.get("/careers/active", { params: { game } }).then((r) => setState({ loading: false, id: r.data.id || null, step: r.data.step || 0, career: r.data.career || null })).catch(() => setState({ loading: false, id: null, step: 0, career: null }));
  }, [game]);
  const start = useCallback(async (body) => {
    const r = await api.post("/careers/start", { game, ...body });
    setState({ loading: false, id: r.data.id, step: r.data.step, career: r.data.career });
  }, [game]);
  const act = useCallback(async (choice) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const r = await api.post(`/careers/${state.id}/act`, { step: state.step, choice });
      setState((s) => ({ ...s, step: r.data.step, career: r.data.career }));
    } catch (e) {
      // Si la pantalla ya había cambiado (otro teléfono, doble toque), se adopta el estado del servidor.
      if (e.response?.status === 409 && e.response.data?.career) setState((s) => ({ ...s, step: e.response.data.step, career: e.response.data.career }));
      else toast(e.response?.data?.error || "No se pudo avanzar");
    } finally { busy.current = false; }
  }, [state.id, state.step, toast]);
  const reset = useCallback(() => setState({ loading: false, id: null, step: 0, career: null }), []);
  return { ...state, start, act, reset };
}

// Número que sube de 0 al valor (se apaga con movimiento reducido).
function Count({ to }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setV(to); return undefined; }
    let raf; const t0 = performance.now();
    const tick = (t) => { const k = Math.min(1, (t - t0) / 700); setV(Math.round(to * k)); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <span className="tabular-nums">{v}</span>;
}

function LevelDots({ level }) {
  return <span className="inline-flex gap-0.5" aria-label={`Nivel del club ${level} de 5`}>{[1, 2, 3, 4, 5].map((n) => <span key={n} className={`h-1.5 w-1.5 rounded-full ${n <= level ? "bg-accent" : "bg-border"}`} />)}</span>;
}

function PlayerCard({ c }) {
  return (
    <Card variant="feature" className="fq-pop">
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-accent/50 bg-accent/10">
          <span className="text-2xl font-black leading-none tabular-nums">{c.ovr}</span>
          <span className="mt-0.5 text-[10px] uppercase tracking-wide text-gray-400">{c.player.pos}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{c.player.surname} <span className="text-gray-500">#{c.player.number}</span></p>
          <p className="text-xs text-gray-400">{POS[c.player.pos]} · {c.age} años · {c.player.nation}</p>
          <p className="mt-0.5 flex items-center gap-2 text-sm"><Shield size={13} className="text-accent" /><span className="truncate">{c.club.name}</span><LevelDots level={c.club.level} /></p>
        </div>
      </div>
      {c.attrs && (
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {Object.entries(ATTR).map(([k, label]) => (
            <div key={k} className="text-center"><div className="h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full bg-accent" style={{ width: `${c.attrs[k]}%` }} /></div><p className="mt-1 text-[10px] leading-tight text-gray-500">{label}</p><p className="text-xs font-semibold tabular-nums">{c.attrs[k]}</p></div>
          ))}
        </div>
      )}
      {"rep" in c && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-400"><span>Reputación</span><b className="text-white">{c.repLabel}</b></div>
          <div className="relative mt-1 h-1.5 rounded-full bg-border"><div className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded bg-accent transition-[left] duration-500" style={{ left: `${(c.rep + 50)}%` }} /></div>
        </div>
      )}
    </Card>
  );
}

function CreatePlayer({ game, onStart }) {
  const medio = game === "cotrero_medio";
  const [f, setF] = useState({ surname: "", number: 10, foot: "diestro", nation: "Chile", pos: medio ? "FWD" : "FWD", profile: "velocidad", mode: "normal" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  async function go(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try { await onStart({ mode: medio ? "normal" : f.mode, player: { surname: f.surname, number: Number(f.number), foot: f.foot, nation: f.nation, pos: f.pos, profile: medio ? undefined : f.profile } }); }
    catch (x) { setErr(x.response?.data?.error || "No se pudo empezar"); setBusy(false); }
  }
  const chip = (active) => `rounded-xl border px-3 py-2 text-left text-sm transition-colors ${active ? "border-accent bg-accent/10" : "border-border text-gray-400"}`;
  return (
    <form onSubmit={go} className="space-y-4">
      <Card variant="feature">
        <p className="t-eyebrow">{medio ? "Cotrero · dificultad media" : "Cotrero · dificultad simple"}</p>
        <p className="mt-1 text-sm text-gray-300">{medio ? "Elige tu posición, cuida tu reputación y llega a la selección. Al final, ¿a qué figura te pareces?" : "De potrero a leyenda: una decisión, una temporada, y el azar se encarga del resto."}</p>
      </Card>
      {!medio && (
        <div role="radiogroup" aria-label="Ritmo" className="grid gap-2 sm:grid-cols-3">
          {MODES.map(([k, label, text]) => <button type="button" key={k} role="radio" aria-checked={f.mode === k} onClick={() => setF({ ...f, mode: k })} className={chip(f.mode === k)}><b className="block">{label}</b><span className="text-xs text-gray-400">{text}</span></button>)}
        </div>
      )}
      <Card>
        <div className="grid grid-cols-[1fr_88px] gap-2">
          <label className="text-xs text-gray-500">Apellido<input value={f.surname} onChange={set("surname")} maxLength={14} placeholder="Apellido" className={field} /></label>
          <label className="text-xs text-gray-500">Número<input type="number" min="1" max="99" value={f.number} onChange={set("number")} className={field} /></label>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-xs text-gray-500">Nacionalidad<select value={f.nation} onChange={set("nation")} className={field}>{NATIONS.map((n) => <option key={n}>{n}</option>)}</select></label>
          <label className="text-xs text-gray-500">Pie hábil<select value={f.foot} onChange={set("foot")} className={field}><option value="diestro">Diestro</option><option value="zurdo">Zurdo</option><option value="ambidiestro">Ambidiestro</option></select></label>
        </div>
        <p className="mt-3 text-xs text-gray-500">Posición</p>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Posición">
          {(medio ? ["FWD", "MID"] : ["GK", "DEF", "MID", "FWD"]).map((p) => <button type="button" key={p} role="radio" aria-checked={f.pos === p} onClick={() => setF({ ...f, pos: p })} className={chip(f.pos === p)}>{medio && p === "MID" ? "Enganche" : POS[p]}</button>)}
        </div>
        {!medio && (
          <>
            <p className="mt-3 text-xs text-gray-500">Perfil</p>
            <div className="mt-1 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Perfil">
              {PROFILES.map(([k, label, text]) => <button type="button" key={k} role="radio" aria-checked={f.profile === k} onClick={() => setF({ ...f, profile: k })} className={chip(f.profile === k)}><b className="block">{label}</b><span className="text-xs text-gray-400">{text}</span></button>)}
            </div>
          </>
        )}
      </Card>
      {err && <p className="text-sm text-red-400" role="alert">{err}</p>}
      <button disabled={busy || f.surname.trim().length < 2} className="btn btn-primary w-full disabled:opacity-50">{busy ? "Empezando…" : "Empezar la carrera"}</button>
    </form>
  );
}

function Decision({ p, onPick }) {
  return (
    <Card key={p.id + p.text} className="fq-rise">
      <p className="t-eyebrow">{p.kind === "minijuego" ? "Partido clave" : p.kind === "atributo" ? "Pretemporada" : "Decisión"}</p>
      <p className="mt-1 text-lg font-semibold leading-snug">{p.text}</p>
      <div className={`mt-3 grid gap-2 ${p.kind === "minijuego" && p.id === "penal" ? "grid-cols-2" : ""}`}>
        {p.options.map((o) => (
          <button key={o.key} onClick={() => onPick(o.key)} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-3 text-left text-sm hover:border-accent/60 active:scale-[0.99]">
            <span className="font-medium">{o.label}</span>
            {o.icons?.length > 0 && <span className="flex flex-wrap justify-end gap-1">{o.icons.map((i) => <span key={i} className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-400">{i}</span>)}</span>}
          </button>
        ))}
      </div>
    </Card>
  );
}

function Summary({ s, onNext, medio }) {
  return (
    <Card className="fq-rise">
      <p className="t-eyebrow">{s.block ? `Resumen de ${s.block} temporadas` : "Resumen"} · {s.club}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[["Partidos", s.matches], ["Goles", s.goals], ["Asistencias", s.assists]].map(([l, v]) => <div key={l} className="rounded-xl border border-border py-2"><p className="text-2xl font-extrabold"><Count to={v || 0} /></p><p className="text-[11px] text-gray-500">{l}</p></div>)}
      </div>
      {s.clean > 0 && <p className="mt-2 text-center text-sm text-gray-400">Vallas invictas: <b className="text-white">{s.clean}</b></p>}
      <p className="mt-3 text-center text-sm">{s.growth > 0 ? <span className="text-accent">Valoración +{s.growth}</span> : s.growth < 0 ? <span className="text-red-400">Valoración {s.growth}</span> : <span className="text-gray-400">Valoración igual</span>} · ahora {s.ovr}</p>
      {(s.titles?.length > 0 || s.awards?.length > 0) && (
        <ul className="mt-3 space-y-1">{[...(s.titles || []).map((t) => [t, "Título"]), ...(s.awards || []).map((a) => [a, "Premio"])].map(([t, k]) => <li key={t} className="fq-pop flex items-center justify-center gap-2 rounded-xl border border-amber/40 bg-amber/10 py-1.5 text-sm"><Trophy size={14} className="text-amber" />{k}: <b>{t}</b></li>)}</ul>
      )}
      {s.injury && <p className="mt-2 text-center text-sm text-red-400">Lesión {s.injury}</p>}
      <button onClick={() => onNext("continue")} className="btn btn-primary mt-4 w-full inline-flex items-center justify-center gap-2">Seguir <ArrowRight size={15} /></button>
      {medio && <p className="mt-2 text-center text-[11px] text-gray-500">Edad {s.nextAge}</p>}
    </Card>
  );
}

function Transfer({ offers, onPick }) {
  return (
    <Card className="fq-rise">
      <p className="t-eyebrow">Mercado de pases</p>
      <p className="mt-1 text-lg font-semibold">Te llegaron ofertas</p>
      <div className="mt-3 space-y-2">
        {offers.map((o, i) => (
          <button key={o.name} onClick={() => onPick(`club:${i}`)} className="fq-deal flex w-full items-center justify-between gap-3 rounded-xl border border-border px-3 py-3 text-left hover:border-accent/60" style={{ animationDelay: `${i * 90}ms` }}>
            <span><b className="block">{o.name}</b><span className="text-xs text-gray-400">{ROLE[o.role]} · nivel <LevelDots level={o.level} /></span></span>
            <ArrowRight size={16} className="text-accent" />
          </button>
        ))}
        <button onClick={() => onPick("stay")} className="btn btn-secondary w-full">Quedarme</button>
      </div>
    </Card>
  );
}

function Retired({ c, onAgain, medio }) {
  const toast = useToast();
  const f = c.final;
  async function share() {
    const text = `Mi carrera en Futotal: ${c.player.surname} #${c.player.number}, ${f.label} con ${f.score} puntos en ${f.seasons} temporadas.`;
    try { if (navigator.share) await navigator.share({ text, url: window.location.origin }); else { await navigator.clipboard.writeText(text); toast("Copiado"); } } catch { /* cancelado */ }
  }
  const r = f.rewards || {};
  return (
    <div className="space-y-3">
      <Card variant="feature" className="fq-rise text-center">
        <Crown size={26} className="mx-auto text-amber fq-pop" />
        <p className="t-eyebrow mt-1">Retiro y legado</p>
        <p className="mt-1 text-3xl font-black">{f.label}</p>
        <p className="text-4xl font-extrabold tabular-nums text-accent"><Count to={f.score} /></p>
        <p className="text-xs text-gray-400">{f.seasons} temporadas · {f.totals.titles} títulos · {f.totals.goals} goles{medio ? ` · ${f.repLabel}` : ""}</p>
        {f.percentile != null && <p className="mt-2 text-sm">Mejor que el <b>{f.percentile}%</b> de las carreras.</p>}
        {f.figure && <p className="mt-1 text-sm">Te pareces a <b>{f.figure.name}</b> <span className="text-xs text-gray-500">(comparación aproximada)</span></p>}
      </Card>
      <Card>
        <p className="t-eyebrow">Tus clubes</p>
        <ol className="mt-2 divide-y divide-border text-sm">{f.clubs.map((k, i) => <li key={i} className="flex items-center justify-between py-2"><span>{k.name}</span><LevelDots level={k.level} /></li>)}</ol>
      </Card>
      {(r.club || r.pack) && (
        <Card><p className="text-sm text-gray-300">
          {r.club?.credited?.length ? `Sumaste ${r.club.credited[0].points} a tu club. ` : r.club?.reason === "ya" ? "Hoy ya sumaste por una carrera. " : r.club?.wouldHave ? `Habrías sumado ${r.club.wouldHave} · ${r.club.reason === "clasico" ? "tu club es Clásico y no suma" : "no va a ningún club"}. ` : ""}
          {r.pack ? `Ganaste un sobre ${r.pack}.` : ""}
        </p></Card>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={share} className="btn btn-secondary inline-flex items-center justify-center gap-2"><Share2 size={15} /> Compartir</button>
        <button onClick={onAgain} className="btn btn-primary">Nueva carrera</button>
      </div>
    </div>
  );
}

export default function Cotrero({ game }) {
  const { loading, career, start, act, reset } = useCareer(game);
  const medio = game === "cotrero_medio";
  const legacyKey = medio ? "cotrero_medio_save_v1" : "cotrero_save_v1";
  let hasLegacy = false;
  try { hasLegacy = !!localStorage.getItem(legacyKey); } catch { /* sin storage */ }

  return (
    <Layout>
      <div className="mx-auto max-w-xl space-y-4">
        {loading && <p className="text-sm text-gray-500">Cargando…</p>}
        {!loading && !career && (
          <>
            <CreatePlayer game={game} onStart={start} />
            {hasLegacy && <p className="text-center text-xs text-gray-500">¿Tenías una carrera a medias? <a className="text-accent underline" href={`${medio ? "/cotrero-medio.html" : "/cotrero.html"}?legacy=1`}>Terminar tu carrera anterior</a></p>}
          </>
        )}
        {career && career.phase !== "retired" && <PlayerCard c={career} />}
        {career && ["decision", "pretemporada", "evento", "minijuego", "convocatoria", "retiro"].includes(career.phase) && career.pending && <Decision p={career.pending} onPick={act} />}
        {career?.phase === "summary" && career.summary && <Summary s={career.summary} onNext={act} medio={medio} />}
        {career?.phase === "transfer" && career.offers && <Transfer offers={career.offers} onPick={act} />}
        {career?.phase === "retired" && <Retired c={career} medio={medio} onAgain={reset} />}
        {career && career.phase !== "retired" && career.history.length > 0 && (
          <Card><p className="t-eyebrow flex items-center gap-1.5"><Star size={12} /> Tu carrera</p>
            <ul className="mt-2 space-y-1 text-xs text-gray-400">{career.history.slice().reverse().map((h, i) => <li key={i} className="flex justify-between gap-2"><span className="truncate">{h.age} años · {h.club}</span><span className="shrink-0 tabular-nums">{h.goals}g · {h.assists}a{h.titles.length ? ` · ${h.titles.length} 🏆` : ""}</span></li>)}</ul>
          </Card>
        )}
      </div>
    </Layout>
  );
}
