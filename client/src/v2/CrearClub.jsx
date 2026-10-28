import { useState } from "react";
import { ArrowLeft, Check, Copy, Share2 } from "lucide-react";
import api from "../api.js";
import Card from "../components/Card.jsx";
import Crest from "../components/Crest.jsx";
import CrestEditor from "../components/CrestEditor.jsx";
import { DEFAULT_CREST } from "../components/Crest.jsx";
import { useToast } from "../context/ToastContext.jsx";

const MODES = [
  { key: "clasico", label: "Clásico", text: "Cuentan el partido del día y la copa semanal. Simple y parejo.", bullets: ["Partido del día: 0 a 100", "Copa semanal", "Lo demás da sobres, no puntos"] },
  { key: "total", label: "Total", text: "Cuenta todo. El partido del día y la copa valen el doble.", bullets: ["Partido del día y copa ×2", "Una partida libre por juego suma (tope 100 al día)", "Podio semanal de DT Online"] },
];

// Crear club en 3 pasos: nombre y escudo → modo → invitar.
export default function CrearClub({ onDone }) {
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [crest, setCrest] = useState({ ...DEFAULT_CREST });
  const [mode, setMode] = useState("clasico");
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState(null); // { group, link }
  const [error, setError] = useState("");

  async function create() {
    setBusy(true); setError("");
    try {
      const r = await api.post("/groups", { name: name.trim(), mode, crest: { ...crest, initials: crest.initials || name.trim().slice(0, 3) } });
      const group = r.data.group;
      setMade({ group, link: `${window.location.origin}/invitacion/${group.invite_code}` });
      setStep(3);
    } catch (e) {
      setError(e.response?.data?.error || "No se pudo crear el club.");
    } finally { setBusy(false); }
  }

  async function share() {
    const text = `Únete a mi club en Futotal: ${made.group.name}`;
    try {
      if (navigator.share) await navigator.share({ text, url: made.link });
      else { await navigator.clipboard.writeText(`${text} ${made.link}`); toast("Link copiado"); }
    } catch { /* cancelado */ }
  }

  return (
    <Card variant="feature" className="wizard">
      <div className="mb-3 flex items-center gap-2">
        {step > 1 && step < 3 && <button onClick={() => setStep(step - 1)} aria-label="Volver" className="p-1 text-gray-400 hover:text-white"><ArrowLeft size={16} /></button>}
        <p className="t-eyebrow flex-1">Crear un club · paso {step} de 3</p>
        <div className="flex gap-1" aria-hidden="true">
          {[1, 2, 3].map((n) => <span key={n} className={`h-1.5 w-6 rounded-full transition-colors ${n <= step ? "bg-accent" : "bg-border"}`} />)}
        </div>
      </div>

      {step === 1 && (
        <div key="s1" className="wizard-step space-y-3">
          <p className="text-lg font-semibold">Ponle nombre y escudo</p>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Nombre del club" className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm" />
          <CrestEditor value={crest} onChange={setCrest} name={name} />
          <button onClick={() => setStep(2)} disabled={!name.trim()} className="btn btn-primary w-full disabled:opacity-50">Siguiente</button>
        </div>
      )}

      {step === 2 && (
        <div key="s2" className="wizard-step space-y-3">
          <p className="text-lg font-semibold">¿Cómo suman los puntos?</p>
          <div className="grid gap-2">
            {MODES.map((m) => (
              <button key={m.key} onClick={() => setMode(m.key)} aria-pressed={mode === m.key}
                className={`rounded-2xl border p-3 text-left transition-colors ${mode === m.key ? "border-accent bg-accent/10" : "border-border"}`}>
                <span className="flex items-center justify-between"><b>{m.label}</b>{mode === m.key && <Check size={16} className="text-accent" />}</span>
                <span className="mt-0.5 block text-sm text-gray-400">{m.text}</span>
                <ul className="mt-1.5 space-y-0.5 text-xs text-gray-500">{m.bullets.map((b) => <li key={b}>· {b}</li>)}</ul>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">Después, el modo se cambia solo el día 1 de cada mes (en pretemporada, cuando quieras).</p>
          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          <button onClick={create} disabled={busy} className="btn btn-primary w-full disabled:opacity-50">{busy ? "Creando…" : "Crear club"}</button>
        </div>
      )}

      {step === 3 && made && (
        <div key="s3" className="wizard-step space-y-3 text-center">
          <div className="wizard-crest mx-auto w-fit"><Crest group={made.group} size={84} /></div>
          <p className="text-lg font-semibold">¡{made.group.name} está listo!</p>
          <p className="text-sm text-gray-400">Invita a tus amigos. Mientras estén entrando, el club está en pretemporada y nadie suma puntos; cuando estén todos, inicias la temporada.</p>
          <p className="select-all rounded-xl border border-dashed border-border bg-bg px-3 py-2 font-mono text-lg tracking-widest">{made.group.invite_code}</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => navigator.clipboard?.writeText(made.group.invite_code).then(() => toast("Código copiado"), () => {})} className="btn btn-secondary inline-flex items-center justify-center gap-2"><Copy size={15} /> Código</button>
            <button onClick={share} className="btn btn-primary inline-flex items-center justify-center gap-2"><Share2 size={15} /> Invitar</button>
          </div>
          <button onClick={() => onDone(made.group.id)} className="btn btn-secondary w-full">Ir a mi club</button>
        </div>
      )}
    </Card>
  );
}
