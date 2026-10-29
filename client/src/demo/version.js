import { useEffect, useSyncExternalStore } from "react";
import api from "../api.js";

// Versiones de la app que solo ve el dueño: «f1» es Futotal 1 (la anterior, sin el rediseño),
// «actual» es lo que ve todo el mundo y «demo» es la beta donde se prueban los cambios antes de
// pasarlos. Se desbloquea con un código en Perfil › Ajustes (o siendo OWNER_USERNAME). La elección
// vive en este navegador; los demás usuarios siempre ven «actual».
const KEY = "fq_version";
const UNLOCK = "fq_codigo";
const CODIGO = "23";
const VERSIONS = ["f1", "actual", "demo"];
const subs = new Set();
let ownerServer = false;
let loaded = false;

const stored = () => { try { const v = localStorage.getItem(KEY); return VERSIONS.includes(v) ? v : "actual"; } catch { return "actual"; } };
const codeOk = () => { try { return localStorage.getItem(UNLOCK) === "1"; } catch { return false; } };
const emit = () => subs.forEach((f) => f());
const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
export const isOwnerNow = () => ownerServer || codeOk();

// Tema de la beta (los dos rediseños grandes): «base» es la paleta ampliada, «a» Noche de estadio y «b» Álbum de figuritas.
const TEMAS = ["base", "a", "b"];
export const currentTema = () => { try { const v = localStorage.getItem("fq_tema"); return TEMAS.includes(v) ? v : "base"; } catch { return "base"; } };
export function setTema(t) {
  if (!isOwnerNow() || !TEMAS.includes(t)) return;
  try { localStorage.setItem("fq_tema", t); } catch { /* sin storage */ }
  emit();
}

export const currentVersion = () => (isOwnerNow() ? stored() : "actual");
export const isDemoNow = () => currentVersion() === "demo";

export function setVersion(v) {
  if (!isOwnerNow() || !VERSIONS.includes(v)) return;
  try { localStorage.setItem(KEY, v); } catch { /* sin storage */ }
  emit();
}

// Escribe el código en Ajustes: con el correcto se desbloquean las versiones. Devuelve si sirvió.
export function unlockWithCode(code) {
  if (String(code).trim() !== CODIGO) return false;
  try { localStorage.setItem(UNLOCK, "1"); } catch { return false; }
  emit();
  return true;
}
export function lockAgain() {
  try { localStorage.removeItem(UNLOCK); localStorage.removeItem(KEY); } catch { /* sin storage */ }
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
    ownerServer = !!data.owner;
  } catch { ownerServer = false; }
  emit();
}

export function useVersion() {
  useEffect(() => { loadOwner(); }, []);
  const version = useSyncExternalStore(subscribe, currentVersion, () => "actual");
  const isOwner = useSyncExternalStore(subscribe, isOwnerNow, () => false);
  const tema = useSyncExternalStore(subscribe, currentTema, () => "base");
  return { owner: isOwner, version, setVersion, tema, setTema };
}

export const useDemo = () => useVersion().version === "demo";
