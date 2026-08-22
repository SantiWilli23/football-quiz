import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import api from "../api.js";
import Card from "./Card.jsx";

// La racha del grupo sólo avanza los días que juegan todos. Se muestra quién
// falta hoy, que es lo que hace que se apuren entre ellos.
export default function GroupStreakCard({ groupId }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!groupId) {
      setData(null);
      return;
    }
    api
      .get("/stats/group-streak", { params: { groupId } })
      .then(({ data }) => setData(data))
      .catch(() => setData(null));
  }, [groupId]);

  if (!data) return null;

  const missing = data.missing_today ?? [];

  return (
    <Card>
      <div className="flex items-center gap-2 text-gray-300 mb-1">
        <Users size={18} />
        <span className="text-sm font-medium">Racha del grupo</span>
      </div>
      <p className="text-3xl font-bold">
        {data.streak} <span className="text-lg font-medium text-gray-400">días</span>
      </p>
      <p className="text-xs text-gray-500 mt-1">
        {data.today_complete
          ? "Hoy jugaron todos."
          : missing.length === 0
            ? "Todavía no arrancó nadie hoy."
            : missing.length === 1
              ? `Falta ${missing[0]}.`
              : `Faltan ${missing.slice(0, 2).join(", ")}${missing.length > 2 ? ` y ${missing.length - 2} más` : ""}.`}
      </p>
    </Card>
  );
}
