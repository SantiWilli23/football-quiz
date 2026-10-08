import { CalendarClock, CalendarCheck } from "lucide-react";
import Card from "./Card.jsx";

const fmt = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "long" });

// Aviso de la ventana de temporada que manda el servidor
// ({ label, open, phaseLabel, closes, next }).
export default function SeasonWindowNotice({ status }) {
  if (!status) return null;
  if (status.open) {
    return (
      <Card className="mb-4">
        <div className="flex items-start gap-3">
          <CalendarCheck size={18} className="text-emerald shrink-0 mt-0.5" />
          <p className="text-sm text-gray-300">
            Abierto: {status.label}, {status.phaseLabel}. Cierra el {fmt(status.closes)}.
          </p>
        </div>
      </Card>
    );
  }
  return (
    <Card className="mb-4">
      <div className="flex items-start gap-3">
        <CalendarClock size={18} className="text-amber shrink-0 mt-0.5" />
        <p className="text-sm text-gray-400">
          Cerrado por ahora. {status.label} abre solo en las vacaciones de verano: la próxima ventana abre el {fmt(status.next.date)}.
        </p>
      </div>
    </Card>
  );
}
