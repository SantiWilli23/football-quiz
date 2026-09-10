import api from "../api.js";

export async function myLeagues() {
  const { data } = await api.get("/dt-league/mine");
  return data.leagues;
}

export async function createLeague(name, leagueKey) {
  const { data } = await api.post("/dt-league", { name, leagueKey });
  return data.league;
}

export async function joinLeague(inviteCode) {
  const { data } = await api.post("/dt-league/join", { inviteCode });
  return data.league;
}

export async function getLeague(code) {
  const { data } = await api.get(`/dt-league/${code}`);
  return data.league;
}

export async function pickTeam(code, teamId) {
  const { data } = await api.post(`/dt-league/${code}/team`, { teamId });
  return data.league;
}

export async function startLeague(code) {
  const { data } = await api.post(`/dt-league/${code}/start`);
  return data.league;
}
