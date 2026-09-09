import api from "../api.js";

export async function searchPlayers(query, excludeIds = []) {
  if (!query || query.trim().length < 2) return [];
  const { data } = await api.get("/equipo-jugador/players", {
    params: { q: query.trim(), exclude: excludeIds.join(",") },
  });
  return data.players || [];
}

export async function searchClubs(query, excludeIds = []) {
  if (!query || query.trim().length < 2) return [];
  const { data } = await api.get("/equipo-jugador/clubs", {
    params: { q: query.trim(), exclude: excludeIds.join(",") },
  });
  return data.clubs || [];
}

export async function randomStartingPlayer(excludeIds = []) {
  const { data } = await api.get("/equipo-jugador/players/random", {
    params: { exclude: excludeIds.join(",") },
  });
  return data.player;
}

export async function checkLink(playerId, clubId) {
  const { data } = await api.post("/equipo-jugador/check-link", { playerId, clubId });
  return !!data.valid;
}
