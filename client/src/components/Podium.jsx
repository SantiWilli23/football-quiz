import { Crown } from "lucide-react";
import Avatar from "./Avatar.jsx";

// Podio de los tres primeros: columnas de distinta altura (2º, 1º, 3º) en
// vez de tres filas idénticas. `entries` = [{ id, username, avatar..., value }]
// ya ordenadas de mayor a menor.
export default function Podium({ entries, unit = "pts", meId }) {
  if (entries.length < 3) return null;
  const order = [entries[1], entries[0], entries[2]];
  const heights = ["h-16", "h-24", "h-12"];
  const places = [2, 1, 3];
  return (
    <div className="flex items-end justify-center gap-3 mb-5" role="list" aria-label="Podio">
      {order.map((e, i) => (
        <div key={e.id} role="listitem" className="flex flex-col items-center w-24 sm:w-28">
          {places[i] === 1 && <Crown size={16} className="text-accent mb-1" />}
          <Avatar user={e} size={places[i] === 1 ? 48 : 40} />
          <p className={`text-sm font-medium truncate max-w-full mt-1.5 ${e.id === meId ? "text-accent" : ""}`}>{e.username}</p>
          <p className="text-xs text-gray-500 mb-1.5 tabular-nums">{e.value} {unit}</p>
          <div className={`w-full ${heights[i]} rounded-t-lg flex items-start justify-center pt-2 font-bold ${places[i] === 1 ? "bg-accent text-onaccent" : "bg-white/10 text-gray-300"}`}>
            {places[i]}
          </div>
        </div>
      ))}
    </div>
  );
}
