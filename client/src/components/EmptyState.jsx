import { Link } from "react-router-dom";

// Pantalla vacía con salida: en vez de sólo avisar que falta algo, dice qué
// hacer y deja el botón al lado. `actions` = [{ label, to?, onClick?, ghost? }].
export default function EmptyState({ icon: Icon, title, hint, actions = [], compact = false }) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? "py-4" : "py-8"}`}>
      {Icon && (
        <span className="w-14 h-14 rounded-full border border-border bg-accent/10 text-accent flex items-center justify-center mb-3">
          <Icon size={24} />
        </span>
      )}
      <p className="font-semibold text-sm">{title}</p>
      {hint && <p className="text-xs text-gray-500 mt-1 max-w-xs leading-relaxed">{hint}</p>}
      {actions.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {actions.map((a) => {
            const cls = a.ghost
              ? "border border-border text-gray-300 hover:text-white hover:border-white/30"
              : "bg-accent text-onaccent hover:opacity-90";
            const base = `px-4 py-2 rounded-card text-xs font-semibold transition-colors ${cls}`;
            return a.to
              ? <Link key={a.label} to={a.to} className={base}>{a.label}</Link>
              : <button key={a.label} onClick={a.onClick} className={base}>{a.label}</button>;
          })}
        </div>
      )}
    </div>
  );
}
