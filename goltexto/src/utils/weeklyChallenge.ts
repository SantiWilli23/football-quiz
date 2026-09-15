// Reto semanal de Fichado: gana quien suma más puntos (ver finalScore en
// scoring.ts — pondera dificultad, intentos y pistas usadas), igual que
// cualquier otro juego de Futotal. Fichado es una app estática separada,
// pero se sirve desde el mismo origen que el resto de Futotal, así que
// comparte localStorage — no necesita login propio.
export function submitChallengeScore(points: number): void {
  try {
    const token = localStorage.getItem("fq_token");
    const groupId = localStorage.getItem("fq_active_group");
    if (!token || !groupId) return;
    fetch("/api/challenges/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ gameKey: "fichado", groupId: Number(groupId), score: points }),
    }).catch(() => {
      /* sin conexión, no rompe el juego */
    });
  } catch {
    /* localStorage no disponible (modo privado, u origen distinto en dev) */
  }
}
