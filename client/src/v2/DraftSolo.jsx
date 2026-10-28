import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, RefreshCw, Star, Trophy } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import MatchStage from "../match/MatchStage.jsx";
import { fromDraft } from "../match/simMatch.js";
import { useToast } from "../context/ToastContext.jsx";
import { clubMessage } from "../utils/dailyGames.js";

// Draft 8a2 (solo), rehecho (Futotal 2.0): se elige formación, modo y estilo; en cada ronda sale
// un plantel de la Champions y fichas a uno de sus once; con el once armado se juega la Champions.
// La partida vive en el servidor: él tira el azar, simula los partidos y decide si fuiste campeón.
const FORMATIONS = ["4-3-3", "4-4-2", "4-2-3-1", "4-2-4", "3-5-2", "5-3-2", "4-5-1", "3-4-3"];
const MODES = [["clasico", "Clásico", "Valoraciones ocultas y un solo cambio de equipo."], ["almanaque", "De almanaque", "Ves las valoraciones, hasta 3 cambios y 3 fichajes al final."]];
const STYLES = [["equilibrado", "Equilibrado"], ["defensivo", "Defensivo"], ["ofensivo", "Ofensivo"]];
const ROUND = { duelo: "El duelo", octavos: "Octavos de final", cuartos: "Cuartos de final", semis: "Semifinales", final: "La final" };
const POS = { GOL: "Arquero", ZAG: "Central", LD: "Lat. der.", LE: "Lat. izq.", MEI: "Medio", PD: "Ext. der.", CA: "Delantero", PE: "Ext. izq." };
const norm = (raw) => raw.split("/").map((p) => ({ LI: "LE", MD: "MEI", ME: "MEI", MEC: "MEI", MED: "MEI", MC: "MEI" }[p.trim()] || p.trim()));

function useDraft() {
  const toast = useToast();
  const [s, setS] = useState({ loading: true, id: null, step: 0, draft: null });
  const busy = useRef(false);
  useEffect(() => {
    api.get("/draft/active").then((r) => setS({ loading: false, id: r.data.id || null, step: r.data.step || 0, draft: r.data.draft })).catch(() => setS({ loading: false, id: null, step: 0, draft: null }));
  }, []);
  const start = useCallback(async (body) => {
    const r = await api.post("/draft/start", body);
    setS({ loading: false, id: r.data.id, step: r.data.step, draft: r.data.draft });
  }, []);
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
  return { ...s, start, act, reset: () => setS({ loading: false, id: null, step: 0, draft: null }) };
}

export function Setup({ onStart, label = "Empezar el draft", title = "8a2 · Draft solo", text = "11 rondas: sale un plantel histórico de la Champions y fichas a uno. Con el once armado, juegas la Champions entera." }) {
  const [f, setF] = useState({ formation: "4-3-3", mode: "clasico", style: "equilibrado" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const chip = (on) => `rounded-xl border px-3 py-2 text-left text-sm transition-colors ${on ? "border-accent bg-accent/10" : "border-border text-gray-400"}`;
  return (
    <div className="space-y-4">
      <Card variant="feature"><p className="t-eyebrow">{title}</p><p className="mt-1 text-sm text-gray-300">{text}</p></Card>
      <div><p className="t-eyebrow mb-1.5">Formación</p><div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Formación">{FORMATIONS.map((n) => <button key={n} role="radio" aria-checked={f.formation === n} onClick={() => setF({ ...f, formation: n })} className={`${chip(f.formation === n)} text-center font-semibold tabular-nums`}>{n}</button>)}</div></div>
      <div><p className="t-eyebrow mb-1.5">Modo</p><div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Modo">{MODES.map(([k, label, text]) => <button key={k} role="radio" aria-checked={f.mode === k} onClick={() => setF({ ...f, mode: k })} className={chip(f.mode === k)}><b className="block">{label}</b><span className="text-xs text-gray-400">{text}</span></button>)}</div></div>
      <div><p className="t-eyebrow mb-1.5">Estilo de juego</p><div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Estilo">{STYLES.map(([k, label]) => <button key={k} role="radio" aria-checked={f.style === k} onClick={() => setF({ ...f, style: k })} className={`${chip(f.style === k)} text-center`}>{label}</button>)}</div><p className="mt-1 text-xs text-gray-500">Defensivo y ofensivo suman +3 de valoración a los jugadores de esa zona.</p></div>
      {err && <p className="text-sm text-red-400" role="alert">{err}</p>}
      <button disabled={busy} onClick={async () => { setBusy(true); setErr(""); try { await onStart(f); } catch (e) { setErr(e.response?.data?.error || "No se pudo empezar"); setBusy(false); } }} className="btn btn-primary w-full disabled:opacity-50">{busy ? "Empezando…" : label}</button>
    </div>
  );
}

function Pitch({ d, selected, moving, onSlot }) {
  const sel = selected != null ? d.pool[selected] : null;
  const movingPlayer = moving != null ? d.slots[moving].filled : null;
  const fitsOf = (p) => (p ? norm(p.p) : []);
  return (
    <div className="relative mx-auto aspect-[68/105] w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/20" style={{ background: "repeating-linear-gradient(0deg, #1f6b3a 0 9%, #237a42 9% 18%)" }}>
      <div className="absolute inset-3 rounded-lg border border-white/30" />
      <div className="absolute left-0 right-0 top-1/2 h-px bg-white/30" />
      <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
      {d.slots.map((slot, i) => {
        const [x, y] = d.layout[i] || [50, 50];
        const canTarget = !slot.filled && ((sel && fitsOf(sel).includes(slot.type)) || (movingPlayer && fitsOf(movingPlayer).includes(slot.type)));
        return (
          <button key={i} onClick={() => onSlot(i)} aria-label={slot.filled ? `${slot.filled.n}, ${POS[slot.type]}` : `Puesto libre: ${POS[slot.type]}`}
            className={`absolute flex w-[72px] -translate-x-1/2 -translate-y-1/2 flex-col items-center ${canTarget ? "animate-pulse" : ""}`} style={{ left: `${x}%`, top: `${y}%` }}>
            <span className={`flex h-11 w-11 items-center justify-center rounded-full border-2 text-xs font-bold ${slot.filled ? "fq-pop border-white bg-black/60 text-white" : canTarget ? "border-amber bg-amber/25 text-amber" : "border-white/40 bg-black/30 text-white/70"} ${moving === i ? "ring-2 ring-accent" : ""}`}>
              {slot.filled ? (slot.filled.r ?? "✓") : slot.type}
            </span>
            <span className="mt-0.5 max-w-[72px] truncate rounded bg-black/55 px-1 text-[11px] leading-4 text-white">{slot.filled ? slot.filled.n : POS[slot.type]}</span>
          </button>
        );
      })}
    </div>
  );
}

export function DraftRound({ d, act }) {
  const [selected, setSelected] = useState(null);
  const [moving, setMoving] = useState(null);
  useEffect(() => { setSelected(null); setMoving(null); }, [d.round, d.team?.club, d.team?.season]);
  const almanaque = d.mode === "almanaque";
  async function onSlot(i) {
    const slot = d.slots[i];
    if (moving != null) { if (moving === i) { setMoving(null); return; } if (!slot.filled) { await act("move", { from: moving, to: i }); setMoving(null); } return; }
    if (slot.filled) { setSelected(null); setMoving(i); return; }
    if (selected == null) return;
    if (await act("pick", { poolIdx: selected, slotIdx: i })) setSelected(null);
  }
  const t = d.team;
  const left = (k) => (k === "club" ? (d.mode === "clasico" ? 1 : 2) - d.rerolls.usedClub : 1 - d.rerolls.usedSeason);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><span className="rounded-full border border-border px-3 py-1 text-xs">RONDA <b>{Math.min(d.round, d.total)}</b>/{d.total}</span><span className="rounded-full border border-border px-3 py-1 text-xs text-gray-400">{almanaque ? "De almanaque" : "Clásico"} · {d.formation}</span></div>
      <Card variant="feature" key={`${t.club}-${t.season}`} className="fq-deal">
        <div className="flex items-center gap-3"><span className="text-3xl" aria-hidden="true">{t.flag}</span>
          <div className="min-w-0"><p className="truncate text-lg font-bold">{t.club} {t.revelacion && <span className="ml-1 rounded bg-purple-500/20 px-1.5 py-0.5 align-middle text-[10px] text-purple-300">REVELACIÓN</span>}{t.bestXI && <span className="ml-1 rounded bg-amber/20 px-1.5 py-0.5 align-middle text-[10px] text-amber">MEJOR XI</span>}</p>
            <p className="text-xs text-gray-400">Temporada {t.season}{t.note ? ` · ${t.note}` : ""}</p></div></div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button disabled={!d.rerolls.club} onClick={() => act("reroll", { type: "club" })} className="btn btn-secondary btn-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-40"><RefreshCw size={13} /> Otro equipo · {left("club")}</button>
          {almanaque && <button disabled={!d.rerolls.season} onClick={() => act("reroll", { type: "season" })} className="btn btn-secondary btn-sm disabled:opacity-40">Otra temporada · {left("season")}</button>}
        </div>
      </Card>
      <Card>
        <p className="t-eyebrow">Elige a quién fichar</p>
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {d.pool.map((p, i) => {
            const empties = new Set(d.slots.filter((s) => !s.filled).map((s) => s.type));
            const fits = norm(p.p).some((x) => empties.has(x));
            const idol = t.idols?.includes(p.n);
            return (
              <button key={p.n} disabled={!fits} onClick={() => { setMoving(null); setSelected(selected === i ? null : i); }} aria-pressed={selected === i}
                className={`fq-deal rounded-xl border px-2.5 py-2 text-left text-sm transition-colors disabled:opacity-35 ${selected === i ? "border-accent bg-accent/15" : "border-border hover:border-white/30"}`} style={{ animationDelay: `${i * 45}ms` }}>
                <span className="flex items-center justify-between gap-1"><b className="truncate">{p.n}</b>{p.r != null && <span className={`tabular-nums font-bold ${p.r >= 88 ? "text-amber" : ""}`}>{p.r}</span>}</span>
                <span className="flex items-center gap-1 text-[11px] text-gray-400">{p.p}{idol && <Star size={10} className="text-sky-400" aria-label="ídolo del club" />}</span>
              </button>
            );
          })}
        </div>
      </Card>
      <p className="min-h-[1.25rem] text-center text-xs text-gray-400" role="status">{moving != null ? `Reubicando a ${d.slots[moving].filled.n}: toca el nuevo puesto (o el mismo para cancelar).` : selected != null ? `Toca un puesto libre para fichar a ${d.pool[selected].n}.` : "Toca un jugador y luego su puesto. Tocar a un fichado lo reubica."}</p>
      <Pitch d={d} selected={selected} moving={moving} onSlot={onSlot} />
    </div>
  );
}

export function Result({ d, act, room = false }) {
  const [slot, setSlot] = useState(null);
  const almanaque = d.mode === "almanaque";
  return (
    <div className="space-y-3">
      <Card variant="feature" className="fq-pop text-center">
        <p className="t-eyebrow">Tu equipo</p>
        <p className="text-5xl font-extrabold tabular-nums text-accent">{d.average}</p>
        <p className="text-xs text-gray-400">Media · {d.formation} · {STYLES.find((s) => s[0] === d.style)?.[1]}</p>
      </Card>
      <Card>
        <ol className="divide-y divide-border text-sm">
          {d.slots.map((s, i) => (
            <li key={i} className="flex items-center gap-2 py-1.5">
              <span className="w-12 shrink-0 text-[11px] text-gray-500">{POS[s.type]}</span>
              <span className="min-w-0 flex-1 truncate">{s.filled.n} <span className="text-xs text-gray-500">{s.filled.club} {s.filled.season}</span></span>
              <b className="tabular-nums">{s.filled.eff}</b>
              {almanaque && d.transfersLeft > 0 && <button onClick={async () => { if (await act("transfer", { slotIdx: i })) setSlot(i); }} className="btn btn-secondary btn-sm">Cambiar</button>}
            </li>
          ))}
        </ol>
        {almanaque && <p className="mt-2 text-xs text-gray-500">Fichajes que te quedan: <b>{d.transfersLeft}</b></p>}
      </Card>
      {d.transferOptions && (
        <Card className="fq-rise">
          <p className="t-eyebrow">Opciones para {POS[d.slots[d.transferSlot ?? slot ?? 0]?.type]}</p>
          <div className="mt-2 grid gap-2">
            {d.transferOptions.map((o, i) => <button key={o.n} onClick={() => act("apply", { optIdx: i })} className="fq-deal flex items-center justify-between rounded-xl border border-border px-3 py-2 text-left text-sm hover:border-accent/60" style={{ animationDelay: `${i * 70}ms` }}><span><b>{o.n}</b> <span className="text-xs text-gray-500">{o.club} {o.season}</span></span><b className="tabular-nums">{o.eff}</b></button>)}
          </div>
        </Card>
      )}
      <button onClick={() => act(room ? "ready" : "cup")} className="btn btn-primary w-full inline-flex items-center justify-center gap-2"><Trophy size={16} /> {room ? "Estoy listo: que juegue mi equipo" : "Jugar la Champions con este equipo"}</button>
    </div>
  );
}

// Tus partidos de la Champions, uno por uno con el visor; después el cuadro completo.
export function Cup({ d, onAgain }) {
  const rounds = d.cup.rounds;
  const mine = useMemo(() => rounds.map((r) => ({ name: r.name, m: r.matches.find((x) => x.isYours) })).filter((x) => x.m), [rounds]);
  const [i, setI] = useState(0);
  const [done, setDone] = useState(false);
  const [all, setAll] = useState(false);
  const cur = mine[i];
  const next = () => (i + 1 < mine.length ? (setI(i + 1), setDone(false)) : setAll(true));
  const f = d.final;
  const versus = !!f.versus;
  return (
    <div className="space-y-3">
      {!all && cur && (
        <>
          <Card variant="feature" key={cur.name}><p className="t-eyebrow">{ROUND[cur.name]}</p><p className="text-sm text-gray-300">Tu selección vs <b>{cur.m.home.isYou ? cur.m.away.label : cur.m.home.label}</b></p></Card>
          <MatchStage key={`${cur.name}`} match={fromDraft(cur.m)} onDone={() => setDone(true)} />
          {done && <button onClick={next} className="btn btn-primary w-full fq-rise">{versus ? "Ver el resultado" : i + 1 < mine.length ? (cur.m.winner === (cur.m.home.isYou ? "home" : "away") ? "Seguir en la Champions" : "Ver el cuadro") : "Ver el cuadro"}</button>}
        </>
      )}
      {(all || !cur) && (
        <>
          <Card variant="feature" className={`fq-pop text-center ${f.champion ? "border-amber/60" : ""}`}>
            <Trophy size={28} className={`mx-auto ${f.champion ? "text-amber" : "text-gray-500"}`} />
            <p className="mt-1 text-2xl font-black">{versus ? (f.champion ? `¡Le ganaste a ${f.rival}!` : `${f.rival} te ganó`) : f.champion ? "¡Campeón de Europa!" : `Eliminado en ${ROUND[f.eliminated]?.toLowerCase()}`}</p>
            <p className="text-sm text-gray-400">{versus ? `Tu equipo ${f.average} · el de ${f.rival} ${f.rivalAverage}` : f.champion ? "Levantaste la copa." : `Campeón: ${f.championName}`}</p>
            {f.rewards && <p className="mt-2 text-sm text-gray-300">{clubMessage(f.rewards.club)} {f.rewards.pack ? `Ganaste un sobre ${f.rewards.pack}.` : ""}</p>}
          </Card>
          {rounds.map((r) => (
            <Card key={r.name}><p className="t-eyebrow">{ROUND[r.name]}</p>
              <ul className="mt-1 divide-y divide-border text-sm">{r.matches.map((m, k) => (
                <li key={k} className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1.5 ${m.isYours ? "font-semibold text-accent" : ""}`}>
                  <span className={`truncate ${m.winner === "home" ? "" : "text-gray-500"}`}>{m.home.label}</span>
                  <span className="tabular-nums text-xs">{m.scoreHome}–{m.scoreAway}{m.pens ? ` (${m.penHome}–${m.penAway})` : ""}</span>
                  <span className={`truncate text-right ${m.winner === "away" ? "" : "text-gray-500"}`}>{m.away.label}</span>
                </li>))}</ul></Card>
          ))}
          <button onClick={onAgain} className="btn btn-primary w-full inline-flex items-center justify-center gap-2">{versus ? "Otro duelo" : "Nueva copa"} <ArrowRight size={15} /></button>
        </>
      )}
    </div>
  );
}

export default function DraftSolo() {
  const { loading, draft, start, act, reset } = useDraft();
  return (
    <Layout>
      <div className="mx-auto max-w-xl space-y-4">
        {loading && <p className="text-sm text-gray-500">Cargando…</p>}
        {!loading && !draft && <Setup onStart={start} />}
        {draft?.phase === "draft" && <DraftRound d={draft} act={act} />}
        {draft?.phase === "result" && <Result d={draft} act={act} />}
        {draft?.phase === "done" && <Cup d={draft} onAgain={reset} />}
      </div>
    </Layout>
  );
}
