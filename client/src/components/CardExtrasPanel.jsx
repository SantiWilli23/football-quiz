import { useCallback, useEffect, useState } from "react";
import { Flame, Shield, UserCog } from "lucide-react";
import api from "../api.js";
import Card from "./Card.jsx";
import { useToast } from "../context/ToastContext.jsx";

const plain = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "");

// Entrenador, capitán, colecciones de selección y cartas "en forma" de Mi equipo.
// `lineupNames` son los 11 guardados; `collection` lo que tenés; `onChanged` recarga fuerza.
export default function CardExtrasPanel({ lineupNames, collection, onChanged }) {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get("/cards-extras").then((r) => setData(r.data)).catch(() => setData(null));
  }, []);
  // Se vuelve a pedir cuando cambia el once guardado: el bonus de selección depende de él.
  useEffect(() => { load(); }, [load, lineupNames.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(next) {
    setBusy(true);
    try {
      await api.put("/cards-extras", { coach: data.coach?.name ?? null, captain: data.captain ?? null, ...next });
      await load();
      onChanged?.();
    } catch (err) {
      toast(err.response?.data?.error || "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;
  const inForm = collection.filter((c) => c.form);
  const lineupCards = collection.filter((c) => lineupNames.includes(c.name));
  const fx = data.effects;

  return (
    <Card>
      <p className="t-eyebrow mb-3">Bonus del equipo</p>

      {fx && (fx.coachOvr + fx.coachChem + fx.setsChem + fx.form > 0 || fx.captain) && (
        <p className="t-meta mb-4">
          Activos:{" "}
          {[
            fx.coach && (fx.coachOvr || fx.coachChem) ? `DT ${fx.coach}: +${fx.coachOvr + fx.coachChem}` : null,
            fx.setsChem ? `selecciones: +${fx.setsChem}` : null,
            fx.form ? `en forma: +${fx.form}` : null,
            fx.captain ? "capitán: conexiones x2" : null,
          ].filter(Boolean).join(" · ")}
        </p>
      )}

      <div className="space-y-5">
        <div>
          <p className="text-sm font-semibold mb-2 flex items-center gap-1.5"><UserCog size={14} /> Entrenador</p>
          {data.coaches.length === 0 ? (
            <p className="text-xs text-gray-500">No tenés ningún entrenador todavía. Salen en los sobres, más seguido en el Sobre Íconos.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              <button
                onClick={() => save({ coach: null })}
                disabled={busy}
                className={`text-left px-3 py-2 rounded-card border text-sm ${!data.coach ? "border-accent/50 bg-accent/10 text-accent" : "border-border text-gray-400 hover:text-white"}`}
              >
                Sin entrenador
              </button>
              {data.coaches.map((c) => (
                <button
                  key={c.name}
                  onClick={() => save({ coach: c.name })}
                  disabled={busy}
                  className={`text-left px-3 py-2 rounded-card border text-sm ${data.coach?.name === c.name ? "border-accent/50 bg-accent/10" : "border-border hover:border-white/30"}`}
                >
                  <span className="block font-medium">{c.realName}</span>
                  <span className="block text-[11px] text-gray-400 leading-snug">{c.note}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Shield size={14} /> Capitán</p>
          {lineupCards.length !== 11 ? (
            <p className="text-xs text-gray-500">Guardá tu once de 11 para elegir capitán.</p>
          ) : (
            <>
              <select
                value={data.captain || ""}
                onChange={(e) => save({ captain: e.target.value || null })}
                disabled={busy}
                className="bg-bg border border-border rounded-card px-3 py-2 text-sm w-full sm:w-auto"
                aria-label="Capitán"
              >
                <option value="">Sin capitán</option>
                {lineupCards.map((c) => <option key={c.name} value={c.name}>{c.realName || c.name}</option>)}
              </select>
              <p className="text-[11px] text-gray-500 mt-1.5">Las conexiones de club con el capitán cuentan doble (y el tope de química sube +5).</p>
            </>
          )}
        </div>

        <div>
          <p className="text-sm font-semibold mb-1">Colecciones de selección</p>
          <p className="text-[11px] text-gray-500 mb-2">Poné en tu once jugadores de un plantel histórico: {data.squadRule}.</p>
          <div className="space-y-2">
            {data.squads.map((s) => (
              <div key={s.id}>
                <div className="flex justify-between text-xs mb-1">
                  <span className={s.chem > 0 ? "text-emerald-500" : "text-gray-300"}>{s.label}</span>
                  <span className="text-gray-500 tabular-nums">en tu once {s.inLineup} · tenés {s.owned}/{s.size}{s.chem > 0 ? ` · +${s.chem}` : ""}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-accent/70" style={{ width: `${Math.min(100, (s.owned / s.size) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold mb-1 flex items-center gap-1.5"><Flame size={14} className="text-amber-400" /> En forma esta semana</p>
          <p className="text-[11px] text-gray-500 mb-2">Los que hicieron un gol en las ligas reales en los últimos 7 días suman +{data.form.bonus} a su carta.</p>
          {inForm.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {inForm.map((c) => (
                <span key={c.name} className="px-2 py-1 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-500 text-xs">{c.realName || c.name} +{data.form.bonus}</span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              Ninguna de tus cartas está en forma ahora.
              {data.form.players.length > 0 && ` Esta semana marcaron, por ejemplo: ${data.form.players.slice(0, 5).map((p) => plain(p.name)).join(", ")}.`}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
