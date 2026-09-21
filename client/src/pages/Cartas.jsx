import { useCallback, useEffect, useMemo, useState } from "react";
import { Layers, Package, Shield, Swords } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { playSfx } from "../utils/sfx.js";

// Clases escritas literales para que Tailwind las genere.
const TIER_STYLE = {
  estrella: "border-purple-500/70 bg-purple-500/10 text-purple-400",
  oro: "border-amber-500/70 bg-amber-500/10 text-amber-500",
  plata: "border-gray-400/60 bg-gray-400/10 text-gray-300",
  bronce: "border-orange-700/60 bg-orange-700/10 text-orange-500",
};
const POS_LABEL = { GK: "Arquero", DEF: "Defensas", MID: "Medios", FWD: "Delanteros" };
const FORMATION = { GK: 1, DEF: 4, MID: 3, FWD: 3 };

function PlayerCard({ c, selected, onClick, small }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`text-left rounded-xl border ${TIER_STYLE[c.tier]} ${small ? "p-2" : "p-3"} ${selected ? "ring-2 ring-accent" : ""} ${onClick ? "hover:brightness-125 transition" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-lg font-bold tabular-nums leading-none">{c.ovr}</span>
        <span className="text-[10px] uppercase tracking-wide opacity-80">{c.pos}</span>
      </div>
      <p className="text-sm font-semibold text-white mt-2 leading-tight">{c.name}</p>
      <p className="text-[11px] text-gray-400 truncate">{c.club}</p>
      <p className="text-[10px] opacity-70 mt-1">{c.tierLabel}{c.count > 1 ? ` · x${c.count}` : ""}{c.isNew ? " · ¡NUEVA!" : ""}</p>
    </Tag>
  );
}

export default function Cartas() {
  const { toast } = useToast();
  const [tab, setTab] = useState("sobres");
  const [state, setState] = useState(null);
  const [collection, setCollection] = useState([]);
  const [opened, setOpened] = useState(null);
  const [selected, setSelected] = useState([]);
  const [strength, setStrength] = useState(null);
  const [rivals, setRivals] = useState([]);
  const [rival, setRival] = useState("cpu");
  const [match, setMatch] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [s, c, l, r] = await Promise.all([
      api.get("/cards/state"), api.get("/cards/collection"), api.get("/cards/lineup"), api.get("/cards/rivals"),
    ]);
    setState(s.data);
    setCollection(c.data.cards);
    setSelected(l.data.players.map((p) => p.name));
    setStrength(l.data.strength);
    setRivals(r.data.rivals);
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);

  async function claimDaily() {
    await api.post("/cards/claim-daily");
    toast("Sobre diario listo");
    load();
  }

  async function openPack() {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await api.post("/cards/open");
      setOpened(data.cards);
      playSfx(data.cards.some((c) => c.tier === "estrella" || c.tier === "oro") ? "win" : "ok");
      await load();
    } catch (err) {
      toast(err.response?.data?.error || "No se pudo abrir el sobre");
    } finally {
      setBusy(false);
    }
  }

  const byName = useMemo(() => new Map(collection.map((c) => [c.name, c])), [collection]);
  const counts = useMemo(() => {
    const out = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const n of selected) if (byName.get(n)) out[byName.get(n).pos]++;
    return out;
  }, [selected, byName]);

  function toggle(c) {
    setSelected((cur) => {
      if (cur.includes(c.name)) return cur.filter((n) => n !== c.name);
      if (counts[c.pos] >= FORMATION[c.pos]) { toast(`Ya elegiste ${FORMATION[c.pos]} ${POS_LABEL[c.pos].toLowerCase()}`); return cur; }
      return [...cur, c.name];
    });
  }

  async function saveLineup() {
    setBusy(true);
    try {
      const { data } = await api.put("/cards/lineup", { players: selected });
      setStrength(data.strength);
      toast("Equipo guardado");
      load();
    } catch (err) {
      toast(err.response?.data?.error || "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  async function play() {
    setBusy(true);
    try {
      const { data } = await api.post("/cards/match", { vs: rival });
      setMatch(data);
      playSfx(data.result === "win" ? "win" : data.result === "loss" ? "bad" : "tick");
      if (data.pack) toast("¡Ganaste un sobre!");
      load();
    } catch (err) {
      toast(err.response?.data?.error || "No se pudo jugar");
    } finally {
      setBusy(false);
    }
  }

  const TABS = [["sobres", "Sobres", Package], ["album", "Álbum", Layers], ["equipo", "Mi equipo", Shield]];

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="t-title mb-1">Cartas</h1>
        <p className="text-gray-400 text-sm">Cada jugador de la base es una carta. Abrí sobres, armá tu once y jugá partidos: la química sale de los clubes que compartieron.</p>
      </div>

      <div className="flex gap-1.5 mb-5">
        {TABS.map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-card text-xs font-medium border inline-flex items-center gap-1.5 transition-colors ${
              tab === k ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-gray-400 hover:text-white"
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
        {state && <span className="ml-auto text-xs text-gray-500 self-center">{state.owned} / {state.total} cartas</span>}
      </div>

      {tab === "sobres" && state && (
        <div className="space-y-4">
          <Card className="text-center py-8">
            <p className="text-4xl font-bold tabular-nums mb-1">{state.packs}</p>
            <p className="text-sm text-gray-400 mb-5">sobre{state.packs === 1 ? "" : "s"} para abrir · 5 cartas cada uno</p>
            <div className="flex gap-2 justify-center flex-wrap">
              <button onClick={openPack} disabled={busy || state.packs === 0} className="px-6 py-2.5 rounded-card bg-accent text-onaccent font-semibold text-sm hover:opacity-90 disabled:opacity-40">
                Abrir sobre
              </button>
              {!state.dailyClaimed && (
                <button onClick={claimDaily} className="px-6 py-2.5 rounded-card border border-border text-sm font-medium text-gray-300 hover:text-white">
                  Reclamar sobre diario
                </button>
              )}
            </div>
            <p className="t-meta mt-4">Ganás sobres con el diario, cumpliendo el reto del día y ganando partidos (máx. 2 por día).</p>
          </Card>
          {opened && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {opened.map((c, i) => <PlayerCard key={i} c={c} />)}
            </div>
          )}
        </div>
      )}

      {tab === "album" && (
        collection.length === 0 ? (
          <Card><EmptyState icon={Package} title="Todavía no tenés cartas" hint="Reclamá tu sobre diario y abrilo para empezar el álbum." actions={[{ label: "Ir a Sobres", onClick: () => setTab("sobres") }]} /></Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {collection.map((c) => <PlayerCard key={c.name} c={c} small />)}
          </div>
        )
      )}

      {tab === "equipo" && (
        <div className="space-y-4">
          <Card>
            <p className="t-eyebrow mb-3">Tu once (1-4-3-3)</p>
            <div className="flex gap-4 text-sm flex-wrap mb-3">
              {Object.keys(FORMATION).map((k) => (
                <span key={k} className={counts[k] === FORMATION[k] ? "text-emerald-500" : "text-gray-400"}>{POS_LABEL[k]} {counts[k]}/{FORMATION[k]}</span>
              ))}
            </div>
            {strength && <p className="t-meta mb-3">Fuerza {Math.round(strength.total)} · química +{Math.round(strength.chem + strength.nat)}</p>}
            <div className="flex gap-2 flex-wrap">
              <button onClick={saveLineup} disabled={busy || selected.length !== 11} className="px-4 py-2 rounded-card bg-accent text-onaccent text-xs font-semibold disabled:opacity-40">Guardar equipo</button>
            </div>
          </Card>

          <Card>
            <p className="t-eyebrow mb-3">Jugar un partido</p>
            <div className="flex gap-2 items-center flex-wrap">
              <select value={rival} onChange={(e) => setRival(e.target.value)} className="bg-bg border border-border rounded-card px-3 py-2 text-sm">
                <option value="cpu">Contra la CPU</option>
                {rivals.map((r) => <option key={r.id} value={r.id}>Contra {r.username}</option>)}
              </select>
              <button onClick={play} disabled={busy || !strength} className="px-4 py-2 rounded-card border border-border text-xs font-semibold text-gray-200 hover:text-white inline-flex items-center gap-1.5 disabled:opacity-40">
                <Swords size={13} /> Jugar
              </button>
            </div>
            {match && (
              <p className="mt-4 text-sm">
                <span className="text-2xl font-bold tabular-nums mr-2">{match.score[0]} – {match.score[1]}</span>
                {match.result === "win" ? "¡Ganaste" : match.result === "draw" ? "Empate" : "Perdiste"} contra {match.opponent}
                <span className="t-meta block mt-1">Tu fuerza {match.strength.mine} vs {match.strength.theirs} (química +{match.strength.chemistry}){match.pack ? " · +1 sobre" : ""}</span>
              </p>
            )}
          </Card>

          {collection.length === 0 ? (
            <Card><EmptyState icon={Package} title="Sin cartas todavía" hint="Abrí sobres para poder armar tu equipo." actions={[{ label: "Ir a Sobres", onClick: () => setTab("sobres") }]} /></Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {collection.map((c) => <PlayerCard key={c.name} c={c} small selected={selected.includes(c.name)} onClick={() => toggle(c)} />)}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
