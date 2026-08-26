// Selector de liga: las cinco grandes europeas más la Primera de Chile. Se
// muestra como una fila de pestañas en vez de un <select> porque son pocas
// y cambiar de liga es la acción más frecuente de toda la pantalla.
export default function LeagueTabs({ leagues, active, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap mb-6">
      {leagues.map((league) => (
        <button
          key={league.key}
          onClick={() => onChange(league.key)}
          aria-pressed={active === league.key}
          className={`px-3.5 py-2 rounded-card text-sm font-medium border transition-colors ${
            active === league.key
              ? "border-accent/60 bg-accent/10 text-accent"
              : "border-border text-gray-400 hover:text-white hover:border-white/30"
          }`}
        >
          {league.name}
        </button>
      ))}
    </div>
  );
}
