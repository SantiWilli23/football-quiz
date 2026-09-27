import { useCallback, useEffect, useRef, useState } from "react";
import { Crown, Layers, Play, Target, Trophy } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import Avatar from "../components/Avatar.jsx";
import EmptyState from "../components/EmptyState.jsx";
import GroupSelector from "../components/GroupSelector.jsx";
import MatchPitch from "../components/MatchPitch.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useGroups } from "../context/GroupContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

const ROUND_NAMES = { 1: "Cuartos", 2: "Semifinales", 3: "Final" };

function Side({ p, winner, pts }) {
  if (!p) return <div className="text-xs text-gray-500 py-1">Pasa directo</div>;
  return (
    <div className={`flex items-center gap-2 py-1 ${winner ? "font-semibold" : "text-gray-400"}`}>
      <Avatar user={p} size={22} />
      <span className="text-sm flex-1 truncate">{p.username}</span>
      {pts != null && <span className="text-xs tabular-nums">{pts}</span>}
      {winner && <Crown size={12} className="text-amber-500" />}
    </div>
  );
}

// Copa semanal: inscripción de lunes a jueves, eliminatoria viernes a domingo.
export default function CopaSemanal() {
  const { activeGroupId: groupId } = useGroups();
  const { user } = useAuth();
  const { toast, celebrate } = useToast();
  const [data, setData] = useState(null);
  const [replay, setReplay] = useState(null); // partido de cartas que se está repitiendo en la cancha
  const celebratedWeek = useRef(null);

  const load = useCallback(() => {
    if (!groupId) return;
    api.get(`/weekly-cup/${groupId}`).then((r) => setData(r.data)).catch(() => setData(null));
  }, [groupId]);
  useEffect(() => { load(); }, [load]);

  // Festejo una sola vez por semana ganada, la primera vez que esta pantalla
  // se abre después de que vos seas el campeón (no en cada render).
  useEffect(() => {
    if (!data?.champion || data.champion.id !== user?.id) return;
    if (celebratedWeek.current === data.week) return;
    celebratedWeek.current = data.week;
    celebrate("¡Campeón de la copa semanal!");
  }, [data, user, celebrate]);

  async function join() {
    try {
      await api.post(`/weekly-cup/${groupId}/join`);
      toast("Estás anotado en la copa");
      load();
    } catch (err) {
      toast(err.response?.data?.error || "No se pudo anotar");
    }
  }

  async function setMode(mode) {
    try {
      await api.put(`/weekly-cup/${groupId}/mode`, { mode });
      toast(mode === "cartas" ? "La copa de esta semana se juega con Cartas" : "La copa de esta semana es por puntos");
      load();
    } catch (err) {
      toast(err.response?.data?.error || "No se pudo cambiar la modalidad");
    }
  }

  const roundName = (r, total) => (r === total ? "Final" : r === total - 1 ? "Semifinales" : ROUND_NAMES[1]);

  return (
    <Layout>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="t-title mb-1">Copa semanal</h1>
          <p className="text-gray-400 text-sm">
            Anotate de lunes a jueves. Desde el viernes se juega a eliminación y la final es el domingo. Hay dos modalidades: por puntos (gana quien sume más ese día en trivia, Fichado y reto del día) o con Cartas (partido simulado entre los equipos de cada uno).
          </p>
        </div>
        <GroupSelector />
      </div>

      {!groupId && <Card><EmptyState icon={Trophy} title="Elegí un grupo" hint="La copa se juega entre los miembros de tu grupo." actions={[{ label: "Ir a Mi grupo", to: "/grupo" }]} /></Card>}

      {data && (
        <div className="space-y-4">
          {data.champion && (
            <Card variant="feature" className="text-center">
              <Crown size={28} className="mx-auto text-amber-500 mb-2" />
              <p className="t-eyebrow mb-1">Campeón de la semana</p>
              <p className="text-2xl font-bold">{data.champion.username}</p>
            </Card>
          )}

          <Card>
            <p className="t-eyebrow mb-2">Modalidad de esta semana</p>
            <div className="flex gap-2 flex-wrap mb-2">
              {[["puntos", "Por puntos", Target], ["cartas", "Con Cartas", Layers]].map(([k, label, Icon]) => {
                const active = data.mode === k;
                const disabled = !data.canChangeMode || (k === "cartas" && !data.cardsAvailable);
                return (
                  <button
                    key={k}
                    onClick={() => !active && setMode(k)}
                    disabled={disabled && !active}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card border text-xs font-medium transition-colors ${active ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-gray-400 hover:text-white disabled:opacity-40 disabled:hover:text-gray-400"}`}
                  >
                    <Icon size={13} /> {label}
                  </button>
                );
              })}
            </div>
            <p className="t-meta">
              {data.mode === "cartas"
                ? "Cada cruce es un partido simulado entre los equipos de Cartas (el once que tengas guardado ese día). Empate: penales. Sin equipo armado, perdés por W.O."
                : "Cada cruce lo gana quien sume más puntos ese día."}
              {data.canChangeMode ? (data.cardsAvailable ? " Como creaste el grupo, podés cambiarla hasta el jueves." : " Para jugarla con Cartas, primero activá Cartas en el grupo.") : ""}
            </p>
          </Card>

          <Card>
            <p className="t-eyebrow mb-3">Anotados ({data.signups.length}/{data.max})</p>
            {data.signups.length === 0 ? (
              <p className="text-sm text-gray-500">Todavía no se anotó nadie.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.signups.map((p) => (
                  <span key={p.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border text-xs">
                    <Avatar user={p} size={18} /> {p.username}
                  </span>
                ))}
              </div>
            )}
            {data.signupOpen && !data.signedUp && (
              <button onClick={join} className="mt-4 px-5 py-2 rounded-card bg-accent text-onaccent text-sm font-semibold hover:opacity-90">Anotarme</button>
            )}
            {data.signedUp && data.phase === "inscripcion" && <p className="t-meta mt-3">Estás anotado. Los cruces se arman el viernes.</p>}
            {data.phase === "sin_copa" && <p className="t-meta mt-3">Esta semana no hubo suficientes anotados (hacen falta 2). La próxima abre el lunes.</p>}
          </Card>

          {data.rounds.map((r) => (
            <Card key={r.round}>
              <p className="t-heading mb-3">{roundName(r.round, data.rounds.length)} <span className="t-meta font-normal">· {r.day}</span></p>
              <div className="grid sm:grid-cols-2 gap-3">
                {r.matches.map((m, i) => (
                  <div key={i} className="rounded-card border border-border px-3 py-2">
                    <Side p={m.a} winner={m.winner && m.a && m.winner === m.a.id} pts={m.aPts} />
                    <div className="border-t border-border" />
                    <Side p={m.b} winner={m.winner && m.b && m.winner === m.b.id} pts={m.bPts} />
                    {m.events && (
                      m.aPts == null ? (
                        <p className="text-xs text-gray-500 pt-1.5">{m.events[0]?.text}</p>
                      ) : (
                        <button onClick={() => setReplay({ key: `${r.round}-${i}`, m })} className="mt-1.5 inline-flex items-center gap-1 text-xs text-accent hover:underline">
                          <Play size={11} /> Ver partido{m.events.some((e) => e.type === "penalties") ? " (se definió por penales)" : ""}
                        </button>
                      )
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}

          {replay && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <p className="t-heading">{replay.m.a?.username} vs {replay.m.b?.username}</p>
                <button onClick={() => setReplay(null)} className="text-xs text-gray-500 hover:text-white">Cerrar</button>
              </div>
              <MatchPitch key={replay.key} events={replay.m.events} homeLabel={replay.m.a?.username} awayLabel={replay.m.b?.username} />
            </Card>
          )}
        </div>
      )}
    </Layout>
  );
}
