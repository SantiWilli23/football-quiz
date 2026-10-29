import { Layers, Shield, Trophy } from "lucide-react";
import { Wordmark } from "./Shell.jsx";

// Panel de marca de Iniciar sesión y Crear cuenta en computador (pantallas grandes): el césped,
// la pelota y la marca de la portada, con lo que es Futotal en tres líneas.
const POINTS = [
  [Trophy, "El partido del día", "Tres minijuegos de un minuto, igual para todos."],
  [Shield, "Tu club", "Una tabla con tus amigos, copa semanal y racha del club."],
  [Layers, "Cartas", "Sobres, álbum, SBC y tu propia carta Futotal."],
];

export default function BrandPanel() {
  return (
    <div className="hidden lg:flex flex-1 flex-col justify-center gap-10 p-14 border-r border-border p-porta" style={{ minHeight: "100vh", alignItems: "flex-start", textAlign: "left", padding: "56px 72px" }}>
      <div className="p-ballw" aria-hidden="true" style={{ height: 110 }}><i className="p-ball" /><i className="p-bsh" /></div>
      <div>
        <Wordmark className="p-wm" />
        <p className="p-tagl mt-3" style={{ maxWidth: 420, fontSize: 18 }}>Un partido nuevo cada día. Juega con tus amigos.</p>
      </div>
      <ul className="space-y-4 max-w-md">
        {POINTS.map(([Icon, t, d]) => (
          <li key={t} className="flex gap-3 items-start">
            <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: "var(--glow)", color: "var(--acc2)" }}><Icon size={20} /></span>
            <span><b className="block">{t}</b><span className="text-sm p-muted">{d}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
