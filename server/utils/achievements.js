import { db } from "../db/client.js";

// Logros de Futotal 2.0. Los ganados se escriben en `user_achievements` en el momento en que
// pasan, y de ahí se leen. El catálogo anterior (17 logros, la mayoría de funciones que se
// retiran) se congela una vez por usuario como «legacy» para que nadie pierda lo ganado ni su marco.
export const CATALOG = [
  { id: "primer_partido", emoji: "⚽", title: "Primer partido", description: "Juega tu primer partido del día" },
  { id: "partido_perfecto", emoji: "💯", title: "Partido perfecto", description: "Acierta todas las preguntas de un partido del día" },
  { id: "en_llamas", emoji: "🔥", title: "En llamas", description: "Llega a 5 días seguidos de racha" },
  { id: "maratonista", emoji: "🏃", title: "Maratonista", description: "Llega a 15 días seguidos de racha" },
  { id: "imparable", emoji: "🚀", title: "Imparable", description: "Llega a 30 días seguidos de racha" },
  { id: "semana_completa", emoji: "📆", title: "Semana completa", description: "Consigue la carta del día los 7 días de una semana" },
  { id: "coleccionista", emoji: "🃏", title: "Coleccionista", description: "Reúne 50 cartas distintas" },
  { id: "plantilla_armada", emoji: "🧩", title: "Plantilla armada", description: "Completa un desafío de plantilla" },
  { id: "copa_ganada", emoji: "🏆", title: "Campeón de copa", description: "Gana la copa semanal de tu club" },
  { id: "podio_mes", emoji: "🥉", title: "Podio del mes", description: "Termina entre los 3 primeros del club en un mes" },
  { id: "campeon_mes", emoji: "🥇", title: "Campeón del mes", description: "Termina primero en tu club en un mes" },
  { id: "cazafantasmas", emoji: "👻", title: "Cazafantasmas", description: "Gánale 5 veces al fantasma de tu rival" },
  { id: "cara_a_cara", emoji: "🤝", title: "Cara a cara", description: "Gana duelos contra 5 rivales distintos" },
  { id: "adivino_clasico", emoji: "🔮", title: "Adivino del clásico", description: "Acierta 8 o más en «Adivina la alineación»" },
  { id: "pronosticador", emoji: "📣", title: "Pronosticador", description: "Acierta 3 pronósticos de partidos temáticos" },
  { id: "hincha_fiel", emoji: "🎽", title: "Hincha fiel", description: "Juega 5 partidos temáticos" },
  { id: "amistoso_ganado", emoji: "🏳️", title: "Amistoso ganado", description: "Tu club gana un amistoso contra otro club" },
  { id: "leyenda_cotrero", emoji: "👑", title: "Leyenda", description: "Termina una carrera de Cotrero como Leyenda" },
  { id: "adn_completo", emoji: "🧬", title: "ADN completo", description: "Ten datos en las 6 áreas de tu ADN" },
  { id: "duelista", emoji: "🗡️", title: "Duelista", description: "Gana 5 duelos" },
  { id: "cazademonios", emoji: "😈", title: "Cazademonios", description: "Gana un duelo en nivel demonio" },
  { id: "invicto", emoji: "🛡️", title: "Invicto", description: "Gana 3 duelos seguidos sin perder" },
];
const IDS = new Set(CATALOG.map((a) => a.id));

// Los 17 logros del catálogo anterior. Los que siguen vivos se mapean a su clave nueva.
const LEGACY = {
  francotirador: ["🎯", "Francotirador", "Acertó 10 preguntas de trivia"],
  "dia-perfecto": ["💯", "Día perfecto", "Acertó las 3 preguntas de trivia en un día"],
  "en-llamas": ["🔥", "En llamas", "Llegó a 5 días de racha"],
  votante: ["🗳️", "Votante", "Respondió 20 preguntas del modo especial"],
  adivino: ["🔮", "Adivino", "Acertó 5 predicciones del grupo"],
  constante: ["📅", "Constante", "Respondió especiales en 7 días distintos"],
  pregunton: ["✍️", "Preguntón", "Escribió 5 preguntas del día del grupo"],
  "mas-votado": ["🏆", "El más votado", "Recibió 10 votos en «¿Quién es más?»"],
  protagonista: ["🌟", "Protagonista", "Fue 3 veces protagonista"],
  erudito: ["🧠", "Erudito", "Acertó 50 preguntas de trivia"],
  maratonista: ["🏃", "Maratonista", "Llegó a 15 días de racha"],
  coleccionista: ["🃏", "Coleccionista", "Respondió 100 preguntas del modo especial"],
  pleno: ["🎰", "Pleno", "Acertó todas sus predicciones en un día"],
  duelista: ["🗡️", "Duelista", "Ganó 5 duelos"],
  cazademonios: ["😈", "Cazademonios", "Ganó un duelo en nivel demonio"],
  invicto: ["🛡️", "Invicto", "Ganó 3 duelos seguidos"],
  bibliotecario: ["📚", "Bibliotecario", "Le salieron 10 preguntas del banco del grupo"],
};
// Claves nuevas que equivalen a un logro anterior (no se cuentan dos veces).
const LEGACY_TO_NEW = { "en-llamas": "en_llamas", maratonista: "maratonista", duelista: "duelista", cazademonios: "cazademonios", invicto: "invicto" };
const legacyKey = (id) => LEGACY_TO_NEW[id] || `legacy:${id}`;

// Da un logro. Devuelve true solo la primera vez.
export async function grant(userId, key, { legacy = 0 } = {}) {
  if (!userId || !(IDS.has(key) || key.startsWith("legacy:"))) return false;
  const res = await db.execute({ sql: "INSERT OR IGNORE INTO user_achievements (user_id, key, legacy) VALUES (?, ?, ?)", args: [userId, key, legacy] });
  return res.rowsAffected > 0;
}

export async function has(userId, key) {
  return !!(await db.execute({ sql: "SELECT 1 FROM user_achievements WHERE user_id = ? AND key = ?", args: [userId, key] })).rows[0];
}

export async function grantAll(userId, keys) {
  const out = [];
  for (const k of keys) if (await grant(userId, k)) out.push(k);
  return out;
}

// Congela, una sola vez por usuario, los logros del catálogo anterior que ya tiene. Lo recibe
// `compute` (computeAchievements de routes/stats.js) para no crear una dependencia circular.
export async function ensureFrozen(userId, compute) {
  if ((await db.execute({ sql: "SELECT 1 FROM achievement_freeze WHERE user_id = ?", args: [userId] })).rows[0]) return 0;
  const groups = (await db.execute({ sql: "SELECT group_id FROM group_members WHERE user_id = ?", args: [userId] })).rows.map((r) => r.group_id);
  const unlocked = new Set();
  for (const gid of [null, ...groups]) {
    try {
      for (const a of (await compute(userId, gid)).achievements) if (a.unlocked) unlocked.add(a.id);
    } catch (e) { console.error("congelar logros", e); return 0; } // si falla, no se marca: se reintenta
  }
  let n = 0;
  for (const id of unlocked) if (await grant(userId, legacyKey(id), { legacy: 1 })) n += 1;
  await db.execute({ sql: "INSERT OR IGNORE INTO achievement_freeze (user_id) VALUES (?)", args: [userId] });
  return n;
}

export async function unlockedCount(userId) {
  return Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM user_achievements WHERE user_id = ?", args: [userId] })).rows[0].n);
}

// Lo que ve la Vitrina: el catálogo nuevo (con el estado de cada uno) y, aparte, los «clásicos»
// ganados en el catálogo anterior, que ya no se pueden ganar de nuevo.
export async function achievementsOf(userId) {
  const rows = (await db.execute({ sql: "SELECT key, earned_at, legacy FROM user_achievements WHERE user_id = ?", args: [userId] })).rows;
  const got = new Map(rows.map((r) => [r.key, r]));
  const fresh = CATALOG.map((a) => ({ ...a, unlocked: got.has(a.id), progress: got.has(a.id) ? 100 : 0, earned_at: got.get(a.id)?.earned_at || null, legacy: false }));
  const classics = Object.entries(LEGACY)
    .filter(([id]) => !LEGACY_TO_NEW[id] && got.has(legacyKey(id)))
    .map(([id, [emoji, title, description]]) => ({ id: legacyKey(id), emoji, title, description, unlocked: true, progress: 100, earned_at: got.get(legacyKey(id)).earned_at, legacy: true }));
  const all = [...fresh, ...classics];
  return { achievements: all, unlocked_count: rows.length, total: CATALOG.length };
}

// Logros que salen de los duelos ganados (servidor decide el ganador).
export async function afterDuel(userId) {
  const rows = (await db.execute({
    sql: `SELECT challenger_id, opponent_id, winner_id, difficulty FROM duels
          WHERE status = 'terminado' AND (challenger_id = ? OR opponent_id = ?) ORDER BY resolved_at, id`,
    args: [userId, userId],
  })).rows;
  const wins = rows.filter((d) => d.winner_id === userId);
  const out = [];
  if (wins.length >= 5 && await grant(userId, "duelista")) out.push("duelista");
  if (wins.some((d) => d.difficulty === "demonio") && await grant(userId, "cazademonios")) out.push("cazademonios");
  const rivals = new Set(wins.map((d) => (d.challenger_id === userId ? d.opponent_id : d.challenger_id)));
  if (rivals.size >= 5 && await grant(userId, "cara_a_cara")) out.push("cara_a_cara");
  let run = 0;
  let best = 0;
  for (const d of rows) { run = d.winner_id === userId ? run + 1 : 0; best = Math.max(best, run); }
  if (best >= 3 && await grant(userId, "invicto")) out.push("invicto");
  return out;
}

// Logros que salen de cerrar el partido del día.
export async function afterDailyMatch({ userId, date, answered, streak, weekStart, weekEnd, beatGhost }) {
  const out = [];
  const g = async (k) => { if (await grant(userId, k)) out.push(k); };
  await g("primer_partido");
  if (answered.length && answered.every((a) => a.ok)) await g("partido_perfecto");
  if (streak >= 5) await g("en_llamas");
  if (streak >= 15) await g("maratonista");
  if (streak >= 30) await g("imparable");
  const week = Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM daily_cards WHERE user_id = ? AND date >= ? AND date <= ?", args: [userId, weekStart, weekEnd] })).rows[0].n);
  if (week >= 7) await g("semana_completa");
  const fans = Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM event_badges WHERE user_id = ? AND kind = 'partido'", args: [userId] })).rows[0].n);
  if (fans >= 5) await g("hincha_fiel");
  if (beatGhost) {
    await db.execute({ sql: "INSERT OR IGNORE INTO ghost_wins (user_id, date) VALUES (?, ?)", args: [userId, date] });
    const n = Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM ghost_wins WHERE user_id = ?", args: [userId] })).rows[0].n);
    if (n >= 5) await g("cazafantasmas");
  }
  return out;
}

// Un hook nunca puede romper el juego: si falla, se registra y se sigue.
export const safely = (promise) => Promise.resolve(promise).catch((e) => { console.error("logro", e); return []; });
