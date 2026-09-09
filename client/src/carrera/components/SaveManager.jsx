import { useState } from "react";
import { Link } from "react-router-dom";
import { useCareer } from "../context/CareerContext.jsx";
import { teamById } from "../data/teams.js";
import TeamCrest from "./TeamCrest.jsx";

export default function SaveManager({ onNewCareer }) {
  const { saveSlots, resumeCareer, deleteCareer } = useCareer();
  const [confirmDelete, setConfirmDelete] = useState(null);

  return (
    <div className="min-h-screen bg-bg text-white p-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/panel" className="inline-block text-xs text-gray-500 hover:text-white mb-3">🏠 Volver al menú principal</Link>
        <h1 className="text-2xl font-bold mb-1">Modo Carrera · DT</h1>
        <p className="text-gray-400 text-sm mb-5">
          {saveSlots.length ? "Retomá una carrera guardada o empezá una nueva." : "Elegí el equipo que vas a dirigir."}
        </p>

        {saveSlots.length > 0 && (
          <div className="space-y-2.5 mb-6">
            {[...saveSlots].sort((a, b) => b.updatedAt - a.updatedAt).map((slot) => {
              const t = teamById(slot.teamId);
              if (!t) return null;
              return (
                <div key={slot.id} className="bg-panel border border-border rounded-2xl px-4 py-3 flex items-center gap-3">
                  <TeamCrest team={t} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{t.name}</p>
                    <p className="text-xs text-gray-500">
                      Temporada {slot.season} · Jornada {slot.week}
                      {slot.gameOver && <span className="text-red-400 ml-1.5">· Despedido</span>}
                    </p>
                  </div>
                  {confirmDelete === slot.id ? (
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => { deleteCareer(slot.id); setConfirmDelete(null); }}
                        className="text-xs font-medium px-3 py-2 rounded-2xl bg-red-500/15 text-red-400 border border-red-500/40 hover:bg-red-500/25 transition-colors"
                      >
                        Confirmar borrado
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-xs px-3 py-2 rounded-2xl border border-border text-gray-400 hover:text-white transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => resumeCareer(slot.id)}
                        className="text-sm font-medium px-4 py-2.5 rounded-2xl bg-accent/10 text-accent border border-accent/40 hover:bg-accent/20 transition-colors"
                      >
                        Continuar
                      </button>
                      <button
                        onClick={() => setConfirmDelete(slot.id)}
                        title="Borrar esta carrera"
                        className="text-sm px-3 py-2.5 rounded-2xl border border-border text-gray-500 hover:text-red-400 hover:border-red-500/40 transition-colors"
                      >
                        🗑
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={onNewCareer}
          className="w-full bg-accent text-black font-semibold py-3 rounded-2xl hover:brightness-110 transition"
        >
          + Nueva carrera
        </button>
      </div>
    </div>
  );
}
