import { useTheme } from "../context/ThemeContext.jsx";
import Card from "./Card.jsx";

export default function ThemeSettings() {
  const { theme, setTheme, themes } = useTheme();

  return (
    <Card>
      <h2 className="font-semibold mb-1">Apariencia</h2>
      <p className="text-xs text-gray-500 mb-5">Nocturno es el tema por default. Elegí otro cuando quieras — se guarda en este dispositivo.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {themes.map((t) => {
          const active = theme === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`text-left p-3.5 rounded-card border transition-colors ${
                active ? "border-accent bg-accent/10" : "border-border hover:border-gray-500"
              }`}
            >
              <div className="flex rounded-card overflow-hidden h-8 mb-3 border border-border/60">
                {t.swatch.map((hex, i) => (
                  <div key={i} style={{ background: hex }} className="flex-1" />
                ))}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{t.label}</span>
                {active && <span className="text-[10px] font-semibold text-accent uppercase tracking-wide">Activo</span>}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
