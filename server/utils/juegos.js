// Juegos fusionados (Futotal 2.0, punto 1 de ESPEC-PENDIENTES): cada clave que mandan los juegos
// viejos se traduce al juego fusionado, de modo que «una vez por juego al día» valga por el juego
// entero y no por variante.
export const FUSED = {
  fichado: "quien_es", quien_es: "quien_es", traspasos: "quien_es",
  escudos: "que_club", torta: "que_club",
  piramide: "mas_o_menos", a_quien_me_compro: "mas_o_menos",
  un_minuto: "trivia", supervivencia: "trivia", trivia: "trivia",
  arbitraje_var: "var",
  tateti: "bingo", bingo: "bingo",
};

// Cotrero y el Draft ya no mandan puntos por esta vía: los acreditan sus propios motores
// (fuentes «carrera» y «draft»).
export const NO_FREE = new Set(["cotrero", "cotrero_medio", "draft_europeo"]);

export const fusedOf = (key) => FUSED[key] || key;

// Juegos fusionados abiertos al público (FUTOTAL2_JUEGOS=bingo,que_club,...). Un juego que no
// está en la lista sigue con su ruta vieja y sin redirección.
export const activeFused = () => String(process.env.FUTOTAL2_JUEGOS || "").split(",").map((s) => s.trim()).filter(Boolean);

// Una partida de 5 rondas en menos de 15 segundos es imposible: no se acredita.
export const MIN_PLAY_SECONDS = 15;
export const tooFast = (seconds) => Number.isFinite(Number(seconds)) && Number(seconds) > 0 && Number(seconds) < MIN_PLAY_SECONDS;
