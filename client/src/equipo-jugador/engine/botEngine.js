// Elige la jugada del bot: siempre intenta contestar bien (nunca "hace trampa"
// ni se equivoca a propósito) — el desafío real es que el pool de jugadores/
// clubes válidos sin usar se va agotando con la cadena, así que tarde o
// temprano a alguien (bot o humano) se le acaban las opciones.
import { randomStartingPlayer, randomClubForPlayer, randomPlayerForClub } from "../api.js";
import { lastChainEntity } from "./chainEngine.js";

export async function pickBotMove(state) {
  if (state.expected === "start") {
    const player = await randomStartingPlayer(state.usedPlayerIds);
    return player ? { id: player.id, label: player.name, kind: "player" } : null;
  }

  const last = lastChainEntity(state);
  if (!last) return null;

  if (state.expected === "club") {
    const club = await randomClubForPlayer(last.id, state.usedClubIds);
    return club ? { id: club.id, label: club.name, kind: "club" } : null;
  }

  const player = await randomPlayerForClub(last.id, state.usedPlayerIds);
  return player ? { id: player.id, label: player.name, kind: "player" } : null;
}
