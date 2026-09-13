import { useTheme } from "../context/ThemeContext.jsx";
import Card from "./Card.jsx";

export default function ThemeSettings() {
  const { theme, setTheme, themes, shape, setShape, shapes } = useTheme();

  return (
    <Card>
      <h2 className="font-semibold mb-1">Apariencia</h2>
      <p className="text-xs text-gray-500 mb-5">Nocturno + Redondeada es lo que ves por default. Cada elección se guarda en este dispositivo.</p>

      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2.5">Color</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
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

      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2.5">Forma</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {shapes.map((s) => {
          const active = shape === s.id;
          const cut = s.id === "cancha";
          return (
            <button
              key={s.id}
              onClick={() => setShape(s.id)}
              className={`text-left p-3.5 rounded-card border transition-colors ${
                active ? "border-accent bg-accent/10" : "border-border hover:border-gray-500"
              }`}
            >
              <div
                className="h-8 mb-3 bg-bg border border-border/60"
                style={
                  cut
                    ? { borderRadius: 0, clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))" }
                    : { borderRadius: 10 }
                }
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{s.label}</span>
                {active && <span className="text-[10px] font-semibold text-accent uppercase tracking-wide">Activo</span>}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
