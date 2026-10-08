// Las estadísticas de los jugadores (ritmo, tiro, pase, regate, defensa, físico) pesan
// en el partido, y más todavía según la táctica. Lo más claro: con la línea defensiva
// alta, los defensores tienen que ser rápidos; con el bloque bajo, importan más la
// marca y el físico.
import { effectiveOvr } from "./positions.js";

const DEF_POS = ["CB", "LB", "RB"];
const MID_POS = ["CDM", "CM", "CAM"];
const ATT_POS = ["LW", "RW", "ST"];
export const ATTR_LABELS = { pace: "Ritmo", shooting: "Tiro", passing: "Pase", dribbling: "Regate", defending: "Defensa", physical: "Físico" };

const attr = (p, key) => p.attributes?.[key] ?? p.ovr;
const avg = (list, key, fallback = 70) => (list.length ? list.reduce((n, p) => n + attr(p, key), 0) / list.length : fallback);

export function lineupPlayers(players, lineup) {
  return (lineup || [])
    .map((slot) => ({ p: players.find((pl) => pl.id === slot.playerId), pos: slot.slot }))
    .filter((x) => x.p)
    .map((x) => ({ ...x.p, _pos: x.pos }));
}

// Ajustes de ataque y defensa que salen de las estadísticas del XI y la línea defensiva.
export function attributeEffects(players, lineup, sliders = {}) {
  const xi = lineupPlayers(players, lineup);
  const defs = xi.filter((p) => DEF_POS.includes(p._pos));
  const mids = xi.filter((p) => MID_POS.includes(p._pos));
  const atts = xi.filter((p) => ATT_POS.includes(p._pos));

  const atk = ((avg(atts, "shooting") - 70) * 0.5 + (avg(atts, "dribbling") - 70) * 0.3 + (avg(mids, "passing") - 70) * 0.3) / 10;
  let def = ((avg(defs, "defending") - 70) * 0.5 + (avg(defs, "physical") - 70) * 0.2) / 10;

  // Línea alta: los defensores rápidos la sostienen y los lentos quedan expuestos.
  // Línea baja: la marca y el físico valen más que la velocidad.
  const line = ((sliders.defLine ?? 50) - 50) / 50; // -1 .. 1
  const paceGap = (avg(defs, "pace") - 70) / 10;
  const markGap = ((avg(defs, "defending") + avg(defs, "physical")) / 2 - 70) / 10;
  const lineAdj = line > 0 ? line * paceGap * 5 : line * markGap * 2;
  def += lineAdj;

  return { atk, def, lineAdj, defPace: Math.round(avg(defs, "pace")) };
}

// Frases para la ficha del jugador: cómo le va con la táctica que tenés puesta.
export function playerTacticNotes(player, sliders = {}) {
  const notes = [];
  const pos = player.position;
  const isDef = DEF_POS.includes(pos);
  const line = (sliders.defLine ?? 50);
  const pace = attr(player, "pace");
  if (isDef && line >= 62) {
    notes.push(pace >= 75
      ? { tone: "good", text: `Su ritmo (${pace}) le permite sostener la línea alta.` }
      : pace < 65
        ? { tone: "bad", text: `Con la línea alta queda expuesto: su ritmo es solo ${pace}.` }
        : { tone: "ok", text: `Ritmo justo (${pace}) para jugar con la línea alta.` });
  }
  if (isDef && line <= 38) {
    const mark = (attr(player, "defending") + attr(player, "physical")) / 2;
    notes.push(mark >= 74
      ? { tone: "good", text: "Con el bloque bajo, su marca y su físico rinden mucho." }
      : { tone: "ok", text: "Con el bloque bajo, necesita más marca y físico para destacar." });
  }
  if (["LW", "RW"].includes(pos) && (sliders.width ?? 50) >= 62) {
    notes.push(attr(player, "dribbling") >= 75
      ? { tone: "good", text: "Con el juego abierto, su regate genera ventajas por las bandas." }
      : { tone: "ok", text: "El juego abierto le pide más regate." });
  }
  if (["ST", "CAM"].includes(pos) && (sliders.offDepth ?? 50) >= 62) {
    notes.push(pace >= 75
      ? { tone: "good", text: "Su ritmo aprovecha la profundidad ofensiva." }
      : { tone: "ok", text: "La profundidad ofensiva le queda larga: ritmo medio." });
  }
  if (["CDM", "CM"].includes(pos) && (sliders.buildUp ?? 50) >= 62) {
    notes.push(attr(player, "passing") >= 75
      ? { tone: "good", text: "Su pase sostiene la salida corta." }
      : { tone: "ok", text: "La salida corta le pide mejor pase." });
  }
  if (!notes.length) notes.push({ tone: "ok", text: "Con la táctica actual no tiene ninguna exigencia especial." });
  return notes;
}

export { effectiveOvr };
