// Extrae del html viejo del 8a2 los datos que usa el Draft nuevo: formaciones, ubicaciones en la
// cancha, ídolos y los 138 planteles de la Champions. Se corre una sola vez; el resultado queda en
// server/data/draft-squads.json y es lo que lee el servidor.
// Uso: node scripts/extraer-draft.js
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, "../../client/public/draft-europeo.html"), "utf-8");
const start = html.indexOf("/* ============ DATOS ============ */");
const end = html.indexOf("/* ============ ESTADO ============ */");
if (start < 0 || end < 0) throw new Error("No se encontró la sección de datos");
const code = html.slice(start, end) + "\n;({ FORMATIONS, LAYOUTS, POS_LABEL, FLAGS, IDOLS, TEAMS, ROUND_ORDER: typeof ROUND_ORDER === 'undefined' ? null : ROUND_ORDER, SEASON_COUNT_BY_CLUB: typeof SEASON_COUNT_BY_CLUB === 'undefined' ? null : SEASON_COUNT_BY_CLUB })";
const out = vm.runInNewContext(code, {}, { timeout: 5000 });
const rest = html.slice(end);
const round = /var ROUND_ORDER\s*=\s*(\[[^\]]*\])/.exec(rest) || /var ROUND_ORDER\s*=\s*(\[[^\]]*\])/.exec(html);
const seasonCount = {};
for (const t of out.TEAMS) seasonCount[t.club] = (seasonCount[t.club] || 0) + 1;
const result = {
  formations: out.FORMATIONS, layouts: out.LAYOUTS, posLabel: out.POS_LABEL, idols: out.IDOLS,
  roundOrder: round ? JSON.parse(round[1].replace(/'/g, '"')) : ["octavos", "cuartos", "semis", "final"],
  teams: out.TEAMS.map((t) => ({ club: t.club, season: t.season, flag: t.flag, revelacion: !!t.revelacion, note: t.note || "", players: t.players.map((p) => ({ n: p.n, p: p.p, r: p.r })) })),
};
result.seasonCount = seasonCount;
fs.writeFileSync(path.join(here, "../data/draft-squads.json"), JSON.stringify(result));
console.log(`${result.teams.length} equipos-temporada, ${Object.keys(result.formations).length} formaciones, rondas: ${result.roundOrder.join(", ")}`);
