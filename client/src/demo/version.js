import { useEffect, useSyncExternalStore } from "react";
import api from "../api.js";

// Versiones de la app que solo ve el dueño (OWNER_USERNAME): «f1» es Futotal 1 (sin el rediseño),
// «actual» es lo que ve todo el mundo y «demo» es donde se prueban los cambios antes de pasarlos.
// La elección vive en este navegador; los demás usuarios siempre ven «actual».
const KEY = "fq_version";
const VERSIONS = ["f1", "actual", "demo"];
const subs = new Set();
let owner = false;
let loaded = false;

const stored = () => { try { const v = localStorage.getItem(KEY); return VERSIONS.includes(v) ? v : "actual"; } catch { return "actual"; } };
const emit = () => subs.forEach((f) => f());
const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };

// Tema de la Demo (los dos rediseños grandes): «base» es la paleta ampliada, «a» Noche de estadio y «b» Álbum de figuritas.
const TEMAS = ["base", "a", "b"];
export const currentTema = () => { try { const v = localStorage.getItem("fq_tema"); return TEMAS.includes(v) ? v : "base"; } catch { return "base"; } };
export function setTema(t) {
  if (!owner || !TEMAS.includes(t)) return;
  try { localStorage.setItem("fq_tema", t); } catch { /* sin storage */ }
  emit();
}

export const currentVersion = () => (owner ? stored() : "actual");
export const isDemoNow = () => currentVersion() === "demo";

export function setVersion(v) {
  if (!owner || !VERSIONS.includes(v)) return;
  try { localStorage.setItem(KEY, v); } catch { /* sin storage */ }
  emit();
}

// Se pregunta una sola vez por sesión, y solo si hay sesión iniciada.
export async function loadOwner() {
  let token = null;
  try { token = localStorage.getItem("fq_token"); } catch { /* sin storage */ }
  if (loaded || !token) return;
  loaded = true;
  try {
    const { data } = await api.get("/me/owner");
    owner = !!data.owner;
  } catch { owner = false; }
  emit();
}

export function useVersion() {
  useEffect(() => { loadOwner(); }, []);
  const version = useSyncExternalStore(subscribe, currentVersion, () => "actual");
  const isOwner = useSyncExternalStore(subscribe, () => owner, () => false);
  const tema = useSyncExternalStore(subscribe, currentTema, () => "base");
  return { owner: isOwner, version, setVersion, tema, setTema };
}

export const useDemo = () => useVersion().version === "demo";
