// Genera server/data/players-additions-05-carrera-dt.txt a partir de los planteles
// reales de Carrera DT (client/src/carrera/data/players.js). Esos planteles sólo
// traen club ACTUAL, edad, posición y nacionalidad, así que cada jugador se carga
// con UN paso de carrera (club actual, inicio aproximado). Sirven para Fichado,
// Fulbodle y Mentiroso; en Equipo-Jugador sólo cuentan como "jugó en ese club".
// Uso: node server/scripts/import-dt-rosters.cjs   (después, unify-players.cjs)
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "../..");
const src = fs.readFileSync(path.join(ROOT, "client/src/carrera/data/players.js"), "utf8");
const teamsSrc = fs.readFileSync(path.join(ROOT, "client/src/carrera/data/teams.js"), "utf8");

const teamName = {};
for (const m of teamsSrc.matchAll(/id: "(\w+)", name: "([^"]+)"/g)) teamName[m[1]] = m[2];

const NAT = {
  ENG: "Inglaterra", SCO: "Escocia", WAL: "Gales", IRL: "Irlanda", NIR: "Irlanda del Norte", ESP: "España", ARG: "Argentina",
  BRA: "Brasil", URU: "Uruguay", COL: "Colombia", POR: "Portugal", FRA: "Francia", ITA: "Italia", GER: "Alemania",
  NED: "Países Bajos", BEL: "Bélgica", SRB: "Serbia", CRO: "Croacia", POL: "Polonia", DEN: "Dinamarca", SWE: "Suecia",
  NOR: "Noruega", SUI: "Suiza", AUT: "Austria", TUR: "Turquía", GRE: "Grecia", UKR: "Ucrania", MAR: "Marruecos",
  SEN: "Senegal", NGA: "Nigeria", GHA: "Ghana", CIV: "Costa de Marfil", CMR: "Camerún", EGY: "Egipto", ALG: "Argelia",
  JPN: "Japón", KOR: "Corea del Sur", USA: "Estados Unidos", MEX: "México", CHI: "Chile", PAR: "Paraguay", ECU: "Ecuador",
  PER: "Perú", VEN: "Venezuela", CZE: "República Checa", SVK: "Eslovaquia", HUN: "Hungría", ROU: "Rumania", ALB: "Albania",
  BIH: "Bosnia y Herzegovina", SVN: "Eslovenia", ISL: "Islandia", FIN: "Finlandia", GEO: "Georgia", MLI: "Mali",
  GAB: "Gabón", GUI: "Guinea", COD: "RD Congo", ISR: "Israel", AUS: "Australia", CAN: "Canadá", TUN: "Túnez", MNE: "Montenegro",
  KOS: "Kosovo", EST: "Estonia", JAM: "Jamaica", CPV: "Cabo Verde", ZIM: "Zimbabue", NZL: "Nueva Zelanda", MKD: "Macedonia del Norte",
};
const POS = { GK: "Portero", CB: "Defensa", LB: "Defensa", RB: "Defensa", CDM: "Mediocampista", CM: "Mediocampista", CAM: "Mediocampista", LW: "Delantero", RW: "Delantero", ST: "Delantero" };
const REF_YEAR = 2025;

const out = ["# GENERADO por server/scripts/import-dt-rosters.cjs — plantel real de Carrera DT (club actual, edad, posición y nacionalidad).", "# Un solo paso de carrera por jugador; el año de inicio es aproximado (2023)."];
let cur = null, n = 0, skipped = [];
for (const line of src.slice(src.indexOf("const NAMED = {")).split("\n")) {
  const t = line.match(/^  (\w+): \[/);
  if (t) { cur = t[1]; continue; }
  const m = line.match(/\{ name: "([^"]+)", pos: "(\w+)", age: (\d+), nat: "(\w+)"/);
  if (!m || !cur) continue;
  const [, name, pos, age, nat] = m;
  if (!teamName[cur] || !NAT[nat] || !POS[pos]) { skipped.push(`${name} (${cur}/${nat}/${pos})`); continue; }
  out.push(`=${name}|${NAT[nat]}|${POS[pos]}|${REF_YEAR - Number(age)}|${teamName[cur]}:2023-`);
  n++;
}
fs.writeFileSync(path.join(ROOT, "server/data/players-additions-05-carrera-dt.txt"), out.join("\n") + "\n");
console.log(`${n} jugadores escritos; sin mapear: ${skipped.length} ${skipped.slice(0, 10).join(", ")}`);
