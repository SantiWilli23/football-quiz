import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Award, Check, Lock, Sparkles, Trophy } from "lucide-react";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import { listSaveSlots, loadCareer, withCareerNamespace } from "../carrera/hooks/useCareerSave.js";
import { VIDAFUT_PREFIX } from "../utils/vidaFut.js";
import api from "../api.js";
import { useToast } from "../context/ToastContext.jsx";

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

// Vida FUT tiene sus PROPIAS partidas: cada juego abierto desde acá lleva
// ?vidafut=1 y guarda con el prefijo "vidafut_" (ver utils/vidaFut.js). Así un
// Cotrero, una Carrera DT o un Presidente que jugás suelto no cuentan para la
// campaña, y lo que jugás en la campaña no aparece en tus partidas sueltas.
function cotreroCareersDone() {
  try {
    const raw = localStorage.getItem(`${VIDAFUT_PREFIX}cotrero_hof`);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.length : 0;
  } catch {
    return 0;
  }
}

function bestDtSeasons() {
  try {
    return withCareerNamespace(true, () => {
      let best = 0;
      for (const slot of listSaveSlots()) {
        const data = loadCareer(slot.id);
        const seasons = (data?.history || []).filter((h) => !h.note).length;
        if (seasons > best) best = seasons;
      }
      return best;
    });
  } catch {
    return 0;
  }
}

function presidenteSeasons() {
  try {
    const raw = localStorage.getItem(`${VIDAFUT_PREFIX}presidente_v1`);
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
    to: "/cotrero/?vidafut=1",
    external: true,
    target: 1,
    progress: cotreroCareersDone,
    label: (p) => `${p} de 1 carrera retirada`,
  },
  {
    id: 2,
    title: "Carrera DT",
    goal: "Dirigí 3 temporadas completas",
    to: "/carrera-dt?vidafut=1",
    target: 3,
    progress: bestDtSeasons,
    label: (p) => `${Math.min(p, 3)} de 3 temporadas`,
  },
  {
    id: 3,
    title: "Modo Presidente",
    goal: "Presidí el club 3 temporadas completas",
    to: "/presidente?vidafut=1",
    target: 3,
    progress: presidenteSeasons,
    label: (p) => `${Math.min(p, 3)} de 3 temporadas`,
  },
];

export default function VidaFut() {
  const [campaign, setCampaign] = useState(load);
  const [progress, setProgress] = useState({ 1: 0, 2: 0, 3: 0 });
  const { toast } = useToast();

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

  // Cada etapa completada regala un sobre de cartas (una sola vez; el servidor lo evita repetir).
  useEffect(() => {
    STAGES.forEach((s) => {
      if (progress[s.id] >= s.target) {
        api.post("/cards/grant-stage", { stage: s.id })
          .then(({ data }) => { if (data.newly) toast(`Etapa «${s.title}» completa · +1 sobre de cartas`); })
          .catch(() => {});
      }
    });
  }, [progress, toast]);

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
      <p className="text-xs text-gray-500 -mt-4 mb-6">
        Las partidas de Vida FUT son aparte: lo que jugás suelto en Cotrero, Carrera DT o Presidente no cuenta acá, y
        la campaña no toca tus partidas sueltas.
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
