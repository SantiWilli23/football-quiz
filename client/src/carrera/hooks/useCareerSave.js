// v2: el lineup titular pasó de ser una lista de ids a slots de formación
// ({ slot, playerId }) — una partida vieja con el formato anterior rompería
// el motor de partidos, así que se descarta en vez de intentar migrarla.
import { vfKey } from "../../utils/vidaFut.js";

const SAVE_VERSION = 2;
// Claves resueltas en cada uso: con ?vidafut=1 la Carrera DT guarda aparte
// (prefijo "vidafut_"), separada de las carreras que jugás suelto.
// `vf` permite forzar el modo (Vida FUT lee su progreso sin estar en ?vidafut=1).
let forcedVf = null;
const k = (key) => vfKey(key, forcedVf ?? undefined);
const LEGACY_KEY = () => k("futotal_career_save");
const SLOTS_KEY = () => k("futotal_career_slots");
const ACTIVE_KEY = () => k("futotal_career_active_slot");
const slotDataKey = (id) => k(`futotal_career_save_${id}`);
const LEGACIES_KEY = () => k("futotal_career_legacies");

// Ejecuta fn leyendo/escribiendo las partidas de Vida FUT (on=true) o las sueltas (on=false).
export function withCareerNamespace(on, fn) {
  const prev = forcedVf;
  forcedVf = on;
  try { return fn(); } finally { forcedVf = prev; }
}

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* almacenamiento lleno o no disponible: se ignora */
  }
}

function slotMetaFrom(id, state) {
  return {
    id,
    teamId: state.teamId,
    season: state.season,
    week: state.week,
    gameOver: !!state.gameOver,
    updatedAt: Date.now(),
  };
}

// Migra el save viejo de slot único (v1 de este sistema, sin index de slots)
// a un slot nuevo, así nadie pierde la carrera en curso con la actualización.
function migrateLegacyIfNeeded() {
  const slots = readJSON(SLOTS_KEY());
  if (slots) return slots;
  const legacy = readJSON(LEGACY_KEY());
  if (!legacy || legacy.version !== SAVE_VERSION) {
    writeJSON(SLOTS_KEY(), []);
    return [];
  }
  const id = `slot_${Date.now()}`;
  writeJSON(slotDataKey(id), legacy);
  writeJSON(ACTIVE_KEY(), id);
  const newSlots = [slotMetaFrom(id, legacy)];
  writeJSON(SLOTS_KEY(), newSlots);
  try { localStorage.removeItem(LEGACY_KEY()); } catch { /* noop */ }
  return newSlots;
}

export function listSaveSlots() {
  return migrateLegacyIfNeeded();
}

export function getActiveSlotId() {
  migrateLegacyIfNeeded();
  return readJSON(ACTIVE_KEY());
}

export function setActiveSlotId(id) {
  writeJSON(ACTIVE_KEY(), id);
}

// Carga la carrera activa (o una puntual si se pasa slotId).
export function loadCareer(slotId) {
  const id = slotId ?? getActiveSlotId();
  if (!id) return null;
  const data = readJSON(slotDataKey(id));
  if (!data || data.version !== SAVE_VERSION) return null;
  return data;
}

export function createSaveSlot(state) {
  const id = `slot_${Date.now()}`;
  const slots = migrateLegacyIfNeeded();
  writeJSON(slotDataKey(id), { ...state, version: SAVE_VERSION });
  writeJSON(SLOTS_KEY(), [...slots, slotMetaFrom(id, state)]);
  writeJSON(ACTIVE_KEY(), id);
  return id;
}

export function saveCareer(state, slotId) {
  const id = slotId ?? getActiveSlotId();
  if (!id) return;
  writeJSON(slotDataKey(id), { ...state, version: SAVE_VERSION });
  const slots = migrateLegacyIfNeeded();
  const idx = slots.findIndex((s) => s.id === id);
  const meta = slotMetaFrom(id, state);
  const nextSlots = idx === -1 ? [...slots, meta] : slots.map((s, i) => (i === idx ? meta : s));
  writeJSON(SLOTS_KEY(), nextSlots);
}

export function deleteSaveSlot(id) {
  try { localStorage.removeItem(slotDataKey(id)); } catch { /* noop */ }
  const slots = migrateLegacyIfNeeded().filter((s) => s.id !== id);
  writeJSON(SLOTS_KEY(), slots);
  if (getActiveSlotId() === id) writeJSON(ACTIVE_KEY(), null);
}

// "Salir" de la carrera activa sin borrarla — vuelve a la pantalla de slots.
export function clearCareer() {
  writeJSON(ACTIVE_KEY(), null);
}

// Fichas de legado de DTs retirados — se guardan acá porque retireCareer()
// borra el slot entero, así que si no se archiva antes el resumen se pierde
// para siempre y no habría nada que comparar en "legado cruzado".
export function listLegacies() {
  return readJSON(LEGACIES_KEY()) || [];
}

export function saveLegacy(legacy) {
  const legacies = listLegacies();
  writeJSON(LEGACIES_KEY(), [...legacies, { ...legacy, id: `legacy_${Date.now()}`, retiredAt: Date.now() }]);
}
