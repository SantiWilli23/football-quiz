const ATTR_LABELS = [["pace", "RIT"], ["shooting", "TIR"], ["passing", "PAS"], ["dribbling", "REG"], ["defending", "DEF"], ["physical", "FIS"]];

function Bar({ value, align }) {
  return (
    <div className={`h-1.5 rounded-full bg-white/10 overflow-hidden ${align === "right" ? "" : ""}`}>
      <div
        className={`h-full rounded-full bg-accent ${align === "right" ? "ml-auto" : ""}`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

// Dos jugadores enfrentados: el objetivo del mercado contra tu mejor opción
// actual en esa misma posición, atributo por atributo. En vez de abrir y
// cerrar dos fichas para comparar a mano.
export default function ComparePlayers({ target, mine, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="bg-panel border border-border rounded-2xl w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-sm">Comparar jugadores</p>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm" aria-label="Cerrar">✕</button>
        </div>

        <div className="flex items-stretch gap-3 mb-4">
          <div className="flex-1 min-w-0 text-right">
            <p className="text-sm font-semibold truncate">{mine ? mine.name : "— sin plantel en esa posición —"}</p>
            {mine && <p className="text-xs text-gray-500">{mine.position} · {mine.age} años · OVR {mine.ovr}</p>}
          </div>
          <span className="text-gray-600 text-xs self-center shrink-0">vs</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{target.name}</p>
            <p className="text-xs text-gray-500">{target.position} · {target.age} años · OVR {target.ovr}</p>
          </div>
        </div>

        <div className="space-y-3">
          {ATTR_LABELS.map(([key, label]) => {
            const a = mine?.attributes?.[key] ?? 0;
            const b = target.attributes?.[key] ?? 0;
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="w-8 text-right text-xs text-gray-400 tabular-nums shrink-0">{mine ? a : "—"}</span>
                <div className="flex-1"><Bar value={a} align="right" /></div>
                <span className="w-9 text-center text-xs font-semibold text-gray-500 shrink-0">{label}</span>
                <div className="flex-1"><Bar value={b} /></div>
                <span className="w-8 text-xs text-gray-400 tabular-nums shrink-0">{b}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
