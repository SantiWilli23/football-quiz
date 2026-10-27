import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, Play, Trophy, Users } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useClubs } from "./useClubs.js";
import { track } from "./analytics.js";

// Hoy: lo que importa del día en pocos bloques. El partido del día arriba, tu club
// debajo, y recién después seguir jugando.
export default function Hoy() {
  const { user } = useAuth();
  const { clubs, loaded, main } = useClubs();
  const [today, setToday] = useState(null);
  const [streak, setStreak] = useState(null);
  const [table, setTable] = useState(null);
  const [clubStreak, setClubStreak] = useState(null);

  useEffect(() => {
    track("abrio_hoy");
    api.get("/daily/today").then((r) => setToday(r.data)).catch(() => setToday(false));
    api.get("/clubs/me/streak").then((r) => setStreak(r.data)).catch(() => setStreak(null));
  }, []);

  useEffect(() => {
    if (!main) return;
    api.get(`/clubs/${main.id}/table`, { params: { view: "hoy" } }).then((r) => setTable(r.data)).catch(() => setTable(null));
    api.get(`/clubs/${main.id}/streak`).then((r) => setClubStreak(r.data)).catch(() => setClubStreak(null));
  }, [main]);

  const played = today && today.result;
  const inProgress = today && !today.result && today.answered.length > 0;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="t-eyebrow">Hoy</p>
            <h1 className="t-title truncate">Hola, {user?.username}</h1>
          </div>
          {streak && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel px-3 py-1.5 text-sm shrink-0" title={streak.protectorAvailable ? "Tenés un protector esta semana" : "El protector de esta semana ya se usó"}>
              <Flame size={15} className="text-orange-400" />
              <b className="tabular-nums">{streak.streak}</b>
              <span className="text-gray-500 text-xs">{streak.streak === 1 ? "día" : "días"}</span>
            </span>
          )}
        </div>

        <Card variant="feature">
          <p className="t-eyebrow">Partido del día</p>
          {today === null && <p className="text-sm text-gray-500 mt-2">Cargando…</p>}
          {today === false && <p className="text-sm text-red-400 mt-2">No se pudo cargar el partido de hoy.</p>}
          {today && played && (
            <>
              <p className="text-5xl font-extrabold tabular-nums mt-1">{today.result.total}<span className="text-xl text-gray-400">/100</span></p>
              <p className="text-sm text-gray-400 mt-1">Ya jugaste. Mañana hay otro, igual para todos.</p>
              <Link to="/partido" className="btn btn-secondary btn-sm mt-3 inline-flex">Ver tu partido</Link>
            </>
          )}
          {today && !played && (
            <>
              <p className="text-lg font-semibold mt-1">{inProgress ? "Te quedaste a la mitad" : "Tres partes, un minuto cada una"}</p>
              <p className="text-sm text-gray-400">¿Quién es?, Más o menos y Penales. El marcador va de 0 a 100 y suma a tu club al instante.</p>
              <Link to="/partido" className="btn btn-primary w-full mt-4 inline-flex items-center justify-center gap-2" onClick={() => track("partido_click_hoy")}>
                <Play size={16} /> {inProgress ? "Seguir jugando" : "Jugar"}
              </Link>
            </>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-2">
            <p className="t-eyebrow flex items-center gap-1.5"><Users size={13} /> {main ? main.name : "Tu club"}</p>
            {main && <Link to="/club" className="text-xs text-accent">Ver tabla</Link>}
          </div>
          {loaded && !main && (
            <div className="text-sm text-gray-400 space-y-3">
              <p>Todavía no estás en un club. Con un club tus puntos cuentan y se abren los sobres.</p>
              <Link to="/club" className="btn btn-primary btn-sm inline-flex">Crear o unirme a un club</Link>
            </div>
          )}
          {main && table?.preseason && (
            <p className="text-sm text-gray-400">Pretemporada: {main.members} {main.members === 1 ? "miembro" : "miembros"}. {main.owner ? "Cuando estén todos, iniciá la temporada desde Club." : "Esperando que el dueño inicie la temporada."}</p>
          )}
          {main && table && !table.preseason && (
            <ol className="divide-y divide-border">
              {table.table.slice(0, 3).map((r) => (
                <li key={r.userId} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-5 text-center font-bold text-gray-400 tabular-nums">{r.rank}</span>
                  <span className={`flex-1 min-w-0 truncate ${r.userId === user?.id ? "font-semibold text-accent" : ""}`}>{r.username}</span>
                  <span className="tabular-nums font-semibold">{r.points}</span>
                </li>
              ))}
              {table.table.length === 0 && <li className="py-2 text-sm text-gray-500">Nadie sumó puntos hoy todavía.</li>}
            </ol>
          )}
        </Card>

        {clubStreak && clubStreak.members >= 2 && (
          <Card>
            <p className="t-eyebrow flex items-center gap-1.5"><Flame size={13} className="text-orange-400" /> Racha del club</p>
            <p className="text-sm mt-1"><b className="tabular-nums">{clubStreak.streak}</b> {clubStreak.streak === 1 ? "día" : "días"} seguidos con todos jugando.</p>
            <p className="text-xs text-gray-500">{clubStreak.todayDone ? "Hoy jugaron todos: el club ganó un sobre extra." : "Si hoy juegan todos los miembros, el club gana un sobre extra."}</p>
          </Card>
        )}

        <Card>
          <p className="t-eyebrow flex items-center gap-1.5 mb-2"><Trophy size={13} /> Seguir jugando</p>
          <div className="grid grid-cols-2 gap-2">
            <Link to="/juegos" className="btn btn-secondary">Todos los juegos</Link>
            <Link to="/hoy/archivo" className="btn btn-secondary">Partidos pasados</Link>
          </div>
        </Card>

        {loaded && clubs.length > 1 && <p className="text-xs text-gray-600 text-center">Tu partido de hoy cuenta en los {clubs.length} clubes en los que estás.</p>}
      </div>
    </Layout>
  );
}
