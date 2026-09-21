import { useEffect, useState } from "react";
import { HelpCircle, Swords, Target, Timer, ShieldCheck } from "lucide-react";
import api from "../api.js";
import { useGroups } from "../context/GroupContext.jsx";
import { daysSince, readVisits } from "../utils/visits.js";

// Los retos semanales que se ganan entrando: si hace una semana o más que no
// jugás uno, aparece en los avisos.
const WEEKLY = [
  { route: "/fulbodle", label: "Reto semanal de Fichado sin jugar", icon: Target },
  { route: "/escudos", label: "Reto semanal de Escudos a ciegas sin jugar", icon: ShieldCheck },
  { route: "/un-minuto", label: "Reto semanal de Un Minuto sin jugar", icon: Timer },
];

// Una sola fuente para «qué me falta hoy»: la usan la franja del Inicio y la
// campana de avisos del menú.
export default function useAlerts() {
  const { activeGroupId: groupId } = useGroups();
  const [trivia, setTrivia] = useState(0);
  const [duels, setDuels] = useState(0);

  useEffect(() => {
    api.get("/questions/today")
      .then(({ data }) => setTrivia((data.questions || []).filter((q) => !q.answered).length))
      .catch(() => setTrivia(0));
  }, []);

  useEffect(() => {
    if (!groupId) { setDuels(0); return; }
    api.get("/duels", { params: { groupId } })
      .then(({ data }) => setDuels((data.duels || []).filter((d) => d.status === "esperando" && d.my_turn).length))
      .catch(() => setDuels(0));
  }, [groupId]);

  const visits = readVisits();
  const items = [];
  if (trivia > 0) items.push({ key: "trivia", to: "/trivia", short: "Trivia", label: `Trivia del día: ${trivia} pregunta${trivia === 1 ? "" : "s"} sin responder`, icon: HelpCircle });
  if (duels > 0) items.push({ key: "duelos", to: "/duelos", short: `Duelo${duels === 1 ? "" : "s"} (${duels})`, label: `${duels} duelo${duels === 1 ? "" : "s"} esperando tu turno`, icon: Swords });
  if (groupId) {
    for (const w of WEEKLY) {
      if (daysSince(w.route, visits) >= 7) items.push({ key: w.route, to: w.route, short: w.label.replace("Reto semanal de ", "").replace(" sin jugar", ""), label: w.label, icon: w.icon });
    }
  }
  return items;
}
