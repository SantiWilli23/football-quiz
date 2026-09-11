import api from "../api.js";

export async function myLeagues() {
  const { data } = await api.get("/dt-league/mine");
  return data.leagues;
}

export async function createLeague(name, leagueKey, weeksPerMonth) {
  const { data } = await api.post("/dt-league", { name, leagueKey, weeksPerMonth });
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

export async function getMyTactics(code) {
  const { data } = await api.get(`/dt-league/${code}/tactics`);
  return data.tactics;
}

export async function setMyTactics(code, tactics) {
  const { data } = await api.post(`/dt-league/${code}/tactics`, tactics);
  return data.tactics;
}

// Sin `month` trae el mes activo (el más viejo con algún partido pendiente).
export async function getFixtures(code, month) {
  const { data } = await api.get(`/dt-league/${code}/fixtures`, { params: month ? { month } : {} });
  return data;
}

export async function getStandings(code) {
  const { data } = await api.get(`/dt-league/${code}/standings`);
  return data.standings;
}

// Resuelve al instante un partido humano-vs-CPU (no hace falta esperar a nadie).
export async function playFixtureSolo(code, fixtureId) {
  const { data } = await api.post(`/dt-league/${code}/fixtures/${fixtureId}/play`);
  return data;
}

// Habilita la conexión en vivo (valida que el partido sea humano-vs-humano).
export async function getLiveAccess(code, fixtureId) {
  const { data } = await api.get(`/dt-league/${code}/fixtures/${fixtureId}/live`);
  return data;
}

// Botón de conveniencia: resuelve los CPU-vs-CPU pendientes del mes activo
// sin esperar a que alguien más entre a la liga.
export async function advanceWeek(code) {
  const { data } = await api.post(`/dt-league/${code}/advance`);
  return data;
}

export function dtLiveWsUrl(fixtureId) {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const token = localStorage.getItem("fq_token") || "";
  return `${proto}//${window.location.host}/ws/dt-live?fixtureId=${fixtureId}&token=${encodeURIComponent(token)}`;
}
