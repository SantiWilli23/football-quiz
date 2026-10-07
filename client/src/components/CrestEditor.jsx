import Crest, { CREST_COLORS, CREST_LABELS, CREST_PATTERNS, CREST_SHAPES, CREST_SYMBOLS } from "./Crest.jsx";

function Options({ label, options, value, onChange }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      <div className="flex gap-1.5 flex-wrap">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            aria-pressed={value === o}
            className={`px-2.5 py-1 rounded-card text-xs font-medium border transition-colors ${
              value === o ? "border-accent/50 bg-accent/10 text-accent" : "border-border text-gray-400 hover:text-white hover:border-white/30"
            }`}
          >
            {CREST_LABELS[o]}
          </button>
        ))}
      </div>
    </div>
  );
}

function Colors({ label, value, onChange }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {CREST_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`${label} ${c}`}
            aria-pressed={value === c}
            className={`w-6 h-6 rounded-full border border-black/30 transition-transform ${value === c ? "scale-110 ring-2 ring-offset-2 ring-offset-panel ring-white/70" : ""}`}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}

// Editor del escudo del grupo: vista previa grande + forma, símbolo, diseño,
// dos colores e iniciales. `value` es el objeto del escudo; devuelve uno nuevo.
export default function CrestEditor({ value, onChange, name = "" }) {
  const set = (key) => (v) => onChange({ ...value, [key]: v });
  const shown = { ...value, initials: value.initials || name.trim().slice(0, 3).toUpperCase() };

  return (
    <div className="flex flex-col sm:flex-row gap-5">
      <div className="flex sm:flex-col items-center gap-3 shrink-0">
        <Crest crest={shown} size={96} />
        <input
          value={value.initials}
          onChange={(e) => set("initials")(e.target.value.toUpperCase().slice(0, 3))}
          placeholder="Iniciales"
          maxLength={3}
          className="w-24 bg-bg border border-border rounded-card px-3 py-2 text-sm text-center uppercase tracking-widest focus:outline-none focus:border-accent"
        />
      </div>
      <div className="flex-1 min-w-0 space-y-3">
        <Options label="Forma" options={CREST_SHAPES} value={value.shape} onChange={set("shape")} />
        <Options label="Símbolo" options={CREST_SYMBOLS} value={value.symbol} onChange={set("symbol")} />
        <Options label="Diseño" options={CREST_PATTERNS} value={value.pattern} onChange={set("pattern")} />
        <Colors label="Color principal" value={value.color} onChange={set("color")} />
        {value.pattern !== "liso" && <Colors label="Color del diseño" value={value.color2} onChange={set("color2")} />}
      </div>
    </div>
  );
}
