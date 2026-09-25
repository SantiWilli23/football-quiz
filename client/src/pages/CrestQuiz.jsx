import { useState } from "react";
import { Trophy, Eye } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import ResultScreen from "../components/ResultScreen.jsx";
import GroupSelector from "../components/GroupSelector.jsx";
import { useGroups } from "../context/GroupContext.jsx";
import { teams, badgeFor } from "../carrera/data/teams.js";

const ROUNDS = 10;
const BLUR_STEPS = [14, 9, 5, 2]; // se va destapando con cada pista, si el usuario la pide

// Solo clubes con escudo real cargado (ver CLUB_LOGOS en carrera/data/teams.js)
// — ya están en el bundle porque los usa Carrera DT, así que este modo no
// necesita ningún asset nuevo.
const POOL = teams.filter((t) => badgeFor(t.id));

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Distancia entre dos colores hex (RGB euclidiana) — cuanto más chica, más se parecen los escudos.
function hexToRgb(hex) {
  const h = (hex || "#888888").replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function colorDist(a, b) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

// Los distractores se eligen por parecido (mismo color principal y, si se puede, misma liga)
// para que el escudo borroso no se pueda adivinar solo por la mancha de color.
function pickDecoys(team, pool) {
  const rest = pool.filter((t) => t.id !== team.id);
  const ranked = shuffle(rest).sort((a, b) => {
    const da = colorDist(team.colors?.primary, a.colors?.primary) - (a.league === team.league ? 40 : 0);
    const db = colorDist(team.colors?.primary, b.colors?.primary) - (b.league === team.league ? 40 : 0);
    return da - db;
  });
  return ranked.slice(0, 3);
}

function buildRounds() {
  const chosen = shuffle(POOL).slice(0, ROUNDS);
  return chosen.map((team) => ({ team, options: shuffle([team, ...pickDecoys(team, POOL)]) }));
}

export default function CrestQuiz() {
  const { activeGroupId: groupId } = useGroups();
  const [phase, setPhase] = useState("idle"); // idle | playing | done
  const [weekly, setWeekly] = useState(true); // reto semanal: sin pistas, suma al grupo
  const [rounds, setRounds] = useState([]);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [results, setResults] = useState([]); // true/false por escudo, para los puntitos
  const [blurLevel, setBlurLevel] = useState(0);
  const [feedback, setFeedback] = useState(null); // "correct" | "wrong"
  const [saveState, setSaveState] = useState(null);

  const current = rounds[index];
  const blur = BLUR_STEPS[Math.min(blurLevel, BLUR_STEPS.length - 1)];

  function start(isWeekly) {
    setWeekly(isWeekly);
    setRounds(buildRounds());
    setIndex(0);
    setCorrectCount(0);
    setResults([]);
    setBlurLevel(0);
    setFeedback(null);
    setSaveState(null);
    setPhase("playing");
  }

  function revealMore() {
    setBlurLevel((b) => Math.min(b + 1, BLUR_STEPS.length - 1));
  }

  async function answer(teamId) {
    if (feedback) return;
    const correct = teamId === current.team.id;
    setFeedback(correct ? "correct" : "wrong");
    if (correct) setCorrectCount((c) => c + 1);
    setResults((r) => [...r, correct]);

    setTimeout(async () => {
      if (index + 1 < rounds.length) {
        setIndex((i) => i + 1);
        setBlurLevel(0);
        setFeedback(null);
      } else {
        setPhase("done");
        if (groupId && weekly) {
          setSaveState("saving");
          try {
            const finalCorrect = correct ? correctCount + 1 : correctCount;
            const { data } = await api.post("/challenges/submit", { gameKey: "escudos", groupId, score: finalCorrect });
            setSaveState({ improved: data.improved });
          } catch {
            setSaveState(null);
          }
        }
      }
    }, 700);
  }

  return (
    <Layout focus={phase === "playing"}>
      <h1 className="text-xl sm:text-2xl font-bold mb-1">Escudos a ciegas</h1>
      <p className="text-gray-400 text-sm mb-4">
        {ROUNDS} escudos reales, muy borrosos. En práctica podés pedir pistas para verlos más nítidos; el reto semanal es a ciegas, sin pistas, y tu mejor marca suma al ranking del grupo.
      </p>

      <GroupSelector />

      {phase === "idle" && (
        <Card className="mt-4 text-center py-10">
          <Trophy size={32} className="mx-auto text-accent mb-3" />
          <p className="text-sm text-gray-400 mb-5">¿Cuántos clubes reconocés solo por el escudo, bien borroso?</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => start(true)}
              className="btn btn-primary"
            >
              Reto semanal (sin pistas)
            </button>
            <button
              onClick={() => start(false)}
              className="px-6 py-2.5 rounded-card border border-border text-sm text-gray-300 hover:text-white hover:border-white/30 transition-colors"
            >
              Práctica (con pistas)
            </button>
          </div>
        </Card>
      )}

      {phase === "playing" && current && (
        <div className="mt-4 space-y-4">
          <div>
            <div className="flex gap-1.5 mb-2" role="img" aria-label={`Escudo ${index + 1} de ${rounds.length}, ${correctCount} correctas`}>
              {rounds.map((_, i) => (
                <span
                  key={i}
                  className={`flex-1 h-1.5 rounded-full ${
                    i < results.length ? (results[i] ? "bg-good" : "bg-bad") : i === index ? "bg-white" : "bg-white/10"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Escudo {index + 1} / {rounds.length}{weekly ? " · sin pistas" : " · práctica"}</span>
              <span className="text-gray-400">
                {correctCount} correctas
                {(() => { let n = 0; for (let i = results.length - 1; i >= 0 && results[i]; i--) n++; return n >= 2 ? ` · racha de ${n}` : ""; })()}
              </span>
            </div>
          </div>

          <Card>
            <div className="flex flex-col items-center gap-4">
              <img
                src={badgeFor(current.team.id)}
                alt="Escudo a adivinar"
                className="w-32 h-32 object-contain transition-[filter]"
                style={{ filter: `blur(${blur}px)` }}
              />

              {!weekly && !feedback && blurLevel < BLUR_STEPS.length - 1 && (
                <button
                  onClick={revealMore}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <Eye size={13} /> Pista (menos borroso)
                </button>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                {current.options.map((opt) => {
                  const isCorrectOpt = feedback && opt.id === current.team.id;
                  const isWrongPick = feedback === "wrong" && opt.id === current.team.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => answer(opt.id)}
                      disabled={!!feedback}
                      className={`text-left px-3 py-2.5 rounded-card border text-sm transition-colors disabled:opacity-70 ${
                        isCorrectOpt
                          ? "border-emerald/50 bg-emerald/10 text-emerald"
                          : "border-border hover:border-accent/40 hover:bg-accent/5"
                      } ${isWrongPick ? "border-emerald/50 bg-emerald/10 text-emerald" : ""}`}
                    >
                      {opt.name}
                    </button>
                  );
                })}
              </div>

              {feedback && (
                <p className={`text-sm font-medium ${feedback === "correct" ? "text-emerald" : "text-red-400"}`}>
                  {feedback === "correct" ? "¡Bien!" : `Era ${current.team.name}`}
                </p>
              )}
            </div>
          </Card>
        </div>
      )}

      {phase === "done" && (
        <ResultScreen
          score={`${correctCount} / ${ROUNDS}`}
          unit="escudos acertados"
          groupId={weekly ? groupId : null}
          saveState={saveState}
          highlight={weekly ? undefined : "Fue práctica: no cuenta para el ranking. Jugá el reto semanal (sin pistas) para sumar."}
          onAgain={() => setPhase("idle")}
          shareText={`⚽ Futotal · Escudos a ciegas: ${correctCount}/${ROUNDS} — ¿me ganás?`}
        />
      )}
    </Layout>
  );
}
