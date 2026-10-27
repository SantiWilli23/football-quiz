import { useCallback, useEffect, useState } from "react";
import api from "../api.js";

// Los clubes del usuario y cuál es el principal (o, si no marcó uno, el primero con
// la temporada iniciada, o el primero a secas).
export function useClubs() {
  const [clubs, setClubs] = useState(null);
  const reload = useCallback(() => api.get("/clubs").then((r) => setClubs(r.data.clubs)).catch(() => setClubs([])), []);
  useEffect(() => { reload(); }, [reload]);
  const list = clubs || [];
  const main = list.find((c) => c.main) || list.find((c) => c.started) || list[0] || null;
  return { clubs: list, loaded: clubs !== null, main, reload };
}
