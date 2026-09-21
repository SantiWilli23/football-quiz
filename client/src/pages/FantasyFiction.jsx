import { useEffect, useState } from "react";
import { ArrowLeftRight, Check, Crown, Lock, TrendingUp, Unlock, X } from "lucide-react";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useGroups } from "../context/GroupContext.jsx";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import { SkeletonCard } from "../components/Skeleton.jsx";
import GroupSelector from "../components/GroupSelector.jsx";

function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function PlayerSearch({ leagueId, budgetLeft, exclude, onPick }) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setResults([]);
      return;
    }
    api
      .get(`/fantasyfiction/${leagueId}/players`, { params: { q: debouncedQuery.trim() } })
      .then(({ data }) => setResults(data.players.filter((p) => !exclude.includes(p.id))))
      .catch(() => setResults([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar jugador..."
        className="w-full bg-panel border border-border rounded-card px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
      />
      {results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-panel border border-border rounded-card overflow-hidden shadow-lg max-h-64 overflow-y-auto">
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(p)}
              disabled={p.price > budgetLeft}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between gap-2"
            >
              <span>
                {p.name} <span className="text-xs text-gray-500">· {p.position || p.nationality}</span>
              </span>
              <span className="text-xs font-semibold text-accent shrink-0">{p.price}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Plantel inicial sorteado por el servidor (~200M): el jugador puede pedir
// otro sorteo o quedarse con este. Si prefiere armarlo a mano, cae en SquadDraft.
function StarterSquad({ league, onJoined }) {
  const unit = league.unit ? ` ${league.unit}` : "";
  const [starter, setStarter] = useState(null);
  const [rolls, setRolls] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const roll = async () => {
    setError("");
    try {
      const { data } = await api.get(`/fantasyfiction/${league.id}/starter`);
      setStarter(data);
    } catch {
      setError("No se pudo sortear el plantel");
    }
  };
  useEffect(() => { roll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post(`/fantasyfiction/${league.id}/join`, { squad: starter.squad.map((p) => p.id) });
      onJoined(data.league);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo confirmar el plantel");
    } finally {
      setBusy(false);
    }
  };

  if (!starter) return <p className="text-sm text-gray-500">{error || "Sorteando tu plantel..."}</p>;

  const groups = ["Portero", "Defensa", "Mediocampista", "Delantero"].map((pos) => [pos, starter.squad.filter((p) => p.category === pos)]);

  return (
    <div className="rounded-card border border-border bg-bg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Tu plantel inicial</p>
        <p className="text-sm font-semibold text-accent">Valor: {starter.cost}{unit} de {league.budgetTotal}{unit}</p>
      </div>
      <p className="text-xs text-gray-500">
        Te toca un plantel de unos {league.budgetTotal}{unit}. Podés pedir otro sorteo o quedarte con este y mejorarlo en el mercado (miércoles y domingos).
      </p>
      <div className="space-y-2">
        {groups.map(([pos, list]) => (
          <div key={pos}>
            <p className="text-xs uppercase tracking-wide text-gray-600 mb-1">{pos}s</p>
            <div className="flex flex-wrap gap-2">
              {list.map((p) => (
                <span key={p.id} className="text-xs px-3 py-1.5 rounded-full border border-border bg-panel">
                  {p.name} · {p.price}{unit}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={confirm}
          disabled={busy}
          className="btn btn-primary flex-1 min-w-[160px]"
        >
          {busy ? "Confirmando..." : "Quedarme con este plantel"}
        </button>
        <button
          onClick={() => { setRolls((r) => r + 1); roll(); }}
          disabled={busy}
          className="px-4 py-2.5 rounded-card border border-border text-sm text-gray-300 hover:text-white hover:border-white/30"
        >
          Sortear otro ({rolls})
        </button>
      </div>
    </div>
  );
}

function SquadDraft({ league, onJoined }) {
  const [squad, setSquad] = useState([]); // [{id, name, price}]
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const spent = squad.reduce((sum, p) => sum + p.price, 0);
  const budgetLeft = league.budgetTotal - spent;

  const addPlayer = (p) => {
    if (squad.length >= league.squadSize) return;
    setSquad((prev) => [...prev, p]);
  };
  const removePlayer = (id) => setSquad((prev) => prev.filter((p) => p.id !== id));

  const confirm = async () => {
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post(`/fantasyfiction/${league.id}/join`, { squad: squad.map((p) => p.id) });
      onJoined(data.league);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo armar el plantel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-card border border-border bg-bg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Armá tu plantel ({squad.length}/{league.squadSize})
        </p>
        <p className="text-sm font-semibold text-accent">
          {budgetLeft} / {league.budgetTotal}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {squad.map((p) => (
          <span key={p.id} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-accent/40 bg-accent/10 text-accent">
            {p.name} · {p.price}
            <button onClick={() => removePlayer(p.id)}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      {squad.length < league.squadSize && (
        <PlayerSearch
          leagueId={league.id}
          budgetLeft={budgetLeft}
          exclude={squad.map((p) => p.id)}
          onPick={addPlayer}
        />
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        onClick={confirm}
        disabled={squad.length !== league.squadSize || loading}
        className="btn btn-primary w-full"
      >
        {loading ? "Confirmando..." : "Confirmar plantel"}
      </button>
    </div>
  );
}

function TransferMarket({ league, onChanged }) {
  const [sellId, setSellId] = useState(null);
  const [buyCandidate, setBuyCandidate] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sellPlayer = league.mySquad.find((p) => p.id === sellId);
  const budgetIfSell = sellPlayer ? league.myBudgetRemaining + sellPlayer.price : league.myBudgetRemaining;

  const confirmTransfer = async () => {
    if (!sellId || !buyCandidate) return;
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post(`/fantasyfiction/${league.id}/transfer`, {
        sellPlayerId: sellId,
        buyPlayerId: buyCandidate.id,
      });
      onChanged(data.league);
      setSellId(null);
      setBuyCandidate(null);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo hacer el fichaje");
    } finally {
      setLoading(false);
    }
  };

  if (!league.marketOpen) {
    return (
      <div className="rounded-card border border-border bg-bg p-4 flex items-center gap-3 text-sm text-gray-400">
        <Lock size={16} />
        El mercado abre los miércoles y domingos. Volvé ese día para hacer fichajes.
      </div>
    );
  }

  return (
    <div className="rounded-card border border-accent/40 bg-accent/5 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-accent">
        <Unlock size={15} />
        Mercado abierto hoy
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-2">1. Elegí a quién vender</p>
        <div className="flex flex-wrap gap-2">
          {league.mySquad.map((p) => (
            <button
              key={p.id}
              onClick={() => setSellId(p.id === sellId ? null : p.id)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                sellId === p.id ? "border-accent bg-accent/20 text-accent" : "border-border text-gray-300 hover:border-white/30"
              }`}
            >
              {p.name} · {p.price}
            </button>
          ))}
        </div>
      </div>

      {sellId && (
        <div>
          <p className="text-xs text-gray-500 mb-2">
            2. Elegí a quién comprar (presupuesto disponible: {budgetIfSell})
          </p>
          <PlayerSearch
            leagueId={league.id}
            budgetLeft={budgetIfSell}
            exclude={league.mySquad.map((p) => p.id)}
            onPick={setBuyCandidate}
          />
          {buyCandidate && (
            <div className="mt-2 flex items-center justify-between rounded-card border border-border bg-panel px-3 py-2">
              <span className="text-sm">
                {buyCandidate.name} <span className="text-xs text-gray-500">· {buyCandidate.price}</span>
              </span>
              <button onClick={() => setBuyCandidate(null)} className="text-gray-500 hover:text-white">
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {sellId && buyCandidate && (
        <button
          onClick={confirmTransfer}
          disabled={loading}
          className="btn btn-primary w-full"
        >
          {loading ? "Confirmando..." : "Confirmar fichaje"}
        </button>
      )}
    </div>
  );
}

// Intercambio directo 1x1 con otro participante — no toca presupuesto, es
// un acuerdo entre dos personas ("vender a otro jugador" en vez de al
// mercado con dinero).
function TradeOffers({ league, onChanged }) {
  const [otherId, setOtherId] = useState(league.otherParticipants[0]?.userId ?? null);
  const [mineId, setMineId] = useState(null);
  const [theirsId, setTheirsId] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const other = league.otherParticipants.find((p) => p.userId === otherId) || null;

  const propose = async () => {
    if (!other || !mineId || !theirsId) return;
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post(`/fantasyfiction/${league.id}/trade-offer`, {
        toUserId: other.userId,
        offerPlayerId: mineId,
        wantPlayerId: theirsId,
      });
      onChanged(data.league);
      setMineId(null);
      setTheirsId(null);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo mandar la oferta");
    } finally {
      setBusy(false);
    }
  };

  const respond = async (offerId, action) => {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post(`/fantasyfiction/${league.id}/trade-offer/${offerId}/${action}`);
      onChanged(data.league);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo actualizar la oferta");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {league.tradeOffersReceived.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Te ofrecieron</p>
          <div className="space-y-2">
            {league.tradeOffersReceived.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 rounded-card border border-accent/30 bg-accent/5 px-3 py-2.5">
                <p className="text-sm">
                  <span className="font-medium">{o.fromUsername}</span> te da {o.offerPlayer.name} ({o.offerPlayer.price}) por tu {o.wantPlayer.name} ({o.wantPlayer.price})
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => respond(o.id, "accept")} disabled={busy} className="p-1.5 rounded-card bg-accent/20 text-accent hover:bg-accent/30 transition-colors">
                    <Check size={14} />
                  </button>
                  <button onClick={() => respond(o.id, "decline")} disabled={busy} className="p-1.5 rounded-card bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {league.tradeOffersSent.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Ofertas que mandaste</p>
          <div className="space-y-2">
            {league.tradeOffersSent.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 rounded-card border border-border bg-bg px-3 py-2.5">
                <p className="text-sm text-gray-300">
                  Le ofreciste {o.offerPlayer.name} a <span className="font-medium">{o.toUsername}</span> por {o.wantPlayer.name}
                </p>
                <button onClick={() => respond(o.id, "decline")} disabled={busy} className="text-xs text-gray-500 hover:text-white transition-colors shrink-0">
                  Cancelar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {league.otherParticipants.length === 0 ? (
        <p className="text-sm text-gray-500">No hay nadie más en esta liga todavía.</p>
      ) : (
        <div className="rounded-card border border-border bg-bg p-4 space-y-3">
          <p className="text-xs text-gray-500">Ofrecerle un cambio a otro jugador de la liga</p>

          <select
            value={otherId || ""}
            onChange={(e) => { setOtherId(Number(e.target.value)); setTheirsId(null); }}
            className="w-full bg-panel border border-border rounded-card px-3 py-2 text-sm focus:outline-none focus:border-accent"
          >
            {league.otherParticipants.map((p) => (
              <option key={p.userId} value={p.userId}>{p.username}</option>
            ))}
          </select>

          {other && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Vos das</p>
                <div className="flex flex-wrap gap-1.5">
                  {league.mySquad.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setMineId(p.id === mineId ? null : p.id)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        mineId === p.id ? "border-accent bg-accent/20 text-accent" : "border-border text-gray-300 hover:border-white/30"
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Vos pedís</p>
                <div className="flex flex-wrap gap-1.5">
                  {other.squad.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setTheirsId(p.id === theirsId ? null : p.id)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        theirsId === p.id ? "border-accent bg-accent/20 text-accent" : "border-border text-gray-300 hover:border-white/30"
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            onClick={propose}
            disabled={!mineId || !theirsId || busy}
            className="btn btn-primary w-full"
          >
            Mandar oferta
          </button>
        </div>
      )}
    </div>
  );
}

export default function FantasyFiction() {
  const { user } = useAuth();
  const { activeGroupId: groupId, groups } = useGroups();
  const [league, setLeague] = useState(undefined); // undefined = cargando, null = no hay
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    if (!groupId) return;
    api
      .get("/fantasyfiction", { params: { groupId } })
      .then(({ data }) => setLeague(data.league))
      .catch(() => setLeague(null));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  useEffect(() => {
    if (!league) return;
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league?.id, league?.status]);

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/fantasyfiction", { groupId });
      setLeague(data.league);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo crear la liga");
    } finally {
      setBusy(false);
    }
  };

  if (groups.length === 0) {
    return (
      <Layout>
        <h1 className="text-xl sm:text-2xl font-bold mb-1">FantasyFiction</h1>
        <p className="text-gray-400 text-sm mb-6">Liga fantasy simulada con todo tu grupo</p>
        <Card>
          <p className="text-gray-400 text-center py-6">Necesitás estar en un grupo para jugar FantasyFiction.</p>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold mb-1 flex items-center gap-2">
            <TrendingUp size={22} className="text-accent" />
            FantasyFiction
          </h1>
          <p className="text-gray-400 text-sm">
            Arrancás con un plantel de unos 200M€ que te sorteamos y lo mejorás en el mercado. La liga arranca cuando se suma todo el grupo: una
            jornada por semana, mercado de pases los miércoles y domingos.
          </p>
        </div>
        <GroupSelector />
      </div>

      {league === undefined && <SkeletonCard />}

      {league === null && (
        <Card>
          <p className="text-sm text-gray-400 mb-4">Todavía no hay una FantasyFiction en este grupo.</p>
          {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
          <button
            onClick={create}
            disabled={busy}
            className="px-4 py-2 rounded-card text-sm font-medium bg-accent hover:bg-accent-dark disabled:opacity-50 text-onaccent transition-colors"
          >
            {busy ? "Creando..." : "Crear FantasyFiction"}
          </button>
        </Card>
      )}

      {league && league.status === "draft" && (
        <Card>
          <p className="text-sm text-gray-400 mb-1">
            {league.participantCount}/{league.memberCount} del grupo ya armaron su plantel.
          </p>
          <p className="text-xs text-gray-600 mb-4">
            La liga arranca a simular sola apenas se sume el último miembro del grupo.
          </p>
          {league.iJoined ? (
            <p className="text-sm text-accent">Ya armaste tu plantel. Esperando al resto del grupo...</p>
          ) : (
            <StarterSquad league={league} onJoined={setLeague} />
          )}
        </Card>
      )}

      {league && (league.status === "active" || league.status === "finished") && (
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Tabla — Jornada {league.jornada}</h3>
            </div>
            <div className="space-y-2">
              {league.standings.map((s) => (
                <div
                  key={s.userId}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-card border ${
                    s.isMe ? "border-accent/40 bg-accent/5" : "border-border"
                  }`}
                >
                  <div className="w-6 text-center text-sm font-semibold text-gray-400 flex items-center justify-center">
                    {s.position === 1 ? <Crown size={15} className="text-accent" /> : s.position}
                  </div>
                  <p className="flex-1 text-sm font-medium truncate">{s.username}</p>
                  <p className="text-sm font-semibold">{s.points} pts</p>
                </div>
              ))}
            </div>
          </Card>

          {league.iJoined && (
            <Card>
              <h3 className="font-semibold mb-4">Tu plantel</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {league.mySquad.map((p) => (
                  <span key={p.id} className="text-xs px-3 py-1.5 rounded-full border border-border bg-bg">
                    {p.name} · {p.price}{league.unit ? ` ${league.unit}` : ""}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-500 mb-4">Presupuesto disponible: {league.myBudgetRemaining}{league.unit ? ` ${league.unit}` : ""}</p>
              <TransferMarket league={league} onChanged={setLeague} />
            </Card>
          )}

          {league.iJoined && (
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <ArrowLeftRight size={16} className="text-accent" />
                <h3 className="font-semibold">Cambios con otros jugadores</h3>
              </div>
              <TradeOffers league={league} onChanged={setLeague} />
            </Card>
          )}
        </div>
      )}
    </Layout>
  );
}
