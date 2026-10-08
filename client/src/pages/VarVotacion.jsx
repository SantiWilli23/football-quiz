import { useCallback, useEffect, useState } from "react";
import { Check, Gavel, X } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import GroupSelector from "../components/GroupSelector.jsx";
import VarClip from "../components/VarClip.jsx";
import { useGroups } from "../context/GroupContext.jsx";

// Votación del VAR: todos los del grupo deciden sobre la misma jugada del día y,
// recién después de votar, se ve cómo votó el grupo y qué dijo el VAR de verdad.
export default function VarVotacion() {
  const { activeGroupId: groupId } = useGroups();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!groupId) { setData(null); return; }
    try {
      const r = await api.get("/arbitraje-var/vote/today", { params: { groupId } });
      setData(r.data);
      setError("");
    } catch {
      setError("No se pudo cargar la jugada de hoy.");
    }
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  async function vote(optionIdx) {
    if (busy || data?.myVote != null) return;
    setBusy(true);
    try {
      const r = await api.post("/arbitraje-var/vote", { groupId, optionIdx });
      setData(r.data);
    } catch {
      setError("No se pudo guardar tu voto.");
    } finally {
      setBusy(false);
    }
  }

  const voted = data?.myVote != null;
  const total = data?.counts ? data.counts.reduce((a, b) => a + b, 0) : 0;

  return (
    <Layout>
      <h1 className="text-xl sm:text-2xl font-bold mb-1 flex items-center gap-2">
        <Gavel size={22} className="text-accent" />
        Votación del VAR
      </h1>
      <p className="text-gray-400 text-sm mb-4">
        Una jugada polémica por día. Votá qué cobrarías: cuando votás, ves cómo votó tu grupo y qué dijo el VAR.
      </p>

      <GroupSelector />

      {!groupId && <Card className="mt-4"><p className="text-sm text-gray-400">Unite a un grupo para votar con tus amigos.</p></Card>}
      {error && <p className="text-sm text-red-400 mt-4">{error}</p>}

      {data && (
        <Card className="mt-4">
          {data.situation.video && <VarClip video={data.situation.video} />}
          <p className="font-medium mb-4">{data.situation.text}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.situation.options.map((opt, idx) => {
              const mine = data.myVote === idx;
              const isCorrect = voted && data.correctIdx === idx;
              const count = voted ? data.counts[idx] : null;
              const pct = voted && total > 0 ? Math.round((count / total) * 100) : 0;
              let cls = "border-border hover:border-accent/40 hover:bg-accent/5";
              if (voted) cls = isCorrect ? "border-accent bg-accent/10" : mine ? "border-red-500/50 bg-red-500/10" : "border-border";
              return (
                <button
                  key={idx}
                  onClick={() => vote(idx)}
                  disabled={voted || busy}
                  className={`relative overflow-hidden text-left px-3 py-2.5 rounded-card border text-sm transition-colors disabled:cursor-default ${cls}`}
                >
                  {voted && <span className="absolute inset-y-0 left-0 bg-white/5" style={{ width: `${pct}%` }} aria-hidden="true" />}
                  <span className="relative flex items-center justify-between gap-2">
                    <span>{opt}{mine && " · tu voto"}</span>
                    {voted && <span className="text-xs text-gray-400 tabular-nums shrink-0">{count} · {pct}%</span>}
                  </span>
                  {voted && data.voters[idx].length > 0 && (
                    <span className="relative block text-[11px] text-gray-500 mt-1">{data.voters[idx].join(", ")}</span>
                  )}
                </button>
              );
            })}
          </div>

          {!voted && <p className="text-xs text-gray-500 mt-3">Votó {data.voted} de {data.members}. Votá para ver al resto y el fallo.</p>}
          {voted && (
            <div className="mt-4">
              <p className={`text-sm font-medium flex items-center gap-1.5 ${data.myVote === data.correctIdx ? "text-emerald" : "text-red-400"}`}>
                {data.myVote === data.correctIdx ? <Check size={15} /> : <X size={15} />}
                {data.myVote === data.correctIdx ? "Coincidiste con el VAR" : `El VAR dijo: ${data.situation.options[data.correctIdx]}`}
              </p>
              <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{data.why}</p>
              <p className="text-xs text-gray-500 mt-2">Votó {data.voted} de {data.members}. Volvé mañana por otra jugada.</p>
            </div>
          )}
        </Card>
      )}
    </Layout>
  );
}
