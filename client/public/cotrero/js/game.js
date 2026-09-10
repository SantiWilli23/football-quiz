// ═══════════════════════════════════════════════════════════════
// COTRERO — Modo Especialista
// ═══════════════════════════════════════════════════════════════

// ── DATA ─────────────────────────────────────────────────────────

const POSITIONS = {
  delantero: {
    label: "Delantero", icon: "⚡",
    desc: "Goles, velocidad y desequilibrio. Vivís del último pase.",
    stats: ["disparo", "velocidad", "regate", "pase", "resistencia"],
    labels: { disparo: "Disparo", velocidad: "Velocidad", regate: "Regate", pase: "Pase", resistencia: "Resistencia" },
    weights: { disparo: 0.32, velocidad: 0.20, regate: 0.20, pase: 0.14, resistencia: 0.14 },
  },
  mediocampista: {
    label: "Mediocampista", icon: "🧠",
    desc: "El cerebro del equipo. Conectás defensas con ataques.",
    stats: ["vision", "pase", "control", "potencia", "resistencia"],
    labels: { vision: "Visión", pase: "Pase", control: "Control", potencia: "Potencia", resistencia: "Resistencia" },
    weights: { vision: 0.24, pase: 0.26, control: 0.20, potencia: 0.16, resistencia: 0.14 },
  },
  defensa: {
    label: "Defensa", icon: "🛡️",
    desc: "La última línea. Liderazgo, físico y lectura del juego.",
    stats: ["defensa", "fisico", "liderazgo", "pase", "resistencia"],
    labels: { defensa: "Defensa", fisico: "Físico", liderazgo: "Liderazgo", pase: "Pase", resistencia: "Resistencia" },
    weights: { defensa: 0.32, fisico: 0.24, liderazgo: 0.16, pase: 0.14, resistencia: 0.14 },
  },
};

const ARCHETYPES = {
  delantero: [
    { id: "killer", name: "Killer del área", desc: "Instinto puro de gol. Dentro del área sos el mejor.", bonus: { disparo: 8 }, rareza: "rare" },
    { id: "extremo", name: "Extremo desequilibrante", desc: "Velocidad y regate como armas. El uno a uno es tu zona de confort.", bonus: { velocidad: 5, regate: 4 }, rareza: "common" },
    { id: "asociativo", name: "Ariete asociativo", desc: "Más que meter goles, los generás. Jugador para el colectivo.", bonus: { pase: 5, disparo: 3 }, rareza: "common" },
    { id: "ruptura", name: "Delantero de ruptura", desc: "Tu arma es la espalda. Velocidad y profundidad constante.", bonus: { velocidad: 7, resistencia: 2 }, rareza: "legendary" },
  ],
  mediocampista: [
    { id: "motor", name: "Motor de mediocampo", desc: "Correr, correr y correr. El equipo vive de tu energía.", bonus: { potencia: 7, resistencia: 2 }, rareza: "common" },
    { id: "metronomo", name: "Metrónomo", desc: "El ritmo lo ponés vos. Pase corto, pase largo, siempre con criterio.", bonus: { pase: 7, control: 2 }, rareza: "rare" },
    { id: "creativo", name: "Mediocampista creativo", desc: "El último pase, la jugada que nadie vio. Creatividad como diferencial.", bonus: { vision: 8 }, rareza: "legendary" },
    { id: "recuperador", name: "Recuperador", desc: "Robar balones y distribuir rápido. El primero en defender, el primero en salir.", bonus: { potencia: 4, control: 5 }, rareza: "common" },
  ],
  defensa: [
    { id: "muro", name: "Muro", desc: "Físico y determinación. Pocos pasan cuando estás bien parado.", bonus: { fisico: 5, defensa: 4 }, rareza: "common" },
    { id: "lider", name: "Líder defensivo", desc: "Organizás la línea, levantás al equipo. Tu valor va más allá del juego.", bonus: { liderazgo: 7, defensa: 2 }, rareza: "rare" },
    { id: "moderno", name: "Defensor moderno", desc: "Salís jugando, te sumás al ataque. Más que detener, construís.", bonus: { pase: 6, fisico: 3 }, rareza: "legendary" },
    { id: "agresivo", name: "Defensor agresivo", desc: "Presión alta, duelos ganados. La agresividad como herramienta.", bonus: { defensa: 5, fisico: 4 }, rareza: "common" },
  ],
};

const COUNTRIES = [
  { name: "Argentina", flag: "🇦🇷", clubs: [
    { id: "river", name: "River Plate", tier: 1, prestige: 90 },
    { id: "boca", name: "Boca Juniors", tier: 1, prestige: 90 },
    { id: "racing", name: "Racing Club", tier: 2, prestige: 65 },
    { id: "sanlorenzo", name: "San Lorenzo", tier: 2, prestige: 60 },
    { id: "huracan", name: "Huracán", tier: 3, prestige: 38 },
  ]},
  { name: "España", flag: "🇪🇸", clubs: [
    { id: "realmadrid", name: "Real Madrid", tier: 1, prestige: 98 },
    { id: "barcelona", name: "FC Barcelona", tier: 1, prestige: 97 },
    { id: "atletico", name: "Atlético Madrid", tier: 1, prestige: 85 },
    { id: "sevilla", name: "Sevilla FC", tier: 2, prestige: 70 },
    { id: "valencia", name: "Valencia CF", tier: 2, prestige: 63 },
  ]},
  { name: "Inglaterra", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", clubs: [
    { id: "mancity", name: "Manchester City", tier: 1, prestige: 95 },
    { id: "liverpool", name: "Liverpool FC", tier: 1, prestige: 93 },
    { id: "arsenal", name: "Arsenal FC", tier: 1, prestige: 85 },
    { id: "chelsea", name: "Chelsea FC", tier: 2, prestige: 80 },
    { id: "newcastle", name: "Newcastle United", tier: 2, prestige: 62 },
  ]},
  { name: "Brasil", flag: "🇧🇷", clubs: [
    { id: "flamengo", name: "Flamengo", tier: 1, prestige: 88 },
    { id: "palmeiras", name: "Palmeiras", tier: 1, prestige: 85 },
    { id: "corinthians", name: "Corinthians", tier: 2, prestige: 70 },
    { id: "saopaulo", name: "São Paulo FC", tier: 2, prestige: 65 },
  ]},
  { name: "Italia", flag: "🇮🇹", clubs: [
    { id: "juventus", name: "Juventus FC", tier: 1, prestige: 90 },
    { id: "intermilan", name: "Inter de Milán", tier: 1, prestige: 88 },
    { id: "milan", name: "AC Milan", tier: 1, prestige: 87 },
    { id: "napoli", name: "Nápoles", tier: 2, prestige: 72 },
  ]},
  { name: "Francia", flag: "🇫🇷", clubs: [
    { id: "psg", name: "Paris Saint-Germain", tier: 1, prestige: 92 },
    { id: "monaco", name: "AS Monaco", tier: 2, prestige: 68 },
    { id: "lyon", name: "Olympique de Lyon", tier: 2, prestige: 72 },
  ]},
];

// ── RETO SEMANAL ─────────────────────────────────────────────────
// Un jugador real (con su posición y el club real donde arrancó su carrera
// senior) por semana, igual para todo el grupo. Cotrero no tiene arqueros,
// así que la lista sólo cubre delantero/mediocampista/defensa. La dificultad
// del reto es la del juego base ("media") — no se altera el balance.
const WEEKLY_PLAYERS = [
  { name: "Lionel Messi", position: "delantero", country: "España", club: "barcelona" },
  { name: "Kylian Mbappé", position: "delantero", country: "Francia", club: "monaco" },
  { name: "Raúl González", position: "delantero", country: "España", club: "realmadrid" },
  { name: "Juan Román Riquelme", position: "mediocampista", country: "Argentina", club: "boca" },
  { name: "Paolo Maldini", position: "defensa", country: "Italia", club: "milan" },
  { name: "Kaká", position: "mediocampista", country: "Brasil", club: "saopaulo" },
  { name: "Zico", position: "delantero", country: "Brasil", club: "flamengo" },
  { name: "Rivellino", position: "mediocampista", country: "Brasil", club: "corinthians" },
  { name: "Steven Gerrard", position: "mediocampista", country: "Inglaterra", club: "liverpool" },
  { name: "John Terry", position: "defensa", country: "Inglaterra", club: "chelsea" },
  { name: "Bukayo Saka", position: "delantero", country: "Inglaterra", club: "arsenal" },
  { name: "Nabil Fekir", position: "mediocampista", country: "Francia", club: "lyon" },
];

function hashStr(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return hash;
}

// Semana ISO simplificada (lunes a domingo) — mismo criterio que el resto de Futotal.
function isoWeekKey() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  return monday.toISOString().slice(0, 10);
}

function currentWeeklyPlayer() {
  const idx = hashStr(isoWeekKey()) % WEEKLY_PLAYERS.length;
  return WEEKLY_PLAYERS[idx];
}

function resolveWeeklyClub(entry) {
  const country = COUNTRIES.find(c => c.name === entry.country);
  const club = country ? country.clubs.find(c => c.id === entry.club) : null;
  return { country, club };
}

function submitChallengeScore(gameKey, score) {
  try {
    const token = localStorage.getItem("fq_token");
    const groupId = localStorage.getItem("fq_active_group");
    if (!token || !groupId) return;
    fetch("/api/challenges/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ gameKey: gameKey, groupId: Number(groupId), score: score }),
    }).catch(function () {});
  } catch (e) {}
}

const DECISIONS_POOL = [
  {
    id: "d01",
    context: "El técnico te convoca a su oficina antes del entrenamiento. Te dice que quiere que hagas más trabajo de presión alta, que el equipo lo necesita en las próximas semanas.",
    options: [
      { text: "Le decís que sí, que lo vas a intentar." },
      { text: "Le explicás que tu juego es otro, que lo ves difícil." },
      { text: "Assentís, pero en el entrenamiento seguís haciendo lo tuyo." },
    ],
    effects: [
      { dt: 4, forma: -2, p: { profesional: 1 } },
      { dt: -5, p: { lider: 1 } },
      { dt: -10, forma: -1, p: { solitario: 1 } },
    ],
  },
  {
    id: "d02",
    context: "Tras el empate de ayer, un compañero con más antigüedad que vos te dice que el problema es el sistema del técnico. Quiere que hablen con el capitán juntos.",
    options: [
      { text: "Lo acompañás. Hay cosas que hay que decir." },
      { text: "Le decís que preferís mantenerte al margen." },
      { text: "Le sugerís que lo hable él directamente, sin involucrarte." },
    ],
    effects: [
      { dt: -6, p: { lider: 1 } },
      { forma: -2, p: { solitario: 1 } },
      { p: { profesional: 1 }, special: "tension_compañero" },
    ],
  },
  {
    id: "d03",
    context: "Tu representante te llama. Una marca deportiva quiere hacer una sesión de fotos esta semana. El club no lo prohíbe, pero no es el mejor momento de la temporada.",
    options: [
      { text: "Aceptás. Es buena plata y exposición." },
      { text: "Lo rechazás. Estás enfocado en la temporada." },
      { text: "Le pedís que lo posterguen para después de la próxima Copa." },
    ],
    effects: [
      { p: { fiestero: 1 }, special: "foto_condicional" },
      { forma: 3, p: { profesional: 1 } },
      { forma: 1, p: { solitario: 1 } },
    ],
  },
  {
    id: "d04",
    context: "Un juvenil de la cantera te busca antes de un entrenamiento. Quiere pedirte consejos sobre cómo manejar la presión del primer equipo.",
    options: [
      { text: "Lo atendés con tiempo. Le contás tu experiencia." },
      { text: "Le das un par de consejos rápidos y seguís con lo tuyo." },
      { text: "Le decís que ahora no podés, que te busque en otro momento." },
    ],
    effects: [
      { dt: 3, forma: -2, p: { lider: 1 } },
      { p: { profesional: 1 } },
      { p: { solitario: 1 } },
    ],
  },
  {
    id: "d05",
    context: "Un periodista te detiene a la salida del entrenamiento y te pregunta por el clásico de la próxima semana. Hay cámaras cerca.",
    options: [
      { text: "Hablás de más. Prometés victoria y mandás un mensaje a los rivales." },
      { text: "Respuesta corta y diplomática. No comprometés nada." },
      { text: "No querés hablar del tema. Te escapás rápido." },
    ],
    effects: [
      { forma: 4, p: { fiestero: 1 }, special: "presion_clasico" },
      { p: { profesional: 1 } },
      { forma: -3, p: { solitario: 1 } },
    ],
  },
  {
    id: "d06",
    context: "El equipo lleva tres partidos sin ganar. Hay tensión en el vestuario y el técnico está callado en los entrenamientos.",
    options: [
      { text: "Tomás la iniciativa. Hablás con el grupo en el vestuario." },
      { text: "Te enfocás en tu propio juego y dejás que el técnico lo maneje." },
      { text: "Pedís una reunión individual con el técnico para entender el plan." },
    ],
    effects: [
      { p: { lider: 1 }, special: "arenga_condicional" },
      { p: { solitario: 1 } },
      { dt: 3, p: { profesional: 1 } },
    ],
  },
  {
    id: "d07",
    context: "Invitación a un evento social organizado por un compañero de equipo. Hay partido importante el fin de semana.",
    options: [
      { text: "Vas y te quedás hasta tarde. Una noche no cambia nada." },
      { text: "Vas un rato, saludás y te vas temprano." },
      { text: "No podés. Necesitás descansar para el partido." },
    ],
    effects: [
      { p: { fiestero: 2 }, special: "cansancio_fiesta" },
      { p: { fiestero: 1 } },
      { forma: 4, p: { profesional: 1 } },
    ],
  },
  {
    id: "d08",
    context: "El técnico te saca en el minuto 65 de un partido que están ganando. Entra un compañero por tu posición.",
    options: [
      { text: "Aplaudís al que entra. Te sentás sin hacer escándalo." },
      { text: "Salís visiblemente molesto. No lo podés disimular." },
      { text: "Te sentás en el banco mirando al piso, sin reaccionar." },
    ],
    effects: [
      { dt: 4, p: { profesional: 1 } },
      { dt: -7, p: { lider: 1 } },
      { forma: -3, p: { solitario: 1 } },
    ],
  },
  {
    id: "d09",
    context: "Un periodista publica una nota crítica de tu rendimiento. Circula en redes y hay comentarios fuertes.",
    options: [
      { text: "Respondés públicamente desde tus redes. No se puede dejar pasar." },
      { text: "Lo ignorás completamente. El trabajo habla por sí solo." },
      { text: "Hablás con el área de comunicación del club para que lo gestionen." },
    ],
    effects: [
      { p: { fiestero: 1 }, special: "polemica_media" },
      { forma: -3, p: { solitario: 1 } },
      { dt: 2, p: { profesional: 1 } },
    ],
  },
  {
    id: "d10",
    context: "El preparador físico te recomienda una semana de carga reducida antes del partido importante. Dice que tus números de GPS están altos.",
    options: [
      { text: "Seguís el plan al pie de la letra." },
      { text: "Entrenás normal con el grupo. Preferís no diferenciarte." },
      { text: "Hacés mitad del protocolo, mitad con el grupo." },
    ],
    effects: [
      { special: "descanso_condicional" },
      { dt: 2, special: "carga_riesgo" },
      { forma: 2 },
    ],
  },
  {
    id: "d11",
    context: "Un compañero importante del vestuario te comenta en voz baja que hay malestar con cómo el cuerpo técnico maneja las rotaciones.",
    options: [
      { text: "Lo escuchás, le decís que entendés pero que vos con el técnico estás bien." },
      { text: "Le preguntás qué sabe más. Querés conocer el panorama completo." },
      { text: "Le decís que si tiene algo que decir, que lo hable directamente con el técnico." },
    ],
    effects: [
      { p: { profesional: 1 }, special: "tension_latente" },
      { p: { fiestero: 1 }, dt: -3 },
      { p: { lider: 1 } },
    ],
  },
  {
    id: "d12",
    context: "Tu representante te avisa que hay un club interesado. Todavía no es una oferta formal, solo quieren saber si estarías disponible para escucharlos.",
    options: [
      { text: "Le decís que sí, que los escuchen." },
      { text: "Le decís que no. Tu cabeza está acá." },
      { text: "Le pedís que lo dejen enfriar, que no es el momento." },
    ],
    effects: [
      { special: "interes_mercado" },
      { dt: 2, p: { profesional: 1 } },
      { p: { solitario: 1 } },
    ],
  },
  {
    id: "d13",
    context: "Antes del entrenamiento, el capitán te llama aparte. Dice que el grupo necesita que alguien hable antes del partido más importante de la temporada.",
    options: [
      { text: "Tomás la palabra vos. Te parás adelante del grupo." },
      { text: "Le decís que lo haga él, que es el capitán." },
      { text: "Proponés que hablen todos un poco, que no sea una sola voz." },
    ],
    effects: [
      { p: { lider: 2 }, special: "arenga_lider" },
      { p: { profesional: 1 } },
      { dt: 1, p: { solitario: 1 } },
    ],
  },
  {
    id: "d14",
    context: "Durante la semana, el técnico te ofrece participar en sesiones de análisis de video táctico adicionales fuera del horario habitual.",
    options: [
      { text: "Aceptás sin dudar. Toda ventaja suma." },
      { text: "Participás un par de veces pero no todas." },
      { text: "Le decís que preferís descansar fuera de los horarios de entreno." },
    ],
    effects: [
      { dt: 5, forma: -2, p: { profesional: 1 } },
      { dt: 2 },
      { forma: 3, p: { solitario: 1 }, dt: -2 },
    ],
  },
  {
    id: "d15",
    context: "Un compañero que no está teniendo minutos te dice que se siente mal, que está pensando en pedir la baja. Te lo cuenta a vos primero.",
    options: [
      { text: "Le decís que aguante. Los momentos difíciles son parte del fútbol." },
      { text: "Le decís que haga lo que siente que es mejor para él." },
      { text: "Le sugerís que hable con el técnico antes de tomar cualquier decisión." },
    ],
    effects: [
      { p: { lider: 1 }, dt: 1 },
      { p: { fiestero: 1 } },
      { p: { profesional: 1 } },
    ],
  },
];

const MATCH_SITUATIONS = [
  {
    id: "ms01",
    text: "Tu equipo pierde el balón seguido en la zona del mediocampo rival. El técnico te mira desde el banco.",
    options: [
      { text: "Bajás más al mediocampo para participar de la construcción." },
      { text: "Pedís el balón desde la espalda de la defensa rival." },
      { text: "No cambiás nada. Esperás que el balón llegue a tus pies." },
    ],
    effects: [
      { rendimiento: 1, riesgo: 0 },
      { rendimiento: 2, riesgo: 1 },
      { rendimiento: -1, riesgo: 0 },
    ],
  },
  {
    id: "ms02",
    text: "El lateral rival deja mucho espacio a tu espalda cada vez que sube. Tu equipo lo ve pero nadie lo explota.",
    options: [
      { text: "Pedís el balón en ese espacio y acelerás." },
      { text: "Se lo indicás a un compañero que está mejor posicionado." },
      { text: "Esperás a ver si el técnico lo corrige desde el banco." },
    ],
    effects: [
      { rendimiento: 2, riesgo: 1 },
      { rendimiento: 1, riesgo: 0 },
      { rendimiento: -1, riesgo: 0 },
    ],
  },
  {
    id: "ms03",
    text: "Están 1-0 arriba. El rival empieza a presionar alto y tu equipo cede terreno.",
    options: [
      { text: "Decís que bajen líneas y cuiden el resultado." },
      { text: "Seguís proponiendo salida desde abajo, sin cambiar nada." },
      { text: "Buscás hacer el segundo gol personalmente." },
    ],
    effects: [
      { rendimiento: 0, riesgo: -1 },
      { rendimiento: 1, riesgo: 1 },
      { rendimiento: 2, riesgo: 2 },
    ],
  },
  {
    id: "ms04",
    text: "El árbitro cobra una falta clara contra tu equipo y varios compañeros rodean al juez.",
    options: [
      { text: "Te alejás del grupo. No vale la pena." },
      { text: "Te sumás a protestar. Es una falta grosera." },
      { text: "Buscás a un compañero para calmarlo antes de que lo amonesten." },
    ],
    effects: [
      { rendimiento: 0, riesgo: 0 },
      { rendimiento: 0, riesgo: 2 },
      { rendimiento: 1, riesgo: -1 },
    ],
  },
  {
    id: "ms05",
    text: "Empatan 0-0 a diez minutos del final. El técnico grita instrucciones que no llegan con claridad.",
    options: [
      { text: "Interpretás lo que creés que quiere y lo hacés." },
      { text: "Seguís tu instinto. Conocés el juego." },
      { text: "Le hacés señas para que aclarare qué quiere." },
    ],
    effects: [
      { rendimiento: 1, riesgo: 1 },
      { rendimiento: 2, riesgo: 1 },
      { rendimiento: 0, riesgo: 0 },
    ],
  },
];

const INJURY_TYPES = [
  { name: "Golpe leve", weeks: 1, prob: 0.50 },
  { name: "Sobrecarga muscular", weeks: 2, prob: 0.25 },
  { name: "Desgarro", weeks: 4, prob: 0.15 },
  { name: "Esguince", weeks: 6, prob: 0.07 },
  { name: "Fractura", weeks: 10, prob: 0.03 },
];

const INTL_WINDOWS = [11, 28];

const FLAVOR_TEXTS = {
  dt_sube: [
    "El técnico te buscó después del entrenamiento para darte una palmada.",
    "Tu nombre apareció primero en la pizarra táctica de hoy.",
    "Hubo un gesto del banco que no pasó desapercibido.",
  ],
  dt_baja: [
    "El técnico fue frío en la charla táctica de hoy.",
    "Te pusieron en el segundo grupo del entrenamiento sin mucha explicación.",
    "El banco no tuvo mucho para decirte esta semana.",
  ],
  forma_sube: [
    "Buen entrenamiento. Te sentiste suelto.",
    "Las piernas respondieron mejor de lo que esperabas esta semana.",
    "Terminaste los ejercicios con energía de sobra.",
  ],
  forma_baja: [
    "Semana larga. El cuerpo lo acusó más de lo normal.",
    "No fue la mejor semana en el predio.",
    "Algo en el ritmo de los últimos días no terminó de cerrarte.",
  ],
  neutral: [
    "Semana de trabajo. Nada fuera de lo normal.",
    "Entrenamiento de rutina. El grupo se mantuvo concentrado.",
    "Sin novedades desde el predio esta semana.",
    "Trabajo y enfoque. La temporada avanza.",
  ],
};

const PERSONALITY_TYPES = {
  lider: {
    name: "Líder",
    icon: "🦁",
    desc: "Tu personalidad se impone en el vestuario. El grupo te sigue aunque no lo busques.",
    reveal: "Temporada tras temporada, fue quedando claro: no sos solo otro jugador. Cuando hablás, el grupo escucha.",
  },
  solitario: {
    name: "Solitario",
    icon: "🌑",
    desc: "Funcionás solo. No buscás el grupo, no lo necesitás para rendir.",
    reveal: "Con los años quedó claro que tu fuerza es propia. No necesitás al grupo para brillar — aunque a veces el grupo lo resienta.",
  },
  fiestero: {
    name: "Fiestero",
    icon: "🔥",
    desc: "Vivís el fútbol con intensidad, dentro y fuera de la cancha.",
    reveal: "Nadie lo podría negar: sos de los que viven el fútbol en todas sus formas. Eso tiene su costo, y también sus momentos.",
  },
  profesional: {
    name: "Profesional",
    icon: "📋",
    desc: "El trabajo primero. Metódico, reservado, confiable.",
    reveal: "Temporada tras temporada, sin escándalos y sin ruido. Tu carrera habla por sí sola.",
  },
};

// ── STATE ─────────────────────────────────────────────────────────

let state = null;
let creation = { step: 1, position: null, archetype: null, shownArchetypes: [], name: "", countryIdx: 0, clubIdx: 0 };
let currentView = "menu";
let currentMatchId = null;
let pendingPersonalityReveal = null;
let expandedHofIds = new Set();

const SAVE_KEY = "cotrero_v1";

function save() {
  if (state) localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function load() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try { state = JSON.parse(raw); return true; }
  catch { return false; }
}

function hasSave() { return !!localStorage.getItem(SAVE_KEY); }

function deleteSave() { localStorage.removeItem(SAVE_KEY); state = null; }

// ── SALÓN DE LA FAMA ──────────────────────────────────────────────
// Cada carrera que termina (retiro) queda registrada acá, para que las
// próximas partidas tengan algo con qué compararse.
const HOF_KEY = "cotrero_hof";
const HOF_MAX = 20;
let hofRecorded = false; // evita duplicar el registro si se renderiza game_over más de una vez
let weeklyScoreSubmitted = false; // idem, para no mandar el puntaje del reto semanal más de una vez

function getHallOfFame() {
  try {
    const raw = localStorage.getItem(HOF_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

function recordCareerInHallOfFame() {
  if (!state || hofRecorded) return;
  hofRecorded = true;
  const career = state.career;
  const player = state.player;
  const entry = {
    id: `${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    date: Date.now(),
    name: player.name,
    position: player.position,
    club: state.club ? state.club.name : "—",
    country: player.country ? player.country.name : null,
    goals: career.goals,
    assists: career.assists,
    appearances: career.appearances,
    seasons: career.season - 1,
    peakOvr: player.ovr,
    caps: career.caps || 0,
    natGoals: career.natGoals || 0,
    seasonHistory: career.seasonHistory || [],
  };
  const list = [entry, ...getHallOfFame()].sort((a, b) => b.goals - a.goals).slice(0, HOF_MAX);
  try { localStorage.setItem(HOF_KEY, JSON.stringify(list)); } catch { /* almacenamiento lleno: se ignora */ }
}

function shareCareerText() {
  if (!state) return "";
  const career = state.career;
  const player = state.player;
  const rankLabel = career.goals > 150 ? "Leyenda" : career.goals > 80 ? "Ídolo" : career.goals > 40 ? "Crack" : "Jugador correcto";
  return [
    `⚽ Cotrero — Carrera de ${player.name}`,
    `${rankLabel} · ${career.season - 1} temporadas`,
    `${career.goals} goles · ${career.assists} asistencias · ${career.appearances} partidos`,
    `OVR final: ${player.ovr}`,
  ].join("\n");
}

// ── ENGINE ────────────────────────────────────────────────────────

function calcOvr(stats, position) {
  const pos = POSITIONS[position];
  if (!pos) return 60;
  return Math.round(pos.stats.reduce((s, stat) => s + (stats[stat] || 60) * pos.weights[stat], 0));
}

function initStats(position, archetype) {
  const pos = POSITIONS[position];
  const stats = {};
  pos.stats.forEach(s => { stats[s] = 50 + Math.floor(Math.random() * 14); });
  if (archetype && archetype.bonus) {
    Object.entries(archetype.bonus).forEach(([s, v]) => {
      if (stats[s] !== undefined) stats[s] = Math.min(78, stats[s] + v);
    });
  }
  return stats;
}

function randomPotential(ovr, age) {
  const base = ovr + 14 + Math.floor(Math.random() * 14);
  return Math.min(97, Math.max(ovr + 5, base));
}

function getLeagueRivals(club) {
  for (const c of COUNTRIES) {
    if (c.clubs.some(cl => cl.id === club.id)) {
      return c.clubs.filter(cl => cl.id !== club.id);
    }
  }
  return [];
}

function generateMatches(club, season) {
  const rivals = getLeagueRivals(club);
  const allRivals = rivals.length ? rivals : COUNTRIES[0].clubs.filter(c => c.id !== club.id);
  const weeks = [3, 6, 9, 13, 17, 19, 23, 26, 29, 33];
  const types = ["liga", "copa", "liga", "clasico", "liga", "copa", "liga", "clasico", "liga", "liga_final"];

  return weeks.map((week, i) => {
    const rival = allRivals[Math.floor(Math.random() * allRivals.length)];
    return {
      id: `m_s${season}_${i}`,
      week,
      rival: { ...rival },
      type: types[i],
      home: Math.random() > 0.5,
      played: false,
      result: null,
      situation: i % 2 === 0 ? MATCH_SITUATIONS[Math.floor(Math.random() * MATCH_SITUATIONS.length)] : null,
    };
  });
}

function allClubs() {
  return COUNTRIES.flatMap(c => c.clubs.map(cl => ({ ...cl, countryName: c.name, countryFlag: c.flag })));
}

function pickOfferClub(currentClub) {
  const candidates = allClubs().filter(cl => cl.id !== currentClub.id && cl.prestige >= currentClub.prestige - 12);
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function regenerateRemainingMatches(newClub) {
  const remaining = state.schedule.matches.filter(m => m.week >= state.career.week);
  const kept = state.schedule.matches.filter(m => m.week < state.career.week);
  const rivals = getLeagueRivals(newClub);
  const allRivals = rivals.length ? rivals : COUNTRIES[0].clubs.filter(c => c.id !== newClub.id);
  const types = ["liga", "copa", "liga", "clasico", "liga", "copa", "liga", "clasico", "liga", "liga_final"];
  const fresh = remaining.map((m, i) => {
    const rival = allRivals[Math.floor(Math.random() * allRivals.length)];
    return {
      id: `m_s${state.career.season}_transfer_${i}`,
      week: m.week,
      rival: { ...rival },
      type: types[i % types.length],
      home: Math.random() > 0.5,
      played: false,
      result: null,
      situation: i % 2 === 0 ? MATCH_SITUATIONS[Math.floor(Math.random() * MATCH_SITUATIONS.length)] : null,
    };
  });
  state.schedule.matches = [...kept, ...fresh];
}

function pickInjuryType() {
  let r = Math.random(), cum = 0;
  for (const t of INJURY_TYPES) { cum += t.prob; if (r < cum) return t; }
  return INJURY_TYPES[0];
}

function pickDecision() {
  if (Math.random() > 0.45) return null;
  const used = state._usedDecisions || [];
  const pool = DECISIONS_POOL.filter(d => !used.includes(d.id));
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function applyDecisionEffects(decision, optionIdx) {
  const fx = decision.effects[optionIdx];
  let deltaForma = 0, deltaDt = 0;

  if (fx.forma) {
    deltaForma = fx.forma;
    state.player.forma = Math.max(10, Math.min(100, state.player.forma + fx.forma));
  }
  if (fx.dt) {
    deltaDt = fx.dt;
    state.player.dtRelation = Math.max(0, Math.min(100, state.player.dtRelation + fx.dt));
  }
  if (fx.p) {
    Object.entries(fx.p).forEach(([t, v]) => {
      state.player.personality[t] = (state.player.personality[t] || 0) + v;
    });
    checkPersonality();
  }
  if (fx.special) applySpecial(fx.special);

  // Queue indirect feedback flavor
  if (deltaDt > 3) state._nextFlavor = "dt_sube";
  else if (deltaDt < -3) state._nextFlavor = "dt_baja";
  else if (deltaForma > 3) state._nextFlavor = "forma_sube";
  else if (deltaForma < -3) state._nextFlavor = "forma_baja";

  if (!state._usedDecisions) state._usedDecisions = [];
  state._usedDecisions.push(decision.id);
  if (state._usedDecisions.length > 12) state._usedDecisions.shift();
}

function applySpecial(id) {
  switch (id) {
    case "foto_condicional":
      if (state.player.forma < 55) state.player.forma = Math.max(10, state.player.forma - 5);
      break;
    case "presion_clasico":
      state._clasicoPressure = true;
      break;
    case "arenga_condicional":
      if ((state.player.personality.lider || 0) >= 3) {
        state.player.forma = Math.min(100, state.player.forma + 6);
        addNews("Tu voz en el vestuario tuvo un efecto que no esperabas.");
      }
      break;
    case "cansancio_fiesta":
      state.player.forma = Math.max(10, state.player.forma - 9);
      break;
    case "interes_mercado":
      state._marketInterest = true;
      break;
    case "arenga_lider":
      if ((state.player.personality.lider || 0) >= 5) {
        state.player.forma = Math.min(100, state.player.forma + 8);
        addNews("El grupo respondió. Algo en tu tono fue diferente.");
      }
      break;
    case "polemica_media":
      if (Math.random() > 0.5) state.player.forma = Math.min(100, state.player.forma + 3);
      else { state.player.forma = Math.max(10, state.player.forma - 4); state.player.dtRelation = Math.max(0, state.player.dtRelation - 3); }
      break;
    case "descanso_condicional":
      state.player.forma = Math.min(100, state.player.forma + (state.player.forma < 60 ? 8 : 3));
      break;
    case "carga_riesgo":
      if (Math.random() > 0.6) state.player.injuryRisk = Math.min(100, state.player.injuryRisk + 8);
      break;
    case "tension_latente":
      state.player.dtRelation = Math.max(0, state.player.dtRelation - 2);
      break;
    default: break;
  }
}

function checkPersonality() {
  if (state.player.personalityRevealed) return;
  const p = state.player.personality;
  const max = Math.max(p.lider, p.solitario, p.fiestero, p.profesional);
  if (max >= 8) {
    const type = Object.entries(p).find(([, v]) => v === max)[0];
    state.player.personalityRevealed = type;
    pendingPersonalityReveal = type;
  }
}

function resolveMatch(matchId, situationChoice) {
  const match = state.schedule.matches.find(m => m.id === matchId);
  if (!match || match.played) return null;

  const injured = !!state.player.injuryStatus;
  const ovr = injured ? Math.round(state.club.prestige * 0.78) : state.player.ovr;
  const forma = injured ? 55 : state.player.forma;
  const homeBonus = match.home ? 5 : -3;
  const rivalStr = (match.rival.prestige || 70) * 0.68 + Math.random() * 15;
  const myStr = ovr + (forma - 50) * 0.25 + homeBonus + (Math.random() * 18 - 9);

  // Situation modifier (no aplica si el jugador no está en cancha)
  let sitMod = 0;
  if (!injured && situationChoice !== null && situationChoice !== undefined && match.situation) {
    const sfx = match.situation.effects[situationChoice];
    sitMod = (sfx.rendimiento || 0) * 3;
    if ((sfx.riesgo || 0) > 0 && Math.random() < 0.3) sitMod -= 5;
  }

  // Clasico pressure
  if (!injured && match.type === "clasico" && state._clasicoPressure) {
    sitMod += Math.random() > 0.5 ? 8 : -8;
    delete state._clasicoPressure;
  }

  const finalMy = myStr + sitMod;
  const diff = finalMy - rivalStr;
  const win = diff > 3;
  const draw = Math.abs(diff) <= 3;
  const loss = !win && !draw;

  // Player stats
  let goals = 0, assists = 0;
  const pos = state.player.position;
  if (!injured && (win || draw)) {
    if (pos === "delantero") {
      if (Math.random() < 0.45) goals = 1;
      if (Math.random() < 0.18) goals = 2;
      if (Math.random() < 0.25) assists = 1;
    } else if (pos === "mediocampista") {
      if (Math.random() < 0.18) goals = 1;
      if (Math.random() < 0.38) assists = 1;
      if (Math.random() < 0.1) assists = 2;
    } else {
      if (Math.random() < 0.1) goals = 1;
      if (Math.random() < 0.16) assists = 1;
    }
  }

  // El marcador siempre respeta win/draw/loss (antes se sorteaban por separado
  // y podían contradecirse, ej. "Victoria" con 1-1).
  let teamGoals, rivalGoals;
  if (win) {
    rivalGoals = Math.floor(Math.random() * 2);
    teamGoals = rivalGoals + 1 + Math.floor(Math.random() * 2);
  } else if (loss) {
    teamGoals = Math.floor(Math.random() * 2);
    rivalGoals = teamGoals + 1 + Math.floor(Math.random() * 2);
  } else {
    teamGoals = rivalGoals = Math.floor(Math.random() * 3);
  }

  const result = { win, draw, loss, teamGoals, rivalGoals, goals, assists, injured };
  match.played = true;
  match.result = result;

  if (!injured) {
    // Update career stats
    state.career.goals += goals;
    state.career.assists += assists;
    state.career.seasonGoals += goals;
    state.career.seasonAssists += assists;
    state.career.appearances += 1;

    // Forma update
    if (win) state.player.forma = Math.min(100, state.player.forma + 6);
    else if (loss) state.player.forma = Math.max(10, state.player.forma - 7);
  }

  return result;
}

function advanceWeek() {
  state.career.week++;

  // Flavor feedback from last week
  const flavor = state._nextFlavor;
  delete state._nextFlavor;
  if (flavor) {
    const texts = FLAVOR_TEXTS[flavor];
    addNews(texts[Math.floor(Math.random() * texts.length)]);
  } else if (Math.random() > 0.55) {
    const texts = FLAVOR_TEXTS.neutral;
    addNews(texts[Math.floor(Math.random() * texts.length)]);
  }

  // Weekly forma drift (slight)
  state.player.forma = Math.max(10, Math.min(100, state.player.forma + (Math.random() * 4 - 2)));

  // ── Lesiones ──
  if (state.player.injuryStatus) {
    state.player.injuryStatus.weeksLeft--;
    if (state.player.injuryStatus.weeksLeft <= 0) {
      addNews(`Te recuperaste de tu ${state.player.injuryStatus.name.toLowerCase()}. Volvés a estar disponible.`, true);
      state.player.injuryStatus = null;
      state.player.injuryRisk = Math.max(10, state.player.injuryRisk - 20);
    }
  } else {
    const weeklyChance = 0.015 + (state.player.injuryRisk / 100) * 0.05;
    if (Math.random() < weeklyChance) {
      const type = pickInjuryType();
      state.player.injuryStatus = { name: type.name, weeksLeft: type.weeks };
      state.player.forma = Math.max(10, state.player.forma - 6);
      addNews(`🩹 Sufriste ${type.name.toLowerCase()}. Vas a estar afuera ${type.weeks} semana${type.weeks === 1 ? "" : "s"}.`, true);
    } else {
      state.player.injuryRisk = Math.max(10, state.player.injuryRisk - 1);
    }
  }

  // ── Oferta de mercado (si tu representante mencionó interés en una decisión reciente) ──
  if (state._marketInterest) {
    delete state._marketInterest;
    if (!state.pendingOffer && Math.random() < 0.6) {
      const offerClub = pickOfferClub(state.club);
      if (offerClub) {
        state.pendingOffer = { club: offerClub };
        addNews(`📩 ${offerClub.name} formalizó una oferta por vos.`, true);
      }
    }
  }

  // ── Convocatoria a la selección ──
  if (INTL_WINDOWS.includes(state.career.week) && state.player.ovr >= 72 && state.player.country) {
    const callChance = Math.max(0.05, Math.min(0.8, (state.player.ovr - 70) / 40));
    if (Math.random() < callChance) {
      state.career.caps = (state.career.caps || 0) + 1;
      const scored = Math.random() < 0.3;
      if (scored) state.career.natGoals = (state.career.natGoals || 0) + 1;
      addNews(
        `${state.player.country.flag} Convocatoria a la Selección de ${state.player.country.name}. ${scored ? "Anotaste con la camiseta nacional." : "Sumaste minutos con la selección."}`,
        true
      );
      state.player.forma = Math.max(10, state.player.forma - 4);
    }
  }

  // New decision for this week
  state.schedule.decisionUsed = false;
  state.schedule.currentDecision = pickDecision();

  save();
}

function startNewSeason() {
  state.player.age++;

  // Stat growth
  const pos = POSITIONS[state.player.position];
  const age = state.player.age;
  const declineAge = 27 + Math.round((state.player.stats.resistencia || 60) / 12);

  if (age < declineAge) {
    const growRate = age <= 19 ? 3 : age <= 22 ? 2.2 : age <= 25 ? 1.4 : 0.7;
    pos.stats.forEach(s => {
      const gap = state.player.potential - (state.player.stats[s] || 60);
      if (gap > 0) {
        const delta = Math.floor(Math.random() * growRate * (gap / 25 + 0.3));
        if (delta > 0) state.player.stats[s] = Math.min(97, (state.player.stats[s] || 60) + delta);
      }
    });
    state.player.ovr = calcOvr(state.player.stats, state.player.position);
  } else {
    // Decline
    if (!state._declineStarted) {
      state._declineStarted = true;
      addNews("Algo cambió. Las piernas ya no responden igual que antes.");
    }
    const declineStat = pos.stats.filter(s => s !== "resistencia")[Math.floor(Math.random() * (pos.stats.length - 1))];
    state.player.stats[declineStat] = Math.max(40, state.player.stats[declineStat] - Math.ceil(Math.random() * 2));
    state.player.ovr = calcOvr(state.player.stats, state.player.position);
  }

  // Guarda el resumen de la temporada que termina, para el detalle del Salón de la Fama.
  if (!state.career.seasonHistory) state.career.seasonHistory = [];
  state.career.seasonHistory.push({
    season: state.career.season,
    age: state.player.age,
    club: state.club.name,
    goals: state.career.seasonGoals,
    assists: state.career.seasonAssists,
    ovr: state.player.ovr,
  });

  // Buen rendimiento sostenido también genera interés de otros clubes, más allá
  // de lo que dispare la decisión del representante.
  if (!state.pendingOffer && state.career.seasonGoals >= 12 && Math.random() < 0.35) {
    const offerClub = pickOfferClub(state.club);
    if (offerClub) {
      state.pendingOffer = { club: offerClub };
      addNews(`📩 Tu temporada llamó la atención: ${offerClub.name} quiere ficharte.`, true);
    }
  }

  // New season
  state.career.season++;
  state.career.week = 0;
  state.career.seasonGoals = 0;
  state.career.seasonAssists = 0;
  state.schedule = {
    matches: generateMatches(state.club, state.career.season),
    currentDecision: null,
    decisionUsed: false,
  };

  // Check retirement
  if (state.player.age >= 37 || (state.player.ovr < 58 && state.player.age >= 32)) {
    navigate("game_over");
    return;
  }

  save();
}

function addNews(text, highlight = false) {
  state.news.unshift({ text, highlight });
  state.news = state.news.slice(0, 6);
}

function initNewGame(name, position, archetype, club, country) {
  const stats = initStats(position, archetype);
  const ovr = calcOvr(stats, position);
  state = {
    player: {
      name,
      position,
      archetype: archetype ? archetype.id : null,
      archetypeName: archetype ? archetype.name : null,
      country: country ? { name: country.name, flag: country.flag } : null,
      age: 16,
      stats,
      ovr,
      forma: 58,
      potential: randomPotential(ovr, 16),
      dtRelation: 50,
      injuryRisk: 15,
      injuryStatus: null,
      personality: { lider: 0, solitario: 0, fiestero: 0, profesional: 0 },
      personalityRevealed: null,
    },
    club,
    pendingOffer: null,
    career: {
      season: 1,
      week: 0,
      goals: 0,
      assists: 0,
      appearances: 0,
      seasonGoals: 0,
      seasonAssists: 0,
      trophies: [],
      caps: 0,
      natGoals: 0,
      seasonHistory: [],
    },
    schedule: {
      matches: generateMatches(club, 1),
      currentDecision: null,
      decisionUsed: false,
    },
    news: [
      { text: `Tu carrera arranca hoy. Primera semana en ${club.name}.`, highlight: true },
    ],
    _usedDecisions: [],
  };
  // Pick first decision after state is ready
  state.schedule.currentDecision = pickDecision();
  save();
}

// ── ROUTER ────────────────────────────────────────────────────────

function navigate(view, params = {}) {
  currentView = view;
  if (params.matchId !== undefined) currentMatchId = params.matchId;
  render();
}

function render() {
  const app = document.getElementById("app");
  switch (currentView) {
    case "menu":       app.innerHTML = renderMenu(); break;
    case "creation":   app.innerHTML = renderCreation(); break;
    case "hub":        app.innerHTML = renderHub(); break;
    case "decision":   app.innerHTML = renderDecision(); break;
    case "match":      app.innerHTML = renderMatch(); break;
    case "season_end": app.innerHTML = renderSeasonEnd(); break;
    case "game_over":  app.innerHTML = renderGameOver(); break;
    case "hall_of_fame": app.innerHTML = renderHallOfFame(); break;
    default:           app.innerHTML = renderMenu();
  }
  attachEvents();
}

// ── VIEWS ─────────────────────────────────────────────────────────

function renderMenu() {
  const saveExists = hasSave();
  return `
    <div class="screen menu-screen fade-in">
      <div class="logo-block">
        <div class="logo">COTRERO</div>
        <div class="logo-sub">Modo Especialista</div>
      </div>
      <div class="menu-btns">
        <button class="btn btn-primary" data-action="new_game">Nueva carrera</button>
        ${saveExists ? `<button class="btn btn-outline" data-action="continue_game">Continuar</button>` : ""}
        <button class="btn btn-outline" data-action="weekly_challenge">🗓 Reto semanal · ranking de grupo</button>
        <button class="btn btn-outline" data-action="view_hof">🏛 Salón de la fama</button>
        ${saveExists ? `<button class="btn btn-ghost" data-action="delete_save">Borrar partida</button>` : ""}
      </div>
    </div>
  `;
}

function renderCreation() {
  const step = creation.step;
  if (step === 1) return renderCreationStep1();
  if (step === 2) return renderCreationStep2();
  if (step === 3) return renderCreationStep3();
  return "";
}

function renderCreationStep1() {
  return `
    <div class="screen creation-screen fade-in">
      <div class="step-header container">
        <div class="step-label">Paso 1 de 3</div>
        <div class="step-title">¿Cuál es tu posición?</div>
        <div class="step-desc">Define cómo jugás y qué atributos importan más.</div>
      </div>
      <div class="cards-grid container">
        ${Object.entries(POSITIONS).map(([key, pos]) => `
          <button class="sel-card ${creation.position === key ? "selected" : ""}" data-action="select_position" data-pos="${key}">
            <span class="sel-card-icon">${pos.icon}</span>
            <div class="sel-card-name">${pos.label}</div>
            <div class="sel-card-desc">${pos.desc}</div>
          </button>
        `).join("")}
      </div>
      <div class="creation-footer container">
        <button class="btn btn-outline" style="max-width:120px" data-action="go_menu">Volver</button>
        <button class="btn btn-primary" data-action="creation_next1" ${!creation.position ? "disabled" : ""}>Siguiente →</button>
      </div>
    </div>
  `;
}

function renderCreationStep2() {
  const archetypes = creation.shownArchetypes;
  const badgeClass = { common: "badge-common", rare: "badge-rare", legendary: "badge-legendary" };
  const badgeLabel = { common: "Común", rare: "Raro", legendary: "Legendario" };

  return `
    <div class="screen creation-screen fade-in">
      <div class="step-header container">
        <div class="step-label">Paso 2 de 3</div>
        <div class="step-title">Elegí tu arquetipo</div>
        <div class="step-desc">Define de dónde viene tu juego. Esta elección es permanente.</div>
      </div>
      <div class="cards-grid container">
        ${archetypes.map(arch => `
          <button class="sel-card ${creation.archetype && creation.archetype.id === arch.id ? "selected" : ""}"
            data-action="select_archetype" data-arch="${arch.id}">
            <div class="sel-card-name">${arch.name}</div>
            <div class="sel-card-desc">${arch.desc}</div>
            <span class="sel-card-badge ${badgeClass[arch.rareza]}">${badgeLabel[arch.rareza]}</span>
          </button>
        `).join("")}
      </div>
      <div class="creation-footer container">
        <button class="btn btn-outline" style="max-width:120px" data-action="creation_back2">Volver</button>
        <button class="btn btn-primary" data-action="creation_next2" ${!creation.archetype ? "disabled" : ""}>Siguiente →</button>
      </div>
    </div>
  `;
}

function renderCreationStep3() {
  const country = COUNTRIES[creation.countryIdx];
  return `
    <div class="screen creation-screen fade-in">
      <div class="step-header container">
        <div class="step-label">Paso 3 de 3</div>
        <div class="step-title">Tu identidad</div>
        <div class="step-desc">Nombre y club donde empezás tu carrera.</div>
      </div>
      <div class="container">
        <div class="form-group">
          <label class="form-label">Nombre del jugador</label>
          <input class="form-input" type="text" placeholder="Escribí tu nombre..." maxlength="30"
            data-action="set_name" value="${creation.name}" />
        </div>
        <div class="form-group">
          <label class="form-label">País</label>
          <select class="form-select" data-action="set_country">
            ${COUNTRIES.map((c, i) => `<option value="${i}" ${i === creation.countryIdx ? "selected" : ""}>${c.flag} ${c.name}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Club inicial</label>
          <select class="form-select" data-action="set_club">
            ${country.clubs.map((cl, i) => `<option value="${i}" ${i === creation.clubIdx ? "selected" : ""}>${cl.name} (Nivel ${cl.tier})</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="creation-footer container">
        <button class="btn btn-outline" style="max-width:120px" data-action="creation_back3">Volver</button>
        <button class="btn btn-primary" data-action="start_game" ${!creation.name.trim() ? "disabled" : ""}>Empezar carrera</button>
      </div>
    </div>
  `;
}

function renderHub() {
  const p = state.player;
  const pos = POSITIONS[p.position];
  const career = state.career;
  const schedule = state.schedule;

  const formaColor = p.forma >= 70 ? "#3FAE9A" : p.forma >= 45 ? "#D9A441" : "#F0907E";
  const weekProgress = Math.round((career.week / 34) * 100);

  // Next important match
  const upcoming = schedule.matches.filter(m => !m.played && m.week >= career.week).sort((a, b) => a.week - b.week)[0];
  const weeksToMatch = upcoming ? upcoming.week - career.week : null;

  // Season end check
  const seasonDone = career.week >= 34;

  return `
    <div class="screen hub-screen fade-in">
      <div class="hub-topbar">
        <div class="hub-logo">COTRERO</div>
        <div class="hub-week">Temporada ${career.season} · Semana ${career.week}/34</div>
      </div>

      <div class="week-progress">
        <div class="week-progress-fill" style="width:${weekProgress}%"></div>
      </div>

      <div class="hub-body">
        <!-- Player card -->
        <div class="card player-card">
          <div class="card-body">
            <div class="player-identity">
              <div class="player-pos-badge">${pos.icon}</div>
              <div>
                <div class="player-name">${p.name}</div>
                <div class="player-meta">${p.country ? p.country.flag + " " : ""}${pos.label} · ${p.age} años · ${state.club.name}</div>
                ${p.archetypeName ? `<div class="player-meta" style="margin-top:2px;color:var(--gold-dim)">${p.archetypeName}</div>` : ""}
                ${career.caps ? `<div class="player-meta" style="margin-top:2px">${career.caps} caps${career.natGoals ? ` · ${career.natGoals} goles con la selección` : ""}</div>` : ""}
              </div>
              <div style="margin-left:auto;text-align:right">
                <div class="ovr-number">${p.ovr}</div>
                <div class="ovr-label">OVR</div>
              </div>
            </div>

            <div class="stats-grid">
              ${pos.stats.map(s => {
                const val = p.stats[s] || 60;
                return `
                  <div class="stat-row">
                    <div class="stat-name">${pos.labels[s]}</div>
                    <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${val}%"></div></div>
                    <div class="stat-value">${val}</div>
                  </div>
                `;
              }).join("")}
            </div>

            <div class="forma-row">
              <div class="forma-label">Forma</div>
              <div class="forma-bar-bg">
                <div class="forma-bar-fill" style="width:${p.forma}%;background:${formaColor}"></div>
              </div>
              <div class="forma-value" style="color:${formaColor}">${p.forma}</div>
            </div>

            ${p.personalityRevealed ? `
              <div style="margin-top:12px;padding:10px 12px;background:var(--gold-subtle);border:1px solid var(--gold-border);border-radius:6px;display:flex;align-items:center;gap:8px">
                <span style="font-size:18px">${PERSONALITY_TYPES[p.personalityRevealed].icon}</span>
                <span style="font-size:13px;color:var(--gold)">${PERSONALITY_TYPES[p.personalityRevealed].name}</span>
              </div>
            ` : ""}

            ${p.injuryStatus ? `
              <div style="margin-top:12px;padding:10px 12px;background:rgba(240,144,126,0.12);border:1px solid rgba(240,144,126,0.3);border-radius:6px;display:flex;align-items:center;gap:8px">
                <span style="font-size:18px">🩹</span>
                <span style="font-size:13px;color:var(--danger)">${p.injuryStatus.name} — ${p.injuryStatus.weeksLeft} sem. restantes</span>
              </div>
            ` : ""}
          </div>
        </div>

        <!-- Oferta de fichaje -->
        ${state.pendingOffer ? `
          <div class="card" style="border-color:var(--gold-border)">
            <div class="card-header">📩 Oferta de fichaje</div>
            <div class="card-body">
              <div style="font-size:14px;margin-bottom:12px">
                <strong>${state.pendingOffer.club.name}</strong> ${state.pendingOffer.club.countryFlag || ""} quiere ficharte
                (nivel ${state.pendingOffer.club.tier}).
              </div>
              <div style="display:flex;gap:8px">
                <button class="btn btn-primary" style="flex:1" data-action="accept_offer">Aceptar</button>
                <button class="btn btn-outline" style="flex:1" data-action="reject_offer">Rechazar</button>
              </div>
            </div>
          </div>
        ` : ""}

        <!-- Actions this week -->
        <div class="card">
          <div class="card-header">Esta semana</div>
          <div>
            ${schedule.currentDecision && !schedule.decisionUsed ? `
              <div class="action-item" data-action="open_decision">
                <div class="action-dot pulse" style="background:var(--gold)"></div>
                <div>
                  <div class="action-text">Hay una decisión pendiente</div>
                  <div class="action-sub">Podés resolverla cuando quieras antes de avanzar</div>
                </div>
                <div class="action-arrow">→</div>
              </div>
            ` : schedule.currentDecision && schedule.decisionUsed ? `
              <div class="action-item disabled">
                <div class="action-dot" style="background:var(--text-dim)"></div>
                <div class="action-text">Ya decidiste esta semana</div>
              </div>
            ` : `
              <div class="action-item disabled">
                <div class="action-dot" style="background:var(--text-dim)"></div>
                <div class="action-text">Sin decisiones esta semana</div>
              </div>
            `}

            ${upcoming && weeksToMatch === 0 ? `
              <div class="action-item" data-action="play_match" data-match="${upcoming.id}">
                <div class="action-dot pulse" style="background:#E74C3C"></div>
                <div>
                  <div class="action-text">⚽ Partido hoy: vs ${upcoming.rival.name}</div>
                  <div class="action-sub">${matchTypeLabel(upcoming.type)} · ${upcoming.home ? "Local" : "Visitante"}</div>
                </div>
                <div class="action-arrow">→</div>
              </div>
            ` : upcoming ? `
              <div class="action-item disabled">
                <div class="action-dot" style="background:var(--text-dim)"></div>
                <div>
                  <div class="action-text">Próximo: vs ${upcoming.rival.name} (en ${weeksToMatch} sem.)</div>
                  <div class="action-sub">${matchTypeLabel(upcoming.type)}</div>
                </div>
              </div>
            ` : ""}
          </div>
        </div>

        <!-- Season stats -->
        <div class="card">
          <div class="card-header">Temporada ${career.season}</div>
          <div class="card-body" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;text-align:center">
            <div>
              <div style="font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:900;color:var(--gold)">${career.seasonGoals}</div>
              <div class="text-xs text-muted" style="letter-spacing:1px;text-transform:uppercase">Goles</div>
            </div>
            <div>
              <div style="font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:900;color:var(--gold)">${career.seasonAssists}</div>
              <div class="text-xs text-muted" style="letter-spacing:1px;text-transform:uppercase">Asistencias</div>
            </div>
            <div>
              <div style="font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:900;color:var(--text)">${career.appearances}</div>
              <div class="text-xs text-muted" style="letter-spacing:1px;text-transform:uppercase">Partidos</div>
            </div>
          </div>
        </div>

        <!-- News -->
        ${state.news.length ? `
          <div class="card">
            <div class="card-header">Novedades</div>
            <div class="card-body" style="padding-top:8px">
              <div class="news-list">
                ${state.news.map(n => `
                  <div class="news-item ${n.highlight ? "highlight" : ""}">${n.text}</div>
                `).join("")}
              </div>
            </div>
          </div>
        ` : ""}

        <!-- Advance week / season end -->
        ${seasonDone ? `
          <button class="btn btn-primary" data-action="end_season">Ver resumen de temporada →</button>
        ` : `
          <button class="btn btn-primary" data-action="advance_week">Avanzar semana →</button>
        `}

        <div style="height:20px"></div>
      </div>
    </div>
  `;
}

function renderDecision() {
  const d = state.schedule.currentDecision;
  if (!d) { navigate("hub"); return ""; }
  const letters = ["A", "B", "C"];
  return `
    <div class="screen decision-screen fade-in">
      <div class="step-header container">
        <div class="step-label">Decisión · Semana ${state.career.week}</div>
        <div class="step-title">Una situación</div>
      </div>

      <div class="decision-context container">${d.context}</div>

      <div class="options-list container">
        ${d.options.map((opt, i) => `
          <button class="option-btn" data-action="make_decision" data-idx="${i}">
            <span class="option-letter">${letters[i]}</span>
            <span>${opt.text}</span>
          </button>
        `).join("")}
      </div>

      <p class="decision-note container">Las consecuencias de cada elección no siempre son evidentes.<br>A veces la opción que parece más segura no lo es.</p>

      <div style="margin-top:20px" class="container">
        <button class="btn btn-ghost" data-action="close_decision">← Volver sin decidir</button>
      </div>
    </div>
  `;
}

function renderMatch() {
  const match = state.schedule.matches.find(m => m.id === currentMatchId);
  if (!match) { navigate("hub"); return ""; }
  const typeLabel = matchTypeLabel(match.type);
  const isClasico = match.type === "clasico";

  return `
    <div class="screen match-screen fade-in">
      <div class="match-header">
        <div class="${isClasico ? "match-type-badge clasico" : "match-type-badge"}">${typeLabel}</div>
        <div class="match-scoreboard">
          <div class="match-team-name">${state.player.name}</div>
          <div class="match-score">vs</div>
          <div class="match-team-name">${match.rival.name}</div>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:6px">${match.home ? "🏠 Local" : "✈️ Visitante"}</div>
      </div>

      <div class="match-body container">
        ${state.player.injuryStatus ? `
          <div class="card" style="padding:20px;text-align:center">
            <div style="font-size:14px;color:var(--danger);line-height:1.6">
              🩹 Estás lesionado (${state.player.injuryStatus.name}, ${state.player.injuryStatus.weeksLeft} sem. restantes).
              El equipo juega sin vos.
            </div>
          </div>
          <button class="btn btn-primary" data-action="resolve_match_sim" data-match="${match.id}">
            Ver resultado
          </button>
        ` : match.situation ? `
          <div class="situation-box">
            <div class="situation-label">Situación táctica</div>
            <div class="situation-text">${match.situation.text}</div>
          </div>
          <div class="options-list" style="margin-bottom:0">
            ${match.situation.options.map((opt, i) => `
              <button class="option-btn" data-action="resolve_match_with_sit" data-match="${match.id}" data-sit="${i}">
                <span class="option-letter">${["A","B","C"][i]}</span>
                <span>${opt.text}</span>
              </button>
            `).join("")}
          </div>
          <button class="btn btn-outline" data-action="resolve_match_sim" data-match="${match.id}">
            Simular sin decidir
          </button>
        ` : `
          <div class="card" style="padding:20px;text-align:center">
            <div style="font-size:14px;color:var(--text-muted);line-height:1.6">
              Partido sin situación táctica especial. El resultado depende de tu nivel y forma actual.
            </div>
          </div>
          <button class="btn btn-primary" data-action="resolve_match_sim" data-match="${match.id}">
            Jugar partido
          </button>
        `}

        <button class="btn btn-ghost" data-action="go_hub">← Volver al Hub</button>
      </div>
    </div>
  `;
}

function renderMatchResult(result, match) {
  const resultLabel = result.win ? "Victoria" : result.draw ? "Empate" : "Derrota";
  const resultColor = result.win ? "var(--success)" : result.draw ? "var(--gold)" : "var(--danger)";
  const resultIcon = result.win ? "🏆" : result.draw ? "🤝" : "😤";

  return `
    <div class="screen season-end-screen fade-in">
      <div class="season-trophy">${resultIcon}</div>
      <div class="season-result-title" style="color:${resultColor}">${resultLabel}</div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:700;text-align:center;color:var(--text);margin-top:8px">
        ${result.teamGoals} — ${result.rivalGoals}
      </div>
      <div style="font-size:13px;color:var(--text-muted);text-align:center;margin-top:4px">vs ${match.rival.name}</div>

      <div class="match-pitch">
        <div class="pitch-center-line"></div>
        <div class="pitch-center-circle"></div>
        <div class="pitch-half">
          <div class="pitch-team-label">${state.player.name}</div>
          <div class="pitch-goal-dots">${"⚽".repeat(result.teamGoals) || "—"}</div>
        </div>
        <div class="pitch-half">
          <div class="pitch-team-label">${match.rival.name}</div>
          <div class="pitch-goal-dots">${"⚽".repeat(result.rivalGoals) || "—"}</div>
        </div>
      </div>

      ${result.injured ? `
        <p style="text-align:center;color:var(--danger);font-size:13px;margin-top:4px">🩹 No jugaste este partido por lesión.</p>
      ` : `
        <div class="stats-summary">
          <div class="stat-summary-box">
            <div class="stat-summary-number">${result.goals}</div>
            <div class="stat-summary-label">Goles tuyos</div>
          </div>
          <div class="stat-summary-box">
            <div class="stat-summary-number">${result.assists}</div>
            <div class="stat-summary-label">Asistencias</div>
          </div>
        </div>
      `}

      <div style="width:100%;max-width:480px">
        <button class="btn btn-primary" data-action="go_hub">Volver al Hub →</button>
      </div>
    </div>
  `;
}

function renderSeasonEnd() {
  const career = state.career;
  const prevSeason = career.season;
  return `
    <div class="screen season-end-screen fade-in">
      <div class="season-trophy">📅</div>
      <div class="season-result-title">Temporada ${prevSeason}</div>
      <div style="font-size:14px;color:var(--text-muted);text-align:center;margin-top:4px">Resumen de la temporada</div>

      <div class="stats-summary">
        <div class="stat-summary-box">
          <div class="stat-summary-number">${career.seasonGoals}</div>
          <div class="stat-summary-label">Goles</div>
        </div>
        <div class="stat-summary-box">
          <div class="stat-summary-number">${career.seasonAssists}</div>
          <div class="stat-summary-label">Asistencias</div>
        </div>
        <div class="stat-summary-box">
          <div class="stat-summary-number">${state.player.ovr}</div>
          <div class="stat-summary-label">OVR actual</div>
        </div>
        <div class="stat-summary-box">
          <div class="stat-summary-number">${state.player.age}</div>
          <div class="stat-summary-label">Edad</div>
        </div>
      </div>

      ${pendingPersonalityReveal ? `
        <div class="personality-reveal">
          <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--gold-dim)">Tu personalidad se reveló</div>
          <div class="personality-name">${PERSONALITY_TYPES[pendingPersonalityReveal].icon} ${PERSONALITY_TYPES[pendingPersonalityReveal].name}</div>
          <div class="personality-desc">${PERSONALITY_TYPES[pendingPersonalityReveal].reveal}</div>
        </div>
      ` : ""}

      <div style="width:100%;max-width:480px">
        <button class="btn btn-primary" data-action="next_season">Siguiente temporada →</button>
      </div>
    </div>
  `;
}

function renderGameOver() {
  const wasWeeklyChallenge = !!(state && state.isWeeklyChallenge) && !weeklyScoreSubmitted;
  recordCareerInHallOfFame();
  if (wasWeeklyChallenge && state) {
    weeklyScoreSubmitted = true;
    var trophyCount = (state.career.trophies || []).length;
    var finalScore = Math.round(
      state.player.ovr * 5 + state.career.goals * 2 + state.career.assists * 1.5 + trophyCount * 15
    );
    submitChallengeScore("cotrero", finalScore);
  }
  const career = state ? state.career : { goals: 0, assists: 0, appearances: 0, season: 1 };
  const player = state ? state.player : { name: "—", ovr: 0, age: 37 };
  const rankLabel = career.goals > 150 ? "Leyenda" : career.goals > 80 ? "Ídolo" : career.goals > 40 ? "Crack" : "Jugador correcto";

  return `
    <div class="screen game-over-screen fade-in">
      <div class="logo-block">
        <div class="logo" style="font-size:48px">FIN</div>
        <div class="logo-sub">Carrera de ${player.name}</div>
      </div>
      <div class="stats-summary" style="width:100%;max-width:480px">
        <div class="stat-summary-box">
          <div class="stat-summary-number">${career.goals}</div>
          <div class="stat-summary-label">Goles</div>
        </div>
        <div class="stat-summary-box">
          <div class="stat-summary-number">${career.assists}</div>
          <div class="stat-summary-label">Asistencias</div>
        </div>
        <div class="stat-summary-box">
          <div class="stat-summary-number">${career.appearances}</div>
          <div class="stat-summary-label">Partidos</div>
        </div>
        <div class="stat-summary-box">
          <div class="stat-summary-number">${career.season - 1}</div>
          <div class="stat-summary-label">Temporadas</div>
        </div>
      </div>
      ${career.caps ? `
        <div class="stats-summary" style="width:100%;max-width:480px">
          <div class="stat-summary-box">
            <div class="stat-summary-number">${career.caps}</div>
            <div class="stat-summary-label">Caps selección</div>
          </div>
          <div class="stat-summary-box">
            <div class="stat-summary-number">${career.natGoals || 0}</div>
            <div class="stat-summary-label">Goles selección</div>
          </div>
        </div>
      ` : ""}
      <div class="personality-reveal" style="max-width:480px;width:100%">
        <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--gold-dim)">Legado</div>
        <div class="personality-name">${rankLabel}</div>
      </div>
      <div style="width:100%;max-width:480px;margin-top:8px;display:flex;flex-direction:column;gap:8px">
        <button class="btn btn-outline" data-action="share_result">📋 Compartir resultado</button>
        <button class="btn btn-ghost" data-action="view_hof">🏛 Salón de la fama</button>
        <button class="btn btn-primary" data-action="new_game_after">Nueva carrera</button>
      </div>
    </div>
  `;
}

function renderHallOfFame() {
  const list = getHallOfFame();
  return `
    <div class="screen fade-in" style="max-width:520px;margin:0 auto">
      <div class="logo-block">
        <div class="logo" style="font-size:32px">🏛 Salón de la Fama</div>
        <div class="logo-sub">Tus mejores carreras, ordenadas por goles</div>
      </div>
      ${!list.length ? `
        <p style="color:var(--text-muted);text-align:center;margin-top:16px">Todavía no terminaste ninguna carrera.</p>
      ` : `
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">
          ${list.map((e, i) => {
            const expanded = expandedHofIds.has(e.id);
            return `
            <div class="stat-summary-box hof-entry" data-action="toggle_hof" data-id="${e.id}" style="text-align:left;padding:12px 16px;cursor:pointer">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                  <div style="font-weight:700">${i + 1}. ${e.name}</div>
                  <div style="font-size:12px;color:var(--text-muted)">
                    ${e.position} · ${e.club} · ${e.seasons} temporadas${e.caps ? ` · ${e.caps} caps` : ""}
                  </div>
                </div>
                <div style="text-align:right">
                  <div style="font-weight:700;color:var(--gold-dim)">${e.goals} goles</div>
                  <div style="font-size:12px;color:var(--text-muted)">${e.assists} asist. · OVR ${e.peakOvr}</div>
                </div>
              </div>
              ${expanded ? `
                <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
                  ${e.seasonHistory && e.seasonHistory.length ? e.seasonHistory.map(s => `
                    <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);padding:3px 0">
                      <span>Temp. ${s.season} · ${s.club} · ${s.age} años</span>
                      <span>${s.goals}g ${s.assists}a · OVR ${s.ovr}</span>
                    </div>
                  `).join("") : `<div style="font-size:12px;color:var(--text-dim)">Sin detalle temporada a temporada.</div>`}
                  ${e.country ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px">Selección: ${e.country}${e.natGoals ? ` · ${e.natGoals} goles` : ""}</div>` : ""}
                </div>
              ` : `<div style="font-size:11px;color:var(--text-dim);margin-top:6px">Tocá para ver el detalle temporada a temporada</div>`}
            </div>
          `;
          }).join("")}
        </div>
      `}
      <div style="width:100%;margin-top:16px">
        <button class="btn btn-outline" data-action="go_menu">← Volver al menú</button>
      </div>
    </div>
  `;
}

// ── HELPERS ───────────────────────────────────────────────────────

function matchTypeLabel(type) {
  const labels = {
    liga: "Liga",
    copa: "Copa",
    clasico: "Clásico",
    liga_final: "Última jornada",
  };
  return labels[type] || "Partido";
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── EVENTS ────────────────────────────────────────────────────────

function attachEvents() {
  document.querySelectorAll("[data-action]").forEach(el => {
    el.addEventListener("click", handleClick);
  });
  document.querySelectorAll("input[data-action]").forEach(el => {
    el.addEventListener("input", handleInput);
  });
  document.querySelectorAll("select[data-action]").forEach(el => {
    el.addEventListener("change", handleChange);
  });
}

function handleClick(e) {
  const el = e.currentTarget;
  const action = el.dataset.action;

  switch (action) {
    case "new_game":
      hofRecorded = false; weeklyScoreSubmitted = false;
      creation = { step: 1, position: null, archetype: null, shownArchetypes: [], name: "", countryIdx: 0, clubIdx: 0 };
      navigate("creation");
      break;

    case "weekly_challenge": {
      hofRecorded = false; weeklyScoreSubmitted = false;
      const entry = currentWeeklyPlayer();
      const { country, club } = resolveWeeklyClub(entry);
      if (!country || !club) { navigate("menu"); break; }
      initNewGame(entry.name, entry.position, null, club, country);
      state.isWeeklyChallenge = true;
      state.weeklyLabel = entry.name;
      save();
      navigate("hub");
      break;
    }

    case "view_hof":
      navigate("hall_of_fame");
      break;

    case "share_result": {
      const text = shareCareerText();
      const done = () => { el.textContent = "✅ Copiado"; setTimeout(() => { el.textContent = "📋 Compartir resultado"; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => alert(text));
      } else {
        alert(text);
      }
      break;
    }

    case "continue_game":
      if (load()) navigate("hub");
      break;

    case "delete_save":
      if (confirm("¿Seguro que querés borrar la partida?")) { deleteSave(); navigate("menu"); }
      break;

    case "go_menu":
      navigate("menu");
      break;

    case "go_hub":
      navigate("hub");
      break;

    case "select_position":
      creation.position = el.dataset.pos;
      creation.archetype = null;
      const allArch = ARCHETYPES[creation.position];
      creation.shownArchetypes = shuffleArray(allArch).slice(0, 3);
      render();
      break;

    case "creation_next1":
      if (!creation.position) return;
      creation.step = 2;
      render();
      break;

    case "select_archetype":
      creation.archetype = creation.shownArchetypes.find(a => a.id === el.dataset.arch);
      render();
      break;

    case "creation_next2":
      if (!creation.archetype) return;
      creation.step = 3;
      render();
      break;

    case "creation_back2":
      creation.step = 1;
      render();
      break;

    case "creation_back3":
      creation.step = 2;
      render();
      break;

    case "start_game": {
      if (!creation.name.trim()) return;
      const country = COUNTRIES[creation.countryIdx];
      const club = country.clubs[creation.clubIdx];
      initNewGame(creation.name.trim(), creation.position, creation.archetype, club, country);
      navigate("hub");
      break;
    }

    case "open_decision":
      navigate("decision");
      break;

    case "close_decision":
      navigate("hub");
      break;

    case "make_decision": {
      const d = state.schedule.currentDecision;
      if (!d || state.schedule.decisionUsed) return;
      const idx = parseInt(el.dataset.idx);
      applyDecisionEffects(d, idx);
      state.schedule.decisionUsed = true;
      save();
      navigate("hub");
      break;
    }

    case "play_match":
      currentMatchId = el.dataset.match;
      navigate("match");
      break;

    case "resolve_match_with_sit": {
      const mId = el.dataset.match;
      const sitIdx = parseInt(el.dataset.sit);
      const result = resolveMatch(mId, sitIdx);
      const match = state.schedule.matches.find(m => m.id === mId);
      save();
      document.getElementById("app").innerHTML = renderMatchResult(result, match);
      attachEvents();
      break;
    }

    case "resolve_match_sim": {
      const mId = el.dataset.match;
      const result = resolveMatch(mId, null);
      const match = state.schedule.matches.find(m => m.id === mId);
      save();
      document.getElementById("app").innerHTML = renderMatchResult(result, match);
      attachEvents();
      break;
    }

    case "accept_offer": {
      if (!state.pendingOffer) return;
      const newClub = state.pendingOffer.club;
      addNews(`✍️ Fichaje cerrado: ahora jugás en ${newClub.name}.`, true);
      state.club = newClub;
      state.pendingOffer = null;
      state.player.dtRelation = 50;
      regenerateRemainingMatches(newClub);
      save();
      navigate("hub");
      break;
    }

    case "reject_offer":
      if (!state.pendingOffer) return;
      addNews(`Rechazaste la oferta de ${state.pendingOffer.club.name}. Seguís en ${state.club.name}.`);
      state.pendingOffer = null;
      save();
      navigate("hub");
      break;

    case "toggle_hof": {
      const id = el.dataset.id;
      if (expandedHofIds.has(id)) expandedHofIds.delete(id); else expandedHofIds.add(id);
      render();
      break;
    }

    case "advance_week":
      if (state.career.week >= 34) return;
      advanceWeek();
      navigate("hub");
      break;

    case "end_season":
      navigate("season_end");
      break;

    case "next_season":
      pendingPersonalityReveal = null;
      startNewSeason();
      if (currentView !== "game_over") navigate("hub");
      break;

    case "new_game_after":
      hofRecorded = false; weeklyScoreSubmitted = false;
      deleteSave();
      creation = { step: 1, position: null, archetype: null, shownArchetypes: [], name: "", countryIdx: 0, clubIdx: 0 };
      navigate("creation");
      break;
  }
}

function handleInput(e) {
  const action = e.target.dataset.action;
  if (action === "set_name") {
    creation.name = e.target.value;
    // Update button state without full re-render
    const btn = document.querySelector("[data-action='start_game']");
    if (btn) btn.disabled = !creation.name.trim();
  }
}

function handleChange(e) {
  const action = e.target.dataset.action;
  if (action === "set_country") {
    creation.countryIdx = parseInt(e.target.value);
    creation.clubIdx = 0;
    render();
  }
  if (action === "set_club") {
    creation.clubIdx = parseInt(e.target.value);
  }
}

// ── INIT ─────────────────────────────────────────────────────────

(function init() {
  render();
})();
