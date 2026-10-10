// Actualiza los planteles del Modo DT con los de hoy (ESPN) y escribe client/src/carrera/data/rosters.js.
//
//   node server/scripts/refresh-dt-rosters.mjs
//
// Para cada club del DT que coincide con uno de la liga actual en ESPN se arma el plantel con nombres reales:
//  - el nivel (ovr) de quien ya estaba en el DT se conserva,
//  - a los fichajes se les estima el nivel con su valor de mercado de Transfermarkt (si lo tenemos),
//  - al resto se le da un nivel acorde a la jerarquía del club.
// Los clubes que ya no están en la liga (descendidos) o que ESPN no encuentra conservan su plantel anterior.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DATA = path.join(ROOT, "server/data");
const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const teams = JSON.parse(fs.readFileSync(path.join(DATA, "dt-teams.json"), "utf8"));
const dt = await import(pathToFileURL(path.join(ROOT, "client/src/carrera/data/players.js")).href);

// ---- valores de Transfermarkt por nombre normalizado (los repetidos se descartan) ----
const tmCount = new Map();
const tm = new Map();
for (const f of fs.readdirSync(DATA).filter((x) => /^transfermarkt-valores-\d+\.txt$/.test(x)).sort()) {
  for (const line of fs.readFileSync(path.join(DATA, f), "utf8").split("\n").filter(Boolean)) {
    const i = line.lastIndexOf("|");
    const k = norm(line.slice(0, i));
    tmCount.set(k, (tmCount.get(k) || 0) + 1);
    tm.set(k, Number(line.slice(i + 1)));
  }
}
for (const [k, n] of tmCount) if (n > 1) tm.delete(k);

const VALUE_TO_OVR = [[200, 92], [120, 89], [80, 87], [50, 84], [30, 81], [20, 79], [12, 77], [8, 75], [5, 73], [3, 71], [2, 69], [1, 66], [0.5, 63], [0, 60]];
function ovrFromValue(v, age) {
  let ovr = 60;
  for (let i = 0; i < VALUE_TO_OVR.length - 1; i++) {
    const [v1, o1] = VALUE_TO_OVR[i], [v2, o2] = VALUE_TO_OVR[i + 1];
    if (v >= v2) { ovr = o2 + ((Math.min(v, v1) - v2) / (v1 - v2)) * (o1 - o2); break; }
  }
  if (age <= 21) ovr -= 4; else if (age <= 23) ovr -= 2; else if (age >= 33) ovr += 3; else if (age >= 31) ovr += 1;
  return Math.max(55, Math.min(92, Math.round(ovr)));
}

// ---- país (ESPN, en inglés) -> código del DT ----
const NAT = {
  England: "ENG", Spain: "ESP", France: "FRA", Germany: "GER", Italy: "ITA", Portugal: "POR", Netherlands: "NED", Belgium: "BEL", Brazil: "BRA", Argentina: "ARG",
  Uruguay: "URU", Colombia: "COL", Croatia: "CRO", Scotland: "SCO", Wales: "WAL", Ireland: "IRL", "Republic of Ireland": "IRL", "Northern Ireland": "NIR",
  Switzerland: "SUI", Austria: "AUT", Denmark: "DEN", Sweden: "SWE", Norway: "NOR", Poland: "POL", Serbia: "SRB", Turkey: "TUR", Türkiye: "TUR", Morocco: "MAR",
  Senegal: "SEN", Nigeria: "NGA", Ghana: "GHA", "Ivory Coast": "CIV", "Côte d'Ivoire": "CIV", Cameroon: "CMR", Algeria: "ALG", Egypt: "EGY", Japan: "JPN",
  "South Korea": "KOR", "United States": "USA", USA: "USA", Canada: "CAN", Mexico: "MEX", Chile: "CHI", Peru: "PER", Ecuador: "ECU", Paraguay: "PAR", Venezuela: "VEN",
  Czechia: "CZE", "Czech Republic": "CZE", Slovakia: "SVK", Slovenia: "SVN", Hungary: "HUN", Romania: "ROU", Greece: "GRE", Ukraine: "UKR", Russia: "RUS",
  Finland: "FIN", Iceland: "ISL", Australia: "AUS", "New Zealand": "NZL", Mali: "MLI", Guinea: "GUI", "DR Congo": "COD", Gabon: "GAB", Tunisia: "TUN",
  Albania: "ALB", Kosovo: "KOS", "Bosnia and Herzegovina": "BIH", "North Macedonia": "MKD", Montenegro: "MNE", Bulgaria: "BUL", Georgia: "GEO", Armenia: "ARM",
  Israel: "ISR", Jamaica: "JAM", Suriname: "SUR", Curaçao: "CUW", Gambia: "GAM", "Cape Verde": "CPV", Angola: "ANG", Zambia: "ZAM", Zimbabwe: "ZIM",
};
const natCode = (c) => NAT[c] || String(c || "ESP").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "ESP";

// ---- posiciones: ESPN solo da G/D/M/F, el detalle sale del DT si ya estaba o se reparte por línea ----
const DEF_CYCLE = ["CB", "RB", "CB", "LB", "CB", "CB", "RB", "LB"];
const MID_CYCLE = ["CM", "CDM", "CAM", "CM", "CDM", "CM", "CAM", "CM"];
const FWD_CYCLE = ["ST", "LW", "RW", "ST", "LW", "RW", "ST", "LW"];
const HASH = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

const SLUGS = { premier: "eng.1", laliga: "esp.1", seriea: "ita.1", bundesliga: "ger.1" };
const ALIAS = {
  "bayernmunich": "bayernmunchen", "bayernmunchen": "bayernmunich", "athleticclub": "athleticbilbao", "atleticomadrid": "atleticodemadrid",
  "wolves": "wolverhamptonwanderers", "newcastle": "newcastleunited", "tottenham": "tottenhamhotspur", "brighton": "brightonhovealbion",
  "westham": "westhamunited", "leeds": "leedsunited", "forest": "nottinghamforest", "spurs": "tottenhamhotspur", "intermilan": "inter", "acmilan": "milan",
  "celta": "celtadevigo", "atleticodemadrid": "atleticomadrid", "interdemilan": "internazionale", "scfriburgo": "scfreiburg", "celtadevigo": "celtavigo", "betis": "realbetis", "realsociedad": "realsociedad", "colonia": "kolon", "friburgo": "freiburg",
  "deportivoalaves": "alaves", "deportivolacoruna": "deportivo", "fccolonia": "fccologne", "hamburgosv": "hamburgsv", "racingdesantander": "racingsantander", "scpaderborn": "scpaderborn07",
};
const getJson = async (u) => { const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0" } }); if (!r.ok) throw new Error(`ESPN ${r.status} ${u}`); return r.json(); };

const out = {};
const report = { actualizados: [], sinCoincidencia: [] };
const oldByTeam = (id) => dt.players.filter((p) => p.teamId === id && !p.isYouth);

for (const [league, slug] of Object.entries(SLUGS)) {
  const list = (await getJson(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/teams`)).sports[0].leagues[0].teams.map((x) => x.team);
  const espnByNorm = new Map(list.map((t) => [norm(t.displayName), t]));
  for (const team of teams.filter((t) => t.league === league && !t.until)) {
    const n = norm(team.name);
    const cands = [n, ALIAS[n]].filter(Boolean);
    let match = cands.map((c) => espnByNorm.get(c)).find(Boolean);
    if (!match) match = list.find((t) => { const e = norm(t.displayName); return e.includes(n) || n.includes(e) || (ALIAS[n] && (e.includes(ALIAS[n]) || ALIAS[n].includes(e))); });
    if (!match) { report.sinCoincidencia.push(`${team.name} (${league})`); continue; }
    let roster;
    try { roster = (await getJson(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/teams/${match.id}/roster`)).athletes || []; } catch { report.sinCoincidencia.push(`${team.name} (sin plantel)`); continue; }
    if (roster.length < 15) { report.sinCoincidencia.push(`${team.name} (plantel corto: ${roster.length})`); continue; }
    const oldMap = new Map(oldByTeam(team.id).map((p) => [norm(p.name), p]));
    const allOld = new Map([...(dt.legacyPlayers || []), ...dt.players].map((p) => [norm(p.name), p]));
    const base = team.tier === 1 ? 76 : team.tier === 2 ? 71 : 67;
    const counters = { D: 0, M: 0, F: 0 };
    const squad = roster.map((a) => {
      const k = norm(a.displayName || a.fullName);
      const old = oldMap.get(k) || allOld.get(k);
      const age = a.age || 25;
      const coarse = a.position?.abbreviation || "M";
      let pos;
      if (old) pos = old.position;
      else if (coarse === "G") pos = "GK";
      else { const cyc = coarse === "D" ? DEF_CYCLE : coarse === "F" ? FWD_CYCLE : MID_CYCLE; pos = cyc[counters[coarse]++ % cyc.length]; }
      let ovr;
      if (old) ovr = old.ovr;
      else if (tm.has(k)) ovr = ovrFromValue(tm.get(k), age);
      else ovr = Math.max(55, Math.min(80, base - 4 + (HASH(k) % 8) + (age >= 30 ? 1 : 0) - (age <= 20 ? 3 : 0)));
      const pot = old ? old.potential : Math.min(95, ovr + (age <= 21 ? 8 : age <= 24 ? 4 : age <= 28 ? 1 : 0));
      return { name: a.displayName || a.fullName, pos, age, nat: natCode(a.citizenship), ovr, pot, id: old && oldMap.has(k) ? old.id : null };
    });
    out[team.id] = squad.sort((x, y) => y.ovr - x.ovr).slice(0, 30);
    report.actualizados.push(`${team.name}: ${squad.length}`);
  }
}

const header = "// Planteles actuales de los clubes del DT (generado por server/scripts/refresh-dt-rosters.mjs).\n";
fs.writeFileSync(path.join(ROOT, "client/src/carrera/data/rosters.js"), header + "export default " + JSON.stringify(out) + ";\n");
console.log("clubes actualizados:", Object.keys(out).length, "| sin coincidencia:", report.sinCoincidencia.length);
console.log("sin coincidencia:", report.sinCoincidencia.join(" · "));
const sample = out.realmadrid || out.mancity || Object.values(out)[0];
console.log("ejemplo:", sample.slice(0, 6).map((p) => `${p.name} ${p.pos} ${p.ovr}`).join(", "));
