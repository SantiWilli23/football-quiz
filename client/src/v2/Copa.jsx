import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import api from "../api.js";
import Card from "../components/Card.jsx";

const ROUND_NAME = { cuartos: "Cuartos", semis: "Semifinales", final: "Final" };
const DAY_NAME = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const dayOf = (iso) => DAY_NAME[(new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7];

// Copa semanal automática: de lunes a jueves clasificás con la suma de tus partidos del
// día y del viernes al domingo se juegan las llaves. No hay que inscribirse.
export default function Copa({ clubId, userId }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    api.get(`/clubs/${clubId}/cup`).then((r) => setData(r.data)).catch(() => setData(false));
  }, [clubId]);

  if (data === null) return <Card><p className="text-sm text-gray-500">Cargando la copa…</p></Card>;
  if (data === false) return <Card><p className="text-sm text-red-400">No se pudo cargar la copa.</p></Card>;

  const cup = data.cup;
  const hasBracket = cup.size > 0;
  const name = (p) => (p ? (p.userId === userId ? "Tú" : p.username) : "—");

  return (
    <Card>
      <p className="t-eyebrow flex items-center gap-1.5"><Trophy size={13} /> Copa de la semana</p>
      {!data.started && <p className="text-sm text-gray-400 mt-2">La copa arranca cuando el club inicie la temporada.</p>}

      {data.started && data.phase === "clasificacion" && (
        <>
          <p className="text-sm text-gray-400 mt-1">Clasificás sumando tus partidos del día de lunes a jueves. El viernes arrancan las llaves.</p>
          <ol className="mt-2 divide-y divide-border">
            {data.qualifying.length === 0 && <li className="py-2 text-sm text-gray-500">Nadie jugó todavía esta semana.</li>}
            {data.qualifying.map((q, i) => (
              <li key={q.userId} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-5 text-center font-bold text-gray-400 tabular-nums">{i + 1}</span>
                <span className={`flex-1 min-w-0 truncate ${q.userId === userId ? "font-semibold text-accent" : ""}`}>{q.username}</span>
                <span className="tabular-nums font-semibold">{q.points}</span>
              </li>
            ))}
          </ol>
        </>
      )}

      {data.started && data.phase === "llaves" && !hasBracket && (
        <p className="text-sm text-gray-400 mt-2">Esta semana no hubo suficientes jugadores para armar la copa (hacen falta al menos 2 que hayan jugado de lunes a jueves).</p>
      )}

      {data.started && data.phase === "llaves" && hasBracket && (
        <div className="mt-2 space-y-4">
          {cup.rounds.map((r) => (
            <div key={r.key}>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">{ROUND_NAME[r.key]} · {dayOf(r.date)}</p>
              <div className="space-y-1.5">
                {r.matches.map((m, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2 text-sm">
                    <span className={`truncate ${m.winner && m.winner.userId === m.a?.userId ? "font-bold text-accent" : ""}`}>{name(m.a)}</span>
                    <span className="tabular-nums text-xs text-gray-400">{m.closed ? `${m.sa ?? 0} – ${m.sb ?? 0}` : "vs"}</span>
                    <span className={`truncate text-right ${m.winner && m.winner.userId === m.b?.userId ? "font-bold text-accent" : ""}`}>{name(m.b)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {cup.champion && (
            <div className="relative overflow-hidden rounded-2xl border border-amber/40 bg-amber/10 py-3 text-center fq-rise">
              {cup.champion.userId === userId && <div className="celebrate-confetti absolute inset-x-0 top-0 h-0 pointer-events-none" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <span key={i} />)}</div>}
              <Trophy size={22} className="mx-auto text-amber fq-pop" />
              <p className="mt-1 text-sm">Campeón: <b className="text-accent">{name(cup.champion)}</b></p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
