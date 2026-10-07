import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, X } from "lucide-react";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

const LEAGUE_NAMES = { premier: "Premier League", laliga: "La Liga", serie_a: "Serie A", bundesliga: "Bundesliga", ligue1: "Ligue 1", chile: "Primera Chile" };

const fmt = (iso) =>
  new Date(iso).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }) +
  " · " + new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

// Selector: liga arriba, equipos de su tabla abajo.
function Picker({ onPick, onClose }) {
  const [league, setLeague] = useState("premier");
  const [teams, setTeams] = useState(null);

  useEffect(() => {
    let alive = true;
    setTeams(null);
    api.get(`/football/${league}/standings`)
      .then((r) => alive && setTeams(r.data.table.map((row) => row.team)))
      .catch(() => alive && setTeams([]));
    return () => { alive = false; };
  }, [league]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-panel border border-border rounded-2xl p-5 max-w-md w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2"><Heart size={16} className="text-red-400" /> Elegí tu equipo favorito</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white" aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {Object.entries(LEAGUE_NAMES).map(([k, n]) => (
            <button
              key={k}
              onClick={() => setLeague(k)}
              className={`px-2.5 py-1 rounded-card text-xs border transition-colors ${league === k ? "border-accent/60 bg-accent/10 text-accent" : "border-border text-gray-400 hover:text-white"}`}
            >
              {n}
            </button>
          ))}
        </div>
        {teams === null && <p className="text-sm text-gray-500">Cargando equipos…</p>}
        <div className="grid grid-cols-2 gap-2">
          {(teams || []).map((t) => (
            <button
              key={t.id}
              onClick={() => onPick({ league, id: t.id, name: t.name, logo: t.logo })}
              className="flex items-center gap-2 px-3 py-2 rounded-card border border-border hover:border-white/30 text-left text-sm min-w-0"
            >
              {t.logo && <img src={t.logo} alt="" className="w-5 h-5 shrink-0" />}
              <span className="truncate">{t.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Tarjeta chica del Inicio: tu equipo favorito con su próximo partido y el último resultado.
export default function FavClubCard() {
  const { user, refreshMe } = useAuth();
  const fav = user?.profile?.favClub;
  const [picking, setPicking] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!fav) { setData(null); return undefined; }
    let alive = true;
    (async () => {
      try {
        const [info, up] = await Promise.all([
          api.get(`/football/${fav.league}/teams/${fav.id}`).then((r) => r.data).catch(() => null),
          api.get(`/football/${fav.league}/upcoming`, { params: { from: new Date().toISOString().slice(0, 10), days: 7 } }).then((r) => r.data.days).catch(() => []),
        ]);
        const next = up.flatMap((d) => d.fixtures).filter((f) => (f.home.id === fav.id || f.away.id === fav.id) && f.status === "NS").sort((a, b) => new Date(a.date) - new Date(b.date))[0];
        if (alive) setData({ next: next || info?.upcoming?.[0] || null, last: info?.recent?.[0] || null });
      } catch { if (alive) setData({ next: null, last: null }); }
    })();
    return () => { alive = false; };
  }, [fav?.league, fav?.id]);

  async function save(club) {
    setPicking(false);
    try { await api.put("/auth/fav-club", club || {}); await refreshMe(); } catch { /* sin cambios */ }
  }

  if (!fav) {
    return (
      <>
        <button onClick={() => setPicking(true)} className="mb-6 w-full flex items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-3 text-left text-sm text-gray-400 hover:text-white hover:border-white/30 transition-colors">
          <Heart size={16} className="text-red-400 shrink-0" /> Elegí tu equipo favorito y mirá sus partidos acá
        </button>
        {picking && <Picker onPick={save} onClose={() => setPicking(false)} />}
      </>
    );
  }

  const m = data?.next;
  const l = data?.last;
  return (
    <>
      <div className="mb-6 rounded-2xl border border-border bg-panel px-4 py-3 flex items-center gap-3 flex-wrap">
        {fav.logo && <img src={fav.logo} alt="" className="w-9 h-9 object-contain shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{fav.name}</p>
          <p className="text-xs text-gray-400 truncate">
            {data === null
              ? "Cargando…"
              : m
                ? `Próximo: ${m.home.name} vs ${m.away.name} · ${fmt(m.date)}`
                : "Sin partidos próximos a la vista"}
          </p>
          {l && <p className="text-[11px] text-gray-500 truncate">Último: {l.home.name} {l.home.score} - {l.away.score} {l.away.name}</p>}
        </div>
        <Link to="/futbol" className="text-xs text-accent hover:underline shrink-0">Ver fútbol</Link>
        <button onClick={() => setPicking(true)} className="text-xs text-gray-500 hover:text-white shrink-0">Cambiar</button>
      </div>
      {picking && <Picker onPick={save} onClose={() => setPicking(false)} />}
    </>
  );
}
