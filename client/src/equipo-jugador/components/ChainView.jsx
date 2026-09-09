export default function ChainView({ chain, playerNames }) {
  if (!chain.length) {
    return <p className="text-sm text-gray-500 text-center py-6">La cadena todavía no arrancó.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-2">
      {chain.map((link, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div
            className={`px-3 py-2 rounded-2xl border text-sm font-medium ${
              link.kind === "player"
                ? "bg-accent/10 border-accent/40 text-accent"
                : "bg-blue/10 border-blue/40 text-blue"
            }`}
            title={`Dicho por ${playerNames[link.bySeat]}`}
          >
            {link.label}
          </div>
          {i < chain.length - 1 && <span className="text-gray-600 text-xs">→</span>}
        </div>
      ))}
    </div>
  );
}
