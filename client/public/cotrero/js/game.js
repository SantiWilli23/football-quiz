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

// El arquetipo define tu estilo de juego (no hay "rareza" ni power creep:
// cada uno es una forma distinta de jugar, no una versión mejor de otra).
// goalProfile/assistProfile los usa resolveMatch() para inclinar el reparto
// entre gol propio y asistencia según el estilo elegido.
const ARCHETYPES = {
  delantero: [
    { id: "killer", name: "Killer del área", desc: "Instinto puro de gol. Dentro del área sos el mejor.", bonus: { disparo: 8 }, goalBias: 1.3, assistBias: 0.7 },
    { id: "cazagoles", name: "Cazagoles puro", desc: "Vivís pegado al área rival. Poco toque, mucha definición.", bonus: { disparo: 9 }, goalBias: 1.4, assistBias: 0.5 },
    { id: "extremo", name: "Extremo desequilibrante", desc: "Velocidad y regate como armas. El uno a uno es tu zona de confort.", bonus: { velocidad: 5, regate: 4 }, goalBias: 1.0, assistBias: 1.2 },
    { id: "asociativo", name: "Ariete asociativo", desc: "Más que meter goles, los generás. Jugador para el colectivo.", bonus: { pase: 5, disparo: 3 }, goalBias: 0.9, assistBias: 1.3 },
    { id: "falso9", name: "Falso 9", desc: "Bajás a buscar el juego y desarmás la defensa rival desde ahí.", bonus: { pase: 6, regate: 3 }, goalBias: 0.85, assistBias: 1.4 },
    { id: "ruptura", name: "Delantero de ruptura", desc: "Tu arma es la espalda. Velocidad y profundidad constante.", bonus: { velocidad: 7, resistencia: 2 }, goalBias: 1.2, assistBias: 0.8 },
    { id: "referencia", name: "Referencia de área", desc: "Juego aéreo y presencia física. El área es tuya.", bonus: { disparo: 5, resistencia: 3 }, goalBias: 1.15, assistBias: 0.9 },
    { id: "segundo9", name: "Segundo delantero", desc: "Jugás un poco más suelto, entre líneas, apoyando al 9 de área.", bonus: { regate: 5, pase: 3 }, goalBias: 1.0, assistBias: 1.1 },
  ],
  mediocampista: [
    { id: "motor", name: "Motor de mediocampo", desc: "Correr, correr y correr. El equipo vive de tu energía.", bonus: { potencia: 7, resistencia: 2 }, goalBias: 0.9, assistBias: 1.0 },
    { id: "metronomo", name: "Metrónomo", desc: "El ritmo lo ponés vos. Pase corto, pase largo, siempre con criterio.", bonus: { pase: 7, control: 2 }, goalBias: 0.8, assistBias: 1.3 },
    { id: "creativo", name: "Mediocampista creativo", desc: "El último pase, la jugada que nadie vio. Creatividad como diferencial.", bonus: { vision: 8 }, goalBias: 0.9, assistBias: 1.4 },
    { id: "recuperador", name: "Recuperador", desc: "Robar balones y distribuir rápido. El primero en defender, el primero en salir.", bonus: { potencia: 4, control: 5 }, goalBias: 0.7, assistBias: 0.9 },
    { id: "enganche", name: "Enganche", desc: "Jugás entre líneas, sos el último pase antes del gol.", bonus: { vision: 6, control: 3 }, goalBias: 1.0, assistBias: 1.4 },
    { id: "box2box", name: "Box-to-box", desc: "Aparecés en las dos áreas. Nunca falta tu carrera de más.", bonus: { potencia: 5, resistencia: 4 }, goalBias: 1.1, assistBias: 1.0 },
    { id: "contencion", name: "Volante de contención", desc: "Primero se defiende: cortás circuitos antes de que empiecen.", bonus: { control: 6, potencia: 2 }, goalBias: 0.6, assistBias: 0.8 },
    { id: "interior", name: "Interior ofensivo", desc: "Llegás desde segunda línea, sorprendés por dentro.", bonus: { pase: 5, vision: 3 }, goalBias: 1.15, assistBias: 1.1 },
  ],
  defensa: [
    { id: "muro", name: "Muro", desc: "Físico y determinación. Pocos pasan cuando estás bien parado.", bonus: { fisico: 5, defensa: 4 }, goalBias: 0.7, assistBias: 0.6 },
    { id: "lider", name: "Líder defensivo", desc: "Organizás la línea, levantás al equipo. Tu valor va más allá del juego.", bonus: { liderazgo: 7, defensa: 2 }, goalBias: 0.8, assistBias: 0.7 },
    { id: "moderno", name: "Defensor moderno", desc: "Salís jugando, te sumás al ataque. Más que detener, construís.", bonus: { pase: 6, fisico: 3 }, goalBias: 1.0, assistBias: 1.2 },
    { id: "agresivo", name: "Defensor agresivo", desc: "Presión alta, duelos ganados. La agresividad como herramienta.", bonus: { defensa: 5, fisico: 4 }, goalBias: 0.9, assistBias: 0.7 },
    { id: "libero", name: "Líbero", desc: "Leés el juego un paso antes que todos y salís jugando limpio.", bonus: { pase: 5, liderazgo: 3 }, goalBias: 0.8, assistBias: 1.1 },
    { id: "marcador", name: "Marcador personal", desc: "Tu rival directo no respira en toda la tarde.", bonus: { defensa: 6, fisico: 2 }, goalBias: 0.6, assistBias: 0.6 },
    { id: "aereo", name: "Central aéreo", desc: "Ganás todo lo que sube. Un peligro más en cada córner rival.", bonus: { fisico: 6, defensa: 2 }, goalBias: 1.3, assistBias: 0.6 },
    { id: "carrilero", name: "Carrilero", desc: "Subís y bajás toda la banda sin parar en todo el partido.", bonus: { pase: 4, fisico: 3, resistencia: 2 }, goalBias: 1.0, assistBias: 1.3 },
  ],
};

const COUNTRIES = [
  { name: "Argentina", flag: "🇦🇷", clubs: [
    { id: "river", name: "River Plate", tier: 1, prestige: 90, colors: { primary: "#E30613", secondary: "#FFFFFF" } },
    { id: "boca", name: "Boca Juniors", tier: 1, prestige: 90, colors: { primary: "#0F3B82", secondary: "#F7D117" } },
    { id: "racing", name: "Racing Club", tier: 2, prestige: 65, colors: { primary: "#5CB5E5", secondary: "#FFFFFF" } },
    { id: "sanlorenzo", name: "San Lorenzo", tier: 2, prestige: 60, colors: { primary: "#0F1E3D", secondary: "#C8102E" } },
    { id: "huracan", name: "Huracán", tier: 3, prestige: 38, colors: { primary: "#F5A623", secondary: "#FFFFFF" } },
  ]},
  { name: "España", flag: "🇪🇸", clubs: [
    { id: "realmadrid", name: "Real Madrid", tier: 1, prestige: 98, colors: { primary: "#FFFFFF", secondary: "#00529F" } },
    { id: "barcelona", name: "FC Barcelona", tier: 1, prestige: 97, colors: { primary: "#A50044", secondary: "#004D98" } },
    { id: "atletico", name: "Atlético Madrid", tier: 1, prestige: 85, colors: { primary: "#CE3524", secondary: "#FFFFFF" } },
    { id: "sevilla", name: "Sevilla FC", tier: 2, prestige: 70, colors: { primary: "#D80027", secondary: "#FFFFFF" } },
    { id: "valencia", name: "Valencia CF", tier: 2, prestige: 63, colors: { primary: "#FF7300", secondary: "#000000" } },
  ]},
  { name: "Inglaterra", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", clubs: [
    { id: "mancity", name: "Manchester City", tier: 1, prestige: 95, colors: { primary: "#6CABDD", secondary: "#1C2C5B" } },
    { id: "liverpool", name: "Liverpool FC", tier: 1, prestige: 93, colors: { primary: "#C8102E", secondary: "#F6EB61" } },
    { id: "arsenal", name: "Arsenal FC", tier: 1, prestige: 85, colors: { primary: "#EF0107", secondary: "#FFFFFF" } },
    { id: "chelsea", name: "Chelsea FC", tier: 2, prestige: 80, colors: { primary: "#034694", secondary: "#FFFFFF" } },
    { id: "newcastle", name: "Newcastle United", tier: 2, prestige: 62, colors: { primary: "#241F20", secondary: "#FFFFFF" } },
  ]},
  { name: "Brasil", flag: "🇧🇷", clubs: [
    { id: "flamengo", name: "Flamengo", tier: 1, prestige: 88, colors: { primary: "#C8102E", secondary: "#000000" } },
    { id: "palmeiras", name: "Palmeiras", tier: 1, prestige: 85, colors: { primary: "#006437", secondary: "#FFFFFF" } },
    { id: "corinthians", name: "Corinthians", tier: 2, prestige: 70, colors: { primary: "#000000", secondary: "#FFFFFF" } },
    { id: "saopaulo", name: "São Paulo FC", tier: 2, prestige: 65, colors: { primary: "#C1121C", secondary: "#000000" } },
  ]},
  { name: "Italia", flag: "🇮🇹", clubs: [
    { id: "juventus", name: "Juventus FC", tier: 1, prestige: 90, colors: { primary: "#000000", secondary: "#FFFFFF" } },
    { id: "intermilan", name: "Inter de Milán", tier: 1, prestige: 88, colors: { primary: "#0B3E97", secondary: "#000000" } },
    { id: "milan", name: "AC Milan", tier: 1, prestige: 87, colors: { primary: "#FB090B", secondary: "#000000" } },
    { id: "napoli", name: "Nápoles", tier: 2, prestige: 72, colors: { primary: "#12A0D7", secondary: "#FFFFFF" } },
  ]},
  { name: "Francia", flag: "🇫🇷", clubs: [
    { id: "psg", name: "Paris Saint-Germain", tier: 1, prestige: 92, colors: { primary: "#004170", secondary: "#DA291C" } },
    { id: "monaco", name: "AS Monaco", tier: 2, prestige: 68, colors: { primary: "#E8112D", secondary: "#FFFFFF" } },
    { id: "lyon", name: "Olympique de Lyon", tier: 2, prestige: 72, colors: { primary: "#0E1E5B", secondary: "#DA0F19" } },
  ]},
];

// Iniciales para el escudo generado (no hay assets de imagen, así que el
// "escudo" es una placa con las iniciales del club en sus propios colores).
function clubInitials(name) {
  const stop = new Set(["fc", "cf", "de", "as", "sc"]);
  const words = name.split(/\s+/).filter(w => !stop.has(w.toLowerCase()));
  const letters = (words.length >= 2 ? [words[0], words[words.length - 1]] : [words[0] || name])
    .map(w => w[0]);
  return letters.join("").toUpperCase().slice(0, 3);
}

function readableTextColor(hex) {
  const h = (hex || "#888888").replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) || 0;
  const g = parseInt(h.substring(2, 4), 16) || 0;
  const b = parseInt(h.substring(4, 6), 16) || 0;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1a1408" : "#f2f2f0";
}

function clubCrestHtml(club, size) {
  size = size || 44;
  const colors = club.colors || { primary: "#8A6423", secondary: "#F2F2F0" };
  const textColor = readableTextColor(colors.primary);
  return `
    <div style="width:${size}px;height:${size}px;border-radius:${Math.round(size * 0.22)}px;
      background:linear-gradient(160deg, ${colors.primary}, ${colors.primary}CC);
      border:2px solid ${colors.secondary}; display:flex; align-items:center; justify-content:center;
      font-family:'Barlow Condensed',sans-serif; font-weight:900; color:${textColor};
      font-size:${Math.round(size * 0.36)}px; letter-spacing:0.5px; flex-shrink:0;">
      ${clubInitials(club.name)}
    </div>
  `;
}

// El club "toma protagonismo" en colores: mientras estés en su plantel, el
// dorado de acento de toda la interfaz pasa a ser el color primario del
// club (con el secundario como variante clara), igual que el selector de
// temas del resto de Futotal pisa variables CSS por afuera de React.
function colorVividness(hex) {
  // Qué tan "usable" es un color como acento sobre fondo oscuro: castiga el
  // blanco/negro puro (mucho contraste pero cero personalidad como acento).
  const h = (hex || "").replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) || 0;
  const g = parseInt(h.substring(2, 4), 16) || 0;
  const b = parseInt(h.substring(4, 6), 16) || 0;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
  const midtoneScore = 1 - Math.abs(luminance - 0.5) * 2; // mejor cerca de la mitad
  return sat * 0.7 + midtoneScore * 0.3;
}

function applyClubTheme(club) {
  if (!club || !club.colors) return;
  const root = document.documentElement.style;
  // El escudo usa primario/secundario tal cual (son los colores reales del
  // club); el acento de la interfaz usa el que mejor funcione como color de
  // botones/texto sobre fondo oscuro, así un club todo blanco o negro (River,
  // Real Madrid, Juventus) no deja la app ilegible.
  const accent = colorVividness(club.colors.primary) >= colorVividness(club.colors.secondary)
    ? club.colors.primary
    : club.colors.secondary;
  root.setProperty("--gold", accent);
  root.setProperty("--gold-light", club.colors.secondary === accent ? club.colors.primary : club.colors.secondary);
  root.setProperty("--gold-border", accent + "48");
  root.setProperty("--gold-subtle", accent + "1F");
}

function resetClubTheme() {
  const root = document.documentElement.style;
  ["--gold", "--gold-light", "--gold-border", "--gold-subtle"].forEach(v => root.removeProperty(v));
}

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
  {
    id: "d16",
    context: "Tu pareja te pide que se muden juntos. Es un paso grande, y la temporada está en un momento exigente.",
    options: [
      { text: "Te animás. Necesitás algo estable fuera de la cancha." },
      { text: "Le pedís esperar hasta que termine la temporada." },
      { text: "Le decís que preferís enfocarte solo en el fútbol por ahora." },
    ],
    effects: [
      { forma: 4, p: { profesional: 1 } },
      { p: { profesional: 1 } },
      { forma: -3, p: { solitario: 1 } },
    ],
  },
  {
    id: "d17",
    context: "Te enterás de que vas a ser padre/madre. La noticia te cae en medio de una semana de partidos importantes.",
    options: [
      { text: "Lo compartís con el grupo. Necesitás decirlo en voz alta." },
      { text: "Lo guardás para vos y tu familia por ahora." },
      { text: "Se lo contás primero al técnico, para que lo tenga en cuenta." },
    ],
    effects: [
      { forma: 5, p: { lider: 1 } },
      { p: { solitario: 1 } },
      { dt: 4, p: { profesional: 1 } },
    ],
  },
  {
    id: "d18",
    context: "Tu familia te reclama que las giras y concentraciones te están alejando de casa. Es una charla que veías venir.",
    options: [
      { text: "Le pedís al club adaptar tu calendario lo que se pueda." },
      { text: "Les explicás que es parte del trabajo y que no depende de vos." },
      { text: "Les prometés compensarlo en cuanto termine la temporada." },
    ],
    effects: [
      { dt: -3, forma: 2 },
      { forma: -4, p: { profesional: 1 } },
      { p: { solitario: 1 } },
    ],
  },
  {
    id: "d19",
    context: "Un familiar cercano no está bien de salud. Te ofrecen un permiso corto para viajar a verlo, aunque hay entrenamientos importantes esa semana.",
    options: [
      { text: "Viajás. La familia primero." },
      { text: "Te quedás, pero llamás todos los días." },
      { text: "Le pedís al club que gestione algo para no perder entrenamientos." },
    ],
    effects: [
      { forma: -2, dt: 2, p: { lider: 1 } },
      { forma: -5, p: { solitario: 1 } },
      { dt: 3, p: { profesional: 1 } },
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

// ── LIGA, OBJETIVOS Y TROFEOS ────────────────────────────────────────
const MATCH_WEEKS = [3, 6, 9, 13, 17, 19, 23, 26, 29, 33];

function buildLeagueTable(club) {
  const rivals = getLeagueRivals(club);
  const allTeams = [club, ...rivals];
  const table = {};
  allTeams.forEach(t => {
    table[t.id] = { id: t.id, name: t.name, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 };
  });
  return table;
}

function sortedLeagueTable() {
  if (!state.leagueTable) return [];
  return Object.values(state.leagueTable).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
}

function myLeaguePosition() {
  const sorted = sortedLeagueTable();
  const idx = sorted.findIndex(r => r.id === state.club.id);
  return idx === -1 ? null : idx + 1;
}

// Objetivo de la temporada según la jerarquía del club — pelear un título
// no es lo mismo que salvar la categoría, y tiene consecuencias distintas.
function assignSeasonObjective(club) {
  const leagueSize = 1 + getLeagueRivals(club).length;
  if (club.tier === 1) return { label: "Pelear el título", targetPosition: 1, leagueSize };
  if (club.tier === 2) return { label: "Terminar entre los mejores", targetPosition: Math.max(2, Math.ceil(leagueSize / 2)), leagueSize };
  return { label: "Salvar la categoría", targetPosition: leagueSize - 1, leagueSize };
}

// Simula la fecha de liga completa: mi partido ya se resolvió en resolveMatch
// (se usa ese resultado tal cual), el resto de los clubes de mi liga juegan
// entre sí con un sorteo liviano basado en prestigio, para que la tabla se
// sienta viva sin tener que simular partido por partido de cada rival.
function simulateLeagueMatchday(myFixture) {
  if (!state.leagueTable) return;
  const club = state.club;
  const rivals = getLeagueRivals(club);
  const allTeams = [club, ...rivals];
  const involved = new Set();

  function apply(idA, idB, golesA, golesB) {
    const rowA = state.leagueTable[idA], rowB = state.leagueTable[idB];
    if (!rowA || !rowB) return;
    rowA.played++; rowB.played++;
    rowA.gf += golesA; rowA.ga += golesB;
    rowB.gf += golesB; rowB.ga += golesA;
    if (golesA > golesB) { rowA.won++; rowA.pts += 3; rowB.lost++; }
    else if (golesA < golesB) { rowB.won++; rowB.pts += 3; rowA.lost++; }
    else { rowA.drawn++; rowB.drawn++; rowA.pts += 1; rowB.pts += 1; }
  }

  if (myFixture && myFixture.result && myFixture.rival && state.leagueTable[myFixture.rival.id]) {
    const r = myFixture.result;
    const golesA = myFixture.home ? r.teamGoals : r.rivalGoals;
    const golesB = myFixture.home ? r.rivalGoals : r.teamGoals;
    apply(club.id, myFixture.rival.id, golesA, golesB);
    involved.add(club.id); involved.add(myFixture.rival.id);
  }

  const rest = allTeams.filter(t => !involved.has(t.id)).sort(() => Math.random() - 0.5);
  for (let i = 0; i < rest.length - 1; i += 2) {
    const a = rest[i], b = rest[i + 1];
    const diff = (a.prestige || 60) - (b.prestige || 60) + (Math.random() * 20 - 10);
    const golesA = Math.max(0, Math.round(1.2 + diff / 25 + Math.random() * 1.6 - 0.8));
    const golesB = Math.max(0, Math.round(1.0 - diff / 25 + Math.random() * 1.6 - 0.8));
    apply(a.id, b.id, golesA, golesB);
  }
}

// ── ENTREVISTAS POST-PARTIDO ─────────────────────────────────────────
// Después de un partido con algo en juego (clásico, goleada, derrota dura)
// te espera la prensa a la salida. Se reutiliza el mismo sistema de
// decisión de siempre (misma pantalla, mismo formato), solo que la
// dispara el partido en vez de la semana.
const INTERVIEW_DECISIONS = [
  {
    id: "int_win",
    context: "Ganaste y la prensa te espera a la salida del vestuario. Te preguntan a qué se debió el buen partido.",
    options: [
      { text: "Le das el crédito al equipo." },
      { text: "Te lo adjudicás a tu nivel individual." },
      { text: "Contestás con generalidades, sin comprometerte." },
    ],
    effects: [
      { dt: 3, p: { lider: 1 } },
      { dt: -2, p: { solitario: 1 }, forma: 2 },
      { p: { profesional: 1 } },
    ],
  },
  {
    id: "int_loss",
    context: "Perdieron y en la conferencia buscan explicaciones. Un periodista pregunta directamente qué falló.",
    options: [
      { text: "Asumís tu parte de responsabilidad." },
      { text: "Señalás que el equipo no estuvo a la altura, sin nombrar a nadie." },
      { text: "Te vas sin contestar." },
    ],
    effects: [
      { dt: 4, forma: -2, p: { profesional: 1 } },
      { dt: -5, p: { lider: 1 } },
      { forma: -3, p: { solitario: 1 } },
    ],
  },
  {
    id: "int_clasico",
    context: "Se terminó el clásico y todos quieren tu palabra sobre el resultado y el ambiente caliente del partido.",
    options: [
      { text: "Hablás con respeto del rival, bajás el tono." },
      { text: "Te subís a la tribuna: mandás un mensaje directo a la hinchada rival." },
      { text: "Evitás el tema por completo." },
    ],
    effects: [
      { dt: 2, p: { profesional: 1 } },
      { forma: 3, p: { fiestero: 1 }, dt: -3 },
      { p: { solitario: 1 } },
    ],
  },
];

function maybeQueueInterview(match, result) {
  if (!match || !result || state.player.injuryStatus) return;
  if (state.schedule.currentDecision && !state.schedule.decisionUsed) return;
  const qualifies = match.type === "clasico" || (result.win && result.teamGoals - result.rivalGoals >= 3) || (result.loss && result.rivalGoals - result.teamGoals >= 2);
  if (!qualifies || Math.random() > 0.6) return;
  const pick = match.type === "clasico" ? INTERVIEW_DECISIONS[2] : result.win ? INTERVIEW_DECISIONS[0] : INTERVIEW_DECISIONS[1];
  state.schedule.currentDecision = pick;
  state.schedule.decisionUsed = false;
}

function addTrophy(name, season) {
  if (!state.career.trophies) state.career.trophies = [];
  state.career.trophies.push({ name, season });
}

// ── RASGOS PERMANENTES ───────────────────────────────────────────────
// A diferencia de la personalidad (que se revela una sola vez al llegar a
// 8 puntos en un rasgo dominante), esto premia la CONSTANCIA: seguir
// eligiendo el mismo tipo de decisión mucho después de revelada tu
// personalidad desbloquea un rasgo permanente con un bonus pasivo chico.
const TRAIT_DEFS = {
  profesional: { threshold: 15, name: "Ejemplar", desc: "Nunca falta a un entrenamiento. La directiva lo nota.", bonusText: "+1 relación con el DT cada semana" },
  lider: { threshold: 15, name: "Capitán nato", desc: "El vestuario te escucha antes que a nadie.", bonusText: "+1 forma extra en cada victoria" },
  solitario: { threshold: 15, name: "Lobo solitario", desc: "Rendís mejor cuando nadie espera nada de vos.", bonusText: "Menos golpes de forma en las derrotas" },
  fiestero: { threshold: 15, name: "Ídolo popular", desc: "Fuera de la cancha sos una estrella — y se nota en la prensa.", bonusText: "La prensa te perdona más rápido" },
};

function checkTraitUnlocks() {
  const p = state.player;
  if (!p.traits) p.traits = [];
  Object.entries(TRAIT_DEFS).forEach(([key, def]) => {
    const count = p.personality[key] || 0;
    if (count >= def.threshold && !p.traits.includes(key)) {
      p.traits.push(key);
      addNews(`⭐ Nuevo rasgo permanente: "${def.name}". ${def.bonusText}.`, true);
    }
  });
}

// ── EVENTOS DE VIDA ──────────────────────────────────────────────────
const LIFE_EVENTS = [
  { id: "casamiento", label: "Te casaste", desc: "Encontraste estabilidad fuera de la cancha.", weeks: 6 },
  { id: "hijo", label: "Fuiste padre/madre", desc: "Una alegría enorme que te cambia las prioridades.", weeks: 8 },
  { id: "mudanza", label: "Te mudaste de casa", desc: "Un nuevo lugar para desconectar después de cada partido.", weeks: 4 },
];

function maybeTriggerLifeEvent() {
  if (state.player.lifeEvent) return;
  if (Math.random() >= 0.02) return;
  const ev = LIFE_EVENTS[Math.floor(Math.random() * LIFE_EVENTS.length)];
  state.player.lifeEvent = { id: ev.id, label: ev.label, weeksLeft: ev.weeks };
  addNews(`💍 ${ev.label}. ${ev.desc}`, true);
}

function tickLifeEvent() {
  const ev = state.player.lifeEvent;
  if (!ev) return;
  ev.weeksLeft--;
  // Mientras dura, la forma no puede caer tan abajo — la estabilidad personal amortigua las malas rachas.
  if (state.player.forma < 45) state.player.forma = 45;
  if (ev.weeksLeft <= 0) state.player.lifeEvent = null;
}

// Cuando el "calor" de prensa (pressHeat) se acumula demasiado por varias
// decisiones polémicas seguidas, se dispara una de estas en vez de una
// decisión normal — la crisis mediática tiene más en juego que el resto.
const CRISIS_DECISIONS = [
  {
    id: "crisis01",
    context: "La prensa lleva semanas acumulando titulares sobre vos. Hoy el club te cita a una conferencia para que 'aclarés la situación' frente a todos los medios.",
    options: [
      { text: "Pedís disculpas públicamente y prometés enfocarte solo en jugar." },
      { text: "Defendés cada una de tus decisiones sin bajar los brazos." },
      { text: "Dejás que el club hable por vos y no decís una palabra." },
    ],
    effects: [
      { dt: 6, forma: -3, p: { profesional: 1 } },
      { dt: -4, p: { lider: 1 }, forma: 2 },
      { dt: 2, p: { solitario: 1 } },
    ],
  },
  {
    id: "crisis02",
    context: "Un dirigente del club te llama en privado. Te dice que la directiva está incómoda con tanto ruido mediático y que esperan un cambio de actitud.",
    options: [
      { text: "Le asegurás que vas a bajar tu perfil públicamente." },
      { text: "Le decís que tu juego dentro de la cancha es lo único que importa." },
      { text: "Le pedís que el club te respalde en vez de presionarte." },
    ],
    effects: [
      { dt: 5, p: { profesional: 1 } },
      { forma: 4, p: { solitario: 1 } },
      { dt: -6, p: { lider: 1 } },
    ],
  },
];

function generateRivalTeammate(playerOvr) {
  return {
    name: RIVAL_NAMES[Math.floor(Math.random() * RIVAL_NAMES.length)],
    ovr: Math.max(50, playerOvr + Math.floor(Math.random() * 11) - 5),
  };
}

// Clubes cuyo id coincide 1:1 con un equipo real del Modo Carrera DT
// (que sólo cubre Premier League y La Liga) — permite ofrecer el epílogo
// "dirigí a tu ex-club" sin inventar una integración de datos que no existe.
const DT_COMPATIBLE_CLUBS = new Set([
  "realmadrid", "barcelona", "atletico", "sevilla", "valencia",
  "mancity", "liverpool", "arsenal", "chelsea", "newcastle",
]);

const RIVAL_NAMES = [
  "Emiliano Duarte", "Thiago Correa", "Marco Veltri", "Lucas Ferreira",
  "Diego Salcedo", "Bruno Iglesias", "Franco Pellegrino", "Mateo Rueda",
];

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
let creation = { step: 1, position: null, archetype: null, shownArchetypes: [], name: "", countryIdx: 0, clubIdx: 0, ironman: false };
let currentView = "menu";
let currentMatchId = null;
let pendingPersonalityReveal = null;
let expandedHofIds = new Set();
let pendingDynasty = null; // { bonus, surname, generation } — se consume en start_game

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
let legacyScoreSubmitted = false; // idem, para el ranking histórico (no semanal) del grupo

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

// ── DINASTÍA FAMILIAR ─────────────────────────────────────────────
// A diferencia del Salón de la Fama (todas las carreras, ordenadas por
// goles), la dinastía es una línea de tiempo: generación 1, 2, 3... Cada
// retiro queda anotado acá, y desde game_over se puede arrancar la
// siguiente generación como hijo/a del jugador que se retira, heredando
// un pequeño plus de potencial según qué tan bueno fue el padre/madre.
const DYNASTY_KEY = "cotrero_dynasty_v1";
const DYNASTY_MAX = 30;
let dynastyRecorded = false;

function getDynasty() {
  try {
    const raw = localStorage.getItem(DYNASTY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

function recordDynastyGeneration() {
  if (!state || dynastyRecorded) return;
  dynastyRecorded = true;
  const career = state.career;
  const player = state.player;
  const list = getDynasty();
  const generation = (list[0]?.generation || 0) + 1;
  const entry = {
    generation,
    name: player.name,
    position: player.position,
    peakOvr: player.ovr,
    goals: career.goals,
    trophies: (career.trophies || []).length,
    seasons: career.season - 1,
    date: Date.now(),
  };
  const updated = [entry, ...list].slice(0, DYNASTY_MAX);
  try { localStorage.setItem(DYNASTY_KEY, JSON.stringify(updated)); } catch { /* se ignora */ }
}

// Bono de potencial para el heredero: cuanto mejor terminó el padre/madre,
// mejor arranca la próxima generación (tope +6, para que igual haga falta
// jugar bien y no sea solo heredar de arriba).
function dynastyBonusFor(peakOvr) {
  return Math.max(0, Math.min(6, Math.round((peakOvr - 70) / 4)));
}

function familySurname(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : fullName;
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
    checkTraitUnlocks();
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

  pushHistory({
    type: "semanal",
    week: state.career.week,
    season: state.career.season,
    label: decision.context.length > 70 ? decision.context.slice(0, 70) + "…" : decision.context,
    text: decision.options[optionIdx].text,
    dtDelta: deltaDt,
    formaDelta: deltaForma,
  });
}

// ── DECISIONES LIBRES ──────────────────────────────────────────────
// A diferencia de la decisión semanal (una por semana, la elige el juego),
// estas las dispara el jugador cuando quiere. Tienen un enfriamiento propio
// para que no se conviertan en una máquina de sumar reputación gratis: cada
// una se puede volver a intentar recién después de `cooldownWeeks` semanas
// (contadas de forma absoluta entre temporadas, ver absWeek).
function absWeek(career) {
  return career.season * 100 + career.week;
}

const SPONSOR_NAMES = ["una marca de indumentaria", "una bebida energética", "una marca de botines", "una cadena de gimnasios"];

const FREE_DECISIONS = [
  {
    id: "patrocinio",
    icon: "🤳",
    label: "Firmar un patrocinio personal",
    sub: "Te exigen mantener el nivel. Si tu forma se cae mucho, te cortan el contrato.",
    cooldownWeeks: 10,
    blocked(p) {
      return p.personalSponsor ? `Ya tenés un contrato vigente con ${p.personalSponsor.label}.` : null;
    },
    resolve(p) {
      const chance = Math.max(0.15, Math.min(0.75, 0.2 + (p.ovr - 65) / 60));
      const success = Math.random() < chance;
      if (success) {
        const label = SPONSOR_NAMES[Math.floor(Math.random() * SPONSOR_NAMES.length)];
        p.personalSponsor = { label, minForma: 35 };
        return { success, text: `Firmaste tu primer contrato personal con ${label}. Mantené el nivel o te lo cortan.` };
      }
      return { success, text: "Ninguna marca se interesó todavía. Capaz con más nivel la próxima." };
    },
  },
  {
    id: "titularidad",
    icon: "🎯",
    label: "Pedir la titularidad",
    sub: "Le pedís al DT un lugar fijo en el 11. El resultado depende de cómo estás parado con él.",
    cooldownWeeks: 6,
    blocked(p) {
      return p.isStarter ? "Ya sos titular indiscutido." : null;
    },
    resolve(p) {
      const chance = Math.max(0.1, Math.min(0.85, 0.25 + (p.dtRelation - 50) / 100 + (p.forma - 50) / 200));
      const success = Math.random() < chance;
      if (success) {
        p.isStarter = true;
        p.dtRelation = Math.max(0, Math.min(100, p.dtRelation + 3));
        return { success, text: "Hablaste con el DT y te aseguró un lugar fijo en el 11. Sos titular." };
      }
      p.dtRelation = Math.max(0, Math.min(100, p.dtRelation - 6));
      return { success, text: `El DT te bajó el perfil: "No es tu momento todavía". Se lo tomó a mal que se lo pidas.` };
    },
  },
  {
    id: "sueldo",
    icon: "💰",
    label: "Pedir un aumento de sueldo",
    sub: "Vas a hablar de plata. Si tu relación con el DT es baja, te puede salir caro.",
    cooldownWeeks: 5,
    blocked() {
      return null;
    },
    resolve(p) {
      const chance = Math.max(0.1, Math.min(0.8, 0.2 + (p.dtRelation - 50) / 90));
      const success = Math.random() < chance;
      if (success) {
        p.salaryLevel = (p.salaryLevel || 0) + 1;
        p.dtRelation = Math.max(0, Math.min(100, p.dtRelation + 1));
        return { success, text: "El club aceptó mejorarte el contrato. Vas a cobrar más." };
      }
      const harsh = p.dtRelation < 30;
      p.dtRelation = Math.max(0, p.dtRelation - (harsh ? 10 : 5));
      return {
        success,
        text: harsh
          ? `Te frenaron en seco: "Primero rendí, después hablamos de plata". Quedó mal el pedido.`
          : "Te dijeron que no es el momento. No cambia nada, pero tampoco ayudó.",
      };
    },
  },
  {
    id: "capitania",
    icon: "🧢",
    label: "Pedir el brazalete de capitán",
    sub: "Le pedís al DT que te haga capitán. Pesa más si el grupo ya te ve como líder.",
    cooldownWeeks: 8,
    blocked(p) {
      return p.isCaptain ? "Ya sos el capitán del equipo." : null;
    },
    resolve(p) {
      const liderBonus = Math.min(20, (p.personality?.lider || 0) * 2);
      const chance = Math.max(0.08, Math.min(0.8, 0.15 + (p.dtRelation - 50) / 120 + liderBonus / 100));
      const success = Math.random() < chance;
      if (success) {
        p.isCaptain = true;
        p.dtRelation = Math.max(0, Math.min(100, p.dtRelation + 4));
        return { success, text: "El DT te da el brazalete: \"Confío en vos para llevar la voz del grupo\"." };
      }
      p.dtRelation = Math.max(0, Math.min(100, p.dtRelation - 5));
      return { success, text: "El DT te dice que todavía no es tu momento de liderar el vestuario." };
    },
  },
  {
    id: "penales",
    icon: "🎯",
    label: "Pedir patear los penales",
    sub: "Le pedís al DT que te confirme como el pateador oficial del equipo.",
    cooldownWeeks: 6,
    blocked(p) {
      return p.setPieceRole === "penales" ? "Ya sos el pateador de penales del equipo." : null;
    },
    resolve(p) {
      const chance = Math.max(0.1, Math.min(0.8, 0.2 + (p.dtRelation - 50) / 110 + (p.ovr - 70) / 150));
      const success = Math.random() < chance;
      if (success) {
        p.setPieceRole = "penales";
        p.dtRelation = Math.max(0, Math.min(100, p.dtRelation + 2));
        return { success, text: "El DT te confirma como el pateador de penales del equipo." };
      }
      p.dtRelation = Math.max(0, Math.min(100, p.dtRelation - 4));
      return { success, text: "El DT prefiere sostener al pateador habitual por ahora." };
    },
  },
  {
    id: "descanso",
    icon: "🌴",
    label: "Pedir unos días de descanso",
    sub: "Le pedís al cuerpo técnico que te baje la carga esta semana.",
    cooldownWeeks: 4,
    blocked(p) {
      return p.forma >= 92 ? "Ya estás a tope de forma, no hace falta." : null;
    },
    resolve(p) {
      const chance = Math.max(0.25, Math.min(0.9, 0.4 + (p.dtRelation - 50) / 150));
      const success = Math.random() < chance;
      if (success) {
        p.forma = Math.min(100, p.forma + 8);
        return { success, text: "Te bajaron la carga esta semana. Llegás más fresco." };
      }
      p.dtRelation = Math.max(0, Math.min(100, p.dtRelation - 3));
      return { success, text: "Te dijeron que no hay tiempo para bajar el ritmo a mitad de temporada." };
    },
  },
  {
    id: "prensa_contrato",
    icon: "📰",
    label: "Hablar con la prensa de tu contrato",
    sub: "Metés presión pública para negociar. Sube el ruido mediático, salga bien o mal.",
    cooldownWeeks: 5,
    blocked() {
      return null;
    },
    resolve(p) {
      const chance = Math.max(0.15, Math.min(0.75, 0.3 + (p.dtRelation - 50) / 130));
      const success = Math.random() < chance;
      if (success) {
        p.dtRelation = Math.max(0, Math.min(100, p.dtRelation + 2));
        state.pressHeat = Math.min(100, (state.pressHeat || 0) + 10);
        return { success, text: "Manejaste bien la nota. El club valora que no perdiste el tono." };
      }
      p.dtRelation = Math.max(0, Math.min(100, p.dtRelation - 8));
      state.pressHeat = Math.min(100, (state.pressHeat || 0) + 20);
      return { success, text: "Te fuiste de boca con la prensa. En el club no les cayó nada bien." };
    },
  },
  {
    id: "redes_sociales",
    icon: "📱",
    label: "Postear algo polémico en redes",
    sub: "Una movida arriesgada para hacer ruido. Puede sumarte fama o quemarte con el club.",
    cooldownWeeks: 4,
    blocked() {
      return null;
    },
    resolve(p) {
      const success = Math.random() < 0.4;
      if (success) {
        p.forma = Math.min(100, p.forma + 3);
        state.pressHeat = Math.min(100, (state.pressHeat || 0) + 15);
        return { success, text: "El posteo explotó de la mejor manera. Ganaste seguidores y buena onda." };
      }
      p.dtRelation = Math.max(0, Math.min(100, p.dtRelation - 9));
      state.pressHeat = Math.min(100, (state.pressHeat || 0) + 25);
      return { success, text: "El posteo generó polémica y el club te pidió explicaciones." };
    },
  },
  {
    id: "prestamo",
    icon: "🚪",
    label: "Amenazar con pedir salir a préstamo",
    sub: "Le hacés saber al club que si no sumás minutos, vas a pedir salir cedido.",
    cooldownWeeks: 7,
    blocked(p) {
      return p.isStarter ? "Sos titular, no tiene sentido amenazar con irte." : null;
    },
    resolve(p) {
      const chance = Math.max(0.15, Math.min(0.7, 0.3 + (50 - p.dtRelation) / 150));
      const success = Math.random() < chance;
      if (success) {
        p.forma = Math.min(100, p.forma + 3);
        return { success, text: "El club tomó nota del reclamo y te promete más consideración de acá en más." };
      }
      p.dtRelation = Math.max(0, Math.min(100, p.dtRelation - 7));
      return { success, text: "Se lo tomaron como una amenaza vacía. No cambió nada, y quedó un mal gesto." };
    },
  },
  {
    id: "rival_migas",
    icon: "🤝",
    label: "Hacer buenas migas con tu rival de puesto",
    sub: "Un gesto sin riesgo: acercarte a quien te compite el lugar en vez de tensar la cuerda.",
    cooldownWeeks: 4,
    blocked(p) {
      return p.rival ? null : "No tenés a nadie compitiéndote el puesto ahora mismo.";
    },
    resolve(p) {
      p.forma = Math.min(100, p.forma + 2);
      p.personality.lider = (p.personality.lider || 0) + 1;
      checkPersonality();
      return { success: true, text: `Te llevás mejor con ${p.rival.name}. El vestuario respira más liviano.` };
    },
  },
  {
    id: "rival_confrontar",
    icon: "😤",
    label: "Confrontar a tu rival de puesto",
    sub: "Un cara a cara directo. Puede marcarle el terreno o salirte el tiro por la culata.",
    cooldownWeeks: 5,
    blocked(p) {
      return p.rival ? null : "No tenés a nadie compitiéndote el puesto ahora mismo.";
    },
    resolve(p) {
      const success = Math.random() < 0.5;
      if (success) {
        p.rival.ovr = Math.max(55, p.rival.ovr - 3);
        return { success, text: `Le dejaste en claro que el puesto es tuyo. ${p.rival.name} bajó un cambio.` };
      }
      p.dtRelation = Math.max(0, Math.min(100, p.dtRelation - 5));
      p.rival.ovr = Math.min(95, p.rival.ovr + 2);
      return { success, text: `La confrontación se fue de tema. El DT se enteró y no le gustó nada.` };
    },
  },
  {
    id: "rival_sabotear",
    icon: "🗡️",
    label: "Meter presión por lo bajo a tu rival",
    sub: "Jugada sucia y de alto riesgo: correr rumores para debilitarlo frente al DT.",
    cooldownWeeks: 8,
    blocked(p) {
      return p.rival ? null : "No tenés a nadie compitiéndote el puesto ahora mismo.";
    },
    resolve(p) {
      const success = Math.random() < 0.35;
      if (success) {
        p.rival.ovr = Math.max(50, p.rival.ovr - 6);
        return { success, text: `El rumor prendió. ${p.rival.name} perdió lugar en la consideración del DT.` };
      }
      p.dtRelation = Math.max(0, Math.min(100, p.dtRelation - 14));
      p.forma = Math.max(10, p.forma - 3);
      return { success, text: "Se supo que vos corriste el rumor. Quedaste pegado frente a todo el plantel." };
    },
  },
];

function resolveFreeDecision(id) {
  const def = FREE_DECISIONS.find(d => d.id === id);
  if (!def) return;
  const p = state.player;
  if (!state.freeDecisionCooldowns) state.freeDecisionCooldowns = {};

  const week = absWeek(state.career);
  const lastWeek = state.freeDecisionCooldowns[id];
  if (lastWeek != null && week - lastWeek < def.cooldownWeeks) return;
  if (def.blocked && def.blocked(p)) return;

  const result = def.resolve(p);
  state.freeDecisionCooldowns[id] = week;
  addNews(result.text, result.success);
  state._lastFreeDecisionResult = { id, ...result };
  pushHistory({
    type: "libre",
    week: state.career.week,
    season: state.career.season,
    label: def.label,
    text: result.text,
    success: result.success,
  });
  save();
}

function pushHistory(entry) {
  if (!state.decisionHistory) state.decisionHistory = [];
  state.decisionHistory.unshift(entry);
  if (state.decisionHistory.length > 40) state.decisionHistory.length = 40;
}

function applySpecial(id) {
  switch (id) {
    case "foto_condicional":
      if (state.player.forma < 55) state.player.forma = Math.max(10, state.player.forma - 5);
      state.pressHeat = Math.min(100, (state.pressHeat || 0) + 10);
      break;
    case "presion_clasico":
      state._clasicoPressure = true;
      state.pressHeat = Math.min(100, (state.pressHeat || 0) + 12);
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
      state.pressHeat = Math.min(100, (state.pressHeat || 0) + 18);
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
  const benched = !injured && !!state._benchedNextMatch;
  const sidelined = injured || benched;
  const ovr = sidelined ? Math.round(state.club.prestige * 0.78) : state.player.ovr;
  const forma = sidelined ? 55 : state.player.forma;
  const homeBonus = match.home ? 5 : -3;
  const rivalStr = (match.rival.prestige || 70) * 0.68 + Math.random() * 15;
  const myStr = ovr + (forma - 50) * 0.25 + homeBonus + (Math.random() * 18 - 9);

  // Situation modifier (no aplica si el jugador no está en cancha)
  let sitMod = 0;
  if (!sidelined && situationChoice !== null && situationChoice !== undefined && match.situation) {
    const sfx = match.situation.effects[situationChoice];
    sitMod = (sfx.rendimiento || 0) * 3;
    if ((sfx.riesgo || 0) > 0 && Math.random() < 0.3) sitMod -= 5;
  }

  // Clasico pressure
  if (!sidelined && match.type === "clasico" && state._clasicoPressure) {
    sitMod += Math.random() > 0.5 ? 8 : -8;
    delete state._clasicoPressure;
  }

  const finalMy = myStr + sitMod;
  const diff = finalMy - rivalStr;
  const win = diff > 3;
  const draw = Math.abs(diff) <= 3;
  const loss = !win && !draw;

  // Player stats — el arquetipo (estilo de juego) inclina el reparto entre
  // gol propio y asistencia: un "Cazagoles" mete más goles y da menos
  // asistencias que un "Falso 9", por ejemplo.
  let goals = 0, assists = 0;
  const pos = state.player.position;
  const archDef = (ARCHETYPES[pos] || []).find(a => a.id === state.player.archetype);
  const goalBias = archDef ? archDef.goalBias : 1;
  const assistBias = archDef ? archDef.assistBias : 1;
  if (!sidelined && (win || draw)) {
    if (pos === "delantero") {
      if (Math.random() < 0.45 * goalBias) goals = 1;
      if (Math.random() < 0.18 * goalBias) goals = 2;
      if (Math.random() < 0.25 * assistBias) assists = 1;
    } else if (pos === "mediocampista") {
      if (Math.random() < 0.18 * goalBias) goals = 1;
      if (Math.random() < 0.38 * assistBias) assists = 1;
      if (Math.random() < 0.1 * assistBias) assists = 2;
    } else {
      if (Math.random() < 0.1 * goalBias) goals = 1;
      if (Math.random() < 0.16 * assistBias) assists = 1;
    }

    // Ser el pateador de penales del equipo da una chance extra de gol,
    // sin importar el puesto (ver decisión libre "Pedir patear los penales").
    if (state.player.setPieceRole === "penales" && Math.random() < 0.12) goals += 1;
  }

  // El marcador siempre respeta win/draw/loss Y nunca contradice lo que hizo
  // el jugador: si metiste 2 goles, el equipo metió como mínimo esos 2 (antes
  // se sorteaban por completo aparte y podía salir "1-0" con 2 goles tuyos).
  const teamFloor = goals + assists;
  let teamGoals, rivalGoals;
  if (win) {
    rivalGoals = Math.floor(Math.random() * 2);
    teamGoals = Math.max(teamFloor, rivalGoals + 1 + Math.floor(Math.random() * 2));
  } else if (loss) {
    teamGoals = Math.max(teamFloor, Math.floor(Math.random() * 2));
    rivalGoals = Math.max(teamGoals + 1 + Math.floor(Math.random() * 2), teamGoals + 1);
  } else {
    teamGoals = rivalGoals = Math.max(teamFloor, Math.floor(Math.random() * 3));
  }

  const result = { win, draw, loss, teamGoals, rivalGoals, goals, assists, injured, benched };
  match.played = true;
  match.result = result;

  if (!sidelined) {
    // Update career stats
    state.career.goals += goals;
    state.career.assists += assists;
    state.career.seasonGoals += goals;
    state.career.seasonAssists += assists;
    state.career.appearances += 1;

    // Forma update — los rasgos permanentes (ver TRAIT_DEFS) suman matices acá.
    const traits = state.player.traits || [];
    if (win) {
      const bonus = traits.includes("lider") ? 1 : 0;
      state.player.forma = Math.min(100, state.player.forma + 6 + bonus);
    } else if (loss) {
      const softened = traits.includes("solitario") ? 4 : 7;
      state.player.forma = Math.max(10, state.player.forma - softened);
    }
  }

  if (benched) delete state._benchedNextMatch;

  return result;
}

function advanceWeek() {
  // Si había un partido programado para esta semana y no se jugó a mano
  // (pantalla de partido con situaciones), se resuelve solo antes de pasar
  // de semana — antes quedaba sin jugarse para siempre si no lo tocabas.
  const dueMatch = state.schedule.matches.find(m => m.week === state.career.week && !m.played);
  if (dueMatch) {
    const result = resolveMatch(dueMatch.id, null);
    if (result) {
      const label = result.win ? "Victoria" : result.draw ? "Empate" : "Derrota";
      const personal = result.goals > 0
        ? ` (marcaste ${result.goals} gol${result.goals > 1 ? "es" : ""})`
        : result.assists > 0
          ? ` (diste ${result.assists} asistencia${result.assists > 1 ? "s" : ""})`
          : "";
      addNews(`⚽ ${label} ${result.teamGoals}-${result.rivalGoals} vs ${dueMatch.rival.name}${personal}.`, true);
    }
    simulateLeagueMatchday(dueMatch);
  }

  // ── Cláusula de rescisión: un club rival la puede pagar y forzarte la
  // salida, aunque vos no quieras irte. Sólo aplica si sos bueno, tu
  // relación con el DT no es pésima (si es mala, es tu club el que te
  // deja ir más fácil, no un extraño pagando de golpe) y no pasó hace poco.
  if (!state._clauseCooldownUntil || state.career.week >= state._clauseCooldownUntil) {
    const clause = buyoutClause(state.player, state.club);
    const buyerChance = state.player.ovr >= 78 ? 0.02 : 0.008;
    if (clause < 900000000 && Math.random() < buyerChance) {
      const buyer = pickOfferClub(state.club);
      if (buyer && buyer.prestige >= state.club.prestige) {
        addNews(`💸 ${buyer.name} pagó tu cláusula de rescisión (€${(clause / 1000000).toFixed(1)}M). El pase se cerró sin que nadie te preguntara.`, true);
        state.club = buyer;
        state.player.dtRelation = 50;
        state.leagueTable = buildLeagueTable(buyer);
        state.seasonObjective = assignSeasonObjective(buyer);
        regenerateRemainingMatches(buyer);
        state._clauseCooldownUntil = state.career.week + 10;
      }
    }
  }

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
  state.player.forma = Math.round(Math.max(10, Math.min(100, state.player.forma + (Math.random() * 4 - 2))));

  // ── Lesiones ──
  if (state.player.injuryStatus) {
    state.player.injuryStatus.weeksLeft--;
    if (state.player.injuryStatus.weeksLeft <= 0) {
      addNews(`Te recuperaste de tu ${state.player.injuryStatus.name.toLowerCase()}. Volvés a estar disponible.`, true);
      state.player.injuryStatus = null;
      state.player.injuryRisk = Math.max(10, state.player.injuryRisk - 20);
    }
  } else {
    const chronicMult = state.player.chronicWeakness ? 1.6 : 1;
    const weeklyChance = (0.015 + (state.player.injuryRisk / 100) * 0.05) * chronicMult;
    if (Math.random() < weeklyChance) {
      const type = pickInjuryType();
      state.player.injuryStatus = { name: type.name, weeksLeft: type.weeks };
      state.player.forma = Math.max(10, state.player.forma - 6);
      addNews(`🩹 Sufriste ${type.name.toLowerCase()}. Vas a estar afuera ${type.weeks} semana${type.weeks === 1 ? "" : "s"}.`, true);

      // Lesión crónica: si te repetís el mismo tipo de lesión una segunda vez,
      // te queda una debilidad permanente en esa zona (más chance a futuro).
      if (!state.player.injuryHistory) state.player.injuryHistory = [];
      state.player.injuryHistory.push(type.name);
      const repeats = state.player.injuryHistory.filter(n => n === type.name).length;
      if (repeats >= 2 && state.player.chronicWeakness !== type.name) {
        state.player.chronicWeakness = type.name;
        addNews(`⚠️ Te quedó una debilidad crónica de ${type.name.toLowerCase()}: vas a ser más propenso a repetirla.`, true);
      }
    } else {
      state.player.injuryRisk = Math.max(10, state.player.injuryRisk - 1);
    }
  }

  // ── Eventos de vida y patrocinio personal ──
  maybeTriggerLifeEvent();
  tickLifeEvent();
  if (state.player.personalSponsor && state.player.forma < state.player.personalSponsor.minForma) {
    addNews(`📉 ${state.player.personalSponsor.label} rescindió tu contrato: tu nivel viene muy por debajo de lo pactado.`, true);
    state.player.personalSponsor = null;
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

  // ── Prensa acumulada: mucho ruido seguido dispara una crisis mediática ──
  const traitsNow = state.player.traits || [];
  const pressDecay = traitsNow.includes("fiestero") ? 9 : 5;
  state.pressHeat = Math.max(0, (state.pressHeat || 0) - pressDecay);
  if (traitsNow.includes("profesional")) {
    state.player.dtRelation = Math.min(100, state.player.dtRelation + 1);
  }
  let forcedDecision = null;
  if (state.pressHeat >= 60) {
    addNews("📰 Los medios no te sueltan. Se armó una bola de nieve mediática.", true);
    forcedDecision = CRISIS_DECISIONS[Math.floor(Math.random() * CRISIS_DECISIONS.length)];
    state.pressHeat = 20;
  } else if (state.pressHeat >= 40 && state.pressHeat < 45) {
    addNews("Empezás a notar que la prensa junta material sobre vos.");
  }

  // ── Rival de vestuario: alguien te disputa el puesto ──
  // La relación con el DT ahora pesa acá: con buena relación cuesta más que
  // te bajen del 11, y si ya sos titular indiscutido el técnico no te toca
  // salvo que la diferencia de nivel sea enorme.
  if (state.player.rival) {
    if (state.career.week % 4 === 0) {
      state.player.rival.ovr = Math.min(95, state.player.rival.ovr + Math.floor(Math.random() * 3));
    }
    const gap = state.player.rival.ovr - state.player.ovr;
    const dtShield = (state.player.dtRelation - 50) / 400; // +/- ~0.12 según relación
    const starterShield = state.player.isStarter ? 0.12 : 0;
    const benchChance = Math.max(0.03, 0.18 - dtShield - starterShield);
    const benchGapThreshold = state.player.isStarter ? 9 : 6;
    if (gap >= benchGapThreshold && Math.random() < benchChance) {
      state._benchedNextMatch = true;
      state.player.dtRelation = Math.max(0, state.player.dtRelation - 3);
      addNews(`El técnico le dio minutos a ${state.player.rival.name} en tu puesto. Se está haciendo un lugar.`, true);
    }
  }

  // ── Relación muy mala con el DT: empieza a jugarte en contra ──
  if (state.player.dtRelation < 15 && Math.random() < 0.25) {
    state.player.forma = Math.max(10, state.player.forma - 4);
    addNews("El cuerpo técnico no te tiene confianza. Se nota en cómo te tratan día a día.", true);
  }

  // New decision for this week
  state.schedule.decisionUsed = false;
  state.schedule.currentDecision = forcedDecision || pickDecision();

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
    const focus = state.player.trainingFocus;
    pos.stats.forEach(s => {
      const gap = state.player.potential - (state.player.stats[s] || 60);
      if (gap > 0) {
        // El entrenamiento elegido concentra la mejora en esa zona (x2) y le
        // resta un poco al resto — no es más crecimiento total, es a dónde va.
        const focusMult = !focus ? 1 : s === focus ? 2 : 0.55;
        const delta = Math.floor(Math.random() * growRate * focusMult * (gap / 25 + 0.3));
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

  // ── Objetivo de temporada: se evalúa con la tabla tal cual quedó ──
  const finishedSeason = state.career.season;
  const finalPosition = myLeaguePosition();
  const objective = state.seasonObjective;
  if (objective && finalPosition != null) {
    const objectiveMet = finalPosition <= objective.targetPosition;
    if (finalPosition === 1) {
      addTrophy(`Campeón de liga`, finishedSeason);
      addNews(`🏆 ¡Campeón! Terminaste 1° con ${state.club.name}.`, true);
      state.player.dtRelation = Math.min(100, state.player.dtRelation + 8);
    } else if (objectiveMet) {
      addNews(`✅ Objetivo cumplido: terminaste ${finalPosition}° de ${objective.leagueSize} (buscabas "${objective.label.toLowerCase()}").`, true);
      state.player.dtRelation = Math.min(100, state.player.dtRelation + 3);
    } else {
      addNews(`❌ Objetivo incumplido: terminaste ${finalPosition}° de ${objective.leagueSize}, se pedía "${objective.label.toLowerCase()}".`, true);
      state.player.dtRelation = Math.max(0, state.player.dtRelation - 6);
    }
  }
  if (state.career.seasonGoals >= 20) {
    addTrophy(`Goleador (${state.career.seasonGoals} goles)`, finishedSeason);
    addNews(`⚽ Terminaste la temporada como goleador con ${state.career.seasonGoals} goles.`, true);
  }

  // ── Negociación con el agente: si la temporada fue buena, en vez de una
  // sola oferta tomalo-o-dejalo, el agente trae 2-3 alternativas reales
  // (plata/prestigio/continuidad) para elegir entre ellas.
  if (!state.agentOffers && finalPosition != null && finalPosition <= 3 && state.player.ovr >= 70 && Math.random() < 0.5) {
    const candidates = allClubs()
      .filter(c => c.id !== state.club.id && c.prestige >= state.club.prestige - 15)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    if (candidates.length >= 2) {
      state.agentOffers = candidates.map(c => ({ club: c }));
      addNews(`🤝 Tu agente te trae ${candidates.length} propuestas para la próxima temporada. Revisalas con calma.`, true);
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
  state.leagueTable = buildLeagueTable(state.club);
  state.seasonObjective = assignSeasonObjective(state.club);

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

function initNewGame(name, position, archetype, club, country, ironman) {
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
      isStarter: null,
      isCaptain: false,
      setPieceRole: null,
      salaryLevel: 0,
      trainingFocus: null,
      injuryRisk: 15,
      injuryStatus: null,
      personality: { lider: 0, solitario: 0, fiestero: 0, profesional: 0 },
      personalityRevealed: null,
      rival: generateRivalTeammate(ovr),
      traits: [],
      lifeEvent: null,
      personalSponsor: null,
      chronicWeakness: null,
      injuryHistory: [],
    },
    club,
    ironman: !!ironman,
    pendingOffer: null,
    agentOffers: null,
    leagueTable: buildLeagueTable(club),
    seasonObjective: assignSeasonObjective(club),
    pressHeat: 0,
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
    freeDecisionCooldowns: {},
    decisionHistory: [],
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
  if (state && state.club) applyClubTheme(state.club); else resetClubTheme();
  switch (currentView) {
    case "menu":       app.innerHTML = renderMenu(); break;
    case "creation":   app.innerHTML = renderCreation(); break;
    case "hub":        app.innerHTML = renderHub(); break;
    case "decisions":  app.innerHTML = renderDecisions(); break;
    case "historial":  app.innerHTML = renderHistorial(); break;
    case "entrenamiento": app.innerHTML = renderEntrenamiento(); break;
    case "liga":       app.innerHTML = renderLiga(); break;
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
        <a class="btn btn-ghost" href="/cotrero.html" style="text-align:center;text-decoration:none">← Cambiar de modo</a>
        <a class="btn btn-ghost" href="/" style="text-align:center;text-decoration:none">🏠 Menú principal de Futotal</a>
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
        <button
          class="stat-summary-box"
          data-action="toggle_ironman"
          style="width:100%;text-align:left;padding:12px 16px;cursor:pointer;display:flex;align-items:center;gap:10px;border-color:${creation.ironman ? "var(--danger)" : "var(--border)"}"
        >
          <span style="font-size:20px">${creation.ironman ? "☑" : "☐"}</span>
          <span>
            <span style="display:block;font-weight:700;color:${creation.ironman ? "var(--danger)" : "var(--text)"}">Modo Ironman</span>
            <span style="display:block;font-size:12px;color:var(--text-muted)">Sin poder esquivar decisiones ni evitar las situaciones tácticas del partido. Cada elección pesa.</span>
          </span>
        </button>
      </div>
      <div class="creation-footer container">
        <button class="btn btn-outline" style="max-width:120px" data-action="creation_back3">Volver</button>
        <button class="btn btn-primary" data-action="start_game" ${!creation.name.trim() ? "disabled" : ""}>Empezar carrera</button>
      </div>
    </div>
  `;
}

// Hay algo para hacer en Decisiones si: la decisión semanal está pendiente,
// o alguna decisión libre está disponible (sin bloqueo y sin enfriamiento) —
// así el puntito avisa también cuando un enfriamiento recién se cumplió.
function hasAvailableFreeDecision() {
  if (!state.freeDecisionCooldowns) state.freeDecisionCooldowns = {};
  const p = state.player;
  const week = absWeek(state.career);
  return FREE_DECISIONS.some(def => {
    if (def.blocked && def.blocked(p)) return false;
    const lastWeek = state.freeDecisionCooldowns[def.id];
    return lastWeek == null || week - lastWeek >= def.cooldownWeeks;
  });
}

function renderTabBar(active) {
  const pendingDecision = !!(state.schedule?.currentDecision && !state.schedule?.decisionUsed);
  const showDot = pendingDecision || hasAvailableFreeDecision();
  return `
    <div class="hub-tabs">
      <button class="hub-tab ${active === "hub" ? "active" : ""}" data-action="go_hub">Inicio</button>
      <button class="hub-tab ${active === "decisions" ? "active" : ""}" data-action="go_decisions">
        Decisiones${showDot ? `<span class="hub-tab-dot"></span>` : ""}
      </button>
      <button class="hub-tab ${active === "historial" ? "active" : ""}" data-action="go_historial">Historial</button>
      <button class="hub-tab ${active === "entrenamiento" ? "active" : ""}" data-action="go_entrenamiento">Entrenamiento</button>
      <button class="hub-tab ${active === "liga" ? "active" : ""}" data-action="go_liga">Liga</button>
    </div>
  `;
}

function dtRelationColor(val) {
  return val >= 65 ? "#3FAE9A" : val >= 35 ? "#D9A441" : "#F0907E";
}

function salaryAmount(p) {
  const base = 8000 + p.ovr * 300;
  return Math.round(base * (1 + (p.salaryLevel || 0) * 0.18));
}

function buyoutClause(p, club) {
  const base = (p.ovr * 1.2 + (p.salaryLevel || 0) * 15 + (p.dtRelation ?? 50) * 0.6) * ((club?.prestige || 70) / 70);
  return Math.round(base) * 100000;
}

function formatMoney(n) {
  return "$" + n.toLocaleString("es-AR");
}

function renderHub() {
  const p = state.player;
  const pos = POSITIONS[p.position];
  const career = state.career;
  const schedule = state.schedule;

  const formaColor = p.forma >= 70 ? "#3FAE9A" : p.forma >= 45 ? "#D9A441" : "#F0907E";
  const dtColor = dtRelationColor(p.dtRelation ?? 50);
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

      ${renderTabBar("hub")}

      <div class="hub-body">
        <!-- Player card -->
        <div class="card player-card">
          <div class="card-body">
            <div class="player-identity">
              ${clubCrestHtml(state.club, 48)}
              <div>
                <div class="player-name">${p.name}</div>
                <div class="player-meta">${p.country ? p.country.flag + " " : ""}${pos.label} · ${p.age} años · <span style="color:var(--gold);font-weight:700">${state.club.name}</span></div>
                ${p.archetypeName ? `<div class="player-meta" style="margin-top:2px;color:var(--gold-dim)">${p.archetypeName}</div>` : ""}
                ${p.dynastyGeneration ? `<div class="player-meta" style="margin-top:2px;color:var(--gold-dim)">👨‍👦 Generación ${p.dynastyGeneration}</div>` : ""}
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
                <div class="forma-bar-fill" style="width:${Math.round(p.forma)}%;background:${formaColor}"></div>
              </div>
              <div class="forma-value" style="color:${formaColor}">${Math.round(p.forma)}</div>
            </div>

            <div class="forma-row" style="margin-top:8px;padding-top:0;border-top:none">
              <div class="forma-label">DT</div>
              <div class="forma-bar-bg">
                <div class="forma-bar-fill" style="width:${p.dtRelation ?? 50}%;background:${dtColor}"></div>
              </div>
              <div class="forma-value" style="color:${dtColor}">${p.dtRelation ?? 50}</div>
            </div>

            ${p.isStarter ? `
              <div style="margin-top:12px;padding:10px 12px;background:var(--gold-subtle);border:1px solid var(--gold-border);border-radius:6px;display:flex;align-items:center;gap:8px">
                <span style="font-size:18px">🎯</span>
                <span style="font-size:13px;color:var(--gold)">Titular indiscutido</span>
              </div>
            ` : ""}

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

            ${p.rival ? `
              <div style="margin-top:12px;padding:10px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;display:flex;align-items:center;justify-content:space-between;gap:8px">
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-size:16px">🥊</span>
                  <span style="font-size:12px;color:var(--text-muted)">Compite por tu puesto: <b style="color:var(--text)">${p.rival.name}</b></span>
                </div>
                <span style="font-size:12px;font-weight:700;color:${p.rival.ovr > p.ovr ? "var(--danger)" : "var(--text-muted)"}">${p.rival.ovr} OVR</span>
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

        <!-- Ofertas del agente (varias, elegís una o te quedás) -->
        ${state.agentOffers ? `
          <div class="card" style="border-color:var(--gold-border)">
            <div class="card-header">🤝 Propuestas de tu agente</div>
            <div class="card-body" style="display:flex; flex-direction:column; gap:8px">
              ${state.agentOffers.map((o, i) => `
                <button class="btn btn-outline" data-action="choose_agent_offer" data-idx="${i}" style="text-align:left; display:flex; justify-content:space-between; align-items:center">
                  <span>${o.club.name}</span>
                  <span style="font-size:11px; color:var(--text-dim)">Prestigio ${o.club.prestige}</span>
                </button>
              `).join("")}
              <button class="btn btn-ghost" data-action="decline_agent_offers">Quedarme en ${state.club.name}</button>
            </div>
          </div>
        ` : ""}

        <!-- Actions this week -->
        <div class="card">
          <div class="card-header">Esta semana</div>
          <div>
            ${schedule.currentDecision && !schedule.decisionUsed ? `
              <div class="action-item" data-action="go_decisions">
                <div class="action-dot pulse" style="background:var(--gold)"></div>
                <div>
                  <div class="action-text">Hay una decisión pendiente</div>
                  <div class="action-sub">Andá a la pestaña Decisiones para resolverla</div>
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
          <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:8px">
            <button class="btn btn-primary" data-action="advance_week" data-weeks="1">Avanzar semana →</button>
            <button class="btn btn-outline" data-action="advance_week" data-weeks="2">+2 sem.</button>
            <button class="btn btn-outline" data-action="advance_week" data-weeks="3">+3 sem.</button>
            <button class="btn btn-outline" data-action="advance_week" data-weeks="4">+1 mes</button>
          </div>
        `}

        <button class="btn btn-ghost" data-action="go_menu" style="margin-top:8px">🏠 Volver al inicio</button>

        <div style="height:20px"></div>
      </div>
    </div>
  `;
}

function renderDecisions() {
  const p = state.player;
  const career = state.career;
  const schedule = state.schedule;
  if (!state.freeDecisionCooldowns) state.freeDecisionCooldowns = {};
  const week = absWeek(career);
  const last = state._lastFreeDecisionResult;

  return `
    <div class="screen hub-screen fade-in">
      <div class="hub-topbar">
        <div class="hub-logo">COTRERO</div>
        <div class="hub-week">Temporada ${career.season} · Semana ${career.week}/34</div>
      </div>

      ${renderTabBar("decisions")}

      <div class="hub-body">
        <div class="card">
          <div class="card-header">Decisión de la semana</div>
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
          </div>
        </div>

        <div class="card">
          <div class="card-header">Relación con el DT</div>
          <div class="card-body">
            <div class="forma-row" style="margin-top:0;padding-top:0;border-top:none">
              <div class="forma-label">DT</div>
              <div class="forma-bar-bg">
                <div class="forma-bar-fill" style="width:${p.dtRelation ?? 50}%;background:${dtRelationColor(p.dtRelation ?? 50)}"></div>
              </div>
              <div class="forma-value" style="color:${dtRelationColor(p.dtRelation ?? 50)}">${p.dtRelation ?? 50}</div>
            </div>
            ${p.isStarter ? `<p style="margin-top:12px;font-size:12px;color:var(--gold)">🎯 Sos titular indiscutido.</p>` : ""}
            ${p.isCaptain ? `<p style="margin-top:8px;font-size:12px;color:var(--gold)">🧢 Sos el capitán del equipo.</p>` : ""}
            ${p.setPieceRole === "penales" ? `<p style="margin-top:8px;font-size:12px;color:var(--gold)">🎯 Pateador de penales del equipo.</p>` : ""}
            ${p.personalSponsor ? `<p style="margin-top:8px;font-size:12px;color:var(--gold)">🤳 Patrocinado por ${p.personalSponsor.label} (mantené la forma arriba de ${p.personalSponsor.minForma}).</p>` : ""}
            ${p.lifeEvent ? `<p style="margin-top:8px;font-size:12px;color:var(--gold)">💍 ${p.lifeEvent.label} (${p.lifeEvent.weeksLeft} sem. restantes de estabilidad extra).</p>` : ""}
            ${p.chronicWeakness ? `<p style="margin-top:8px;font-size:12px;color:var(--danger)">⚠️ Debilidad crónica: ${p.chronicWeakness}.</p>` : ""}
            <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted)">
              <span>💰 Sueldo semanal</span>
              <span style="color:var(--text);font-weight:600">${formatMoney(salaryAmount(p))}</span>
            </div>
            <div style="margin-top:6px;display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted)">
              <span>📄 Cláusula de rescisión</span>
              <span style="color:var(--text);font-weight:600">${formatMoney(buyoutClause(p, state.club))}</span>
            </div>
          </div>
        </div>

        ${last ? `
          <div class="card free-result-flash" style="border-color:${last.success ? "var(--gold-border)" : "rgba(240,144,126,0.4)"}">
            <div class="card-body">
              <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;color:${last.success ? "var(--gold)" : "var(--danger)"}">
                ${last.success ? "✅ Salió bien" : "⚠️ Salió mal"}
              </div>
              <div style="font-size:13px;color:${last.success ? "var(--gold)" : "var(--danger)"}">${last.text}</div>
            </div>
          </div>
        ` : ""}

        <div class="card">
          <div class="card-header">Decisiones libres</div>
          <div>
            ${FREE_DECISIONS.map(def => {
              const blockedReason = def.blocked && def.blocked(p);
              const lastWeek = state.freeDecisionCooldowns[def.id];
              const weeksLeft = lastWeek != null ? def.cooldownWeeks - (week - lastWeek) : 0;
              const onCooldown = weeksLeft > 0;
              const disabled = !!blockedReason || onCooldown;
              return `
                <div class="action-item ${disabled ? "disabled" : ""}" ${disabled ? "" : `data-action="free_decision" data-id="${def.id}"`}>
                  <div class="action-dot" style="background:${disabled ? "var(--text-dim)" : "var(--gold)"}"></div>
                  <div>
                    <div class="action-text">${def.icon} ${def.label}</div>
                    <div class="action-sub">${blockedReason || (onCooldown ? `Podés volver a intentarlo en ${weeksLeft} sem.` : def.sub)}</div>
                  </div>
                  ${disabled ? "" : `<div class="action-arrow">→</div>`}
                </div>
              `;
            }).join("")}
          </div>
        </div>

        <div style="height:20px"></div>
      </div>
    </div>
  `;
}

function renderHistorial() {
  const history = state.decisionHistory || [];
  return `
    <div class="screen hub-screen fade-in">
      <div class="hub-topbar">
        <div class="hub-logo">COTRERO</div>
        <div class="hub-week">Temporada ${state.career.season} · Semana ${state.career.week}/34</div>
      </div>

      ${renderTabBar("historial")}

      <div class="hub-body">
        <div class="card">
          <div class="card-header">Historial de decisiones</div>
          <div>
            ${history.length === 0 ? `
              <div class="card-body" style="color:var(--text-muted);font-size:13px">
                Todavía no tomaste ninguna decisión esta carrera.
              </div>
            ` : history.map(h => `
              <div class="history-item">
                <div class="history-week">Temporada ${h.season} · Semana ${h.week} · ${h.type === "semanal" ? "Decisión semanal" : "Decisión libre"}</div>
                <div class="history-label">${h.label}</div>
                <div class="history-choice" style="color:${
                  h.type === "libre"
                    ? (h.success ? "var(--gold)" : "var(--danger)")
                    : "var(--text)"
                }">
                  ${h.type === "libre" ? (h.success ? "✅ " : "⚠️ ") : "→ "}${h.text}
                </div>
              </div>
            `).join("")}
          </div>
        </div>

        <div style="height:20px"></div>
      </div>
    </div>
  `;
}

function renderEntrenamiento() {
  const p = state.player;
  const pos = POSITIONS[p.position];
  const focus = p.trainingFocus;

  return `
    <div class="screen hub-screen fade-in">
      <div class="hub-topbar">
        <div class="hub-logo">COTRERO</div>
        <div class="hub-week">Temporada ${state.career.season} · Semana ${state.career.week}/34</div>
      </div>

      ${renderTabBar("entrenamiento")}

      <div class="hub-body">
        <div class="card">
          <div class="card-header">Foco de entrenamiento</div>
          <div class="card-body">
            <p style="font-size:12.5px;color:var(--text-muted);margin-bottom:14px">
              Elegí en qué zona concentrar tu trabajo. Al cierre de cada temporada, esa estadística
              crece bastante más que el resto (no es más crecimiento total: es a dónde va).
            </p>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">
              ${pos.stats.map(s => `
                <button class="btn ${focus === s ? "btn-primary" : "btn-outline"}" data-action="set_training_focus" data-stat="${s}" style="padding:12px 8px">
                  <div style="font-size:12.5px;font-weight:700">${pos.labels[s]}</div>
                  <div style="font-size:16px;font-weight:900;margin-top:2px">${p.stats[s] || 60}</div>
                </button>
              `).join("")}
            </div>
            ${focus ? `
              <p style="margin-top:14px;font-size:12px;color:var(--gold)">
                🎯 Entrenando ${pos.labels[focus]}. Se nota al cierre de la temporada ${state.career.season}.
              </p>
            ` : `
              <p style="margin-top:14px;font-size:12px;color:var(--text-dim)">
                Sin foco elegido: el crecimiento se reparte parejo entre todas tus estadísticas.
              </p>
            `}
          </div>
        </div>

        <div style="height:20px"></div>
      </div>
    </div>
  `;
}

function renderLiga() {
  const p = state.player;
  const table = sortedLeagueTable();
  const objective = state.seasonObjective;
  const myPos = myLeaguePosition();
  const trophies = state.career.trophies || [];
  const potentialPct = Math.round((p.ovr / p.potential) * 100);

  return `
    <div class="screen hub-screen fade-in">
      <div class="hub-topbar">
        <div class="hub-logo">COTRERO</div>
        <div class="hub-week">Temporada ${state.career.season} · Semana ${state.career.week}/34</div>
      </div>

      ${renderTabBar("liga")}

      <div class="hub-body">
        ${objective ? `
          <div class="card">
            <div class="card-header">Objetivo de la temporada</div>
            <div class="card-body">
              <p style="font-size:14px;font-weight:700;margin-bottom:4px">${objective.label}</p>
              <p style="font-size:12px;color:var(--text-muted)">
                Necesitás terminar ${objective.targetPosition}° o mejor de ${objective.leagueSize}.
                ${myPos ? `Ahora mismo estás ${myPos}°.` : ""}
              </p>
            </div>
          </div>
        ` : ""}

        <div class="card">
          <div class="card-header">Tabla de posiciones</div>
          <div class="card-body" style="overflow-x:auto">
            <table style="width:100%; border-collapse:collapse; font-size:12.5px; white-space:nowrap">
              <thead>
                <tr style="color:var(--text-dim); text-align:left">
                  <th style="padding:4px 6px">#</th>
                  <th style="padding:4px 6px">Club</th>
                  <th style="padding:4px 6px; text-align:center">PJ</th>
                  <th style="padding:4px 6px; text-align:center">G</th>
                  <th style="padding:4px 6px; text-align:center">E</th>
                  <th style="padding:4px 6px; text-align:center">P</th>
                  <th style="padding:4px 6px; text-align:center">DG</th>
                  <th style="padding:4px 6px; text-align:center">Pts</th>
                </tr>
              </thead>
              <tbody>
                ${table.map((row, i) => `
                  <tr style="border-top:1px solid var(--border); ${row.id === state.club.id ? "color:var(--gold); font-weight:700" : ""}">
                    <td style="padding:5px 6px">${i + 1}</td>
                    <td style="padding:5px 6px">${row.name}</td>
                    <td style="padding:5px 6px; text-align:center">${row.played}</td>
                    <td style="padding:5px 6px; text-align:center">${row.won}</td>
                    <td style="padding:5px 6px; text-align:center">${row.drawn}</td>
                    <td style="padding:5px 6px; text-align:center">${row.lost}</td>
                    <td style="padding:5px 6px; text-align:center">${row.gf - row.ga}</td>
                    <td style="padding:5px 6px; text-align:center">${row.pts}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Margen de crecimiento</div>
          <div class="card-body">
            <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted); margin-bottom:6px">
              <span>OVR actual: ${p.ovr}</span>
              <span>Potencial: ${p.potential}</span>
            </div>
            <div class="forma-bar-bg"><div class="forma-bar-fill" style="width:${Math.min(100, potentialPct)}%; background:var(--gold)"></div></div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Vitrina de trofeos</div>
          <div class="card-body">
            ${trophies.length === 0 ? `
              <p style="font-size:12.5px; color:var(--text-dim)">Todavía no ganaste nada. Empezá por la liga.</p>
            ` : `
              <div style="display:flex; flex-wrap:wrap; gap:8px">
                ${trophies.map(t => `
                  <span style="display:inline-flex; align-items:center; gap:6px; padding:8px 12px; border-radius:999px; border:1px solid var(--gold-border); background:var(--gold-subtle); font-size:12px">
                    🏆 ${t.name} <span style="color:var(--text-dim)">· T${t.season}</span>
                  </span>
                `).join("")}
              </div>
            `}
          </div>
        </div>

        ${p.traits && p.traits.length ? `
          <div class="card">
            <div class="card-header">Rasgos permanentes</div>
            <div class="card-body" style="display:flex; flex-direction:column; gap:8px">
              ${p.traits.map(key => `
                <div>
                  <p style="font-size:13px; font-weight:700; color:var(--gold)">⭐ ${TRAIT_DEFS[key].name}</p>
                  <p style="font-size:12px; color:var(--text-muted)">${TRAIT_DEFS[key].desc}</p>
                </div>
              `).join("")}
            </div>
          </div>
        ` : ""}

        <div style="height:20px"></div>
      </div>
    </div>
  `;
}

function renderDecision() {
  const d = state.schedule.currentDecision;
  if (!d) { navigate("decisions"); return ""; }
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

      ${state.ironman ? `
        <p class="decision-note container" style="color:var(--danger)">🔒 Modo Ironman: tenés que elegir una opción.</p>
      ` : `
        <div style="margin-top:20px" class="container">
          <button class="btn btn-ghost" data-action="close_decision">← Volver sin decidir</button>
        </div>
      `}
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
        ` : state._benchedNextMatch ? `
          <div class="card" style="padding:20px;text-align:center">
            <div style="font-size:14px;color:var(--gold);line-height:1.6">
              🪑 El técnico eligió a ${state.player.rival ? state.player.rival.name : "tu competencia"} en tu puesto para este partido.
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
          ${state.ironman ? `
            <p class="decision-note" style="color:var(--danger)">🔒 Modo Ironman: tenés que elegir una opción táctica.</p>
          ` : `
            <button class="btn btn-outline" data-action="resolve_match_sim" data-match="${match.id}">
              Simular sin decidir
            </button>
          `}
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
      ` : result.benched ? `
        <p style="text-align:center;color:var(--gold);font-size:13px;margin-top:4px">🪑 No jugaste este partido — el técnico eligió a otro en tu puesto.</p>
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
  recordDynastyGeneration();
  const dynasty = getDynasty();
  if (wasWeeklyChallenge && state) {
    weeklyScoreSubmitted = true;
    var trophyCount = (state.career.trophies || []).length;
    var finalScore = Math.round(
      state.player.ovr * 5 + state.career.goals * 2 + state.career.assists * 1.5 + trophyCount * 15
    );
    submitChallengeScore("cotrero", finalScore);
  }
  // Ranking histórico del grupo (no se resetea cada semana como el reto de
  // arriba — queda la mejor carrera de siempre de cada uno).
  if (state && !legacyScoreSubmitted) {
    legacyScoreSubmitted = true;
    const trophyCount2 = (state.career.trophies || []).length;
    const legacyScore = Math.round(
      state.player.ovr * 5 + state.career.goals * 2 + state.career.assists * 1.5 + trophyCount2 * 15
    );
    submitChallengeScore("cotrero_legado", legacyScore);
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
      ${career.seasonHistory && career.seasonHistory.length > 0 ? `
        <div class="card" style="width:100%;max-width:480px">
          <div class="card-header">La película completa</div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:0">
            ${career.seasonHistory.map((s, i) => `
              <div style="display:flex;gap:10px;padding:8px 0;${i > 0 ? "border-top:1px dashed var(--border)" : ""}">
                <div style="font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:18px;color:var(--gold-dim);width:26px;flex-shrink:0">${s.season}</div>
                <div style="flex:1;min-width:0">
                  <p style="font-size:13px;font-weight:600">${s.club} · ${s.age} años</p>
                  <p style="font-size:11.5px;color:var(--text-muted)">${s.goals} goles, ${s.assists} asistencias · ${s.ovr} OVR</p>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}
      ${(state && (state.career.trophies || []).length > 0) ? `
        <div class="card" style="width:100%;max-width:480px">
          <div class="card-header">Vitrina final</div>
          <div class="card-body" style="display:flex;flex-wrap:wrap;gap:8px">
            ${state.career.trophies.map(t => `
              <span style="display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:999px;border:1px solid var(--gold-border);background:var(--gold-subtle);font-size:12px">
                🏆 ${t.name} <span style="color:var(--text-dim)">· T${t.season}</span>
              </span>
            `).join("")}
          </div>
        </div>
      ` : ""}
      ${dynasty.length > 0 ? `
        <div class="card" style="width:100%;max-width:480px;border-color:var(--gold-border)">
          <div class="card-body">
            <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--gold-dim);margin-bottom:8px">
              Legado familiar · Generación ${dynasty[0].generation}
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:14px">
              ${dynasty.slice(0, 4).map(g => `
                <div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--text-muted)">
                  <span>Gen. ${g.generation} · ${g.name}</span>
                  <span>${g.peakOvr} OVR · ${g.goals} goles</span>
                </div>
              `).join("")}
            </div>
            <button class="btn btn-primary" data-action="start_heir">
              👨‍👦 Continuar el legado (Generación ${dynasty[0].generation + 1})
            </button>
          </div>
        </div>
      ` : ""}
      ${state && state.club && DT_COMPATIBLE_CLUBS.has(state.club.id) ? `
        <div class="card" style="width:100%;max-width:480px;border-color:var(--gold-border)">
          <div class="card-body" style="text-align:center">
            <div style="font-size:13px;color:var(--text-muted);margin-bottom:10px">
              Colgaste los botines en ${state.club.name}. ¿Y si seguís del otro lado de la línea?
            </div>
            <button class="btn btn-primary" data-action="epilogue_dt">⚽➡️🧢 Dirigí a ${state.club.name} en Modo Carrera DT</button>
          </div>
        </div>
      ` : ""}
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
      hofRecorded = false; weeklyScoreSubmitted = false; legacyScoreSubmitted = false;
      creation = { step: 1, position: null, archetype: null, shownArchetypes: [], name: "", countryIdx: 0, clubIdx: 0, ironman: false };
      navigate("creation");
      break;

    case "weekly_challenge": {
      hofRecorded = false; weeklyScoreSubmitted = false; legacyScoreSubmitted = false;
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

    case "start_heir": {
      const dynasty = getDynasty();
      const parent = dynasty[0];
      if (!parent) return;
      hofRecorded = false; weeklyScoreSubmitted = false; legacyScoreSubmitted = false;
      pendingDynasty = {
        bonus: dynastyBonusFor(parent.peakOvr),
        surname: familySurname(parent.name),
        generation: parent.generation + 1,
      };
      creation = {
        step: 1, position: null, archetype: null, shownArchetypes: [],
        name: pendingDynasty.surname ? `${pendingDynasty.surname} Jr.` : "",
        countryIdx: 0, clubIdx: 0, ironman: false,
      };
      navigate("creation");
      break;
    }

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

    case "epilogue_dt":
      if (state && state.club) {
        try { localStorage.setItem("fq_dt_prefill_team", state.club.id); } catch (e) {}
      }
      window.location.href = "/carrera-dt";
      break;

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
      creation.shownArchetypes = shuffleArray(allArch).slice(0, 4);
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

    case "toggle_ironman":
      creation.ironman = !creation.ironman;
      render();
      break;

    case "start_game": {
      if (!creation.name.trim()) return;
      const country = COUNTRIES[creation.countryIdx];
      const club = country.clubs[creation.clubIdx];
      initNewGame(creation.name.trim(), creation.position, creation.archetype, club, country, creation.ironman);
      if (pendingDynasty) {
        state.player.potential = Math.min(99, state.player.potential + pendingDynasty.bonus);
        state.player.dynastyGeneration = pendingDynasty.generation;
        state.news.unshift(
          pendingDynasty.bonus > 0
            ? `👨‍👦 Generación ${pendingDynasty.generation} de la familia ${pendingDynasty.surname}: arrancás con un plus de potencial por el legado familiar.`
            : `👨‍👦 Generación ${pendingDynasty.generation} de la familia ${pendingDynasty.surname}. A escribir tu propia historia.`
        );
        save();
        pendingDynasty = null;
      }
      navigate("hub");
      break;
    }

    case "open_decision":
      navigate("decision");
      break;

    case "close_decision":
      navigate("decisions");
      break;

    case "go_decisions":
      navigate("decisions");
      break;

    case "go_historial":
      navigate("historial");
      break;

    case "go_entrenamiento":
      navigate("entrenamiento");
      break;

    case "go_liga":
      navigate("liga");
      break;

    case "set_training_focus":
      state.player.trainingFocus = el.dataset.stat;
      save();
      navigate("entrenamiento");
      break;

    case "free_decision":
      resolveFreeDecision(el.dataset.id);
      navigate("decisions");
      break;

    case "make_decision": {
      const d = state.schedule.currentDecision;
      if (!d || state.schedule.decisionUsed) return;
      const idx = parseInt(el.dataset.idx);
      applyDecisionEffects(d, idx);
      state.schedule.decisionUsed = true;
      save();
      navigate("decisions");
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
      simulateLeagueMatchday(match);
      maybeQueueInterview(match, result);
      save();
      document.getElementById("app").innerHTML = renderMatchResult(result, match);
      attachEvents();
      break;
    }

    case "resolve_match_sim": {
      const mId = el.dataset.match;
      const result = resolveMatch(mId, null);
      const match = state.schedule.matches.find(m => m.id === mId);
      simulateLeagueMatchday(match);
      maybeQueueInterview(match, result);
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

    case "choose_agent_offer": {
      if (!state.agentOffers) return;
      const idx = parseInt(el.dataset.idx, 10);
      const chosen = state.agentOffers[idx];
      if (!chosen) return;
      addNews(`✍️ Fichaje cerrado por tu agente: ahora jugás en ${chosen.club.name}.`, true);
      state.club = chosen.club;
      state.agentOffers = null;
      state.player.dtRelation = 50;
      state.leagueTable = buildLeagueTable(chosen.club);
      state.seasonObjective = assignSeasonObjective(chosen.club);
      regenerateRemainingMatches(chosen.club);
      save();
      navigate("hub");
      break;
    }

    case "decline_agent_offers":
      if (!state.agentOffers) return;
      addNews(`Le dijiste a tu agente que por ahora seguís en ${state.club.name}.`);
      state.agentOffers = null;
      save();
      navigate("hub");
      break;

    case "toggle_hof": {
      const id = el.dataset.id;
      if (expandedHofIds.has(id)) expandedHofIds.delete(id); else expandedHofIds.add(id);
      render();
      break;
    }

    case "advance_week": {
      const weeksToSkip = Math.max(1, parseInt(el.dataset.weeks, 10) || 1);
      for (let i = 0; i < weeksToSkip; i++) {
        if (state.career.week >= 34) break;
        advanceWeek();
      }
      navigate("hub");
      break;
    }

    case "end_season":
      navigate("season_end");
      break;

    case "next_season":
      pendingPersonalityReveal = null;
      startNewSeason();
      if (currentView !== "game_over") navigate("hub");
      break;

    case "new_game_after":
      hofRecorded = false; weeklyScoreSubmitted = false; legacyScoreSubmitted = false;
      deleteSave();
      creation = { step: 1, position: null, archetype: null, shownArchetypes: [], name: "", countryIdx: 0, clubIdx: 0, ironman: false };
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
