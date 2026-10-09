import { useCallback, useEffect, useState } from "react";
import { getMonth, getScore, setReady, startNextSeason } from "./api.js";

// Paneles de la temporada de la Liga Online DT: cierre del mes con "Listo", liga de puntaje y
// arranque de la temporada siguiente.

export function NextSeasonButton({ code, league, onStarted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function go() {
    setBusy(true);
    setError(null);
    try {
      await startNextSeason(code);
      onStarted?.();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo arrancar la temporada");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button onClick={go} disabled={busy} className="btn btn-primary disabled:opacity-40">
        {busy ? "Armando…" : `Arrancar la temporada ${(league.season || 1) + 1}`}
      </button>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </>
  );
}

// Cierre del mes: quién terminó, quién falta, el botón "Listo" y las multas por demorar.
export function MonthPanel({ code, onChanged }) {
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await getMonth(code);
      setM((prev) => {
        if (prev && prev.month !== data.month) onChanged?.();
        return data;
      });
    } catch {
      // se reintenta en el próximo ciclo
    }
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    const id = setInterval(() => { if (document.visibilityState === "visible") load(); }, 15000);
    return () => clearInterval(id);
  }, [load]);

  async function toggleReady(ready) {
    setBusy(true);
    setError(null);
    try {
      const data = await setReady(code, ready);
      setM(data);
      if (data.monthAdvanced) onChanged?.();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo avisar");
    } finally {
      setBusy(false);
    }
  }

  if (!m || !m.me) return null;
  const me = m.me;
  return (
    <div className="rounded-2xl border border-border bg-panel p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="font-semibold text-sm">Cerrar el mes {m.month} de {m.totalMonths}</p>
        <p className="text-xs text-gray-500">Para pasar al siguiente, todos los jugadores tienen que jugar todo y dar "Listo".</p>
      </div>
      <ul className="grid sm:grid-cols-2 gap-1.5 text-xs">
        {m.humans.map((h) => (
          <li key={h.userId} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-1.5">
            <span className="truncate">{h.username}{h.userId === me.userId ? " (vos)" : ""}</span>
            <span className={h.done ? "text-emerald" : h.pendingMatches === 0 ? "text-amber" : "text-gray-400"}>
              {h.done ? "Listo ✓" : h.pendingMatches === 0 ? "Falta dar Listo" : `Faltan ${h.pendingMatches} partido${h.pendingMatches === 1 ? "" : "s"}`}
            </span>
          </li>
        ))}
      </ul>
      {error && <p className="text-xs text-red-300">{error}</p>}
      <div className="flex items-center gap-3 flex-wrap">
        {me.ready ? (
          <>
            <span className="text-sm text-emerald font-medium">Ya diste "Listo". Esperando a los demás…</span>
            <button onClick={() => toggleReady(false)} disabled={busy} className="text-xs text-gray-400 hover:text-white underline disabled:opacity-40">Deshacer</button>
          </>
        ) : me.pendingMatches > 0 ? (
          <span className="text-sm text-gray-400">Te faltan {me.pendingMatches} partido{me.pendingMatches === 1 ? "" : "s"} del mes (liga y copas) para poder dar "Listo".</span>
        ) : (
          <button onClick={() => toggleReady(true)} disabled={busy} className="btn btn-primary disabled:opacity-40">{busy ? "…" : "¡Listo, cerrar mi mes!"}</button>
        )}
      </div>
      {m.overdue && (
        <p className="text-xs text-amber bg-amber/10 border border-amber/30 rounded-xl px-3 py-2">
          Los demás ya cerraron el mes y vos sos el que falta. Desde tu último movimiento corre el reloj: multa de €{m.finePerDay}M por día
          ({m.overdue.daysElapsed} día{m.overdue.daysElapsed === 1 ? "" : "s"} hasta ahora) y a los {m.expelAfterDays} días te expulsan y tu club pasa a la CPU.
        </p>
      )}
      {m.pendingFines > 0 && <p className="text-xs text-red-300">Multas pendientes: €{m.pendingFines}M (se descuentan de tu presupuesto al abrir Mi club).</p>}
    </div>
  );
}

const TIER = { 1: "Tier 1", 2: "Tier 2", 3: "Tier 3" };

// Liga de puntaje: lo que va sumando cada humano frente a lo que se esperaba de su club.
export function ScoreTab({ code, league, onReload }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    getScore(code).then(setData).catch(() => setData({ board: [], history: [], season: league.season || 1 }));
  }, [code, league.currentWeek, league.currentMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <p className="text-sm text-gray-500 text-center py-6">Cargando…</p>;
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-panel/50 px-4 py-3 text-xs text-gray-400 leading-relaxed">
        No es lo mismo ganar la liga con el Barça que con el Girona: el puntaje compara lo que hace tu club con lo que se esperaba de su nivel.
        Se recalcula al cerrar cada jornada (cuando todos la jugaron) y suma resultados, tabla, copas, Champions y Europa League.
        Arranca de cero cada temporada y queda guardado en el historial.
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Temporada {data.season}</p>
        {data.board.length === 0 && <p className="text-sm text-gray-500">Todavía no hay jugadores con club.</p>}
        <ol className="space-y-1.5">
          {data.board.map((b, i) => (
            <li key={b.userId} className={`flex items-center gap-3 rounded-2xl border px-4 py-2.5 text-sm ${b.isMe ? "border-accent/40 bg-accent/5" : "border-border bg-panel"}`}>
              <span className="w-6 text-gray-500 tabular-nums">{i + 1}</span>
              <span className="flex-1 min-w-0">
                <span className="font-semibold">{b.username}</span>
                <span className="block text-xs text-gray-500 truncate">
                  {b.teamName} · {TIER[b.tier] || "—"}{b.position ? ` · va ${b.position}°, se esperaba ${b.expectedPosition}°` : ""}
                </span>
              </span>
              <span className="text-lg font-bold tabular-nums">{b.points}</span>
            </li>
          ))}
        </ol>
      </div>
      {data.history.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Historial</p>
          <ul className="space-y-1 text-sm">
            {data.history.map((h) => (
              <li key={`${h.season}-${h.userId}`} className="flex items-center gap-3 text-gray-300">
                <span className="w-24 text-gray-500">Temporada {h.season}</span>
                <span className="flex-1">{h.username} · {h.teamName}{h.position ? ` · ${h.position}°` : ""}</span>
                <span className="font-semibold tabular-nums">{h.points} pts</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {league.status === "finished" && league.isMine && (
        <div className="text-center"><NextSeasonButton code={code} league={league} onStarted={onReload} /></div>
      )}
    </div>
  );
}
