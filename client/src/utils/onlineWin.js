// El ganador de una partida online avisa al servidor: suma 3 puntos por cada
// persona a la que le ganó. `room` identifica la partida (código de sala o token)
// para que no se cuente dos veces. Si no hay sesión o grupo, no hace nada.
export function reportOnlineWin(gameKey, opponents, room) {
  try {
    const token = localStorage.getItem("fq_token");
    const groupId = localStorage.getItem("fq_active_group");
    if (!token || !groupId || !(opponents >= 1)) return;
    fetch("/api/online-games/win", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ gameKey, groupId: Number(groupId), opponents, room: String(room) }),
    }).catch(() => {});
  } catch {
    /* sin storage: no rompe el juego */
  }
}
