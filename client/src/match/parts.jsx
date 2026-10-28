import { ArrowLeftRight, Goal } from "lucide-react";

// Piezas compartidas por el partido real (PartidoVivo) y los partidos simulados (MatchStage).

export function EventIcon({ type }) {
  if (type === "goal" || type === "pen_goal") return <Goal size={15} className="text-white" />;
  if (type === "own_goal") return <Goal size={15} className="text-red-400" />;
  if (type === "yellow") return <span className="inline-block h-3.5 w-2.5 rounded-[2px] bg-yellow-400" />;
  if (type === "red") return <span className="inline-block h-3.5 w-2.5 rounded-[2px] bg-red-500" />;
  if (type === "sub") return <ArrowLeftRight size={14} className="text-accent" />;
  if (type === "shootout_kick") return <Goal size={14} className="text-gray-300" />;
  if (type === "pen_miss" || type === "save") return <span className="text-[10px] font-bold text-gray-400">ATAJ</span>;
  if (type === "chance") return <span className="text-[10px] font-bold text-amber">¡UY!</span>;
  if (type === "injury") return <span className="text-[13px] font-bold text-red-400">+</span>;
  return <span className="text-[10px] font-bold text-gray-400">VAR</span>;
}

const QUIET = new Set(["kickoff", "ht", "ft"]);
const kickText = (e) => <>{e.player} <span className={e.scored ? "text-good" : "text-red-400"}>{e.scored ? "marcó" : "falló"}</span></>;

// Línea de tiempo: local a la izquierda y visita a la derecha. Sirve para el modelo del partido
// real (`e.id`, `e.display`) y para SimMatch (sin ellos). Los eventos de pura señalización
// (pitazo inicial, entretiempo, final) se muestran como separadores.
export function Timeline({ events, empty }) {
  if (!events.length) return <p className="text-sm text-gray-500">{empty}</p>;
  return (
    <ol className="divide-y divide-border">
      {events.map((e, i) => {
        if (QUIET.has(e.type)) {
          return <li key={e.id ?? `${e.type}-${i}`} className="py-1.5 text-center text-[11px] uppercase tracking-wide text-gray-500">{e.type === "kickoff" ? "Pitazo inicial" : e.type === "ht" ? "Entretiempo" : "Final del partido"}</li>;
        }
        const left = e.team === "home";
        const text = e.type === "shootout_kick" ? kickText(e) : e.type === "sub"
          ? <><span className="text-good">▲ {e.in}</span> <span className="text-gray-500">▼ {e.out}</span></>
          : <>{e.player || e.text}{e.assist ? <span className="text-gray-500"> · asist. {e.assist}</span> : null}{e.type === "pen_goal" ? <span className="text-gray-500"> (pen.)</span> : null}{e.type === "own_goal" ? <span className="text-gray-500"> (en contra)</span> : null}</>;
        return (
          <li key={e.id ?? `${e.type}-${i}`} className={`fq-rise flex items-center gap-2 py-2 text-sm ${left ? "" : "flex-row-reverse text-right"}`}>
            <span className="w-12 shrink-0 text-center text-xs tabular-nums text-gray-400">{e.display || `${e.min}'${e.extra ? `+${e.extra}` : ""}`}</span>
            <span className="flex w-5 shrink-0 justify-center"><EventIcon type={e.type} /></span>
            <span className="min-w-0 flex-1 break-words">{text}</span>
          </li>
        );
      })}
    </ol>
  );
}
