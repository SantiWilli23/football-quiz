import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Target } from "lucide-react";
import api from "../api.js";
import { useToast } from "../context/ToastContext.jsx";
import { playSfx } from "../utils/sfx.js";

// Reto del día: consigna común para todos. Si ya está cumplido y todavía no se
// cobró, se cobra solo al abrir el inicio (el servidor lo valida y es una vez
// por día).
export default function DailyChallenge({ standalone = false }) {
  const [data, setData] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    let alive = true;
    api.get("/daily-challenge")
      .then(async ({ data: d }) => {
        if (!alive) return;
        if (d.done && !d.claimed) {
          try {
            const { data: c } = await api.post("/daily-challenge/claim");
            if (c.newly) {
              toast(`Reto del día cumplido · +${c.points} pts`);
              playSfx("win");
            }
            d = { ...d, claimed: true, streak: c.streak };
          } catch { /* se reintenta la próxima vez que abra el inicio */ }
        }
        if (alive) setData(d);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [toast]);

  if (!data) return null;
  const { challenge, done, streak } = data;
  const inner = (
    <>
      <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-emerald-500/15 text-emerald-500" : "bg-accent/15 text-accent"}`}>
        {done ? <Check size={14} /> : <Target size={14} />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="t-eyebrow block mb-0.5">Reto del día · +{challenge.points} pts{streak > 1 ? ` · racha ${streak}` : ""}</span>
        <span className={`text-sm ${done ? "text-gray-500 line-through" : "text-gray-200"}`}>{challenge.label}</span>
      </span>
    </>
  );
  return (
    <div className={standalone ? "mb-8 bg-panel border border-border rounded-2xl px-5 py-4" : "mt-5 pt-5 border-t border-white/10"}>
      {done ? (
        <div className="flex items-center gap-3">{inner}</div>
      ) : (
        <Link to={challenge.to} className="flex items-center gap-3 group">{inner}</Link>
      )}
    </div>
  );
}
