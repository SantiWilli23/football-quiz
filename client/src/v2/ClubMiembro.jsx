import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Check, Flame, Swords, Trophy, X } from "lucide-react";
import api from "../api.js";
import Avatar from "../components/Avatar.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const KIND = { quien: "¿Quién es?", mas_menos: "Más o menos", penal: "Penal", especial: "Especial" };
const PLACE = { 1: "1.º", 2: "2.º", 3: "3.º" };

function Rank({ label, r }) {
  return (
    <div className="rounded-xl border border-border px-2 py-2 text-center">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-lg font-bold tabular-nums">{r ? `${r.rank}.º` : "–"}</p>
      <p className="text-xs text-gray-500 tabular-nums">{r ? `${r.points} pts` : "sin puntos"}</p>
    </div>
  );
}

function Versus({ h }) {
  const win = h.totals.me === h.totals.them ? null : h.totals.me > h.totals.them;
  const secs = (ms) => `${(ms / 1000).toFixed(1)} s`;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 items-center text-center">
        <div><p className="text-3xl font-extrabold tabular-nums">{h.totals.me}</p><p className="text-xs text-gray-500">Tú</p></div>
        <p className="text-xs uppercase tracking-wide text-gray-500">{win === null ? "Empate" : win ? "Ganaste" : "Perdiste"}</p>
        <div><p className="text-3xl font-extrabold tabular-nums">{h.totals.them}</p><p className="truncate text-xs text-gray-500">{h.username}</p></div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        {h.parts.map((p) => (
          <div key={p.part} className="rounded-xl border border-border py-1.5">
            <p className="text-gray-500">{p.part}T</p>
            <p className="tabular-nums"><b className={p.me >= p.them ? "text-accent" : ""}>{p.me}</b> · <b className={p.them > p.me ? "text-accent" : ""}>{p.them}</b></p>
          </div>
        ))}
      </div>
      <ol className="divide-y divide-border text-sm">
        {h.rows.map((r) => (
          <li key={r.idx} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-1.5">
            <span className="truncate text-gray-400">{r.idx + 1}. {KIND[r.kind] || "Pregunta"}</span>
            <span className={`inline-flex items-center gap-1 tabular-nums ${r.me?.ok ? "text-accent" : "text-red-400"}`}>{r.me?.ok ? <Check size={13} /> : <X size={13} />}{r.me ? secs(r.me.ms) : "–"}</span>
            <span className={`inline-flex items-center gap-1 tabular-nums ${r.them?.ok ? "text-accent" : "text-red-400"}`}>{r.them?.ok ? <Check size={13} /> : <X size={13} />}{r.them ? secs(r.them.ms) : "–"}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// Ficha de miembro: aparece al tocar a alguien de la tabla.
export default function ClubMiembro({ club, uid, uniform, myScore, onClose }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [f, setF] = useState(null);
  const [h, setH] = useState(null);

  useEffect(() => {
    setF(null); setH(null);
    api.get(`/clubs/${club.id}/members/${uid}`).then((r) => setF(r.data)).catch(() => setF(false));
  }, [club.id, uid]);

  async function compare() {
    try { setH((await api.get(`/clubs/${club.id}/head-to-head/${uid}`)).data); }
    catch (e) { toast(e.response?.data?.error || "No se pudo abrir el cara a cara"); }
  }

  // «Supera mi marcador»: un desafío sin puntos para mandar por el chat.
  async function challenge() {
    const score = f?.myToday ?? myScore;
    const text = score != null ? `Supera mi ${score} en el partido de hoy de Futotal` : "Juega el partido de hoy de Futotal";
    const url = club.invite ? `${window.location.origin}/invitacion/${club.invite}?de=${encodeURIComponent(user?.username || "")}` : window.location.origin;
    try {
      if (navigator.share) await navigator.share({ text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); toast("Desafío copiado"); }
    } catch { /* cancelado */ }
  }

  // Va fuera de la página: el contenedor de la pantalla crea su propio apilado y la barra de abajo taparía los botones.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-modal="true" aria-label="Ficha del miembro" onClick={onClose}>
      <div className="sheet-in max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-panel p-4 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="t-eyebrow">Ficha del miembro</p>
          <button onClick={onClose} aria-label="Cerrar" className="p-1 text-gray-400 hover:text-white"><X size={18} /></button>
        </div>
        {f === null && <p className="text-sm text-gray-500">Cargando…</p>}
        {f === false && <p className="text-sm text-red-400">No se pudo cargar la ficha.</p>}
        {f && !h && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar user={f.user} size={56} uniform={uniform} />
              <div className="min-w-0">
                <p className="truncate text-xl font-bold">{f.user.username}</p>
                <p className="flex items-center gap-3 text-sm text-gray-400">
                  <span className="inline-flex items-center gap-1"><Flame size={14} className="text-orange-400" />{f.streak} {f.streak === 1 ? "día" : "días"}</span>
                  {f.average != null && <span>Media {f.average}</span>}
                </p>
              </div>
            </div>
            {club.started && (
              <div className="grid grid-cols-3 gap-2">
                <Rank label="Hoy" r={f.ranks.hoy} /><Rank label="Mes" r={f.ranks.mes} /><Rank label="General" r={f.ranks.general} />
              </div>
            )}
            <p className="text-sm text-gray-300">{f.today.played ? <>Hoy sacó <b className="tabular-nums">{f.today.total}</b> en el partido del día.</> : "Todavía no jugó el partido de hoy."}</p>
            {f.trophies.length > 0 && (
              <p className="flex flex-wrap items-center gap-2 text-sm text-gray-300"><Trophy size={14} className="text-amber" />
                {f.trophies.map((t) => <span key={t.month} className="rounded-full border border-border px-2 py-0.5 text-xs">{PLACE[t.place] || `${t.place}.º`} · {t.month}</span>)}
              </p>
            )}
            {!f.me && (
              <div className="grid gap-2">
                {f.canCompare
                  ? <button onClick={compare} className="btn btn-primary">Cara a cara</button>
                  : <p className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-gray-500">El cara a cara se abre cuando los dos jugaron el partido de hoy.</p>}
                <button onClick={challenge} className="btn btn-secondary">Supera mi marcador</button>
                <button onClick={() => navigate("/versus")} className="btn btn-secondary inline-flex items-center justify-center gap-2"><Swords size={15} /> Pedir revancha</button>
              </div>
            )}
          </div>
        )}
        {h && (
          <div>
            <Versus h={h} />
            <button onClick={() => setH(null)} className="btn btn-secondary btn-sm mt-3 w-full">Volver a la ficha</button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
