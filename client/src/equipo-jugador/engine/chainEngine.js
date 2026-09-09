// Motor puro del juego "Equipo-Jugador": no sabe nada de red ni de React,
// solo transforma un estado en otro. Se usa igual en modo local (mismo
// dispositivo) y en modo online (donde el host es la autoridad y todos los
// demás sólo reciben el estado ya resuelto).

export const TURN_SECONDS = 25;

export function createGame(playerCount, playerNames) {
  return {
    playerCount,
    playerNames,
    alive: Array.from({ length: playerCount }, () => true),
    turnSeat: 0,
    chain: [],
    usedPlayerIds: [],
    usedClubIds: [],
    // "start": el primer jugador dice cualquier futbolista, sin necesidad de enlace.
    // "club" / "player": lo que tiene que decir el siguiente.
    expected: "start",
    status: "playing",
    winnerSeat: null,
    turnStartedAt: Date.now(),
  };
}

function nextAliveSeat(state, fromSeat) {
  for (let i = 1; i <= state.playerCount; i++) {
    const seat = (fromSeat + i) % state.playerCount;
    if (state.alive[seat]) return seat;
  }
  return fromSeat;
}

function aliveCount(state) {
  return state.alive.filter(Boolean).length;
}

// Agrega una jugada válida a la cadena y pasa el turno al siguiente vivo.
export function applyMove(state, entity) {
  const kind = state.expected === "start" ? "player" : state.expected;
  const chain = [...state.chain, { kind, id: entity.id, label: entity.label, bySeat: state.turnSeat }];
  const usedPlayerIds = kind === "player" ? [...state.usedPlayerIds, entity.id] : state.usedPlayerIds;
  const usedClubIds = kind === "club" ? [...state.usedClubIds, entity.id] : state.usedClubIds;
  const nextExpected = kind === "player" ? "club" : "player";

  return {
    ...state,
    chain,
    usedPlayerIds,
    usedClubIds,
    expected: nextExpected,
    turnSeat: nextAliveSeat(state, state.turnSeat),
    turnStartedAt: Date.now(),
  };
}

// El jugador en turno falla (respuesta inválida, repetida o se le acabó el
// tiempo): queda eliminado directo de la partida, no solo pierde la ronda.
export function eliminateCurrentTurn(state, reason = "No respondió a tiempo.") {
  const eliminatedSeat = state.turnSeat;
  const alive = state.alive.map((a, i) => (i === eliminatedSeat ? false : a));
  const survivors = aliveCount({ ...state, alive });

  if (survivors <= 1) {
    const winnerSeat = alive.findIndex(Boolean);
    return { ...state, alive, status: "finished", winnerSeat: winnerSeat === -1 ? null : winnerSeat, lastEliminated: eliminatedSeat, lastEliminationReason: reason };
  }

  return {
    ...state,
    alive,
    turnSeat: nextAliveSeat({ ...state, alive }, eliminatedSeat),
    turnStartedAt: Date.now(),
    lastEliminated: eliminatedSeat,
    lastEliminationReason: reason,
  };
}

export function isEntityUsed(state, kind, id) {
  return kind === "player" ? state.usedPlayerIds.includes(id) : state.usedClubIds.includes(id);
}

export function lastChainEntity(state) {
  return state.chain[state.chain.length - 1] || null;
}
