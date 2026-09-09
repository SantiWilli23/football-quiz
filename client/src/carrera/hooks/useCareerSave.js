// v2: el lineup titular pasó de ser una lista de ids a slots de formación
// ({ slot, playerId }) — una partida vieja con el formato anterior rompería
// el motor de partidos, así que se descarta en vez de intentar migrarla.
const SAVE_VERSION = 2;
const LEGACY_KEY = "futotal_career_save";
const SLOTS_KEY = "futotal_career_slots";
const ACTIVE_KEY = "futotal_career_active_slot";
const slotDataKey = (id) => `futotal_career_save_${id}`;

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
  const slots = readJSON(SLOTS_KEY);
  if (slots) return slots;
  const legacy = readJSON(LEGACY_KEY);
  if (!legacy || legacy.version !== SAVE_VERSION) {
    writeJSON(SLOTS_KEY, []);
    return [];
  }
  const id = `slot_${Date.now()}`;
  writeJSON(slotDataKey(id), legacy);
  writeJSON(ACTIVE_KEY, id);
  const newSlots = [slotMetaFrom(id, legacy)];
  writeJSON(SLOTS_KEY, newSlots);
  try { localStorage.removeItem(LEGACY_KEY); } catch { /* noop */ }
  return newSlots;
}

export function listSaveSlots() {
  return migrateLegacyIfNeeded();
}

export function getActiveSlotId() {
  migrateLegacyIfNeeded();
  return readJSON(ACTIVE_KEY);
}

export function setActiveSlotId(id) {
  writeJSON(ACTIVE_KEY, id);
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
  writeJSON(SLOTS_KEY, [...slots, slotMetaFrom(id, state)]);
  writeJSON(ACTIVE_KEY, id);
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
  writeJSON(SLOTS_KEY, nextSlots);
}

export function deleteSaveSlot(id) {
  try { localStorage.removeItem(slotDataKey(id)); } catch { /* noop */ }
  const slots = migrateLegacyIfNeeded().filter((s) => s.id !== id);
  writeJSON(SLOTS_KEY, slots);
  if (getActiveSlotId() === id) writeJSON(ACTIVE_KEY, null);
}

// "Salir" de la carrera activa sin borrarla — vuelve a la pantalla de slots.
export function clearCareer() {
  writeJSON(ACTIVE_KEY, null);
}
