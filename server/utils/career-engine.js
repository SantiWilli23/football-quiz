// Motor de carrera de Cotrero (simple y medio). Corre en el servidor: el teléfono solo muestra el
// estado y manda la elección; el azar sale de una semilla (misma carrera + mismas elecciones =
// mismo resultado) y el puntaje lo calcula el servidor. Funciones puras: no tocan la base.
//
// Unidad de tiempo: la «media temporada». Cada paso simula 1 (Intensa), 2 (Normal) o 6 (Exprés)
// medias temporadas; en Cotrero medio un paso es una temporada completa (2).

export const MODES = {
  intensa: { label: "Intensa", step: 1, text: "Dos decisiones por temporada" },
  normal: { label: "Normal", step: 2, text: "Una decisión por temporada" },
  expres: { label: "Exprés", step: 6, text: "Una decisión cada 3 temporadas" },
};
export const NATIONS = ["Chile", "Argentina", "Uruguay", "Perú", "Colombia", "Brasil", "Paraguay", "Ecuador", "Venezuela", "Bolivia", "España", "Italia"];
export const POSITIONS = { simple: ["GK", "DEF", "MID", "FWD"], medio: ["FWD", "MID"] };
export const POS_LABEL = { GK: "Arquero", DEF: "Defensa", MID: "Medio", FWD: "Delantero" };
export const PROFILES = ["velocidad", "tecnica", "fisico"];
export const FEET = ["diestro", "zurdo", "ambidiestro"];
export const ATTRS = { def: "Definición", pas: "Pase", reg: "Regate", fis: "Físico", men: "Mentalidad" };
const WEIGHTS = { FWD: { def: 0.4, reg: 0.2, fis: 0.2, pas: 0.1, men: 0.1 }, MID: { pas: 0.4, reg: 0.25, def: 0.15, men: 0.1, fis: 0.1 } };

const LEVEL_MIN = [0, 0, 64, 72, 80, 86]; // valoración mínima para que te ofrezcan un club de cada nivel
const P_LEAGUE = [0, 0.05, 0.12, 0.2, 0.3, 0.4];
const P_CUP = [0, 0, 0, 0.06, 0.12, 0.2];
const ROLE_FACTOR = { titular: 1, rotacion: 0.8, suplente: 0.5 };
const MINUTES = { titular: 1, rotacion: 0.7, suplente: 0.4 };
const MATCHES = { titular: [30, 38], rotacion: [18, 28], suplente: [5, 14] };

const HOME = {
  Chile: ["Universidad de Chile", "Colo-Colo", "Unión Española", "Huachipato", "Palestino", "Everton"],
  Argentina: ["Rosario Central", "Talleres", "Lanús", "Argentinos Juniors", "Vélez", "Estudiantes"],
  Uruguay: ["Peñarol", "Nacional", "Danubio", "Liverpool FC", "Wanderers"],
  Perú: ["Alianza Lima", "Universitario", "Sporting Cristal", "Melgar"],
  Colombia: ["Atlético Nacional", "Millonarios", "América de Cali", "Junior"],
  Brasil: ["Grêmio", "Fluminense", "Botafogo", "Vasco da Gama"],
  Paraguay: ["Olimpia", "Cerro Porteño", "Libertad"],
  Ecuador: ["Liga de Quito", "Barcelona SC", "Independiente del Valle"],
  Venezuela: ["Caracas FC", "Deportivo Táchira", "Zamora"],
  Bolivia: ["Bolívar", "The Strongest", "Always Ready"],
  España: ["Getafe", "Osasuna", "Celta de Vigo", "Mallorca"],
  Italia: ["Torino", "Udinese", "Bologna", "Genoa"],
};
const POOL = {
  2: ["Boca Juniors", "River Plate", "Flamengo", "Palmeiras", "São Paulo", "Atlético Mineiro", "Independiente", "Racing Club", "Santos", "Monterrey", "LA Galaxy", "Inter Miami"],
  3: ["Benfica", "Porto", "Ajax", "Sevilla", "Atalanta", "Lyon", "Bayer Leverkusen", "Villarreal", "Real Sociedad", "Lazio"],
  4: ["Atlético de Madrid", "Juventus", "Inter", "AC Milan", "Borussia Dortmund", "Napoli", "Tottenham", "Arsenal", "Roma"],
  5: ["Real Madrid", "FC Barcelona", "Manchester City", "Bayern München", "Liverpool", "Paris Saint-Germain"],
};
const ARAB = ["Al-Hilal", "Al-Nassr", "Al-Ittihad"];

// ---------- azar con semilla ----------
function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// Cada tirada depende de la semilla y de cuántas se hicieron: reanudar una carrera da lo mismo.
function rng(state) { state.n += 1; return mulberry((state.seed * 2654435761 + state.n * 40503) >>> 0)(); }
const int = (state, a, b) => a + Math.floor(rng(state) * (b - a + 1));
const pick = (state, list) => list[Math.floor(rng(state) * list.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const chance = (state, p) => rng(state) < p;

// ---------- estado inicial ----------
export function validatePlayer(game, input = {}) {
  const surname = String(input.surname || "").replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]/g, "").trim().slice(0, 14);
  if (surname.length < 2) return { error: "El apellido necesita entre 2 y 14 letras" };
  const number = Math.round(Number(input.number));
  if (!(number >= 1 && number <= 99)) return { error: "El número va de 1 a 99" };
  const foot = FEET.includes(input.foot) ? input.foot : null;
  const nation = NATIONS.includes(input.nation) ? input.nation : null;
  const pos = POSITIONS[game === "cotrero_medio" ? "medio" : "simple"].includes(input.pos) ? input.pos : null;
  if (!foot || !nation || !pos) return { error: "Faltan datos del jugador" };
  const profile = game === "cotrero" ? (PROFILES.includes(input.profile) ? input.profile : null) : null;
  if (game === "cotrero" && !profile) return { error: "Elige un perfil" };
  return { player: { surname, number, foot, nation, pos, profile } };
}

export function newCareer(game, mode, player, seed) {
  const medio = game === "cotrero_medio";
  const state = {
    game, mode: medio ? "normal" : mode, seed: seed >>> 0, n: 0, v: 1,
    player, age: 17, half: 0, // medias temporadas jugadas
    ovr: 0, potential: 0, attrs: null, rep: 0, caps: 0,
    club: null, role: "titular", level: 1,
    mods: {}, used: {}, history: [], clubs: [],
    totals: { titles: 0, awards: 0, goals: 0, assists: 0, matches: 0, cleanSheets: 0, peak: 0, seasons: 0 },
    acc: { matches: 0, goals: 0, assists: 0, cleanSheets: 0 }, // acumulado de la temporada en curso
    summary: null, pending: null, phase: "decision", retired: false, final: null,
    decisionsLeft: 0, eventsThisSeason: 0, calledUp: false, keyMatches: 0,
  };
  // Talento oculto: unos pocos llegan a estrella, la mayoría queda en el medio y algunos se estancan.
  const draw = rng(state);
  state.potential = draw < 0.3 ? 60 + int(state, 0, 12) : draw < 0.8 ? 72 + int(state, 0, 12) : 84 + int(state, 0, 15);
  state.retireAge = 33 + int(state, 0, 5);
  if (medio) {
    state.attrs = Object.fromEntries(Object.keys(ATTRS).map((k) => [k, 50 + int(state, 0, 8)]));
    state.ovr = ovrFromAttrs(state);
  } else {
    state.ovr = 55 + int(state, 0, 5) - (player.foot === "ambidiestro" ? 2 : 0);
  }
  state.totals.peak = state.ovr;
  state.club = { name: pick(state, HOME[player.nation] || HOME.Chile), level: 1 };
  state.clubs.push({ name: state.club.name, level: 1, from: state.age });
  state.pending = medio ? pretemporada() : nextDecision(state);
  state.phase = medio ? "pretemporada" : "decision";
  return state;
}

function ovrFromAttrs(state) {
  const w = WEIGHTS[state.player.pos] || WEIGHTS.FWD;
  return Math.round(Object.entries(w).reduce((s, [k, wt]) => s + state.attrs[k] * wt, 0));
}
const roleOf = (state) => {
  const level = state.mods.level ?? state.club.level;
  const min = LEVEL_MIN[level];
  return state.mods.role || (state.ovr >= min + 4 ? "titular" : state.ovr >= min - 4 ? "rotacion" : "suplente");
};

// ---------- decisiones ----------
// Cada opción trae `icons` (efectos sin números para la pantalla) y `apply(state)` con lo que hace.
const O = (key, label, icons, apply) => ({ key, label, icons, apply });
const mod = (patch) => (s) => { for (const [k, v] of Object.entries(patch)) s.mods[k] = typeof v === "function" ? v(s.mods[k]) : v; };
const mult = (f) => (cur = 1) => cur * f;
const add = (n) => (cur = 0) => cur + n;
const gainOvr = (s, n) => { if (s.attrs) { for (const k of Object.keys(s.attrs)) s.attrs[k] = clamp(s.attrs[k] + n, 30, 99); s.ovr = ovrFromAttrs(s); } else s.ovr = clamp(s.ovr + n, 30, 99); s.totals.peak = Math.max(s.totals.peak, s.ovr); };
const seasonNo = (s) => Math.floor(s.half / 2);

const DECISIONS = [
  { id: "pretemporada", text: "Llega la pretemporada. ¿Cómo la encaras?", when: () => true, options: [
    O("fuerte", "Entrenar fuerte", ["↑ valoración", "↑ lesión"], (s) => { gainOvr(s, 1); mod({ injury: add(0.05) })(s); }),
    O("normal", "Ritmo normal", [], () => {}),
    O("descanso", "Descansar más", ["↓ lesión"], mod({ injury: add(-0.05) })) ] },
  { id: "prestamo", text: "Juegas poco. Te ofrecen un préstamo en un club más chico.", when: (s) => roleOf(s) === "suplente" && s.age <= 22 && s.club.level > 1, options: [
    O("ir", "Ir a préstamo", ["↑ minutos", "↑ crecimiento"], (s) => { s.mods.role = "titular"; s.mods.level = Math.max(1, s.club.level - 1); s.mods.growth = 1.2; }),
    O("quedar", "Quedarme", [], () => {}) ] },
  { id: "puesto", text: "El DT te pide jugar un poco fuera de tu puesto.", when: (s) => ["MID", "FWD"].includes(s.player.pos), options: [
    O("aceptar", "Aceptar", ["↑ minutos", "↓ goles"], mod({ role: "titular", goal: mult(0.9) })),
    O("negar", "Negarme", ["↓ minutos"], mod({ role: "rotacion" })) ] },
  { id: "oferta_grande", text: "Un club más grande va por ti.", when: (s) => s.ovr >= LEVEL_MIN[Math.min(5, s.club.level + 1)] && s.club.level < 5 && s.half > 4, options: [
    O("ir", "Irme", ["↑ nivel", "↓ minutos"], (s) => { s.pendingMove = Math.min(5, s.club.level + 1); mod({ role: "rotacion" })(s); }),
    O("quedar", "Quedarme", ["↑ títulos"], mod({ league: mult(1.1) })) ] },
  { id: "renovacion", text: "Se vence tu contrato. Te ofrecen renovar.", when: (s) => s.half > 0 && seasonNo(s) % 3 === 0, options: [
    O("renovar", "Renovar", ["↓ ofertas"], mod({ noOffers: true })),
    O("probar", "Probar suerte", ["↑ ofertas"], mod({ forceOffer: true })) ] },
  { id: "lesion_leve", text: "Una molestia te marca. ¿Cómo sigues?", when: (s) => s.mods.minorInjury, options: [
    O("volver", "Volver antes", ["↑ partidos", "↑ recaída"], (s) => { mod({ matches: mult(1.2) })(s); if (chance(s, 0.3)) mod({ matches: mult(0.7) })(s); }),
    O("recuperar", "Recuperarme bien", [], () => {}) ] },
  { id: "clasico", text: "Llega el clásico decisivo. Te ofrecen patear el penal.", when: (s) => s.club.level <= 2 && s.half > 1, options: [
    O("patear", "Pedir el penal", ["↑↓ títulos"], (s) => { mod({ league: mult(chance(s, 0.7) ? 1.3 : 0.95) })(s); }),
    O("dejar", "Dejarlo", [], () => {}) ] },
  { id: "juvenil", text: "Te convocan a la selección juvenil.", when: (s) => s.age <= 20 && s.ovr >= 65, options: [
    O("ir", "Ir", ["↑ valoración", "↓ partidos"], (s) => { gainOvr(s, 2); mod({ matches: mult(0.9) })(s); }),
    O("no", "No ir", [], () => {}) ] },
  { id: "dt_pelea", text: "Tuviste un encontrón con el DT.", when: (s) => s.half > 2 && chance(s, 0.08), options: [
    O("disculpas", "Pedir disculpas", [], () => {}),
    O("salir", "Pedir salir", ["↓ minutos"], (s) => { s.pendingMove = s.club.level; mod({ role: "rotacion" })(s); }) ] },
  { id: "capitania", text: "Te ofrecen la cinta de capitán.", when: (s) => s.age >= 27 && roleOf(s) === "titular", options: [
    O("aceptar", "Aceptar", ["↑ títulos"], mod({ league: mult(1.05), cup: mult(1.05) })),
    O("rechazar", "Rechazar", [], () => {}) ] },
  { id: "arabia", text: "Un club de Arabia te ofrece un contrato enorme.", when: (s) => s.age >= 30 && s.ovr >= 75, options: [
    O("ir", "Irme", ["↓ valoración"], (s) => { s.arab = true; s.pendingMove = 2; gainOvr(s, -1); }),
    O("quedar", "Quedarme", [], () => {}) ] },
  { id: "origen", text: "Tu primer club quiere que vuelvas.", when: (s) => s.age >= 32 && s.clubs[0].name !== s.club.name, options: [
    O("volver", "Volver", ["↑ minutos"], (s) => { s.homeReturn = true; s.homeBonus = true; s.pendingMove = 1; mod({ role: "titular" })(s); }),
    O("seguir", "Seguir donde estoy", [], () => {}) ] },
  { id: "dt_nuevo", text: "Cambió el DT del club.", when: (s) => s.half > 2 && chance(s, 0.15), options: [
    O("adaptar", "Adaptarme", [], (s) => mod({ role: chance(s, 0.5) ? "titular" : "rotacion" })(s)),
    O("prestamo", "Pedir salir a préstamo", ["↑ minutos"], (s) => { s.mods.role = "titular"; s.mods.level = Math.max(1, s.club.level - 1); }) ] },
  { id: "despedida", text: "Es tu última temporada. Te ofrecen un partido de despedida.", when: (s) => s.age >= 35, options: [
    O("jugar", "Jugarlo", ["↑ leyenda"], (s) => { if (s.clubs.some((c) => c.name === s.club.name && s.age - c.from >= 5)) s.totals.awards += 1; }),
    O("no", "No", [], () => {}) ] },
  { id: "tiros_libres", text: "Tienes buena pegada. ¿Practicas tiros libres?", when: (s) => s.player.profile === "tecnica" && s.ovr >= 70, options: [
    O("practicar", "Practicar", ["↑ goles"], mod({ goal: mult(1.1) })),
    O("no", "No", [], () => {}) ] },
  { id: "penales", text: "Eres arquero: ¿estudias a los pateadores?", when: (s) => s.player.pos === "GK", options: [
    O("estudiar", "Estudiar a los pateadores", ["↑ vallas"], mod({ clean: mult(1.1) })),
    O("no", "No", [], () => {}) ] },
  { id: "corners", text: "El DT quiere que subas a los córners.", when: (s) => s.player.pos === "DEF", options: [
    O("subir", "Subir", ["↑ goles", "↓ vallas"], mod({ clean: mult(0.95), defGoal: add(0.03) })),
    O("no", "No", [], () => {}) ] },
  { id: "copa_rotacion", text: "Viene la copa y el DT quiere rotar.", when: (s) => s.club.level >= 2, options: [
    O("pedir", "Pedir jugar la copa", ["↑ copa", "↓ liga"], mod({ cup: mult(1.1), league: mult(0.9) })),
    O("aceptar", "Aceptar la rotación", [], () => {}) ] },
  { id: "sobrepeso", text: "Volviste de vacaciones con unos kilos de más.", when: (s) => s.half > 2 && chance(s, 0.06), options: [
    O("dieta", "Dieta estricta", ["↓ lesión"], mod({ injury: add(-0.05) })),
    O("nada", "No pasa nada", ["↓ valoración"], (s) => gainOvr(s, -1)) ] },
  { id: "representante", text: "Un representante nuevo te busca.", when: (s) => s.half > 1, options: [
    O("firmar", "Firmar", ["↑ ofertas"], mod({ forceOffer: true })),
    O("no", "No", [], () => {}) ] },
  { id: "invierno", text: "Se abre el mercado de invierno.", when: (s) => s.mode === "intensa" && s.half % 2 === 1 && s.half > 1, options: [
    O("cambiar", "Cambiarme en enero", ["↑ ofertas"], mod({ forceOffer: true })),
    O("quedar", "Quedarme", [], () => {}) ] },
  { id: "joven", text: "Un juvenil del club te quita el puesto.", when: (s) => s.age >= 31 && roleOf(s) !== "suplente", options: [
    O("pelear", "Pelear el puesto", ["↑↓ minutos"], (s) => mod({ role: chance(s, 0.5) ? "titular" : "rotacion" })(s)),
    O("asumir", "Asumir la rotación", [], mod({ role: "rotacion" })) ] },
  { id: "final_continental", text: "Llegaste a una final continental.", when: (s) => s.club.level >= 3 && s.half > 2, options: [
    O("jugar", "Jugar infiltrado", ["↑ copa", "↑ lesión"], mod({ cup: mult(1.2), injury: add(0.2) })),
    O("banco", "Ir al banco", [], () => {}) ] },
  { id: "jugador_entrenador", text: "Te ofrecen ser jugador-entrenador.", when: (s) => s.age >= 36, options: [
    O("aceptar", "Aceptar", ["↑ leyenda"], (s) => { s.legado = true; }),
    O("no", "No", [], () => {}) ] },
  { id: "agente", text: "Te proponen una gira promocional en pleno torneo.", when: (s) => s.half > 3 && s.club.level >= 2, options: [
    O("ir", "Ir", ["↑ ofertas", "↓ valoración"], (s) => { mod({ forceOffer: true })(s); gainOvr(s, -1); }),
    O("no", "No", [], () => {}) ] },
];
const BY_ID = Object.fromEntries(DECISIONS.map((d) => [d.id, d]));
const EXPRES_IDS = new Set(["pretemporada", "oferta_grande", "renovacion", "lesion_grave", "arabia", "origen"]);

function publicDecision(d) {
  return { id: d.id, text: d.text, options: d.options.map(({ key, label, icons }) => ({ key, label, icons })) };
}

// Elige la próxima decisión: una que cumpla su condición y no se haya usado en las últimas 3 temporadas.
function nextDecision(state) {
  const now = state.half;
  const pool = DECISIONS.filter((d) => (state.mode !== "expres" || EXPRES_IDS.has(d.id)) && (state.used[d.id] === undefined || now - state.used[d.id] >= 6) && d.when(state));
  const chosen = pool.length ? pick(state, pool) : BY_ID.pretemporada;
  state.used[chosen.id] = now;
  return publicDecision(chosen);
}

// ---------- Cotrero medio: eventos, minijuegos y convocatoria ----------
const E = (key, label, rep, apply = () => {}, icons = []) => ({ key, label, icons: [rep > 0 ? "↑ reputación" : rep < 0 ? "↓ reputación" : "", ...icons].filter(Boolean), rep, apply });
const EVENTS = [
  { id: "entrevista", text: "Tras una derrota, la prensa te espera.", options: [E("humilde", "Dar la cara", 4), E("culpar", "Culpar al árbitro", -5), E("callar", "No decir nada", 0)] },
  { id: "festejo", text: "Metiste un gol en el clásico. ¿Cómo lo festejas?", options: [E("provocar", "Provocar a la hinchada rival", -6, mod({ league: mult(1.05) }), ["↑ goles"]), E("abrazar", "Abrazar a tus compañeros", 3), E("dedicar", "Dedicárselo a tu familia", 5)] },
  { id: "redes", text: "Una polémica en redes sociales te salpica.", options: [E("pedir", "Pedir disculpas", 2), E("responder", "Responder con todo", -5), E("ignorar", "Ignorarla", 0)] },
  { id: "barrio", text: "El club de tu barrio necesita una mano.", options: [E("donar", "Donar camisetas y balones", 6), E("visitar", "Ir a un entrenamiento", 4), E("nada", "No puedo", -2)] },
  { id: "falta", text: "Hay un entrenamiento, pero tenías una fiesta.", options: [E("ir", "Ir al entrenamiento", 2), E("faltar", "Faltar", -6, mod({ role: "rotacion" }))] },
  { id: "pelea", text: "Discutiste fuerte con un compañero.", options: [E("reconciliar", "Hablarlo y reconciliar", 3), E("pelear", "Seguir peleado", -4)] },
  { id: "aumento", text: "Tu contrato se acerca a su fin.", options: [E("pedir", "Pedir un aumento", -3, mod({ forceOffer: true }), ["↑ ofertas"]), E("callar", "Esperar", 1)] },
  { id: "rival", text: "Un club rival histórico te llama.", options: [E("rechazar", "Rechazar por respeto", 6), E("considerar", "Escuchar la propuesta", -4, mod({ forceOffer: true }))] },
  { id: "dt", text: "Te preguntan por tu DT.", options: [E("elogiar", "Elogiarlo", 3), E("criticar", "Criticar sus decisiones", -4), E("neutral", "Cuidar las palabras", 0)] },
  { id: "foto", text: "Te sacan una foto con la hinchada rival.", options: [E("explicar", "Explicar que fue un saludo", 1), E("negar", "Negar todo", -3)] },
  { id: "hospital", text: "Un hospital infantil te invita.", options: [E("ir", "Ir", 7), E("excusa", "Mandar un saludo", 1)] },
  { id: "fiesta", text: "Víspera de final: te invitan a una fiesta.", options: [E("ir", "Ir un rato", -6, mod({ league: mult(0.9) })), E("quedar", "Descansar en la concentración", 3, mod({ league: mult(1.05) }))] },
  { id: "companero", text: "Critican a un compañero en la prensa.", options: [E("defender", "Defenderlo", 5), E("callar", "Quedarme afuera", -1)] },
  { id: "despedida_f", text: "Quieres cambiar de aire y salir rápido.", options: [E("avisar", "Despedirme como corresponde", 4), E("irse", "Irme sin avisar", -8, mod({ forceOffer: true }))] },
  { id: "autografos", text: "Perdiste, pero la gente sigue en el estadio.", options: [E("firmar", "Quedarme a firmar autógrafos", 5), E("irse", "Irme directo al camarín", -2)] },
  { id: "arbitro", text: "El árbitro te sacó una amarilla injusta.", options: [E("aceptar", "Aceptarla", 2), E("protestar", "Protestar fuerte", -4)] },
  { id: "seleccion_club", text: "El club te pide que no vayas a la selección.", options: [E("club", "Quedarme con el club", -3, mod({ matches: mult(1.1) })), E("seleccion", "Ir igual", 4)] },
  { id: "homenaje", text: "Te piden un homenaje a un ídolo del club.", options: [E("ir", "Participar", 6), E("no", "No puedo ir", -2)] },
  { id: "capitan", text: "El vestuario te propone como capitán.", options: [E("aceptar", "Aceptar con humildad", 5, mod({ league: mult(1.05) })), E("rechazar", "Dejárselo a otro", 1)] },
  { id: "barra", text: "Un grupo de la barra te exige resultados.", options: [E("hablar", "Conversar con ellos", 3), E("ignorar", "Ignorarlos", -2), E("enfrentar", "Responderles en público", -6)] },
];
const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
const publicEvent = (e) => ({ id: e.id, text: e.text, kind: "evento", options: e.options.map(({ key, label, icons }) => ({ key, label, icons })) });

function pretemporada() {
  return { id: "pretemporada_medio", kind: "atributo", text: "Pretemporada: ¿qué estadística quieres mejorar?", options: Object.entries(ATTRS).map(([key, label]) => ({ key, label, icons: ["+2"] })) };
}
const PENAL_ZONES = ["Arriba izquierda", "Arriba al medio", "Arriba derecha", "Abajo izquierda", "Abajo al medio", "Abajo derecha"];
function keyMatch(state) {
  const type = state.keyMatches % 2 === 0 ? "penal" : "mano";
  return type === "penal"
    ? { id: "penal", kind: "minijuego", text: "Final del campeonato, penal decisivo. ¿Dónde lo pateas?", options: PENAL_ZONES.map((label, i) => ({ key: String(i), label, icons: [] })) }
    : { id: "mano", kind: "minijuego", text: "Mano a mano con el arquero en un partido clave.", options: [{ key: "cruzado", label: "Definir cruzado", icons: [] }, { key: "picado", label: "Picarla", icons: [] }, { key: "gambeta", label: "Gambetear al arquero", icons: [] }] };
}
function resolveMinigame(state, d, choice) {
  const skill = clamp(0.62 + ((state.attrs?.def ?? 60) - 60) * 0.004, 0.4, 0.9);
  let ok;
  if (d.id === "penal") ok = rng(state) < skill * (Number(choice) === int(state, 0, 5) ? 0.35 : 1);
  else ok = rng(state) < clamp(skill + ({ cruzado: 0.04, picado: 0, gambeta: (state.attrs?.reg ?? 60) * 0.002 - 0.08 }[choice] || 0), 0.3, 0.92);
  state.keyMatches += 1;
  state.mods.league = (state.mods.league ?? 1) * (ok ? 1.1 : 0.9);
  state.rep = clamp(state.rep + (ok ? 3 : -3), -50, 50);
  return ok;
}

// ---------- simulación ----------
function simulateHalf(state) {
  const level = state.mods.level ?? state.club.level;
  const role = roleOf(state);
  const [a, b] = MATCHES[role];
  const matches = Math.max(0, Math.round(int(state, a, b) / 2 * (state.mods.matches ?? 1) * (state.injuredNext ? 0.7 : 1)));
  const { pos, profile, foot } = state.player;
  let g = { FWD: 0.25 + (state.ovr - 60) * 0.012, MID: 0.08 + (state.ovr - 60) * 0.005, DEF: 0.03 + (state.mods.defGoal ?? 0), GK: 0 }[pos];
  let as = { FWD: 0.12, MID: 0.18 + (state.ovr - 60) * 0.006, DEF: 0.05, GK: 0 }[pos];
  g = Math.max(0, g) * (state.mods.goal ?? 1) * (profile === "velocidad" ? 1.1 : 1) * (foot === "ambidiestro" ? 1.05 : 1);
  as = Math.max(0, as) * (profile === "tecnica" ? 1.15 : 1);
  let goals = 0, assists = 0;
  for (let i = 0; i < matches; i++) { if (rng(state) < Math.min(g, 0.95)) goals += 1; if (rng(state) < Math.min(as, 0.8)) assists += 1; }
  const clean = ["DEF", "GK"].includes(pos) ? Math.round(matches * (0.2 + level * 0.06) * (state.mods.clean ?? 1)) : 0;
  state.acc.matches += matches; state.acc.goals += goals; state.acc.assists += assists; state.acc.cleanSheets += clean;
  state.half += 1;
  state.lastRole = role;
  return { matches, goals, assists, clean, role };
}

function growthFor(age) {
  return age <= 21 ? [3, 6] : age <= 27 ? [1, 3] : age <= 30 ? [-1, 1] : [-4, -2];
}

// Cierra una temporada completa: progresión por edad, títulos, premios, lesiones y retiro.
function endSeason(state) {
  const level = state.mods.level ?? state.club.level;
  const role = state.lastRole || roleOf(state);
  const [lo, hi] = growthFor(state.age);
  let growth = int(state, lo, hi) * (growth_sign(lo, hi) >= 0 ? MINUTES[role] : 1) * (state.mods.growth ?? 1);
  if (growth > 0 && state.ovr >= state.potential) growth = 0;
  growth = Math.round(growth);
  gainOvr(state, growth);

  const out = { age: state.age, club: state.club.name, level, role, ...state.acc, growth, titles: [], awards: [], injury: null, ovr: state.ovr };
  const roleF = ROLE_FACTOR[role];
  if (chance(state, P_LEAGUE[level] * roleF * (state.mods.league ?? 1))) { out.titles.push("Liga"); state.totals.titles += 1; }
  if (level >= 3 && chance(state, P_CUP[level] * roleF * (state.mods.cup ?? 1))) { out.titles.push("Copa internacional"); state.totals.titles += 1; }
  if (state.ovr >= LEVEL_MIN[level] + 8 && chance(state, 0.25)) { out.awards.push("Mejor del torneo"); state.totals.awards += 1; }
  if (state.ovr >= 90 && level === 5 && chance(state, 0.3)) { out.awards.push("Mejor del mundo"); state.totals.awards += 1; }
  const pInj = clamp(0.12 + (state.age > 30 ? 0.03 * (state.age - 30) : 0) + (state.mods.injury ?? 0) + (state.player.profile === "fisico" ? -0.04 : 0), 0, 0.9);
  state.offerFlags = { force: !!state.mods.forceOffer, none: !!state.mods.noOffers };
  state.injuredNext = false;
  if (chance(state, pInj)) {
    const severe = chance(state, 0.25);
    out.injury = severe ? "grave" : "leve";
    if (severe) { gainOvr(state, -int(state, 1, 3)); state.injuredNext = true; out.ovr = state.ovr; }
    else state.mods.minorInjury = true;
  }
  const t = state.totals;
  t.goals += state.acc.goals; t.assists += state.acc.assists; t.matches += state.acc.matches; t.cleanSheets += state.acc.cleanSheets; t.seasons += 1;
  t.peak = Math.max(t.peak, state.ovr);
  state.history.push(out);
  state.acc = { matches: 0, goals: 0, assists: 0, cleanSheets: 0 };
  state.age += 1;
  state.mods = state.mods.minorInjury ? { minorInjury: true } : {};
  state.calledUp = false; state.eventsThisSeason = 0;
  return out;
}
const growth_sign = (lo, hi) => (lo + hi) / 2;

const retireNow = (state) => state.age >= (state.retireAge || 38) || (state.age >= 30 && state.ovr < 62);

function makeOffers(state) {
  const flags = state.offerFlags || {};
  state.offerFlags = null;
  if (flags.none) return [];
  const allowed = Math.max(...[1, 2, 3, 4, 5].filter((l) => LEVEL_MIN[l] <= state.ovr));
  const last = state.history[state.history.length - 1];
  const cur = state.club.level;
  const forced = !!flags.force;
  if (!forced && !chance(state, 0.55)) return [];
  const badYear = last && last.matches < 10;
  const maxLevel = badYear ? cur : Math.min(allowed, cur + 1);
  const n = forced ? int(state, 1, 3) : int(state, 1, 2);
  const offers = [];
  for (let i = 0; i < n; i++) {
    const level = int(state, Math.max(1, cur - 1), Math.max(1, maxLevel));
    const name = level === 1 ? pick(state, HOME[state.player.nation] || HOME.Chile) : pick(state, POOL[level]);
    if (name === state.club.name || offers.some((o) => o.name === name)) continue;
    const need = LEVEL_MIN[level];
    offers.push({ name, level, role: state.ovr >= need + 4 ? "titular" : state.ovr >= need - 4 ? "rotacion" : "suplente" });
  }
  return offers;
}

function summaryFor(state, s) {
  return { ...s, ovr: state.ovr, rep: state.rep, nextAge: state.age };
}

// ---------- paso del juego ----------
export function publicView(state) {
  const medio = state.game === "cotrero_medio";
  return {
    game: state.game, mode: state.mode, phase: state.phase, retired: state.retired,
    player: state.player, age: state.age, ovr: state.ovr, club: state.club, role: state.lastRole || roleOf(state),
    ...(medio ? { attrs: state.attrs, rep: state.rep, repLabel: repLabel(state.rep), caps: state.caps } : {}),
    totals: state.totals, history: state.history.slice(-12), pending: state.pending, summary: state.summary, offers: state.offers || null,
    final: state.final,
  };
}

export const repLabel = (rep) => (rep >= 40 ? "Ídolo" : rep >= 15 ? "Querido" : rep > -15 ? "Profesional" : rep > -40 ? "Polémico" : "Villano");

function advance(state, halves) {
  let sum = null;
  for (let i = 0; i < halves; i++) {
    simulateHalf(state);
    if (state.half % 2 === 0) { sum = endSeason(state); if (retireNow(state)) break; }
  }
  return sum;
}

function applyMove(state, club) {
  state.club = { name: club.name, level: club.level };
  state.clubs.push({ name: club.name, level: club.level, from: state.age });
}

// Una elección del jugador. Devuelve el estado nuevo o { error } si no corresponde.
export function act(state, input = {}) {
  if (state.retired) return { error: "La carrera ya terminó" };
  const choice = String(input.choice ?? "");
  const s = structuredClone(state);
  const medio = s.game === "cotrero_medio";

  if (s.phase === "pretemporada") {
    if (!ATTRS[choice]) return { error: "Elige una estadística" };
    s.attrs[choice] = clamp(s.attrs[choice] + 2, 30, 99);
    s.ovr = ovrFromAttrs(s); s.totals.peak = Math.max(s.totals.peak, s.ovr);
    s.pending = null;
    s.phase = "evento";
    s.pending = nextEvent(s);
    return s;
  }

  if (s.phase === "evento" || s.phase === "minijuego" || s.phase === "convocatoria") {
    const p = s.pending;
    if (!p || !p.options.some((o) => o.key === choice)) return { error: "Esa opción no existe" };
    if (p.kind === "minijuego") {
      const ok = resolveMinigame(s, p, choice);
      s.lastMinigame = ok;
    } else if (p.id === "convocatoria") {
      if (choice === "ir") { s.rep = clamp(s.rep + 5, -50, 50); s.caps += int(s, 2, 6); if (chance(s, 0.2)) s.mods.matches = 0.8; }
      else s.rep = clamp(s.rep - 3, -50, 50);
      s.calledUp = true;
    } else {
      const ev = EVENT_BY_ID[p.id]; const opt = ev.options.find((o) => o.key === choice);
      s.rep = clamp(s.rep + opt.rep, -50, 50); opt.apply(s); s.eventsThisSeason += 1;
    }
    s.pending = null;
    return advanceMedio(s);
  }

  if (s.phase === "decision") {
    const d = BY_ID[s.pending?.id];
    const opt = d?.options.find((o) => o.key === choice);
    if (!opt) return { error: "Esa opción no existe" };
    opt.apply(s);
    const halves = MODES[s.mode].step;
    const sum = advance(s, halves);
    s.summary = summaryFor(s, sum || { age: s.age, matches: s.acc.matches, goals: s.acc.goals, assists: s.acc.assists, clean: s.acc.cleanSheets, titles: [], awards: [], growth: 0, club: s.club.name, level: s.club.level, role: s.lastRole });
    if (halves > 2) s.summary = { ...s.summary, block: halves / 2 };
    s.pending = null; s.offers = null;
    s.phase = "summary";
    return s;
  }

  if (s.phase === "summary") {
    if (choice !== "continue") return { error: "Continúa para seguir" };
    s.summary = null;
    if (retireNow(s)) return finish(s);
    if (s.half % 2 !== 0) return toDecision(s); // media temporada: solo se sigue decidiendo
    // retiro voluntario
    if (s.age >= 33 && s.ovr < 70 && !s.askedRetire) { s.askedRetire = true; s.phase = "retiro"; s.pending = { id: "retiro", text: "Cada vez te cuesta más. ¿Te retiras?", options: [{ key: "retirar", label: "Retirarme", icons: [] }, { key: "seguir", label: "Seguir un año más", icons: [] }] }; return s; }
    s.askedRetire = false;
    if (s.pendingMove) { const lvl = s.pendingMove; s.pendingMove = null; const name = s.arab ? pick(s, ARAB) : s.homeReturn ? s.clubs[0].name : lvl === 1 ? pick(s, HOME[s.player.nation] || HOME.Chile) : pick(s, POOL[lvl]); applyMove(s, { name, level: s.homeReturn ? 1 : s.arab ? 2 : lvl }); s.arab = false; s.homeReturn = false; }
    const offers = makeOffers(s);
    if (offers.length) { s.offers = offers; s.phase = "transfer"; return s; }
    return toDecision(s);
  }

  if (s.phase === "retiro") {
    if (choice === "retirar") return finish(s);
    s.pending = null; s.phase = "decision"; return toDecision(s);
  }

  if (s.phase === "transfer") {
    if (choice === "stay") { s.offers = null; return toDecision(s); }
    const m = /^club:(\d+)$/.exec(choice);
    const o = m && s.offers?.[Number(m[1])];
    if (!o) return { error: "Esa oferta no existe" };
    applyMove(s, o);
    s.offers = null;
    s.mods.role = o.role;
    return toDecision(s);
  }
  void medio;
  return { error: "Estado desconocido" };
}

function toDecision(s) {
  if (s.game === "cotrero_medio") { s.phase = "pretemporada"; s.pending = pretemporada(); return s; }
  s.phase = "decision"; s.pending = nextDecision(s);
  return s;
}

// Cotrero medio: un paso es una temporada; entre la pretemporada y el cierre hay 1–2 eventos,
// el partido clave (minijuego) y la convocatoria.
function nextEvent(s) {
  if (s.eventsThisSeason === 0 || (s.eventsThisSeason === 1 && chance(s, 0.5))) { const ev = pick(s, EVENTS.filter((e) => s.used[`e:${e.id}`] === undefined || s.half - s.used[`e:${e.id}`] > 8)); s.used[`e:${ev.id}`] = s.half; return publicEvent(ev); }
  return null;
}
function advanceMedio(s) {
  // ¿otro evento?
  if (s.phase === "evento" && s.eventsThisSeason < 2 && s.eventsThisSeason >= 1) {
    const more = nextEvent(s);
    if (more) { s.pending = more; return s; }
  }
  if (s.phase === "evento" && s.club.level >= 1 && s.keyPlayed !== s.half && chance(s, 0.6)) {
    s.keyPlayed = s.half; s.phase = "minijuego"; s.pending = keyMatch(s); return s;
  }
  if (!s.calledUp && s.ovr >= 74 && s.rep >= -2) {
    s.phase = "convocatoria";
    s.pending = { id: "convocatoria", kind: "evento", text: "¡Te convocaron a la selección!", options: [{ key: "ir", label: "Ir", icons: ["↑ reputación", "↑ lesión"] }, { key: "excusarse", label: "Excusarme", icons: ["↓ reputación"] }] };
    return s;
  }
  // se juega la temporada
  const sum = advance(s, 2);
  s.summary = summaryFor(s, sum);
  s.pending = null; s.offers = null; s.phase = "summary";
  return s;
}

// ---------- fin de la carrera ----------
export function scoreOf(state) {
  const t = state.totals;
  const def = ["DEF", "GK"].includes(state.player.pos) ? t.cleanSheets * 0.6 : 0;
  const medio = state.game === "cotrero_medio" ? Math.max(0, state.rep) * 6 + state.caps * 2 : 0;
  let total = t.titles * 45 + t.awards * 35 + t.goals * 1.1 + t.assists * 0.9 + t.matches * 0.25 + Math.max(0, t.peak - 55) * 6 + t.seasons * 3 + def + medio;
  if (state.legado) total *= 1.05;
  if (state.homeBonus && state.history.some((h) => h.titles.length && h.club === state.clubs[0].name && h.age >= 32)) total *= 1.1;
  return Math.min(3000, Math.round(total));
}
// Etiquetas (las mismas de siempre). Los cortes salen de simular miles de carreras por versión para
// que, jugando bien, «Leyenda» sea un 4% y «Jugador de paso» un 25%: [correcto, Crack, Ídolo, Leyenda].
export const CUTS = { cotrero: [580, 760, 950, 1080], cotrero_medio: [815, 1070, 1300, 1450] };
export function labelOf(score, game = "cotrero") {
  const [c, k, i, l] = CUTS[game] || CUTS.cotrero;
  return score >= l ? "Leyenda" : score >= i ? "Ídolo" : score >= k ? "Crack" : score >= c ? "Jugador correcto" : "Jugador de paso";
}

function finish(s) {
  s.retired = true; s.phase = "retired"; s.pending = null; s.offers = null; s.summary = null;
  const score = scoreOf(s);
  s.final = { score, label: labelOf(score, s.game), seasons: s.totals.seasons, clubs: s.clubs.map((c) => ({ name: c.name, level: c.level })), totals: s.totals, rep: s.rep, repLabel: repLabel(s.rep), caps: s.caps };
  return s;
}

// Figura histórica más parecida (solo Cotrero medio): distancia entre promedios normalizados.
export function closestFigure(state, figures) {
  const t = state.totals;
  const mine = { g: t.goals / Math.max(1, t.seasons), titles: t.titles, seasons: t.seasons, caps: state.caps, rep: state.rep };
  const scale = { g: 15, titles: 20, seasons: 10, caps: 80, rep: 40 };
  let best = null;
  for (const f of figures.filter((x) => x.pos === (state.player.pos === "MID" ? "Enganche" : "Delantero"))) {
    const d = Math.sqrt(((mine.g - f.goalsPerSeason) / scale.g) ** 2 + ((mine.titles - f.titles) / scale.titles) ** 2 + ((mine.seasons - f.seasons) / scale.seasons) ** 2 + ((mine.caps - f.caps) / scale.caps) ** 2 + ((mine.rep - f.rep) / scale.rep) ** 2);
    if (!best || d < best.d) best = { d, f };
  }
  return best ? { name: best.f.name, approx: true } : null;
}
export { DECISIONS, EVENTS };
