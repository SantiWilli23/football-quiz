// Reto semanal de Fichado: gana quien adivina en MENOS intentos (el backend
// ya sabe que este juego se ordena ascendente). Fichado es una app estática
// separada, pero se sirve desde el mismo origen que el resto de Futotal, así
// que comparte localStorage — no necesita login propio.
export function submitChallengeScore(attemptsUsed: number): void {
  try {
    const token = localStorage.getItem("fq_token");
    const groupId = localStorage.getItem("fq_active_group");
    if (!token || !groupId) return;
    fetch("/api/challenges/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ gameKey: "fichado", groupId: Number(groupId), score: attemptsUsed }),
    }).catch(() => {
      /* sin conexión, no rompe el juego */
    });
  } catch {
    /* localStorage no disponible (modo privado, u origen distinto en dev) */
  }
}
