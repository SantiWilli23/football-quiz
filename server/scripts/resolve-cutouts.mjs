// Busca en TheSportsDB (clave gratuita pública) la foto sin fondo ("cutout") de cada
// jugador del pool de la Subasta y la guarda en server/data/player-cutouts.json.
// Se corre a mano de vez en cuando: `node scripts/resolve-cutouts.mjs`. Es incremental
// (no repite lo ya resuelto) y espacia los pedidos para respetar el límite gratuito.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { draftPool } from "../routes/cards.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../data/player-cutouts.json");
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const done = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const pool = draftPool()
  .filter((p) => p.ovr >= 80 || (p.pos === "GK" && p.ovr >= 74))
  .sort((a, b) => b.ovr - a.ovr);

// Se intercalan los puestos (arquero, defensa, medio, delantero) para que todos queden cubiertos aunque se corte antes de terminar.
const byPos = { GK: [], DEF: [], MID: [], FWD: [] };
pool.forEach((p) => byPos[p.pos]?.push(p));
const interleaved = [];
for (let i = 0; interleaved.length < pool.length; i++) for (const k of Object.keys(byPos)) if (byPos[k][i]) interleaved.push(byPos[k][i]);

function matches(want, got) {
  const a = norm(want), b = norm(got);
  if (a === b) return true;
  const last = a.split(" ").pop();
  return b.split(" ").pop() === last && a[0] === b[0];
}

let n = 0;
for (const p of interleaved) {
  if (p.name in done) continue;
  try {
    const res = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(p.name)}`);
    if (res.status === 429) { console.log("límite alcanzado, espero 60 s"); await sleep(60000); continue; }
    const j = await res.json();
    const hit = (j.player || []).find((x) => x.strSport === "Soccer" && x.strCutout && matches(p.name, x.strPlayer));
    done[p.name] = hit ? hit.strCutout : null;
  } catch (e) {
    console.log("error", p.name, e.message);
    await sleep(5000);
    continue;
  }
  n++;
  if (n % 15 === 0) { fs.writeFileSync(OUT, JSON.stringify(done)); console.log(n, "resueltos,", Object.values(done).filter(Boolean).length, "con foto"); }
  await sleep(2200);
}
fs.writeFileSync(OUT, JSON.stringify(done));
console.log("listo:", Object.values(done).filter(Boolean).length, "con foto de", Object.keys(done).length);
