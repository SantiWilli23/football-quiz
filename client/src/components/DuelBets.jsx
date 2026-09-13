import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import api from "../api.js";
import Card from "../components/Card.jsx";

export default function DuelBets({ groupId }) {
  const [bettable, setBettable] = useState([]);
  const [mine, setMine] = useState([]);
  const [amounts, setAmounts] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    api.get("/duels/bettable", { params: { groupId } }).then(({ data }) => setBettable(data.duels)).catch(() => setBettable([]));
    api.get("/duels/bets/mine", { params: { groupId } }).then(({ data }) => setMine(data.bets)).catch(() => setMine([]));
  };

  useEffect(() => {
    if (!groupId) return;
    load();
  }, [groupId]);

  async function placeBet(duelId, pickedUserId) {
    const amount = Number(amounts[duelId]) || 5;
    setBusy(duelId);
    setError("");
    try {
      await api.post(`/duels/${duelId}/bet`, { picked_user_id: pickedUserId, amount });
      load();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo apostar");
    } finally {
      setBusy(null);
    }
  }

  if (bettable.length === 0 && mine.length === 0) return null;

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <Coins size={16} className="text-amber-400" />
        <h3 className="font-semibold">Apuestas cruzadas</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Apostá puntos propios a quién gana un duelo ajeno. Acertás, ganás lo apostado; fallás, lo perdés.
      </p>

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      {bettable.filter((d) => !d.already_bet).length > 0 && (
        <div className="space-y-2 mb-5">
          {bettable
            .filter((d) => !d.already_bet)
            .map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3 rounded-card border border-border bg-panel flex-wrap">
                <span className="text-sm flex-1 min-w-[140px]">
                  {d.challenger_name} vs {d.opponent_name}
                </span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={amounts[d.id] ?? 5}
                  onChange={(e) => setAmounts((prev) => ({ ...prev, [d.id]: e.target.value }))}
                  className="w-14 bg-bg border border-border rounded-card text-center py-1.5 text-sm focus:outline-none focus:border-accent"
                />
                <button
                  onClick={() => placeBet(d.id, d.challenger_id)}
                  disabled={busy === d.id}
                  className="text-xs font-medium px-3 py-2 rounded-card bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 disabled:opacity-40 transition-colors"
                >
                  Gana {d.challenger_name}
                </button>
                <button
                  onClick={() => placeBet(d.id, d.opponent_id)}
                  disabled={busy === d.id}
                  className="text-xs font-medium px-3 py-2 rounded-card bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 disabled:opacity-40 transition-colors"
                >
                  Gana {d.opponent_name}
                </button>
              </div>
            ))}
        </div>
      )}

      {mine.length > 0 && (
        <div className="space-y-1.5">
          {mine.map((b) => (
            <div key={b.id} className="flex items-center justify-between text-sm px-1">
              <span className="text-gray-400 truncate">
                {b.challenger_name} vs {b.opponent_name} — apostaste {b.amount} a {b.picked_name}
              </span>
              {b.settled ? (
                <span className={`shrink-0 font-semibold ${b.result_points > 0 ? "text-emerald" : b.result_points < 0 ? "text-red-400" : "text-gray-500"}`}>
                  {b.result_points > 0 ? `+${b.result_points}` : b.result_points} pts
                </span>
              ) : (
                <span className="shrink-0 text-xs text-gray-500">pendiente</span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
