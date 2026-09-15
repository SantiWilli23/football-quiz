import { useEffect, useState } from "react";
import { Building2, Coins, Handshake, Heart, Landmark, ShieldX, Sprout, Trophy, Users } from "lucide-react";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import { teamsByLeague, teamById } from "../carrera/data/teams.js";
import TeamCrest from "../carrera/components/TeamCrest.jsx";
import {
  initialPresidentState, advanceWeek, applyDecisionEffects,
  canUpgradeStadium, upgradeStadium, hireSponsor, hireAcademy, fireDt, objectiveFor,
  STADIUM_TIERS, SPONSOR_TIERS, ACADEMY_TIERS, TICKET_PRICE_LEVELS, WEEKS_PER_SEASON,
} from "../presidente/engine.js";
import { buildPresidenteLegacy } from "../presidente/legacy.js";

const SAVE_KEY = "presidente_v1";

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function save(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    /* sin storage disponible: no rompe el juego */
  }
}

function ClubPicker({ onPick }) {
  const [league, setLeague] = useState("premier");
  const list = teamsByLeague(league);

  return (
    <Card>
      <h3 className="font-semibold mb-4">Elegí el club que vas a presidir</h3>
      <div className="flex gap-2 mb-4">
        {["premier", "laliga"].map((l) => (
          <button
            key={l}
            onClick={() => setLeague(l)}
            className={`px-3 py-1.5 rounded-card text-sm font-medium border transition-colors ${
              league === l ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-gray-400"
            }`}
          >
            {l === "premier" ? "Premier League" : "La Liga"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {list.map((t) => (
          <button
            key={t.id}
            onClick={() => onPick(t)}
            className="flex items-center gap-2.5 px-3 py-3 rounded-card border border-border bg-bg hover:border-accent/40 transition-colors text-left"
          >
            <TeamCrest team={t} size={32} />
            <span className="text-sm font-medium truncate">{t.name}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

function StatBar({ label, value, color }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span className="font-semibold" style={{ color }}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

function trustColor(v) {
  return v >= 60 ? "#3fae9a" : v >= 30 ? "#d9a441" : "#e0664f";
}

function Dashboard({ state, setState }) {
  const team = teamById(state.teamId);
  const objective = objectiveFor(state.teamId);
  const [showHistory, setShowHistory] = useState(false);
  const [legacy, setLegacy] = useState(null);
  const [confirmRetire, setConfirmRetire] = useState(false);

  const handleDecision = (idx) => {
    setState((s) => {
      const next = applyDecisionEffects(s, s.currentDecision, idx);
      return { ...next, decisionUsed: true };
    });
  };

  const handleAdvance = () => setState((s) => advanceWeek(s));
  const handleUpgradeStadium = () => setState((s) => upgradeStadium(s));
  const handleSponsor = (tier) => setState((s) => hireSponsor(s, tier));
  const handleAcademy = (tier) => setState((s) => hireAcademy(s, tier));
  const handleFireDt = () => setState((s) => fireDt(s));
  const openLegacy = () => setLegacy(buildPresidenteLegacy(state));
  const retire = () => { localStorage.removeItem(SAVE_KEY); setState(null); };

  if (state.gameOver) {
    return (
      <Card>
        <div className="text-center py-10">
          <ShieldX size={40} className="mx-auto text-red-400 mb-3" />
          <p className="text-xl font-bold mb-2">Destituido</p>
          <p className="text-gray-400 mb-6">La directiva perdió la confianza en tu gestión al frente de {team.name}.</p>
          <button
            onClick={() => { localStorage.removeItem(SAVE_KEY); setState(null); }}
            className="bg-accent text-onaccent font-semibold px-5 py-2.5 rounded-2xl"
          >
            Empezar de nuevo
          </button>
        </div>
      </Card>
    );
  }

  const nextStadium = STADIUM_TIERS[state.stadiumTier];

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center gap-4 flex-wrap justify-between">
          <div className="flex items-center gap-3">
            <TeamCrest team={team} size={48} />
            <div>
              <p className="font-bold text-lg">{team.name}</p>
              <p className="text-xs text-gray-500">Temporada {state.season} · Semana {state.week}/{WEEKS_PER_SEASON}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Coins size={16} className="text-accent" />
            €{state.budget}M {state.debt > 0 && <span className="text-red-400 text-xs">(deuda €{state.debt}M)</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
          <StatBar label="Confianza directiva" value={state.boardTrust} color={trustColor(state.boardTrust)} />
          <StatBar label="Hinchada" value={state.fanHappiness} color={trustColor(state.fanHappiness)} />
          <div className="text-xs text-gray-500">
            <p className="mb-0.5">Estadio: nivel {state.stadiumTier} ({STADIUM_TIERS[state.stadiumTier - 1].capacity.toLocaleString()})</p>
            <p>Precio entrada: €{TICKET_PRICE_LEVELS[state.ticketPriceLevel - 1]}</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide font-semibold text-gray-500">
            <Landmark size={13} />
            <span>Objetivo de la directiva</span>
          </div>
          {state.titlesWon > 0 && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border text-accent border-accent/30 bg-accent/10">
              🏆 {state.titlesWon} título{state.titlesWon === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <p className="text-sm font-semibold">{objective.label}</p>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={15} className="text-accent" />
          <h3 className="font-semibold">Decisión de la semana</h3>
        </div>
        {state.currentDecision && !state.decisionUsed ? (
          <div>
            <p className="text-sm text-gray-300 mb-4">{state.currentDecision.context}</p>
            <div className="space-y-2">
              {state.currentDecision.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleDecision(i)}
                  className="w-full text-left px-4 py-3 rounded-card border border-border bg-bg hover:border-accent/40 transition-colors text-sm"
                >
                  {opt.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Ya decidiste esta semana.</p>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Building2 size={15} className="text-accent" />
          <h3 className="font-semibold">Gestión del club</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={handleUpgradeStadium}
            disabled={!nextStadium || !canUpgradeStadium(state)}
            className="px-3 py-3 rounded-card border border-border bg-bg hover:border-accent/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
          >
            <p className="text-sm font-medium mb-0.5">Ampliar estadio</p>
            <p className="text-xs text-gray-500">
              {nextStadium ? `€${nextStadium.upgradeCost}M → ${nextStadium.capacity.toLocaleString()}` : "Ya está al máximo"}
            </p>
          </button>

          {SPONSOR_TIERS.map((s) => (
            <button
              key={s.tier}
              onClick={() => handleSponsor(s.tier)}
              disabled={state.sponsorTier >= s.tier || state.budget < s.tier * 1.5}
              className="px-3 py-3 rounded-card border border-border bg-bg hover:border-accent/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
            >
              <p className="text-sm font-medium mb-0.5 flex items-center gap-1.5">
                <Handshake size={13} /> {s.label}
              </p>
              <p className="text-xs text-gray-500">€{s.tier * 1.5}M · +€{s.weeklyIncome}M/sem</p>
            </button>
          ))}

          {ACADEMY_TIERS.map((a) => (
            <button
              key={a.tier}
              onClick={() => handleAcademy(a.tier)}
              disabled={state.academyTier >= a.tier || state.budget < a.cost}
              className="px-3 py-3 rounded-card border border-border bg-bg hover:border-accent/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
            >
              <p className="text-sm font-medium mb-0.5 flex items-center gap-1.5">
                <Sprout size={13} /> {a.label}
              </p>
              <p className="text-xs text-gray-500">€{a.cost}M · nivel del plantel sube solo cada temporada</p>
            </button>
          ))}

          <button
            onClick={handleFireDt}
            className="px-3 py-3 rounded-card border border-red-500/30 bg-red-500/5 hover:border-red-500/50 transition-colors text-left"
          >
            <p className="text-sm font-medium mb-0.5 text-red-300">Echar al DT</p>
            <p className="text-xs text-gray-500">Sube la hinchada, resiente a la directiva</p>
          </button>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Users size={15} className="text-accent" />
          <h3 className="font-semibold">Novedades</h3>
        </div>
        <div className="space-y-1.5">
          {state.news.map((n, i) => (
            <p key={i} className="text-xs text-gray-500">{n}</p>
          ))}
        </div>
      </Card>

      {state.history.length > 0 && (
        <Card>
          <button onClick={() => setShowHistory((v) => !v)} className="flex items-center gap-2 w-full text-left">
            <Trophy size={15} className="text-accent" />
            <h3 className="font-semibold flex-1">Historial de gestión ({state.history.length} temporada{state.history.length === 1 ? "" : "s"})</h3>
            <span className="text-xs text-gray-500">{showHistory ? "Ocultar" : "Ver"}</span>
          </button>

          {showHistory && (
            <div className="space-y-2 mt-4">
              {state.history.map((h, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-card border border-border bg-bg px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">Temporada {h.season}</p>
                    <p className="text-xs text-gray-500">{h.objectiveLabel} — {h.objectiveMet ? "cumplido" : "no cumplido"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{h.position}°{h.champion && " 🏆"}</p>
                    <p className="text-[11px] text-gray-500">de {h.leagueSize}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 mt-4 border-t border-border">
            {!legacy ? (
              <button onClick={openLegacy} className="text-sm text-gray-500 hover:text-amber transition-colors">
                🏛 Ver mi legado y renunciar
              </button>
            ) : (
              <div className="bg-panel border border-amber/30 rounded-2xl p-5 space-y-4">
                <h3 className="font-bold text-lg text-amber">🏛 Tu legado como presidente de {legacy.teamName}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-2xl font-bold">{legacy.seasonsCount}</p>
                    <p className="text-xs text-gray-500">Temporadas</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber">{legacy.titlesWon}</p>
                    <p className="text-xs text-gray-500">Títulos</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald">{legacy.objectivesMet}</p>
                    <p className="text-xs text-gray-500">Objetivos cumplidos</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{legacy.finalStadiumTier}</p>
                    <p className="text-xs text-gray-500">Nivel de estadio final</p>
                  </div>
                </div>
                {legacy.best && <p className="text-sm text-gray-400">Tu mejor temporada: <span className="text-white font-semibold">{legacy.best.position}°</span> de {legacy.best.leagueSize}.</p>}

                {!confirmRetire ? (
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => setConfirmRetire(true)}
                      className="text-sm font-semibold px-4 py-2.5 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors"
                    >
                      Renunciar para siempre
                    </button>
                    <button onClick={() => setLegacy(null)} className="text-sm text-gray-500 hover:text-white transition-colors">
                      Cerrar
                    </button>
                  </div>
                ) : (
                  <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-4">
                    <p className="text-sm mb-3">Esto borra tu gestión para siempre. No se puede deshacer.</p>
                    <div className="flex items-center gap-3">
                      <button onClick={retire} className="text-sm font-semibold px-4 py-2.5 rounded-2xl bg-red-500 hover:bg-red-600 text-white transition-colors">
                        Sí, renunciar
                      </button>
                      <button onClick={() => setConfirmRetire(false)} className="text-sm text-gray-400 hover:text-white transition-colors">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      <button
        onClick={handleAdvance}
        className="w-full bg-accent hover:bg-accent-dark text-onaccent font-semibold rounded-2xl py-3 text-sm transition-colors"
      >
        {state.week >= WEEKS_PER_SEASON - 1 ? "Cerrar temporada →" : "Avanzar semana →"}
      </button>
    </div>
  );
}

export default function Presidente() {
  const [state, setState] = useState(() => load());

  useEffect(() => {
    if (state) save(state);
  }, [state]);

  const startCareer = (team) => {
    const initial = initialPresidentState(team.id, team.name, team.league, team.prestige);
    setState(initial);
  };

  return (
    <Layout>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold mb-1 flex items-center gap-2">
            <Heart size={22} className="text-accent" />
            Modo Presidente
          </h1>
          <p className="text-gray-400 text-sm">
            Un nivel arriba del DT: manejás la plata, el estadio, los sponsors y la relación con la hinchada.
          </p>
        </div>
        {state && (
          <button
            onClick={() => { localStorage.removeItem(SAVE_KEY); setState(null); }}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors border border-border rounded-full px-3 py-1.5"
          >
            Renunciar y empezar de nuevo
          </button>
        )}
      </div>

      {!state && <ClubPicker onPick={startCareer} />}
      {state && <Dashboard state={state} setState={setState} />}
    </Layout>
  );
}
