import { Globe2 } from "lucide-react";
import { useCareer } from "../context/CareerContext.jsx";

export default function NationalTeamCard() {
  const {
    state,
    acceptNationalTeamJob,
    declineNationalTeamOffer,
    playNationalMatch,
    resignNationalTeam,
  } = useCareer();

  const nt = state.nationalTeam;
  const pending = state.pendingNationalOffer;

  if (!pending && !nt?.active) return null;

  return (
    <div className="bg-panel border border-blue-500/30 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Globe2 size={16} className="text-blue-400" />
        <h3 className="font-semibold text-sm">Selección Nacional</h3>
      </div>

      {pending && (
        <div>
          <p className="text-sm text-gray-300 mb-3">
            La federación te ofrece dirigir a la Selección en paralelo a tu club durante la próxima fecha FIFA.
          </p>
          <div className="flex gap-2">
            <button
              onClick={acceptNationalTeamJob}
              className="flex-1 bg-blue-500/20 border border-blue-500/40 text-blue-300 font-semibold text-sm rounded-xl py-2 hover:bg-blue-500/30 transition-colors"
            >
              Aceptar
            </button>
            <button
              onClick={declineNationalTeamOffer}
              className="flex-1 bg-transparent border border-border text-gray-400 font-semibold text-sm rounded-xl py-2 hover:text-white transition-colors"
            >
              Rechazar
            </button>
          </div>
        </div>
      )}

      {nt?.active && (
        <div>
          <p className="text-sm text-gray-300 mb-2">
            DT de la Selección de <span className="font-semibold text-white">{nt.country}</span>
          </p>
          <div className="grid grid-cols-4 gap-2 mb-3 text-center">
            <div>
              <p className="text-lg font-bold">{nt.caps}</p>
              <p className="text-xs text-gray-500 uppercase">PJ</p>
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-400">{nt.wins}</p>
              <p className="text-xs text-gray-500 uppercase">PG</p>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-400">{nt.draws}</p>
              <p className="text-xs text-gray-500 uppercase">PE</p>
            </div>
            <div>
              <p className="text-lg font-bold text-red-400">{nt.losses}</p>
              <p className="text-xs text-gray-500 uppercase">PP</p>
            </div>
          </div>

          {nt.history.length > 0 && (
            <div className="space-y-1 mb-3 max-h-28 overflow-y-auto">
              {nt.history.map((h, i) => (
                <p key={i} className="text-xs text-gray-500">
                  vs {h.rival}: {h.myGoals}-{h.rivalGoals}
                </p>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={playNationalMatch}
              className="flex-1 bg-blue-500/20 border border-blue-500/40 text-blue-300 font-semibold text-sm rounded-xl py-2 hover:bg-blue-500/30 transition-colors"
            >
              Jugar amistoso
            </button>
            <button
              onClick={resignNationalTeam}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2"
            >
              Renunciar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
