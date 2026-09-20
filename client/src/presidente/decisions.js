// Decisiones de la semana de Modo Presidente. Las clásicas valen siempre; las
// nuevas (más abajo) dependen de cómo está el club.

export const CLASSIC_DECISIONS = [
  {
    id: "p01",
    context: "El área comercial te trae dos propuestas para la próxima campaña de entradas.",
    options: [
      { text: "Subir el precio de las entradas." },
      { text: "Mantener los precios actuales." },
      { text: "Bajar los precios para llenar el estadio." },
    ],
    effects: [
      { ticketPriceDelta: 1, fanHappiness: -8 },
      {},
      { ticketPriceDelta: -1, fanHappiness: 10, boardTrust: -3 },
    ],
  },
  {
    id: "p02",
    context: "Una marca te ofrece renovar el sponsor principal por más plata, pero con exigencias de resultados.",
    options: [
      { text: "Aceptás las condiciones." },
      { text: "Negociás algo más conservador." },
      { text: "Rechazás la oferta." },
    ],
    effects: [
      { budget: 3, boardTrust: 2, special: "sponsor_pressure" },
      { budget: 1.5 },
      { fanHappiness: 2 },
    ],
  },
  {
    id: "p03",
    context: "El DT te pide más presupuesto de fichajes para competir arriba de la tabla.",
    options: [
      { text: "Le das un refuerzo grande al presupuesto." },
      { text: "Le das un aumento moderado." },
      { text: "Le decís que no hay margen este semestre." },
    ],
    effects: [
      { dtBudgetGiven: 8, budget: -8, dtQuality: 6 },
      { dtBudgetGiven: 3, budget: -3, dtQuality: 2 },
      { boardTrust: -4, dtQuality: -3 },
    ],
  },
  {
    id: "p04",
    context: "La hinchada viene reclamando por la comida y los servicios del estadio en los partidos.",
    options: [
      { text: "Invertís en mejorar la experiencia del día de partido." },
      { text: "Hacés mejoras menores." },
      { text: "Lo dejás como está por ahora." },
    ],
    effects: [
      { budget: -2, fanHappiness: 10 },
      { budget: -0.8, fanHappiness: 4 },
      { fanHappiness: -5 },
    ],
  },
  {
    id: "p05",
    context: "El banco te ofrece una línea de crédito para financiar el proyecto deportivo.",
    options: [
      { text: "Tomás un préstamo grande." },
      { text: "Tomás un préstamo chico." },
      { text: "No te endeudás." },
    ],
    effects: [
      { budget: 12, debt: 12, boardTrust: -2 },
      { budget: 5, debt: 5 },
      {},
    ],
  },
  {
    id: "p06",
    context: "La directiva pide una actualización sobre el estado financiero del club.",
    options: [
      { text: "Sos transparente, incluso con las malas noticias." },
      { text: "Presentás un panorama optimista." },
      { text: "Evitás dar detalles." },
    ],
    effects: [
      { boardTrust: 5 },
      { boardTrust: 2, special: "optimism_risk" },
      { boardTrust: -6 },
    ],
  },
  {
    id: "p07",
    context: "Un grupo de hinchas organiza una protesta pacífica por el rumbo del club.",
    options: [
      { text: "Los recibís y escuchás sus reclamos." },
      { text: "Emitís un comunicado institucional." },
      { text: "No respondés públicamente." },
    ],
    effects: [
      { fanHappiness: 8, boardTrust: -1 },
      { fanHappiness: 3 },
      { fanHappiness: -6 },
    ],
  },
  {
    id: "p08",
    context: "Un club rival te ofrece armar un amistoso de pretemporada de alto perfil, con buena bolsa de dinero.",
    options: [
      { text: "Aceptás — la plata sirve, aunque cansa al plantel." },
      { text: "Proponés uno más chico, menos exigente." },
      { text: "Rechazás para cuidar la pretemporada." },
    ],
    effects: [
      { budget: 2.5, dtQuality: -2 },
      { budget: 1 },
      { fanHappiness: -2 },
    ],
  },
  {
    id: "p09",
    context: "Periodistas te preguntan directo si el DT sigue el año que viene.",
    options: [
      { text: "Le das tu respaldo público total." },
      { text: "Contestás con ambigüedad calculada." },
      { text: "Dejás la puerta abierta a un cambio." },
    ],
    effects: [
      { dtQuality: 3, boardTrust: -1 },
      {},
      { fanHappiness: 3, dtQuality: -2 },
    ],
  },
  {
    id: "p10",
    context: "Se abre la chance de renovar el naming rights del estadio por varios años.",
    options: [
      { text: "Firmás un contrato largo y grande." },
      { text: "Firmás algo más corto y modesto." },
      { text: "No tocás el nombre del estadio — pesa la historia." },
    ],
    effects: [
      { budget: 6, fanHappiness: -6, boardTrust: 4 },
      { budget: 2.5 },
      { fanHappiness: 4 },
    ],
  },
  {
    id: "p11",
    context: "El club de al lado te ofrece un canje de socios/beneficios cruzados con la comunidad.",
    options: [
      { text: "Aceptás — buena imagen institucional." },
      { text: "Lo evaluás para más adelante." },
      { text: "No, son rivales históricos." },
    ],
    effects: [
      { fanHappiness: 5, boardTrust: 2 },
      {},
      { fanHappiness: -1 },
    ],
  },
  {
    id: "p12",
    context: "Un fondo de inversión se acerca a comprar un porcentaje minoritario del club.",
    options: [
      { text: "Abrís la negociación en serio." },
      { text: "Escuchás la oferta sin comprometerte." },
      { text: "Cerrás la puerta — el club sigue 100% de los socios." },
    ],
    effects: [
      { budget: 15, boardTrust: -5, special: "fund_pressure" },
      {},
      { boardTrust: 5, fanHappiness: 4 },
    ],
  },
  {
    id: "p13",
    context: "La prensa te tira el micrófono después del clásico: te preguntan por la victoria/derrota frente al rival de siempre.",
    options: [
      { text: "Le bajás el precio: 'un partido más, quedan muchos puntos'." },
      { text: "Le das el gusto al hincha y calentás el clásico para la revancha." },
      { text: "No hacés declaraciones." },
    ],
    effects: [
      { boardTrust: 2 },
      { fanHappiness: 6, boardTrust: -2 },
      {},
    ],
  },
  {
    id: "p14",
    context: "Un periodista te pregunta si el mercado de pases estuvo a la altura de lo que pedía el DT.",
    options: [
      { text: "Reconocés que faltó presupuesto." },
      { text: "Decís que el plantel actual alcanza y sobra." },
      { text: "Cambiás de tema." },
    ],
    effects: [
      { dtQuality: 2, boardTrust: -1 },
      { boardTrust: 2, dtQuality: -1 },
      {},
    ],
  },
];

// Decisiones nuevas de la gestión: a diferencia de las clásicas, muchas solo
// aparecen cuando la situación del club las justifica (`when`) — una crisis
// de deuda no aparece con caja llena, un conflicto con la barra solo si la
// hinchada está caliente, etc. `when` se evalúa al elegir la decisión; lo
// que se guarda en el estado es solo el texto y los efectos.
// Efectos nuevos: press, prestige, membersPct, starInjury (semanas),
// youthBoost (sube el OVR de un juvenil), scandal (pega en prensa, prestigio
// e hinchada a la vez), sellBackup (vender un suplente y cobrar).
export const NEW_DECISIONS = [
  {
    id: "n01",
    context: "La barra brava exige entradas gratis y el control de una tribuna. Amenazan con hacer un escándalo si no cedés.",
    when: (s) => s.fanHappiness < 75,
    options: [
      { text: "Cedés: entradas y palco para los líderes." },
      { text: "Los denunciás y reforzás la seguridad del estadio." },
      { text: "Negociás en secreto con dinero del club." },
    ],
    effects: [
      { fanHappiness: 4, boardTrust: -6, press: -8, prestige: -2 },
      { budget: -1.5, fanHappiness: -6, press: 8, boardTrust: 3 },
      { budget: -2, fanHappiness: 3, scandal: 1 },
    ],
  },
  {
    id: "n02",
    context: "Un fondo de inversión ofrece comprar el 30% de las acciones del club a cambio de plata fresca y voz en la directiva.",
    when: (s) => s.season >= 2,
    options: [
      { text: "Aceptás: entra plata, pero pierden autonomía." },
      { text: "Pedís un préstamo más chico sin ceder acciones." },
      { text: "Los rechazás: el club es de los socios." },
    ],
    effects: [
      { budget: 22, boardTrust: -8, fanHappiness: -6, prestige: 2 },
      { budget: 8, debt: 8, boardTrust: -1 },
      { fanHappiness: 8, membersPct: 3, boardTrust: 3 },
    ],
  },
  {
    id: "n03",
    context: "Salió un audio filtrado de un directivo hablando mal del plantel. La prensa quiere una respuesta tuya.",
    options: [
      { text: "Lo echás de la directiva en público." },
      { text: "Pedís disculpas y bajás el tono." },
      { text: "Lo defendés: 'fue sacado de contexto'." },
    ],
    effects: [
      { press: 10, boardTrust: -5, fanHappiness: 4 },
      { press: 3, dtConfidence: 3 },
      { press: -10, boardTrust: 3, dtConfidence: -6 },
    ],
  },
  {
    id: "n04",
    context: "El DT quiere renovar el cuerpo médico y comprar un sistema de recuperación de última generación.",
    when: (s) => (s.medicalTier || 0) < 3,
    options: [
      { text: "Aprobás todo el paquete." },
      { text: "Aprobás la mitad." },
      { text: "Le decís que se arregle con lo que hay." },
    ],
    effects: [
      { budget: -4, dtQuality: 3, dtConfidence: 6 },
      { budget: -1.8, dtQuality: 1, dtConfidence: 2 },
      { dtConfidence: -6 },
    ],
  },
  {
    id: "n05",
    context: "Una figura del plantel se lesiona en un entrenamiento. El DT te pide traer un reemplazo de urgencia.",
    when: (s) => s.week >= 4,
    options: [
      { text: "Aprobás un fichaje de emergencia." },
      { text: "Que juegue un juvenil." },
    ],
    effects: [
      { budget: -5, starInjury: 4, dtConfidence: 4 },
      { starInjury: 6, youthBoost: 3, fanHappiness: -2 },
    ],
  },
  {
    id: "n06",
    context: "Una empresa de criptomonedas te ofrece un sponsor cuantioso. Su reputación no es la mejor.",
    when: (s) => s.prestige >= 30,
    options: [
      { text: "Firmás el contrato: la plata es la plata." },
      { text: "Pedís que se investiguen antes de firmar." },
      { text: "Los rechazás." },
    ],
    effects: [
      { budget: 9, scandal: 1, boardTrust: -2 },
      { budget: 2, press: 4 },
      { boardTrust: 2, press: 2 },
    ],
  },
  {
    id: "n07",
    context: "Un periodista de peso propone una entrevista larga y sin filtro con vos. Puede sumarte o hundirte.",
    options: [
      { text: "Vas y respondés todo." },
      { text: "Mandás al vocero." },
      { text: "Te negás." },
    ],
    effects: [
      { press: 14, fanHappiness: 4, boardTrust: -1 },
      { press: 2 },
      { press: -6, boardTrust: 1 },
    ],
  },
  {
    id: "n08",
    context: "La Federación te propone que tu estadio sea sede de una final. Hay que adaptar accesos y seguridad.",
    when: (s) => s.stadiumTier >= 2,
    options: [
      { text: "Aceptás y hacés la inversión." },
      { text: "Aceptás con un evento reducido." },
      { text: "Declinás: no da el presupuesto." },
    ],
    effects: [
      { budget: -3, prestige: 4, fanHappiness: 6, press: 6, membersPct: 2 },
      { budget: -1, prestige: 1, fanHappiness: 2 },
      { boardTrust: -1 },
    ],
  },
  {
    id: "n09",
    context: "Los socios reclaman la cuota más baja: dicen que el club se volvió elitista.",
    when: (s) => (s.memberFeeLevel || 1) >= 3,
    options: [
      { text: "Bajás la cuota un escalón." },
      { text: "Mantenés la cuota pero sumás beneficios." },
      { text: "No cambiás nada." },
    ],
    effects: [
      { memberFeeDelta: -1, fanHappiness: 6, membersPct: 5 },
      { budget: -1.2, fanHappiness: 3, membersPct: 2 },
      { fanHappiness: -6, membersPct: -4 },
    ],
  },
  {
    id: "n10",
    context: "El club rival ofrece dinero por una de tus promesas de la cantera, y el chico quiere irse.",
    when: (s) => s.academyTier >= 1,
    options: [
      { text: "Lo vendés y cobrás." },
      { text: "Le mejorás el contrato para que se quede." },
    ],
    effects: [
      { budget: 6, fanHappiness: -3, sellBackup: 1 },
      { budget: -1.5, youthBoost: 2, dtConfidence: 3 },
    ],
  },
  {
    id: "n11",
    context: "El gremio de jugadores amenaza con una medida de fuerza por los premios por partido atrasados.",
    when: (s) => s.wageLevel <= 2,
    options: [
      { text: "Pagás lo adeudado y sumás un bono." },
      { text: "Te sentás a negociar en cuotas." },
      { text: "Los enfrentás públicamente." },
    ],
    effects: [
      { budget: -3, dtConfidence: 6, fanHappiness: 2 },
      { budget: -1, dtConfidence: 1 },
      { press: -8, dtConfidence: -10, fanHappiness: -4 },
    ],
  },
  {
    id: "n12",
    context: "Te proponen construir un museo y una tienda temática en el estadio, para explotar la historia del club.",
    when: (s) => (s.storeTier || 0) < 2,
    options: [
      { text: "Aprobás la obra completa." },
      { text: "Solo la tienda." },
      { text: "No es prioridad." },
    ],
    effects: [
      { budget: -5, prestige: 2, fanHappiness: 5, membersPct: 3 },
      { budget: -2, fanHappiness: 2 },
      {},
    ],
  },
  {
    id: "n13",
    context: "Hacienda te avisa de una inspección impositiva. Hay unas cuentas del club que no cierran del todo bien.",
    when: (s) => s.season >= 2 && s.budget < 15,
    options: [
      { text: "Regularizás todo y pagás la multa." },
      { text: "Contratás un estudio jurídico caro para resistir." },
      { text: "Escondés lo que podés." },
    ],
    effects: [
      { budget: -4, boardTrust: 2, press: 2 },
      { budget: -2.5, boardTrust: -1 },
      { scandal: 1, boardTrust: -6 },
    ],
  },
  {
    id: "n14",
    context: "El capitán pide públicamente que se haga un esfuerzo para reforzar el plantel o se va a fin de año.",
    when: (s) => s.week >= 6,
    options: [
      { text: "Prometés refuerzos y le das plata al DT." },
      { text: "Hablás a solas con él y lo calmás." },
      { text: "Le decís que el club está primero." },
    ],
    effects: [
      { budget: -5, dtBudgetGiven: 4, dtQuality: 3, fanHappiness: 3 },
      { dtConfidence: 3 },
      { fanHappiness: -6, dtQuality: -2, dtConfidence: -4 },
    ],
  },
  {
    id: "n15",
    context: "Un documental sobre el club te ofrece protagonismo. Cuesta una producción pero la exposición sería enorme.",
    when: (s) => s.prestige >= 25,
    options: [
      { text: "Producís el documental." },
      { text: "Solo das acceso al vestuario." },
      { text: "Rechazás." },
    ],
    effects: [
      { budget: -3, prestige: 5, press: 10, membersPct: 4 },
      { prestige: 2, press: 4 },
      {},
    ],
  },
  {
    id: "n16",
    context: "La oposición política del club te acusa de mala gestión y pide una auditoría abierta.",
    when: (s) => s.boardTrust < 60,
    options: [
      { text: "Abrís los libros contables." },
      { text: "Los descalificás: 'es puro relato'." },
      { text: "Los invitás a integrar una comisión de control." },
    ],
    effects: [
      { boardTrust: 5, press: 4, fanHappiness: 2 },
      { boardTrust: -3, press: -4 },
      { boardTrust: 3, oppositionDelta: -6 },
    ],
  },
  {
    id: "n17",
    context: "Un mecenas del club quiere donar plata para una obra, pero exige poner su nombre a la tribuna.",
    when: (s) => s.stadiumTier >= 2,
    options: [
      { text: "Aceptás: la tribuna lleva su nombre." },
      { text: "Aceptás sin naming, solo un reconocimiento." },
      { text: "Rechazás la donación." },
    ],
    effects: [
      { budget: 12, fanHappiness: -4, prestige: 1 },
      { budget: 4, fanHappiness: 2 },
      { fanHappiness: 3, boardTrust: -1 },
    ],
  },
  {
    id: "n18",
    context: "Se acerca el clásico y la hinchada pide que el presidente hable en la previa.",
    when: (s) => !!s.rivalId,
    options: [
      { text: "Lanzás un discurso encendido." },
      { text: "Pedís calma y juego limpio." },
      { text: "Te mantenés al margen." },
    ],
    effects: [
      { fanHappiness: 8, press: -3, prestige: -1 },
      { press: 6, fanHappiness: 2 },
      {},
    ],
  },
  {
    id: "n19",
    context: "Una aerolínea quiere pagar por llevar al plantel y los hinchas a un partido lejano en un vuelo temático.",
    options: [
      { text: "Aceptás el paquete promocional." },
      { text: "Negociás mejores condiciones." },
    ],
    effects: [
      { budget: 3, fanHappiness: 3 },
      { budget: 4.5, boardTrust: 2, press: 3 },
    ],
  },
  {
    id: "n20",
    context: "Un joven talento del club rival quiere jugar con vos, y su representante pide una cifra por la mediación.",
    options: [
      { text: "Pagás la comisión: ese pibe vale oro." },
      { text: "Te negás a pagar comisiones." },
    ],
    effects: [
      { budget: -4, youthBoost: 4, dtQuality: 2 },
      { boardTrust: 2 },
    ],
  },
  {
    id: "n21",
    context: "La liga te invita a un acuerdo de venta conjunta de derechos de TV. Sube la plata de todos pero achica tu ventaja.",
    when: (s) => s.prestige >= 40,
    options: [
      { text: "Firmás el acuerdo colectivo." },
      { text: "Te oponés y presionás por más plata para los grandes." },
    ],
    effects: [
      { budget: 5, boardTrust: 2, press: 2 },
      { budget: 1, prestige: 2, boardTrust: -2 },
    ],
  },
  {
    id: "n22",
    context: "El club pasa una racha mala de resultados y la prensa pide tu renuncia en horario central.",
    when: (s) => s.week >= 6 && s.fanHappiness < 50,
    options: [
      { text: "Convocás una conferencia y ponés la cara." },
      { text: "Echás al DT para calmar las aguas." },
      { text: "Ignorás el ruido." },
    ],
    effects: [
      { press: 8, fanHappiness: 4, boardTrust: 1 },
      { fanHappiness: 8, dtConfidence: -20, fireDtEffect: 1 },
      { press: -6, fanHappiness: -4 },
    ],
  },
];

export const DECISIONS_POOL = [...CLASSIC_DECISIONS, ...NEW_DECISIONS];
