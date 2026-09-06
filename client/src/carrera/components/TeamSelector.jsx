import { useState } from "react";
import { Link } from "react-router-dom";
import { useCareer } from "../context/CareerContext.jsx";
import TeamCrest from "./TeamCrest.jsx";

export default function TeamSelector() {
  const { allTeams, selectTeam } = useCareer();
  const [league, setLeague] = useState("premier");
  const [chosen, setChosen] = useState(null);

  const list = allTeams.filter((t) => t.league === league);

  return (
    <div className="min-h-screen bg-bg text-white p-4">
      <div className="max-w-4xl mx-auto">
        <Link to="/panel" className="inline-block text-xs text-gray-500 hover:text-white mb-3">🏠 Volver al menú principal</Link>
        <h1 className="text-2xl font-bold mb-1">Modo Carrera · DT</h1>
        <p className="text-gray-400 text-sm mb-5">Elegí el equipo que vas a dirigir.</p>

        <div className="flex gap-2 mb-4">
          {[["premier", "Premier League"], ["laliga", "La Liga"]].map(([id, label]) => (
            <button
              key={id}
              onClick={() => { setLeague(id); setChosen(null); }}
              className={`px-4 py-2 rounded-card text-sm font-medium border ${
                league === id ? "bg-accent/15 text-accent border-accent/30" : "text-gray-400 border-border"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {list.map((t) => (
            <button
              key={t.id}
              onClick={() => setChosen(t)}
              className={`text-left p-3 rounded-card border bg-panel transition-colors ${
                chosen?.id === t.id ? "border-accent" : "border-border hover:border-white/20"
              }`}
            >
              <TeamCrest team={t} size={32} className="mb-2" />
              <p className="text-sm font-semibold">{t.name}</p>
              <p className="text-xs text-gray-500">Tier {t.tier} · €{t.budget}M</p>
            </button>
          ))}
        </div>

        {chosen && (
          <div className="bg-panel border border-border rounded-card p-4">
            <div className="flex items-center gap-3 mb-3">
              <TeamCrest team={chosen} size={40} />
              <div>
                <p className="font-semibold">{chosen.name}</p>
                <p className="text-xs text-gray-500">Presupuesto inicial: €{chosen.budget}M · Prestigio {chosen.prestige}/10</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Objetivo de la directiva: <b className="text-white">{objectiveLabel(chosen.boardObjective)}</b>
            </p>
            <button
              onClick={() => selectTeam(chosen.id)}
              className="w-full bg-accent text-black font-semibold py-2.5 rounded-card hover:brightness-110 transition"
            >
              Empezar Carrera
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function objectiveLabel(o) {
  const map = {
    ganar_liga: "Ganar la liga", top3: "Top 3", top4: "Top 4", top6: "Top 6",
    top8: "Top 8", top10: "Top 10", top12: "Top 12", salvarse: "Salvar la categoría",
  };
  return map[o] || o;
}
