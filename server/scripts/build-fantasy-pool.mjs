// Arma server/data/fantasy-pool.json para el Fantasy: los planteles actuales de la Premier y de
// LaLiga (del Modo DT, con nivel, edad y posición) y las leyendas retiradas con su nivel de prime.
//
//   node server/scripts/build-fantasy-pool.mjs
//
// Valor de mercado: el de Transfermarkt si lo tenemos (server/data/valores-mercado-tm.json), si no el
// que calcula el Modo DT. Las leyendas toman el valor de su nivel de prime.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DATA = path.join(ROOT, "server/data");
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8"));

const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const dt = await import(pathToFileURL(path.join(ROOT, "client/src/carrera/data/players.js")).href);
const teams = read("dt-teams.json").filter((t) => t.league === "premier" || t.league === "laliga");
const TM = read("valores-mercado-tm.json");
const tmByNorm = new Map();
for (const [n, v] of Object.entries(TM)) tmByNorm.set(norm(n), tmByNorm.has(norm(n)) ? null : v);

const POS = { GK: "GK", CB: "DEF", LB: "DEF", RB: "DEF", LWB: "DEF", RWB: "DEF", CDM: "MID", CM: "MID", CAM: "MID", LM: "MID", RM: "MID", LW: "FWD", RW: "FWD", ST: "FWD", CF: "FWD" };
const round1 = (v) => Math.round(v * 10) / 10;

// ---- planteles actuales ----
const clubs = {};
const players = [];
for (const t of teams) {
  clubs[t.id] = { id: t.id, name: t.name, short: t.shortName, league: t.league, tier: t.tier };
  for (const p of dt.players.filter((x) => x.teamId === t.id && !x.isYouth)) {
    const tm = TM[p.name] ?? tmByNorm.get(norm(p.name)) ?? null;
    players.push({
      id: `a_${p.id}`, name: p.name, pos: POS[p.position] || "MID", ovr: p.ovr, age: p.age, club: t.id, nat: p.nationality,
      value: round1(tm ?? p.value), legend: false,
    });
  }
}

// ---- leyendas, en su mejor momento ----
// Lista curada de figuras históricas (ya retiradas o que dejaron su prime atrás) con su nivel de prime.
// Cada una se busca en la base de jugadores para tomar su nacionalidad y su nombre tal cual figura.
const base = read("equipo-jugador-players.json").jugadores;
const baseByNorm = new Map(base.map((p) => [norm(p.nombre), p]));
const VALUE_BY_OVR = [[97, 150], [94, 120], [91, 90], [88, 65], [85, 45], [82, 30], [79, 20], [76, 12], [73, 7], [70, 4]];
function valueForOvr(ovr) {
  for (let i = 0; i < VALUE_BY_OVR.length - 1; i++) {
    const [o1, v1] = VALUE_BY_OVR[i], [o2, v2] = VALUE_BY_OVR[i + 1];
    if (ovr <= o1 && ovr >= o2) return round1(v2 + ((ovr - o2) / (o1 - o2)) * (v1 - v2));
  }
  return ovr > 97 ? 150 : 4;
}
const LEGENDS = `Gianluigi Buffon|GK|92
Iker Casillas|GK|92
Oliver Kahn|GK|91
Peter Schmeichel|GK|90
Petr Cech|GK|89
Edwin van der Sar|GK|88
Dino Zoff|GK|90
Gordon Banks|GK|90
Lev Yashin|GK|95
Fabien Barthez|GK|85
Jens Lehmann|GK|85
Víctor Valdés|GK|87
Franz Beckenbauer|DEF|95
Paolo Maldini|DEF|94
Franco Baresi|DEF|93
Fabio Cannavaro|DEF|91
Alessandro Nesta|DEF|91
Carles Puyol|DEF|90
Cafu|DEF|91
Philipp Lahm|DEF|91
Roberto Carlos|DEF|90
Dani Alves|DEF|90
Gaetano Scirea|DEF|91
Bobby Moore|DEF|90
John Terry|DEF|89
Rio Ferdinand|DEF|89
Ashley Cole|DEF|89
Nemanja Vidić|DEF|89
Marcel Desailly|DEF|89
Lilian Thuram|DEF|88
Jaap Stam|DEF|88
Javier Zanetti|DEF|88
Giorgio Chiellini|DEF|88
Gerard Piqué|DEF|88
Laurent Blanc|DEF|87
Pepe|DEF|87
Patrice Evra|DEF|86
Bixente Lizarazu|DEF|85
Gary Neville|DEF|85
Diego Godín|DEF|88
Sergio Ramos|DEF|91
Johan Cruyff|FWD|96
Diego Maradona|FWD|97
Pelé|FWD|98
Zinedine Zidane|MID|96
Michel Platini|MID|93
Lothar Matthäus|MID|92
Xavi Hernández|MID|93
Andrés Iniesta|MID|93
Andrea Pirlo|MID|91
Steven Gerrard|MID|91
Frank Lampard|MID|90
Paul Scholes|MID|90
Patrick Vieira|MID|90
Roy Keane|MID|89
Kaká|MID|93
Luis Figo|MID|92
Pavel Nedvěd|MID|91
Rivaldo|MID|92
Ronaldinho|MID|95
Clarence Seedorf|MID|88
Claude Makélélé|MID|87
Deco|MID|87
Michael Ballack|MID|88
Toni Kroos|MID|91
Bastian Schweinsteiger|MID|89
Xabi Alonso|MID|89
Sergio Busquets|MID|89
Yaya Touré|MID|88
Juan Román Riquelme|MID|88
David Beckham|MID|89
Gheorghe Hagi|MID|89
Dennis Bergkamp|MID|90
Roberto Baggio|MID|93
Alessandro Del Piero|MID|91
Francesco Totti|MID|92
Zlatan Ibrahimović|FWD|91
Ronaldo Nazário|FWD|96
Marco van Basten|FWD|95
Gerd Müller|FWD|94
Alfredo Di Stéfano|FWD|95
Eusébio|FWD|93
Ferenc Puskás|FWD|94
Thierry Henry|FWD|93
George Best|FWD|92
Romário|FWD|92
Andriy Shevchenko|FWD|92
Gabriel Batistuta|FWD|91
Hristo Stoichkov|FWD|91
Kenny Dalglish|FWD|91
Samuel Eto'o|FWD|90
Didier Drogba|FWD|90
Wayne Rooney|FWD|90
David Villa|FWD|90
Raúl|FWD|90
Ruud van Nistelrooy|FWD|90
Alan Shearer|FWD|90
George Weah|FWD|90
Fernando Torres|FWD|89
Robin van Persie|FWD|89
Eric Cantona|FWD|89
Jean-Pierre Papin|FWD|89
Michael Owen|FWD|88
Ian Rush|FWD|88
Gary Lineker|FWD|88
Christian Vieri|FWD|88
Diego Forlán|FWD|87
Hernán Crespo|FWD|87
Radamel Falcao|FWD|87
Carlos Tevez|FWD|88
Sergio Agüero|FWD|90
Gonzalo Higuaín|FWD|87
Karim Benzema|FWD|91
Luis Suárez|FWD|90`.split("\n").map((l) => l.split("|"));
const actualNames = new Set(players.map((p) => norm(p.name)));
const legends = [];
const missing = [];
for (const [name, pos, ovrStr] of LEGENDS) {
  if (actualNames.has(norm(name))) continue; // si todavía juega en la Premier o LaLiga ya está como actual
  const b = baseByNorm.get(norm(name));
  if (!b) missing.push(name);
  const ovr = Number(ovrStr);
  legends.push({ id: `l_${legends.length}`, name: b ? b.nombre : name, pos, ovr, age: 27, club: null, nat: b?.nacionalidad || "", value: valueForOvr(ovr), legend: true });
}
if (missing.length) console.log("leyendas fuera de la base (se usa el nombre tal cual):", missing.join(", "));

const out = { clubs, players, legends };
fs.writeFileSync(path.join(DATA, "fantasy-pool.json"), JSON.stringify(out));
const count = (l, k, v) => l.filter((p) => p[k] === v).length;
console.log("clubes", Object.keys(clubs).length, "jugadores actuales", players.length, "leyendas", legends.length);
for (const pos of ["GK", "DEF", "MID", "FWD"]) console.log(pos, "actuales", count(players, "pos", pos), "leyendas", count(legends, "pos", pos));
console.log("con valor TM:", players.filter((p) => TM[p.name] != null || tmByNorm.get(norm(p.name)) != null).length, "de", players.length);
console.log("Valverde", players.filter((p) => /Valverde/.test(p.name)).map((p) => `${p.name} ${p.ovr} ${p.value}M ${p.club}`).join(" | "));
console.log("top valor", players.sort((a, b) => b.value - a.value).slice(0, 5).map((p) => `${p.name} ${p.value}`).join(", "));
console.log("leyendas top", legends.slice(0, 6).map((p) => `${p.name} ${p.ovr}`).join(", "));
