// Unifica la base de jugadores de Equipo-Jugador, Fichado, Fulbodle y Mentiroso
// en UN solo archivo maestro (server/data/equipo-jugador-players.json).
//
//   node server/scripts/unify-players.cjs            # aplica y reescribe el maestro
//   node server/scripts/unify-players.cjs --dry      # sólo informa, no escribe
//
// Qué hace, en orden:
//  1. Unifica nombres de clubes (alias + variantes con/sin tildes) y normaliza
//     nacionalidades y posiciones.
//  2. Fusiona jugadores repetidos ("Kylian Mbappe" / "Kylian Mbappé").
//  3. Suma los jugadores que sólo vivían en la base propia de Mentiroso
//     (server/data/mentiroso-legacy.json) — nombre, apodos aceptados y clubes.
//  4. Aplica server/data/players-additions.txt (jugadores nuevos y traspasos).
//  5. Genera client/public/js/mentiroso-players.js para Mentiroso.
//
// Fichado se regenera aparte con `npm run build:data` en goltexto/, que lee el
// mismo maestro. Es idempotente: correrlo dos veces da el mismo resultado.
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "../..");
const MASTER = path.join(ROOT, "server/data/equipo-jugador-players.json");
const ALIASES = path.join(ROOT, "server/data/club-aliases.json");
const LEGACY = path.join(ROOT, "server/data/mentiroso-legacy.json");
const ADDITIONS = path.join(ROOT, "server/data/players-additions.txt");
const MENTIROSO_OUT = path.join(ROOT, "client/public/js/mentiroso-players.js");
const DRY = process.argv.includes("--dry");

const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const key = (s) => fold(s).toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const SUFFIX = /\s*\((cedido|cantera)\)\s*$/i;

// ---------- clubes ----------
const aliasRaw = JSON.parse(fs.readFileSync(ALIASES, "utf8")).alias;
const CLUB_ALIAS = new Map(Object.entries(aliasRaw).map(([a, c]) => [key(a), c]));
const clubForm = new Map(); // key -> nombre canónico elegido

function splitSuffix(raw) {
  const m = String(raw).match(SUFFIX);
  return { base: String(raw).replace(SUFFIX, "").trim(), suffix: m ? ` (${m[1].toLowerCase()})` : "" };
}

// Primera pasada: para variantes que sólo difieren en tildes, gana la forma
// SIN tildes (es la convención de LEAGUE_MAP en Fichado y de league-clubs.js).
function registerClub(base) {
  const k = key(base);
  if (CLUB_ALIAS.has(k)) return;
  if (!clubForm.has(k)) clubForm.set(k, fold(base));
}
function canonClub(raw) {
  const { base, suffix } = splitSuffix(raw);
  const k = key(base);
  const canon = CLUB_ALIAS.get(k) || clubForm.get(k) || fold(base);
  return canon + suffix;
}

// ---------- nacionalidad y posición ----------
const NAT_FIX = {
  espana: "España", belgica: "Bélgica", "paises bajos": "Países Bajos", japon: "Japón", peru: "Perú",
  mexico: "México", canada: "Canadá", camerun: "Camerún", hungria: "Hungría", turquia: "Turquía",
  "republica checa": "República Checa", "bosnia y herzegovina": "Bosnia y Herzegovina", bosnia: "Bosnia y Herzegovina",
  "costa de marfil": "Costa de Marfil", tunez: "Túnez", argelia: "Argelia", grecia: "Grecia",
  "arabia saudita": "Arabia Saudita", "corea del sur": "Corea del Sur", "nueva zelanda": "Nueva Zelanda",
  "estados unidos": "Estados Unidos", "irlanda del norte": "Irlanda del Norte", rumania: "Rumania",
  islandia: "Islandia", eslovaquia: "Eslovaquia", eslovenia: "Eslovenia", ucrania: "Ucrania", suiza: "Suiza",
  escocia: "Escocia", nigeria: "Nigeria", "republica democratica del congo": "RD Congo", rdcongo: "RD Congo",
  finlandia: "Finlandia", montenegro: "Montenegro", armenia: "Armenia", kosovo: "Kosovo", georgia: "Georgia",
};
function canonNat(n) {
  if (!n) return n;
  const k = key(n);
  return NAT_FIX[k] || n.trim();
}
const POS_FIX = { portero: "Portero", arquero: "Portero", defensa: "Defensa", defensor: "Defensa", mediocampista: "Mediocampista", volante: "Mediocampista", delantero: "Delantero", extremo: "Delantero" };
const canonPos = (p) => POS_FIX[key(p)] || p;

// ---------- carrera ----------
function stintKey(c) {
  return `${key(splitSuffix(c.club).base)}|${c.inicio}`;
}
function mergeStints(a, b) {
  const out = [...a];
  const seen = new Set(a.map(stintKey));
  const clubs = new Set(a.map((c) => key(splitSuffix(c.club).base)));
  for (const c of b) {
    if (seen.has(stintKey(c))) continue;
    // Mismo club y años parecidos = mismo paso con otro nombre de club.
    const near = out.find((x) => key(splitSuffix(x.club).base) === key(splitSuffix(c.club).base) && Math.abs((x.inicio || 0) - (c.inicio || 0)) <= 1);
    if (near) continue;
    out.push(c);
    seen.add(stintKey(c));
    clubs.add(key(splitSuffix(c.club).base));
  }
  return out.sort((x, y) => (x.inicio || 0) - (y.inicio || 0));
}

function richerName(a, b) {
  const accents = (s) => (s.match(/[À-ſ]/g) || []).length;
  return accents(b) > accents(a) ? b : a;
}

// ---------- carga y normalización del maestro ----------
const master = JSON.parse(fs.readFileSync(MASTER, "utf8"));
const report = { merged: [], legacyAdded: [], legacyClubsMissing: [], additionsNew: [], transfers: [], skipped: [] };

for (const p of master.jugadores) for (const c of p.carrera || []) registerClub(splitSuffix(c.club).base);
const legacy = fs.existsSync(LEGACY) ? JSON.parse(fs.readFileSync(LEGACY, "utf8")) : [];
for (const l of legacy) for (const c of l.c) registerClub(splitSuffix(c).base);

const byKey = new Map();
const players = [];
for (const raw of master.jugadores) {
  const p = {
    nombre: raw.nombre,
    nacionalidad: canonNat(raw.nacionalidad),
    posicion: canonPos(raw.posicion),
    nacimiento: raw.nacimiento,
    carrera: (raw.carrera || []).map((c) => ({ club: canonClub(c.club), inicio: c.inicio, fin: c.fin ?? null })),
  };
  const k = key(p.nombre);
  const prev = byKey.get(k);
  if (prev) {
    report.merged.push(`${prev.nombre} + ${p.nombre}`);
    prev.nombre = richerName(prev.nombre, p.nombre);
    prev.carrera = mergeStints(prev.carrera, p.carrera);
    prev.nacimiento = prev.nacimiento || p.nacimiento;
    continue;
  }
  byKey.set(k, p);
  players.push(p);
}

function findPlayer(name, nat, clubs) {
  const direct = byKey.get(key(name));
  if (direct) return direct;
  const parts = key(name).split(" ");
  const last = parts[parts.length - 1];
  const cands = players.filter((q) => key(q.nombre).split(" ").pop() === last);
  const clubKeys = new Set((clubs || []).map((c) => key(splitSuffix(canonClub(c)).base)));
  const scored = cands
    .map((q) => ({ q, overlap: q.carrera.filter((c) => clubKeys.has(key(splitSuffix(c.club).base))).length }))
    .filter((x) => x.overlap >= Math.min(2, clubKeys.size) && (!nat || key(x.q.nacionalidad) === key(canonNat(nat))))
    .sort((a, b) => b.overlap - a.overlap);
  return scored.length === 1 || (scored[0] && scored[0].overlap > (scored[1]?.overlap || 0)) ? scored[0].q : null;
}

// ---------- Mentiroso: jugadores y apodos que sólo estaban ahí ----------
const nicknames = {}; // key(nombre) -> [apodos]
const legacyPending = [];
const NAME_MAP = new Map(); // "@Nombre en Mentiroso|Nombre en el maestro"
if (fs.existsSync(ADDITIONS)) {
  for (const line of fs.readFileSync(ADDITIONS, "utf8").split(/\r?\n/)) {
    if (line.startsWith("@")) {
      const [a, b] = line.slice(1).split("|").map((x) => x.trim());
      NAME_MAP.set(key(a), b);
    }
  }
}
for (const l of legacy) {
  let found = null;
  for (const nm of [NAME_MAP.get(key(l.n)) || l.n, ...(l.a || [])]) {
    found = byKey.get(key(nm));
    if (found) break;
  }
  if (!found) found = findPlayer(l.n, l.nat, l.c);
  if (!found) {
    legacyPending.push(l);
    continue;
  }
  if (l.a?.length) nicknames[key(found.nombre)] = [...new Set([...(nicknames[key(found.nombre)] || []), ...l.a])];
  const have = new Set(found.carrera.map((c) => key(splitSuffix(c.club).base)));
  const missing = l.c.map(canonClub).filter((c) => !have.has(key(splitSuffix(c).base)));
  if (missing.length) report.legacyClubsMissing.push(`${found.nombre}: ${[...new Set(missing)].join(", ")}`);
}

// ---------- adiciones (players-additions.txt) ----------
// Formatos (una línea por jugador, "#" comenta):
//   =Nombre|Nacionalidad|Posición|Nacimiento|Club:2015-2020;Club (cedido):2018-2019;Club:2020-
//       Jugador completo. Si ya existe, se completan datos y pasos que falten.
//   ~Nombre|Nacionalidad|Posición|Nacimiento|AñoDebut|AñoRetiro   (clubes vienen de Mentiroso, años repartidos)
//       Para leyendas de las que sólo hay la lista de clubes. Años APROXIMADOS.
//   +Nombre|Club:2015-2020;Club:2021-2022     suma pasos que faltan a un jugador que ya existe (falla si no lo encuentra)
//   >Nombre|Club nuevo|Año[|AñoFin]
//       Traspaso: cierra el paso abierto y abre el nuevo.
function parseStints(s) {
  return s.split(";").map((t) => t.trim()).filter(Boolean).map((t) => {
    const idx = t.lastIndexOf(":");
    const club = canonClub(t.slice(0, idx).trim());
    const [a, b] = t.slice(idx + 1).split("-");
    return { club, inicio: Number(a), fin: b ? Number(b) : null };
  });
}
const legacyByKey = new Map();
for (const l of legacy) legacyByKey.set(key(l.n), l);

if (fs.existsSync(ADDITIONS)) {
  for (const [i, line] of fs.readFileSync(ADDITIONS, "utf8").split(/\r?\n/).entries()) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t.startsWith("@")) continue;
    const op = t[0];
    const f = t.slice(1).split("|").map((x) => x.trim());
    try {
      if (op === "=") {
        const [nombre, nat, pos, nac, stints] = f;
        const carrera = parseStints(stints);
        const ex = byKey.get(key(nombre));
        if (ex) {
          ex.carrera = mergeStints(ex.carrera, carrera);
          ex.nacionalidad = ex.nacionalidad || canonNat(nat);
          report.skipped.push(`= ${nombre} (ya existía, se completó)`);
        } else {
          const p = { nombre, nacionalidad: canonNat(nat), posicion: canonPos(pos), nacimiento: Number(nac), carrera };
          byKey.set(key(nombre), p);
          players.push(p);
          report.additionsNew.push(nombre);
        }
      } else if (op === "~") {
        const [nombre, nat, pos, nac, debut, retiro] = f;
        const l = legacyByKey.get(key(nombre));
        if (!l) throw new Error("no está en mentiroso-legacy.json");
        if (byKey.get(key(nombre))) { report.skipped.push(`~ ${nombre} (ya existía)`); continue; }
        const clubs = [];
        for (const c of l.c.map(canonClub)) if (!clubs.some((x) => key(splitSuffix(x).base) === key(splitSuffix(c).base) && x === c)) clubs.push(c);
        const from = Number(debut), to = Number(retiro), span = Math.max(clubs.length, to - from);
        const carrera = clubs.map((club, idx) => {
          const a = from + Math.round((idx * span) / clubs.length);
          const b = idx === clubs.length - 1 ? to : from + Math.round(((idx + 1) * span) / clubs.length);
          return { club, inicio: a, fin: b };
        });
        const p = { nombre, nacionalidad: canonNat(nat), posicion: canonPos(pos), nacimiento: Number(nac), carrera };
        byKey.set(key(nombre), p);
        players.push(p);
        if (l.a?.length) nicknames[key(nombre)] = l.a;
        report.additionsNew.push(nombre);
      } else if (op === "+") {
        const [nombre, stints] = f;
        const p = byKey.get(key(nombre)) || findPlayer(nombre, null, []);
        if (!p) throw new Error("jugador no encontrado");
        p.carrera = mergeStints(p.carrera, parseStints(stints));
        report.skipped.push("+ " + p.nombre);
      } else if (op === ">") {
        const [nombre, club, ini, fin] = f;
        const p = byKey.get(key(nombre)) || findPlayer(nombre, null, []);
        if (!p) throw new Error("jugador no encontrado");
        const year = Number(ini);
        const cn = canonClub(club);
        const open = p.carrera.filter((c) => c.fin === null && key(splitSuffix(c.club).base) !== key(splitSuffix(cn).base));
        for (const c of open) c.fin = year;
        if (!p.carrera.some((c) => key(splitSuffix(c.club).base) === key(splitSuffix(cn).base) && c.inicio === year)) {
          p.carrera.push({ club: cn, inicio: year, fin: fin ? Number(fin) : null });
        }
        report.transfers.push(`${p.nombre} → ${cn} (${year})`);
      } else throw new Error("operación desconocida");
    } catch (e) {
      console.error(`players-additions.txt:${i + 1}: ${e.message} — ${t.slice(0, 70)}`);
      process.exitCode = 1;
    }
  }
}

// Para los que quedaron pendientes de Mentiroso, se informa: hay que sumarlos
// en players-additions.txt (con "=" si son activos o "~" si son leyendas).
report.legacyPending = legacyPending.filter((l) => !byKey.get(key(l.n)));

// Un jugador no puede estar en dos clubes a la vez: si quedaron varios pasos
// abiertos, gana el más reciente y los demás se cierran en su año de inicio.
for (const p of players) {
  const open = p.carrera.filter((c) => c.fin === null);
  if (open.length > 1) {
    const latest = open.reduce((a, b) => ((b.inicio || 0) >= (a.inicio || 0) ? b : a));
    for (const c of open) if (c !== latest) c.fin = latest.inicio;
  }
}

// ---------- validaciones sobre el resultado ----------
const problems = [];
for (const p of players) {
  if (!p.nombre || !p.nacionalidad || !p.posicion || !p.nacimiento) problems.push(`falta dato: ${p.nombre}`);
  if (!p.carrera.length) problems.push(`sin carrera: ${p.nombre}`);
  for (const c of p.carrera) if (!c.inicio) problems.push(`paso sin año: ${p.nombre} / ${c.club}`);
  const open = p.carrera.filter((c) => c.fin === null);
  if (open.length > 1) problems.push(`varios pasos abiertos: ${p.nombre}: ${open.map((c) => c.club).join(" + ")}`);
}

players.sort((a, b) => 0); // se mantiene el orden original (primero los más conocidos)

console.log(`Jugadores: ${master.jugadores.length} → ${players.length}`);
console.log(`Repetidos fusionados: ${report.merged.length}`);
console.log(`Nuevos por adiciones: ${report.additionsNew.length}`);
console.log(`Traspasos aplicados: ${report.transfers.length}`);
console.log(`Mentiroso: ${legacy.length} entradas; ${report.legacyPending.length} pendientes de sumar; ${report.legacyClubsMissing.length} con clubes que el maestro no tiene`);
console.log(`Problemas de validación: ${problems.length}`);
fs.mkdirSync(path.join(ROOT, ".tmp"), { recursive: true });
fs.writeFileSync(path.join(ROOT, ".tmp/unify-report.json"), JSON.stringify({ ...report, problems }, null, 2));

if (DRY) {
  console.log("--dry: no se escribió nada (detalle en .tmp/unify-report.json)");
  process.exit(process.exitCode || 0);
}

master.jugadores = players;
master._meta = {
  ...master._meta,
  descripcion: "Base ÚNICA de futbolistas de Futotal: la comparten Equipo-Jugador, Fichado, Fulbodle y Mentiroso.",
  fuente: "Conocimiento general del editor (no scraping ni API en vivo). Años de club aproximados (temporada de inicio - temporada de fin); para leyendas retiradas cargadas desde Mentiroso los años están repartidos entre los clubes y son orientativos.",
  regenerar: "Editar server/data/players-additions.txt y correr `node server/scripts/unify-players.cjs`, después `npm run build:data` en goltexto/.",
};
fs.writeFileSync(MASTER, JSON.stringify(master, null, 2) + "\n");

// ---------- Mentiroso ----------
const out = players.map((p) => {
  const clubs = [];
  for (const c of p.carrera) {
    const base = splitSuffix(c.club).base;
    if (!clubs.includes(base)) clubs.push(base);
  }
  const rec = { n: p.nombre, c: clubs, nat: p.nacionalidad };
  const a = nicknames[key(p.nombre)];
  if (a?.length) rec.a = a;
  return rec;
});
fs.mkdirSync(path.dirname(MENTIROSO_OUT), { recursive: true });
fs.writeFileSync(
  MENTIROSO_OUT,
  `// GENERADO por server/scripts/unify-players.cjs — no editar a mano.\n// Misma base que Equipo-Jugador, Fichado y Fulbodle (equipo-jugador-players.json).\nwindow.MENTIROSO_CLUB_ALIAS = ${JSON.stringify(Object.fromEntries(Object.entries(aliasRaw)))};\nwindow.MENTIROSO_DB = ${JSON.stringify(out)};\n`
);
console.log(`Escrito: ${path.relative(ROOT, MASTER)} y ${path.relative(ROOT, MENTIROSO_OUT)}`);
