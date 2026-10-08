import { useEffect, useState } from "react";
import { Trophy, Eye, Lock } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import ResultScreen from "../components/ResultScreen.jsx";
import GroupSelector from "../components/GroupSelector.jsx";
import { useGroups } from "../context/GroupContext.jsx";
import { logGame } from "../utils/logGame.js";
import { teams, badgeFor } from "../carrera/data/teams.js";
import { EXTRA_CRESTS } from "../data/extraCrests.js";
import { submitDaily, dailyMessage } from "../utils/dailyGames.js";

const ROUNDS = 10;
const BLUR_STEPS = [14, 9, 5, 2]; // se va destapando solo con el tiempo (y con la pista, en práctica)
// Los primeros 3 segundos el escudo no cambia; después se aclara un paso cada 3 s.
const GRACE_MS = 3000;
const STEP_MS = 3000;
// Cuanto más nítido estaba el escudo al acertar, menos vale el acierto.
const LEVEL_VALUE = [1, 0.85, 0.7, 0.55];

// Solo clubes con escudo real cargado (ver CLUB_LOGOS en carrera/data/teams.js)
// — ya están en el bundle porque los usa Carrera DT, así que este modo no
// necesita ningún asset nuevo.
const BASE_POOL = teams.filter((t) => badgeFor(t.id));
// Clubes grandes de otras ligas (Ajax, Boca, Benfica...) y clubes de ascenso: no son
// equipos jugables de Carrera DT, traen su escudo directo (ver data/extraCrests.js).
const asTeam = (e) => ({ id: e.id, name: e.name, league: e.league, prestige: e.prestige, badge: e.badge, colors: null });
const BIG_EXTRAS = EXTRA_CRESTS.filter((e) => e.kind === "grande").map(asTeam);
const ASCENSO_EXTRAS = EXTRA_CRESTS.filter((e) => e.kind === "ascenso").map(asTeam);
const POOL = [...BASE_POOL, ...BIG_EXTRAS];
// Nivel Experto: clubes de ascenso y los más oscuros de todo el pool.
const EXPERT_POOL = [...ASCENSO_EXTRAS, ...POOL.filter((t) => (t.prestige ?? 5) <= 4)];
const crestSrc = (team) => team.badge || badgeFor(team.id);
const OPT_TONES = ["tone-accent", "tone-blue", "tone-purple", "tone-pink"];
const SAMPLE_CREST = POOL[Math.floor(Math.random() * Math.max(1, POOL.length))];

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

// Los distractores se eligen por parecido: mismo color principal, misma
// liga si se puede, y —clave para que no se puedan descartar por pura
// fama— un nivel de reconocimiento (prestige, 1-10) PARECIDO al del club
// posta. Antes solo pesaba el color, así que un escudo obscuro podía
// terminar al lado de 3 clubes gigantes: cualquiera que ya conocía esos 3
// de memoria acertaba por descarte sin reconocer el escudo borroso en sí.
function pickDecoys(team, pool) {
  const targetPrestige = team.prestige ?? 5;
  const rest = pool.filter((t) => t.id !== team.id);
  const ranked = shuffle(rest).sort((a, b) => {
    const scoreA =
      colorDist(team.colors?.primary, a.colors?.primary) +
      Math.abs((a.prestige ?? 5) - targetPrestige) * 18 -
      (a.league === team.league ? 40 : 0);
    const scoreB =
      colorDist(team.colors?.primary, b.colors?.primary) +
      Math.abs((b.prestige ?? 5) - targetPrestige) * 18 -
      (b.league === team.league ? 40 : 0);
    return scoreA - scoreB;
  });
  return ranked.slice(0, 3);
}

// Juego diario: dificultad MEDIA = clubes de reconocimiento intermedio (prestige
// 4 a 7), ni los gigantes que se adivinan solos ni los escudos más obscuros.
const MID_POOL = POOL.filter((t) => (t.prestige ?? 5) >= 4 && (t.prestige ?? 5) <= 7);

function buildRounds(mid = false, expert = false) {
  const base = expert ? EXPERT_POOL : mid && MID_POOL.length >= ROUNDS ? MID_POOL : POOL;
  const chosen = shuffle(base).slice(0, ROUNDS);
  // En Experto las opciones falsas también son clubes oscuros: no hay nombres famosos que descartar.
  return chosen.map((team) => ({ team, options: shuffle([team, ...pickDecoys(team, expert ? EXPERT_POOL : POOL)]) }));
}

// Puntaje del reto semanal: rendimiento (aciertos) × dificultad (cuánto
// menos conocido es el club — prestige bajo = escudo más difícil de
// reconocer, vale más) × duración (más rápido en promedio, más puntos,
// pero nunca menos de 70% ni más de 130% del puntaje base — pensar un
// segundo de más no debería arruinar la marca).
const IDEAL_SECONDS_PER_ROUND = 8;

function computeWeeklyScore(rounds, results, elapsedMs, levels = []) {
  let raw = 0;
  rounds.forEach((r, i) => {
    if (!results[i]) return;
    const difficulty = 11 - (r.team.prestige ?? 5); // 1 (muy famoso) a 10 (muy obscuro)
    raw += (10 + difficulty * 2) * (LEVEL_VALUE[levels[i] ?? 0] ?? 0.55); // 12 a 30 puntos por acierto según qué tan reconocible era, y qué tan borroso estaba
  });
  const idealMs = IDEAL_SECONDS_PER_ROUND * rounds.length * 1000;
  const timeFactor = Math.min(1.3, Math.max(0.7, idealMs / Math.max(1, elapsedMs)));
  return Math.round(raw * timeFactor);
}

export default function CrestQuiz() {
  const { activeGroupId: groupId } = useGroups();
  const [phase, setPhase] = useState("idle"); // idle | playing | done
  const [weekly, setWeekly] = useState(true); // reto semanal: sin pistas, suma al grupo
  const [isDaily, setIsDaily] = useState(false); // juego diario: sin pistas, dificultad media
  const [isExpert, setIsExpert] = useState(false); // nivel Experto: clubes de ascenso y oscuros, sin pistas
  const [dailyMsg, setDailyMsg] = useState("");
  const [rounds, setRounds] = useState([]);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [results, setResults] = useState([]); // true/false por escudo, para los puntitos
  const [blurLevel, setBlurLevel] = useState(0);
  const [feedback, setFeedback] = useState(null); // "correct" | "wrong"
  const [saveState, setSaveState] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [levels, setLevels] = useState([]); // nivel de desenfoque al responder cada escudo
  const [weeklyStatus, setWeeklyStatus] = useState(undefined); // undefined mientras carga | { played, score }
  const [lockedMsg, setLockedMsg] = useState("");

  const current = rounds[index];
  const blur = BLUR_STEPS[Math.min(blurLevel, BLUR_STEPS.length - 1)];

  useEffect(() => {
    if (!groupId) { setWeeklyStatus(null); return; }
    setWeeklyStatus(undefined);
    api.get("/challenges/mine", { params: { gameKey: "escudos", groupId } })
      .then(({ data }) => setWeeklyStatus(data))
      .catch(() => setWeeklyStatus(null));
  }, [groupId, phase]);

  function start(kind) {
    if (kind === "weekly" && weeklyStatus?.locked) return;
    setWeekly(kind === "weekly");
    setIsDaily(kind === "daily");
    setIsExpert(kind === "expert");
    setDailyMsg("");
    setRounds(buildRounds(kind === "daily", kind === "expert"));
    setIndex(0);
    setCorrectCount(0);
    setResults([]);
    setBlurLevel(0);
    setLevels([]);
    setFeedback(null);
    setSaveState(null);
    setLockedMsg("");
    setStartedAt(Date.now());
    setPhase("playing");
  }

  // El escudo se aclara solo: 3 segundos sin cambios y después un paso cada 3 s.
  useEffect(() => {
    if (phase !== "playing" || feedback) return undefined;
    let interval;
    const timeout = setTimeout(() => {
      setBlurLevel((b) => Math.min(b + 1, BLUR_STEPS.length - 1));
      interval = setInterval(() => setBlurLevel((b) => Math.min(b + 1, BLUR_STEPS.length - 1)), STEP_MS);
    }, GRACE_MS);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [phase, index, feedback]);

  function revealMore() {
    setBlurLevel((b) => Math.min(b + 1, BLUR_STEPS.length - 1));
  }

  async function answer(teamId) {
    if (feedback) return;
    const correct = teamId === current.team.id;
    setFeedback(correct ? "correct" : "wrong");
    if (correct) setCorrectCount((c) => c + 1);
    const nextResults = [...results, correct];
    const nextLevels = [...levels, blurLevel];
    setResults(nextResults);
    setLevels(nextLevels);

    setTimeout(async () => {
      if (index + 1 < rounds.length) {
        setIndex((i) => i + 1);
        setBlurLevel(0);
        setFeedback(null);
      } else {
        setPhase("done");
        logGame("escudos", weekly ? 4 : isDaily ? 3 : 2, nextResults.filter(Boolean).length / ROUNDS, nextResults.filter(Boolean).length + "/" + ROUNDS + " escudos" + (weekly ? " · reto semanal" : isDaily ? " · diario" : " · práctica"));
        if (isDaily) {
          const hits = nextResults.filter(Boolean).length;
          const weighted = nextResults.reduce((sum, ok, i) => sum + (ok ? (LEVEL_VALUE[nextLevels[i] ?? 0] ?? 0.55) : 0), 0);
          submitDaily("escudos", weighted / ROUNDS, hits).then((r) => setDailyMsg(dailyMessage(r)));
        }
        if (groupId && weekly) {
          setSaveState("saving");
          try {
            const elapsedMs = Date.now() - startedAt;
            const score = computeWeeklyScore(rounds, nextResults, elapsedMs, nextLevels);
            const { data } = await api.post("/challenges/submit", { gameKey: "escudos", groupId, score });
            setSaveState({ improved: data.improved });
          } catch (err) {
            if (err.response?.status === 409) {
              setLockedMsg("Ya se había guardado el reto de esta semana (jugaste en otra pestaña) — esta corrida no se contó.");
            }
            setSaveState(null);
          }
        }
      }
    }, 700);
  }

  const alreadyPlayed = weeklyStatus?.locked;

  return (
    <Layout focus={phase === "playing"}>
      <h1 className="text-xl sm:text-2xl font-bold mb-1">Escudos a ciegas</h1>
      <p className="text-gray-400 text-sm mb-4">
        {ROUNDS} escudos reales, muy borrosos, que se aclaran solos (los primeros 3 segundos no cambian: acertar antes vale más). En práctica podés pedir pistas para verlos más nítidos; el reto semanal es a ciegas, sin pistas, un solo intento por semana, y el puntaje pondera cuántos acertaste, qué tan reconocibles eran y qué tan rápido respondiste.
      </p>

      <GroupSelector />

      {phase === "idle" && (
        <div className="mt-4 space-y-4">
        <div className="hero-b rounded-3xl p-6 sm:p-8 overflow-hidden relative" style={{ "--hero-a": "var(--c-blue)", "--hero-b": "var(--c-pink)" }}>
          {SAMPLE_CREST && <img src={crestSrc(SAMPLE_CREST)} alt="" aria-hidden="true" className="absolute -right-6 top-1/2 -translate-y-1/2 w-56 h-56 sm:w-72 sm:h-72 object-contain opacity-90 pointer-events-none" style={{ filter: "blur(10px)" }} />}
          <div className="relative max-w-xl">
          <Trophy size={28} className="text-accent mb-3" />
          <p className="text-lg text-gray-200 mb-5">¿Cuántos clubes reconocés solo por el escudo, bien borroso?</p>

          {alreadyPlayed && (
            <p className="flex items-center justify-center gap-1.5 text-xs text-amber-500 mb-4">
              <Lock size={13} /> Ya jugaste el reto semanal esta semana · {weeklyStatus.score} pts. Volvé el lunes.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button onClick={() => start("daily")} className="btn btn-primary">
              Juego diario (media)
            </button>
            <button
              onClick={() => start("weekly")}
              disabled={!!alreadyPlayed}
              className="px-6 py-2.5 rounded-card border border-border text-sm text-gray-300 hover:text-white hover:border-white/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={alreadyPlayed ? "Ya jugaste el reto semanal — un solo intento por semana" : undefined}
            >
              {alreadyPlayed ? "Reto semanal jugado" : "Reto semanal (sin pistas)"}
            </button>
            <button
              onClick={() => start("expert")}
              className="px-6 py-2.5 rounded-card border border-border text-sm text-gray-300 hover:text-white hover:border-white/30 transition-colors"
            >
              Experto (ascenso y clubes oscuros)
            </button>
            <button
              onClick={() => start("practice")}
              className="px-6 py-2.5 rounded-card border border-border text-sm text-gray-300 hover:text-white hover:border-white/30 transition-colors"
            >
              Práctica (con pistas)
            </button>
          </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-panel p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-y-3">
            <div className="strip-cell tone-blue"><p className="text-xs uppercase tracking-wider text-gray-500">Reto semanal</p><p className="text-xl sm:text-2xl font-bold text-tone mt-1">{alreadyPlayed ? `${weeklyStatus.score} pts` : "Disponible"}</p></div>
            <div className="strip-cell tone-amber"><p className="text-xs uppercase tracking-wider text-gray-500">Juego diario</p><p className="text-xl sm:text-2xl font-bold text-tone mt-1">hasta 20 pts</p></div>
            <div className="strip-cell tone-pink"><p className="text-xs uppercase tracking-wider text-gray-500">Cada partida</p><p className="text-xl sm:text-2xl font-bold text-tone mt-1">{ROUNDS} escudos</p></div>
          </div>
        </div>
        </div>
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
              <span className="text-gray-400">Escudo {index + 1} / {rounds.length}{isDaily ? " · diario, sin pistas" : isExpert ? " · experto, sin pistas" : weekly ? " · sin pistas" : " · práctica"}</span>
              <span className="text-gray-400">
                {correctCount} correctas
                {(() => { let n = 0; for (let i = results.length - 1; i >= 0 && results[i]; i--) n++; return n >= 2 ? ` · racha de ${n}` : ""; })()}
              </span>
            </div>
          </div>

          <div className="hero-b rounded-3xl p-5 sm:p-7" style={{ "--hero-a": "var(--c-blue)", "--hero-b": "var(--c-purple)" }}>
            <div className="flex flex-col items-center gap-4">
              <span
                className="relative w-52 h-52 sm:w-60 sm:h-60 rounded-full flex items-center justify-center tone-blue"
                style={{ background: `conic-gradient(rgb(var(--tone)) ${((blurLevel + 1) / BLUR_STEPS.length) * 100}%, rgb(var(--c-border)) 0)`, boxShadow: "0 0 30px -8px rgb(var(--tone))" }}
              >
                <span className="absolute inset-2 rounded-full bg-bg" />
                <img
                  src={crestSrc(current.team)}
                  alt="Escudo a adivinar"
                  className="relative w-32 h-32 sm:w-40 sm:h-40 object-contain transition-[filter]"
                  style={{ filter: `blur(${blur}px)` }}
                />
              </span>
              <p className="text-xs uppercase tracking-wider text-gray-400">Claridad {Math.round(((blurLevel + 1) / BLUR_STEPS.length) * 100)}% · vale ×{LEVEL_VALUE[Math.min(blurLevel, LEVEL_VALUE.length - 1)]}</p>

              {!weekly && !isDaily && !isExpert && !feedback && blurLevel < BLUR_STEPS.length - 1 && (
                <button
                  onClick={revealMore}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <Eye size={13} /> Pista (menos borroso)
                </button>
              )}

              <div className="flex flex-col gap-2 w-full max-w-xl">
                {current.options.map((opt, oi) => {
                  const isCorrectOpt = feedback && opt.id === current.team.id;
                  const isWrongPick = feedback === "wrong" && opt.id === current.team.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => answer(opt.id)}
                      disabled={!!feedback}
                      className={`${OPT_TONES[oi % 4]} flex items-center gap-3 text-left px-4 py-3 rounded-2xl border text-sm transition-colors disabled:opacity-70 ${
                        isCorrectOpt
                          ? "border-emerald/50 bg-emerald/10 text-emerald"
                          : "border-border hover:border-accent/40 hover:bg-accent/5"
                      } ${isWrongPick ? "border-emerald/50 bg-emerald/10 text-emerald" : ""}`}
                    >
                      <span className="w-7 h-7 shrink-0 rounded-full bg-tone text-onaccent flex items-center justify-center text-xs font-bold">{"ABCD"[oi]}</span>
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
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="space-y-4">
        <div className="hero-b rounded-3xl p-5 sm:p-6" style={{ "--hero-a": "var(--c-blue)", "--hero-b": "var(--c-amber)" }}>
          <p className="t-eyebrow mb-3">Ronda por ronda</p>
          <div className="flex flex-wrap gap-3">
            {rounds.map((r, i) => (
              <span key={i} className={`relative w-14 h-14 rounded-2xl border-2 flex items-center justify-center bg-bg/60 ${results[i] ? "border-emerald/70" : "border-red-500/70"}`}>
                <img src={crestSrc(r.team)} alt={r.team.name} title={r.team.name} className="w-9 h-9 object-contain" />
                <span className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center ${results[i] ? "bg-emerald text-onaccent" : "bg-red-500 text-white"}`}>{results[i] ? "✓" : "✗"}</span>
              </span>
            ))}
          </div>
        </div>
        <ResultScreen
          score={`${correctCount} / ${ROUNDS}`}
          unit="escudos acertados"
          groupId={weekly ? groupId : null}
          saveState={saveState}
          highlight={
            isDaily
              ? dailyMsg || "Guardando tu puntaje del día…"
              : !weekly
              ? "Fue práctica: no cuenta para el ranking. Jugá el juego diario o el reto semanal (sin pistas) para sumar."
              : lockedMsg || "Puntaje del reto: aciertos × qué tan reconocible era el club × qué tan rápido respondiste. Un solo intento por semana."
          }
          onAgain={() => setPhase("idle")}
          shareText={`⚽ Futotal · Escudos a ciegas: ${correctCount}/${ROUNDS} — ¿me ganás?`}
        />
        </div>
      )}
    </Layout>
  );
}
