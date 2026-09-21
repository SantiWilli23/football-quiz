import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Award, Check, Lock, Sparkles, Trophy } from "lucide-react";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import { listSaveSlots, loadCareer } from "../carrera/hooks/useCareerSave.js";

const SAVE_KEY = "vidafut_v1";

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : { stage: 1 };
  } catch {
    return { stage: 1 };
  }
}

function save(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    /* sin storage: la campaña no persiste, no rompe nada */
  }
}

// Cada etapa se mide contra el progreso REAL que ya guarda cada modo por su
// cuenta — no hay una tabla nueva ni un estado paralelo que se pueda
// desincronizar. Simplificación consciente: no exige que el progreso haya
// arrancado DESPUÉS de empezar la campaña (sería más estricto, pero pedía
// trackear "snapshots" cruzando tres localStorage distintos) — si ya tenías
// una carrera de Presidente con 3 temporadas antes de arrancar Vida FUT, esa
// etapa cuenta hecha. Es una campaña personal, no un modo competitivo.
function cotreroCareersDone() {
  try {
    const raw = localStorage.getItem("cotrero_hof");
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.length : 0;
  } catch {
    return 0;
  }
}

function bestDtSeasons() {
  try {
    const slots = listSaveSlots();
    let best = 0;
    for (const slot of slots) {
      const data = loadCareer(slot.id);
      const seasons = (data?.history || []).filter((h) => !h.note).length;
      if (seasons > best) best = seasons;
    }
    return best;
  } catch {
    return 0;
  }
}

function presidenteSeasons() {
  try {
    const raw = localStorage.getItem("presidente_v1");
    const state = raw ? JSON.parse(raw) : null;
    return state?.history?.length || 0;
  } catch {
    return 0;
  }
}

const STAGES = [
  {
    id: 1,
    title: "Cotrero Especialista",
    goal: "Retirá al menos un jugador (una carrera completa)",
    to: "/cotrero/",
    external: true,
    target: 1,
    progress: cotreroCareersDone,
    label: (p) => `${p} de 1 carrera retirada`,
  },
  {
    id: 2,
    title: "Carrera DT",
    goal: "Dirigí 3 temporadas completas",
    to: "/carrera-dt",
    target: 3,
    progress: bestDtSeasons,
    label: (p) => `${Math.min(p, 3)} de 3 temporadas`,
  },
  {
    id: 3,
    title: "Modo Presidente",
    goal: "Presidí el club 3 temporadas completas",
    to: "/presidente",
    target: 3,
    progress: presidenteSeasons,
    label: (p) => `${Math.min(p, 3)} de 3 temporadas`,
  },
];

export default function VidaFut() {
  const [campaign, setCampaign] = useState(load);
  const [progress, setProgress] = useState({ 1: 0, 2: 0, 3: 0 });

  const refresh = () => {
    setProgress({ 1: cotreroCareersDone(), 2: bestDtSeasons(), 3: presidenteSeasons() });
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    save(campaign);
  }, [campaign]);

  useEffect(() => {
    const stage = STAGES.find((s) => s.id === campaign.stage);
    if (stage && progress[stage.id] >= stage.target) {
      setCampaign((c) => ({ ...c, stage: Math.min(c.stage + 1, 4) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  const allDone = campaign.stage > 3;

  return (
    <Layout>
      <h1 className="text-xl sm:text-2xl font-bold mb-1 flex items-center gap-2">
        <Sparkles size={22} className="text-accent" />
        Modo Vida FUT
      </h1>
      <p className="text-gray-400 text-sm mb-6">
        Una carrera larga en tres etapas: arrancás jugando como futbolista en Cotrero Especialista, después colgás los
        botines y dirigís 3 temporadas como DT, y terminás presidiendo el club otras 3 temporadas.
      </p>

      {allDone && (
        <Card className="mb-6 border-accent/40 bg-accent/5 text-center py-8">
          <Trophy size={32} className="mx-auto text-accent mb-3" />
          <p className="text-lg font-bold mb-1">¡Vida FUT completa!</p>
          <p className="text-sm text-gray-400">Jugador, DT y presidente — recorriste las tres etapas.</p>
        </Card>
      )}

      <div className="space-y-3">
        {STAGES.map((stage, i) => {
          const done = progress[stage.id] >= stage.target;
          const active = campaign.stage === stage.id;
          const locked = campaign.stage < stage.id;
          const pct = Math.min(100, Math.round((progress[stage.id] / stage.target) * 100));

          return (
            <Card key={stage.id} className={active ? "border-accent/40" : ""}>
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${
                    done
                      ? "bg-accent/20 text-accent"
                      : locked
                      ? "bg-white/5 text-gray-600"
                      : "bg-accent/10 text-accent border border-accent/30"
                  }`}
                >
                  {done ? <Check size={16} /> : locked ? <Lock size={14} /> : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{stage.title}</p>
                    {done && <Award size={14} className="text-accent shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 mb-2">{stage.goal}</p>

                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mb-1.5">
                    <div
                      className="h-full rounded-full transition-[width]"
                      style={{ width: `${pct}%`, background: done ? "rgb(var(--c-emerald))" : "#3b9dd6" }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">{stage.label(progress[stage.id] || 0)}</p>

                  {!locked && !done && (
                    stage.external ? (
                      <a
                        href={stage.to}
                        className="inline-block mt-3 text-xs font-medium px-3 py-1.5 rounded-card bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 transition-colors"
                      >
                        Ir a jugar
                      </a>
                    ) : (
                      <Link
                        to={stage.to}
                        className="inline-block mt-3 text-xs font-medium px-3 py-1.5 rounded-card bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 transition-colors"
                      >
                        Ir a jugar
                      </Link>
                    )
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <button
        onClick={refresh}
        className="mt-4 text-xs text-gray-500 hover:text-white transition-colors"
      >
        Actualizar progreso
      </button>
    </Layout>
  );
}
