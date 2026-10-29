import { useCallback, useEffect, useState } from "react";
import api from "../api.js";

// Nivel, título y celebración elegida del usuario (GET /me/progreso). Se guarda en memoria para no
// pedirlo en cada penal.
let cache = null;
const subs = new Set();
const emit = () => subs.forEach((f) => f(cache));

export async function loadProgreso(force = false) {
  let token = null;
  try { token = localStorage.getItem("fq_token"); } catch { /* sin storage */ }
  if (!token) return null;
  if (cache && !force) return cache;
  try { cache = (await api.get("/me/progreso")).data; } catch { cache = cache || null; }
  emit();
  return cache;
}

export default function useProgreso() {
  const [p, setP] = useState(cache);
  useEffect(() => { subs.add(setP); loadProgreso(); return () => { subs.delete(setP); }; }, []);
  const choose = useCallback(async (id) => {
    await api.put("/me/celebracion", { id });
    await loadProgreso(true);
  }, []);
  return { progreso: p, choose };
}
