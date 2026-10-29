import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LogOut } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Avatar from "../components/Avatar.jsx";
import AvatarEditor from "../components/AvatarEditor.jsx";
import ProfileEditor from "../components/ProfileEditor.jsx";
import PushToggle from "../components/PushToggle.jsx";
import AccountSettings from "../components/AccountSettings.jsx";
import Vitrina from "../components/Vitrina.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { isSfxOn, setSfxOn } from "../utils/sfx.js";
import { useClubs } from "./useClubs.js";
import { useStreak } from "./Shell.jsx";
import RecoveryCode from "./RecoveryCode.jsx";
import GhostToggle from "./GhostToggle.jsx";
import Adn from "./Adn.jsx";
import { resetManos } from "./Mano.jsx";
import { DEVICE_MODES, readDeviceMode, setDeviceMode } from "../utils/device.js";
import { useTheme } from "../context/ThemeContext.jsx";
import CodigoAjuste from "../demo/CodigoAjuste.jsx";
import ProgresoCard from "../demo/ProgresoCard.jsx";

const AREAS = [["chile", "CHI"], ["europa", "EUR"], ["leyendas", "LEY"], ["actualidad", "ACT"], ["mercado", "MER"], ["velocidad", "VEL"]];
const TIER = { especial: ["#f2b84b", "Especial"], oro: ["#e8c46a", "Oro"], plata: ["#b9c2cc", "Plata"], bronce: ["#c58a5b", "Bronce"] };

// Tu carta Futotal (como en el prototipo): media de los últimos 30 partidos del día; se da vuelta
// y muestra el ADN por área.
function CartaFutotal({ card, user }) {
  const [flip, setFlip] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!card) return null;
  if (!card.media) {
    return (
      <section className="p-sect p-stg" style={{ "--i": 1 }}>
        <h3>Tu carta Futotal</h3>
        <div className="p-card text-sm p-muted">Aparece cuando juegues tu primer partido del día. Su media es el promedio de tus últimos 30.</div>
      </section>
    );
  }
  const [color, label] = TIER[card.tier] || TIER.bronce;
  const share = async () => {
    const top = AREAS.filter(([a]) => card.adn[a]?.score != null).sort(([a], [b]) => card.adn[b].score - card.adn[a].score).slice(0, 3);
    const text = `⚽ Futotal · Carta de ${card.username}: ${card.media} (${label})${top.length ? ` · ${top.map(([a, s]) => `${s} ${card.adn[a].score}`).join(" · ")}` : ""}`;
    if (navigator.share) { navigator.share({ text }).catch(() => {}); return; }
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* sin portapapeles */ }
  };
  return (
    <section className="p-sect p-stg" style={{ "--i": 1 }}>
      <h3>Tu carta Futotal<button onClick={share}>{copied ? "Copiado" : "Compartir"}</button></h3>
      <button className={`p-fcard ${flip ? "flip" : ""}`} style={{ "--rc": color }} onClick={() => setFlip((f) => !f)} aria-label="Dar vuelta la carta">
        <div className="in">
          <div className="ff">
            <span className="fr1">{card.media}</span>
            <span className="fr2">{label.toUpperCase()}</span>
            <span className="mt-1.5"><Avatar user={user} size={56} /></span>
            <b className="fn">{card.username.toUpperCase()}</b>
            <div className="fadn">{AREAS.map(([a, s]) => <span key={a}><b>{card.adn[a]?.score ?? "–"}</b>{s}</span>)}</div>
          </div>
          <div className="fb">
            <ul className="w-full px-4 space-y-1.5 text-sm">
              <li className="p-eyebrow" style={{ justifyContent: "center" }}>ADN</li>
              {AREAS.map(([a, s]) => <li key={a} className="flex justify-between"><span className="p-muted">{s}</span><b className="p-num text-base">{card.adn[a]?.score ?? "–"}</b></li>)}
            </ul>
          </div>
        </div>
      </button>
      <p className="p-gap beta-hide" style={{ justifyContent: "center" }}>{card.played === 1 ? "Media de tu primer partido del día" : `Media de tus últimos ${card.played} partidos del día`}. Toca para ver tu ADN.</p>
    </section>
  );
}

function Toggle({ label, on, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b last:border-0" style={{ borderColor: "var(--line)" }}>
      <span>{label}</span>
      <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
        className="relative w-[46px] h-[27px] rounded-full border transition-colors shrink-0"
        style={{ background: on ? "var(--acc)" : "var(--panel2)", borderColor: on ? "var(--acc)" : "var(--line)" }}>
        <span className="absolute top-[2px] w-[21px] h-[21px] rounded-full transition-all" style={{ left: on ? 21 : 2, background: on ? "#fff" : "var(--mute)" }} />
      </button>
    </div>
  );
}

// Yo (Futotal 2.0): carta Futotal, ADN, números, vitrina, últimos partidos y ajustes en una
// sola pantalla, como en el prototipo. Estadísticas e Historial dejan de ser páginas aparte.
export default function Yo() {
  const { user, refreshMe, logout } = useAuth();
  const { main } = useClubs();
  const streak = useStreak();
  const [card, setCard] = useState(null);
  const [sound, setSound] = useState(isSfxOn);
  const [editing, setEditing] = useState(false);
  const [guides, setGuides] = useState(false);
  const [device, setDevice] = useState(readDeviceMode);
  const { theme, setTheme, themes } = useTheme();
  useEffect(() => { api.get("/me/card").then((r) => setCard(r.data)).catch(() => setCard(null)); }, []);
  if (!user) return null;

  const hist = card?.history || [];
  return (
    <Layout hub>
      <div className="p-stg flex items-center gap-3.5 mt-2" style={{ "--i": 0 }}>
        <Avatar user={user} size={64} />
        <div className="flex-1 min-w-0">
          <h2 className="truncate" style={{ font: "800 24px var(--f-d)" }}>{user.username}</h2>
          <small className="p-muted">{main ? main.name : "Sin club"}</small>
        </div>
      </div>

      {/* Teléfono: una columna en el orden del prototipo (order). Computador: dos columnas. */}
      <div className="p-dgrid">
      <div className="p-l">
      <div style={{ order: 2 }}><CartaFutotal card={card} user={user} /></div>
      <div className="mt-4" style={{ order: 3 }}><ProgresoCard /></div>

      <div className="p-stats p-stg mt-4" style={{ "--i": 3, order: 4 }}>
        <div><b>{card?.games ?? 0}</b><span>Partidos</span></div>
        <div><b>{card?.best ?? 0}</b><span>Mejor marcador</span></div>
        <div><b>{streak?.streak ?? 0}</b><span>Racha</span></div>
      </div>

      <section className="p-sect p-stg" style={{ "--i": 4, order: 5 }}>
        <h3>Vitrina</h3>
        <Vitrina />
      </section>
      </div>

      <div className="p-r">
      <section className="p-sect p-stg" style={{ "--i": 2, order: 3 }}>
        <Adn />
      </section>

      {hist.length > 0 && (
        <section className="p-sect p-stg" style={{ "--i": 5, order: 6 }}>
          <h3>Últimos partidos<Link to="/historial">Ver todo</Link></h3>
          <div className="p-card">
            <div className="flex items-end justify-center gap-2 h-[90px] pt-1.5">
              {hist.map((h) => (
                <div key={h.date} className="flex-1 max-w-[56px] flex flex-col items-center justify-end h-full gap-1 p-num text-[11px] p-muted">
                  <span>{h.total}</span>
                  <i className="block w-full rounded-t-[5px]" style={{ height: `${Math.max(4, h.total / 100 * 70)}px`, background: "var(--acc)" }} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="p-sect p-stg" style={{ "--i": 6, order: 7 }}>
        <h3>Ajustes</h3>
        <div className="p-card" style={{ padding: "4px 14px" }}>
          <div className="py-3 border-b" style={{ borderColor: "var(--line)" }}>
            <span className="block mb-2">Modo de pantalla</span>
            <div className="p-seg" role="radiogroup" aria-label="Modo de pantalla">
              {DEVICE_MODES.map((m) => (
                <button key={m.id} role="radio" aria-checked={device === m.id} title={m.hint} className={device === m.id ? "on" : ""} onClick={() => { setDeviceMode(m.id); setDevice(m.id); }}>{m.label}</button>
              ))}
            </div>
            <small className="block mt-1.5 p-dim beta-hide">{DEVICE_MODES.find((m) => m.id === device)?.hint}</small>
          </div>
          <div className="py-3 border-b" style={{ borderColor: "var(--line)" }}>
            <span className="block mb-2">Colores</span>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Colores">
              {themes.map((t) => (
                <button key={t.id} role="radio" aria-checked={theme === t.id} onClick={() => setTheme(t.id)}
                  className="rounded-xl border p-2 text-left text-xs font-semibold transition-colors"
                  style={{ borderColor: theme === t.id ? "var(--acc)" : "var(--line)", background: theme === t.id ? "var(--me-bg)" : "transparent" }}>
                  <span className="flex h-6 rounded-md overflow-hidden mb-1.5" aria-hidden="true">{t.swatch.map((c) => <i key={c} className="flex-1" style={{ background: c }} />)}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <Toggle label="Sonido" on={sound} onChange={(v) => { setSfxOn(v); setSound(v); }} />
          <div className="py-3 border-b flex items-center justify-between gap-3" style={{ borderColor: "var(--line)" }}>
            <span>Guías de cada juego</span>
            <button className="p-btn ghost sm" onClick={() => { resetManos(); try { localStorage.removeItem("fq_home_hint"); } catch { /* sin storage */ } setGuides(true); }}>{guides ? "Listo" : "Ver de nuevo"}</button>
          </div>
          <div className="py-3 flex items-center justify-between gap-3">
            <span>Perfil y avatar</span>
            <button className="p-btn ghost sm" onClick={() => setEditing((e) => !e)} aria-expanded={editing}>{editing ? "Cerrar" : "Editar"}</button>
          </div>
        </div>
        <div className="mt-3 space-y-3">
          {editing && (<><AvatarEditor user={user} onSaved={refreshMe} /><ProfileEditor user={user} onSaved={refreshMe} /></>)}
          <GhostToggle />
          <PushToggle />
          <RecoveryCode />
          <CodigoAjuste />
          <Link to="/otro" className="p-btn ghost w-full">Otro</Link>
          <AccountSettings user={user} onUpdated={refreshMe} />
          <button onClick={logout} className="p-btn ghost w-full"><LogOut size={16} /> Cerrar sesión</button>
        </div>
      </section>
      </div>
      </div>
    </Layout>
  );
}
