import "dotenv/config";
import { db, initSchema } from "./client.js";

function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Slot 1: trivia general de fútbol mundial, misma dificultad de siempre.
const SLOT1_POOL = [
  {
    question: "¿Quién es el máximo goleador histórico en la historia de los Mundiales de fútbol?",
    category: "Individuales",
    difficulty: "dificil",
    option_a: "Ronaldo Nazário",
    option_b: "Just Fontaine",
    option_c: "Miroslav Klose",
    option_d: "Gerd Müller",
    correct_answer: "c",
  },
  {
    question: "¿Qué selección ganó el primer Mundial de fútbol de la historia, disputado en 1930?",
    category: "Mundiales",
    difficulty: "media",
    option_a: "Argentina",
    option_b: "Uruguay",
    option_c: "Brasil",
    option_d: "Italia",
    correct_answer: "b",
  },
  {
    question: "¿Qué arquero es el único portero en la historia en ganar el Balón de Oro, en 1963?",
    category: "Individuales",
    difficulty: "dificil",
    option_a: "Gordon Banks",
    option_b: "Dino Zoff",
    option_c: "Gianluigi Buffon",
    option_d: "Lev Yashin",
    correct_answer: "d",
  },
  {
    question: "¿Qué club ganó la primera edición de la Copa Libertadores, en 1960?",
    category: "Libertadores",
    difficulty: "dificil",
    option_a: "River Plate",
    option_b: "Nacional",
    option_c: "Peñarol",
    option_d: "Olimpia",
    correct_answer: "c",
  },
  {
    question: "¿Quién tiene el récord de más goles en una sola edición de un Mundial, con 13 goles en 1958?",
    category: "Mundiales",
    difficulty: "dificil",
    option_a: "Pelé",
    option_b: "Just Fontaine",
    option_c: "Sándor Kocsis",
    option_d: "Eusébio",
    correct_answer: "b",
  },
  {
    question: "¿Qué selección ganó la primera edición de la Eurocopa, en 1960?",
    category: "Eurocopa",
    difficulty: "dificil",
    option_a: "Unión Soviética",
    option_b: "Yugoslavia",
    option_c: "Checoslovaquia",
    option_d: "Francia",
    correct_answer: "a",
  },
  {
    question: "¿En qué país se disputó el Mundial de 1970, donde Brasil ganó su tercer título?",
    category: "Mundiales",
    difficulty: "media",
    option_a: "Chile",
    option_b: "Argentina",
    option_c: "México",
    option_d: "Alemania",
    correct_answer: "c",
  },
  {
    question: "¿Quién fue el máximo goleador del Mundial de Brasil 2014, con 6 goles?",
    category: "Mundiales",
    difficulty: "dificil",
    option_a: "Lionel Messi",
    option_b: "Thomas Müller",
    option_c: "Neymar",
    option_d: "James Rodríguez",
    correct_answer: "d",
  },
  {
    question: "¿Qué selección se convirtió en 2022 en la primera de África en llegar a una semifinal de un Mundial?",
    category: "Mundiales",
    difficulty: "media",
    option_a: "Ghana",
    option_b: "Marruecos",
    option_c: "Senegal",
    option_d: "Camerún",
    correct_answer: "b",
  },
  {
    question: "¿Qué jugador tiene el récord de más partidos disputados en la historia de los Mundiales?",
    category: "Individuales",
    difficulty: "dificil",
    option_a: "Lothar Matthäus",
    option_b: "Diego Maradona",
    option_c: "Lionel Messi",
    option_d: "Franz Beckenbauer",
    correct_answer: "c",
  },
  {
    question: "¿Qué selección ganó el Mundial de 1950 al vencer a Brasil como local, en el histórico 'Maracanazo'?",
    category: "Mundiales",
    difficulty: "dificil",
    option_a: "Argentina",
    option_b: "Uruguay",
    option_c: "Paraguay",
    option_d: "Chile",
    correct_answer: "b",
  },
  {
    question: "¿En qué edición del Mundial se utilizó por primera vez el VAR (videoarbitraje)?",
    category: "Reglas",
    difficulty: "media",
    option_a: "Brasil 2014",
    option_b: "Rusia 2018",
    option_c: "Catar 2022",
    option_d: "Sudáfrica 2010",
    correct_answer: "b",
  },
  {
    question: "¿Qué arquero ganó el primer Guante de Oro al mejor portero de un Mundial, en 1994?",
    category: "Individuales",
    difficulty: "dificil",
    option_a: "Michel Preud'homme",
    option_b: "Fabien Barthez",
    option_c: "Óscar Córdoba",
    option_d: "Jorge Campos",
    correct_answer: "a",
  },
  {
    question: "¿Cuál fue el resultado final del partido decisivo del Mundial 1950 entre Uruguay y Brasil?",
    category: "Mundiales",
    difficulty: "dificil",
    option_a: "Uruguay 2 - Brasil 1",
    option_b: "Uruguay 3 - Brasil 2",
    option_c: "Uruguay 1 - Brasil 0",
    option_d: "Uruguay 2 - Brasil 0",
    correct_answer: "a",
  },
  {
    question: "¿Qué jugador convirtió el gol más rápido en la historia de los Mundiales (10,8 segundos), en 2002?",
    category: "Mundiales",
    difficulty: "dificil",
    option_a: "Ronaldo Nazário",
    option_b: "Hakan Şükür",
    option_c: "Miroslav Klose",
    option_d: "Michael Owen",
    correct_answer: "b",
  },
  {
    question: "¿Qué selección ganó la primera Copa Rey Fahd en 1992, antecesora de la Copa Confederaciones?",
    category: "Historia",
    difficulty: "dificil",
    option_a: "Brasil",
    option_b: "Alemania",
    option_c: "Argentina",
    option_d: "México",
    correct_answer: "c",
  },
  {
    question: "¿Qué dos países coorganizaron el Mundial de 2002, el primero disputado en Asia?",
    category: "Mundiales",
    difficulty: "media",
    option_a: "China y Japón",
    option_b: "Japón y Corea del Sur",
    option_c: "Tailandia y Corea del Sur",
    option_d: "Corea del Sur y China",
    correct_answer: "b",
  },
  {
    question: "¿Cuántos goles convirtió Pelé en total a lo largo de los Mundiales que disputó?",
    category: "Individuales",
    difficulty: "dificil",
    option_a: "10",
    option_b: "12",
    option_c: "15",
    option_d: "9",
    correct_answer: "b",
  },
  {
    question: "¿Qué selección ganó el Mundial de 1974, disputado en Alemania?",
    category: "Mundiales",
    difficulty: "media",
    option_a: "Países Bajos",
    option_b: "Alemania Occidental",
    option_c: "Polonia",
    option_d: "Brasil",
    correct_answer: "b",
  },
  {
    question:
      "¿Qué jugador convirtió, en el mismo partido de cuartos de final del Mundial 1986, el gol de 'la Mano de Dios' y el 'Gol del Siglo'?",
    category: "Individuales",
    difficulty: "media",
    option_a: "Jorge Valdano",
    option_b: "Diego Maradona",
    option_c: "Jorge Burruchaga",
    option_d: "Claudio Caniggia",
    correct_answer: "b",
  },
];

// Slot 2: liga chilena, con foco en Universidad de Chile. Misma dificultad que siempre.
const SLOT2_POOL = [
  {
    question: "¿En qué año se fundó Universidad de Chile, el club conocido como 'La U'?",
    category: "Liga Chilena",
    difficulty: "dificil",
    option_a: "1925",
    option_b: "1927",
    option_c: "1933",
    option_d: "1910",
    correct_answer: "b",
  },
  {
    question: "¿Qué título internacional ganó Universidad de Chile en 2011, el primero de su historia?",
    category: "Liga Chilena",
    difficulty: "dificil",
    option_a: "Copa Libertadores",
    option_b: "Recopa Sudamericana",
    option_c: "Copa Sudamericana",
    option_d: "Copa Merconorte",
    correct_answer: "c",
  },
  {
    question: "¿Qué entrenador argentino dirigió a Universidad de Chile durante su histórica campaña de 2011?",
    category: "Liga Chilena",
    difficulty: "dificil",
    option_a: "Marcelo Bielsa",
    option_b: "Jorge Sampaoli",
    option_c: "Gerardo Martino",
    option_d: "Marcelo Gallardo",
    correct_answer: "b",
  },
  {
    question: "¿Cómo se conoce al clásico entre Universidad de Chile y Universidad Católica?",
    category: "Liga Chilena",
    difficulty: "media",
    option_a: "Superclásico",
    option_b: "Clásico del Sur",
    option_c: "Clásico Universitario",
    option_d: "Clásico Capitalino",
    correct_answer: "c",
  },
  {
    question: "¿Cómo se conoce al clásico entre Colo-Colo y Universidad de Chile, el más popular del fútbol chileno?",
    category: "Liga Chilena",
    difficulty: "media",
    option_a: "Clásico Universitario",
    option_b: "Superclásico",
    option_c: "Clásico del Pacífico",
    option_d: "Gran Clásico",
    correct_answer: "b",
  },
  {
    question: "¿Con qué apodo se conoció al histórico equipo de Universidad de Chile campeón en la década de 1960?",
    category: "Liga Chilena",
    difficulty: "dificil",
    option_a: "El Ballet Azul",
    option_b: "La Máquina Azul",
    option_c: "Los Azules de Oro",
    option_d: "El Escuadrón Azul",
    correct_answer: "a",
  },
  {
    question: "¿Ante qué equipo argentino perdió Universidad de Chile la final de la Copa Libertadores de 1970?",
    category: "Liga Chilena",
    difficulty: "dificil",
    option_a: "Boca Juniors",
    option_b: "River Plate",
    option_c: "Estudiantes de La Plata",
    option_d: "Racing Club",
    correct_answer: "c",
  },
  {
    question:
      "¿En qué club chileno se formó y debutó profesionalmente Marcelo Salas antes de partir al fútbol internacional?",
    category: "Liga Chilena",
    difficulty: "media",
    option_a: "Colo-Colo",
    option_b: "Universidad de Chile",
    option_c: "Universidad Católica",
    option_d: "Cobreloa",
    correct_answer: "b",
  },
  {
    question: "¿Qué club chileno tiene más títulos de Primera División en la historia?",
    category: "Liga Chilena",
    difficulty: "media",
    option_a: "Universidad de Chile",
    option_b: "Universidad Católica",
    option_c: "Colo-Colo",
    option_d: "Cobreloa",
    correct_answer: "c",
  },
  {
    question:
      "¿Qué club chileno ganó la Copa Libertadores en 1991, siendo hasta hoy el único club de Chile en lograrlo?",
    category: "Liga Chilena",
    difficulty: "dificil",
    option_a: "Universidad de Chile",
    option_b: "Colo-Colo",
    option_c: "Universidad Católica",
    option_d: "Palestino",
    correct_answer: "b",
  },
  {
    question: "¿Qué jugador fundó el club Colo-Colo en 1925?",
    category: "Liga Chilena",
    difficulty: "dificil",
    option_a: "David Arellano",
    option_b: "Carlos Caszely",
    option_c: "Elías Figueroa",
    option_d: "Francisco Valdés",
    correct_answer: "a",
  },
  {
    question:
      "¿Qué club del norte de Chile llegó a dos finales consecutivas de la Copa Libertadores (1981 y 1982) sin poder consagrarse campeón?",
    category: "Liga Chilena",
    difficulty: "dificil",
    option_a: "Cobresal",
    option_b: "Deportes Antofagasta",
    option_c: "Cobreloa",
    option_d: "Deportes Iquique",
    correct_answer: "c",
  },
  {
    question: "¿En qué año Chile fue sede de la Copa del Mundo?",
    category: "Liga Chilena",
    difficulty: "media",
    option_a: "1958",
    option_b: "1962",
    option_c: "1966",
    option_d: "1970",
    correct_answer: "b",
  },
  {
    question: "¿Qué apodo recibe históricamente Universidad de Chile por sus destacadas giras internacionales?",
    category: "Liga Chilena",
    difficulty: "dificil",
    option_a: "El Romántico Viajero",
    option_b: "El Trotamundos Azul",
    option_c: "El Viajero Universitario",
    option_d: "El Nómade Azul",
    correct_answer: "a",
  },
  {
    question:
      "¿A qué selección venció Chile en la final de la Copa América 2015, disputada en su propio país, para ganar su primer título continental?",
    category: "Liga Chilena",
    difficulty: "media",
    option_a: "Brasil",
    option_b: "Uruguay",
    option_c: "Argentina",
    option_d: "Perú",
    correct_answer: "c",
  },
  {
    question: "¿Qué equipo enfrentó y venció Universidad de Chile en la final de la Copa Sudamericana 2011?",
    category: "Liga Chilena",
    difficulty: "dificil",
    option_a: "LDU Quito",
    option_b: "Independiente del Valle",
    option_c: "Emelec",
    option_d: "Barcelona SC",
    correct_answer: "a",
  },
  {
    question:
      "¿En qué estadio chileno se disputan tradicionalmente las grandes finales del fútbol nacional y los partidos de la selección?",
    category: "Liga Chilena",
    difficulty: "media",
    option_a: "Estadio Monumental",
    option_b: "Estadio Nacional",
    option_c: "Estadio Sausalito",
    option_d: "Estadio El Teniente",
    correct_answer: "b",
  },
  {
    question:
      "¿Cuántos títulos oficiales ganó Universidad de Chile durante su histórica temporada 2011 (Apertura, Copa Sudamericana y Clausura)?",
    category: "Liga Chilena",
    difficulty: "dificil",
    option_a: "2",
    option_b: "3",
    option_c: "4",
    option_d: "1",
    correct_answer: "b",
  },
];

// Slot 3: fútbol europeo, mucho más difícil que el resto.
const SLOT3_POOL = [
  {
    question: "¿Qué equipo fue el primer campeón de la Premier League tras su fundación en 1992-93?",
    category: "Europa",
    difficulty: "dificil",
    option_a: "Arsenal",
    option_b: "Manchester United",
    option_c: "Liverpool",
    option_d: "Blackburn Rovers",
    correct_answer: "b",
  },
  {
    question: "¿Qué equipo ganó la primera edición de la Bundesliga alemana, en 1963-64?",
    category: "Europa",
    difficulty: "dificil",
    option_a: "Bayern Múnich",
    option_b: "Borussia Dortmund",
    option_c: "1. FC Köln",
    option_d: "Hamburgo SV",
    correct_answer: "c",
  },
  {
    question:
      "¿Qué club ganó cinco de las seis ediciones de la Ligue 1 entre 2015 y 2020, consolidándose como el nuevo gigante del fútbol francés?",
    category: "Europa",
    difficulty: "dificil",
    option_a: "Olympique de Marsella",
    option_b: "Mónaco",
    option_c: "Lyon",
    option_d: "Paris Saint-Germain",
    correct_answer: "d",
  },
  {
    question: "¿Qué club ganó la primera Copa Intercontinental de la historia, en 1960, venciendo al Peñarol?",
    category: "Europa",
    difficulty: "dificil",
    option_a: "Real Madrid",
    option_b: "Benfica",
    option_c: "AC Milan",
    option_d: "Inter de Milán",
    correct_answer: "a",
  },
  {
    question: "¿Qué jugador neerlandés ganó tres Balones de Oro en la década de 1970 (1971, 1973 y 1974)?",
    category: "Europa",
    difficulty: "dificil",
    option_a: "Johan Neeskens",
    option_b: "Johan Cruyff",
    option_c: "Rob Rensenbrink",
    option_d: "Ruud Krol",
    correct_answer: "b",
  },
  {
    question: "¿Qué club italiano ganó la primera edición de la Recopa de Europa (Cup Winners' Cup), en 1960-61?",
    category: "Europa",
    difficulty: "dificil",
    option_a: "Juventus",
    option_b: "AC Milan",
    option_c: "Fiorentina",
    option_d: "Inter de Milán",
    correct_answer: "c",
  },
  {
    question: "¿Qué club escocés perdió la final de la primera Recopa de Europa ante la Fiorentina, en 1961?",
    category: "Europa",
    difficulty: "dificil",
    option_a: "Celtic",
    option_b: "Rangers",
    option_c: "Aberdeen",
    option_d: "Hibernian",
    correct_answer: "b",
  },
  {
    question:
      "¿Qué club portugués, dirigido por Béla Guttmann, ganó dos Copas de Europa consecutivas en 1961 y 1962?",
    category: "Europa",
    difficulty: "dificil",
    option_a: "Sporting CP",
    option_b: "Porto",
    option_c: "Benfica",
    option_d: "Boavista",
    correct_answer: "c",
  },
  {
    question: "¿Qué jugador fue la gran figura de aquel Benfica bicampeón de Europa de 1961 y 1962?",
    category: "Europa",
    difficulty: "dificil",
    option_a: "Eusébio",
    option_b: "Mário Coluna",
    option_c: "José Águas",
    option_d: "António Simões",
    correct_answer: "a",
  },
  {
    question:
      "¿Qué club ganó tres Champions League consecutivas entre 2016 y 2018, algo inédito en la era moderna de la competición?",
    category: "Europa",
    difficulty: "dificil",
    option_a: "Barcelona",
    option_b: "Bayern Múnich",
    option_c: "Real Madrid",
    option_d: "Liverpool",
    correct_answer: "c",
  },
  {
    question:
      "¿Qué equipo ganó la Premier League 2015-16 pese a partir como candidato al descenso, en una de las mayores sorpresas del fútbol europeo?",
    category: "Europa",
    difficulty: "dificil",
    option_a: "West Ham",
    option_b: "Leicester City",
    option_c: "Southampton",
    option_d: "Everton",
    correct_answer: "b",
  },
  {
    question: "¿Qué arquero alemán se consagró campeón del mundo en 2014 y ganó el Guante de Oro del torneo?",
    category: "Europa",
    difficulty: "dificil",
    option_a: "Manuel Neuer",
    option_b: "Marc-André ter Stegen",
    option_c: "René Adler",
    option_d: "Oliver Kahn",
    correct_answer: "a",
  },
  {
    question:
      "¿Qué club neerlandés popularizó el estilo conocido como 'Fútbol Total' bajo la dirección de Rinus Michels en los años 70?",
    category: "Europa",
    difficulty: "dificil",
    option_a: "Feyenoord",
    option_b: "PSV",
    option_c: "Ajax",
    option_d: "AZ Alkmaar",
    correct_answer: "c",
  },
  {
    question:
      "¿Qué club escocés, dirigido por Alex Ferguson, ganó la Recopa de Europa 1982-83 venciendo al Real Madrid en la final?",
    category: "Europa",
    difficulty: "dificil",
    option_a: "Celtic",
    option_b: "Aberdeen",
    option_c: "Dundee United",
    option_d: "Hearts",
    correct_answer: "b",
  },
  {
    question:
      "¿Qué equipo alemán perdió la final de la Champions League 1999 tras un recordado gol del Manchester United en el último minuto?",
    category: "Europa",
    difficulty: "dificil",
    option_a: "Bayer Leverkusen",
    option_b: "Bayern Múnich",
    option_c: "Schalke 04",
    option_d: "Borussia Dortmund",
    correct_answer: "b",
  },
  {
    question:
      "¿Qué club italiano ganó la Copa de Europa de 1985, disputada en la trágica final marcada por la tragedia de Heysel?",
    category: "Europa",
    difficulty: "dificil",
    option_a: "AC Milan",
    option_b: "Juventus",
    option_c: "Roma",
    option_d: "Napoli",
    correct_answer: "b",
  },
  {
    question:
      "¿Qué futbolista es el único en ganar la Bota de Oro europea (máximo goleador de Europa) representando a tres clubes distintos?",
    category: "Europa",
    difficulty: "dificil",
    option_a: "Lionel Messi",
    option_b: "Cristiano Ronaldo",
    option_c: "Robert Lewandowski",
    option_d: "Luis Suárez",
    correct_answer: "b",
  },
  {
    question:
      "¿Qué club rumano ganó la Copa de Europa de 1986 tras vencer al Barcelona en la definición por penales?",
    category: "Europa",
    difficulty: "dificil",
    option_a: "Dinamo de Bucarest",
    option_b: "Steaua de Bucarest",
    option_c: "Rapid de Bucarest",
    option_d: "CFR Cluj",
    correct_answer: "b",
  },
  {
    question:
      "¿Qué club escocés, conocido como los 'Lisbon Lions', fue el primer equipo británico en ganar la Copa de Europa, en 1967?",
    category: "Europa",
    difficulty: "dificil",
    option_a: "Rangers",
    option_b: "Celtic",
    option_c: "Aberdeen",
    option_d: "Hibernian",
    correct_answer: "b",
  },
  {
    question:
      "¿Qué club inglés, dirigido por Brian Clough, ganó la Copa de Europa en 1979 y 1980 de forma consecutiva?",
    category: "Europa",
    difficulty: "dificil",
    option_a: "Liverpool",
    option_b: "Aston Villa",
    option_c: "Nottingham Forest",
    option_d: "Leeds United",
    correct_answer: "c",
  },
];

// Pregunta bonus del día: votación entre compañeros de grupo, sin respuesta correcta.
const BONUS_POOL = [
  "¿Quién es más probable que llegue tarde a ver un partido?",
  "¿Quién es más probable que discuta con el árbitro a través de la tele?",
  "¿Quién es más probable que se cambie de camiseta a mitad de temporada?",
  "¿Quién es más probable que haga el ridículo en una final?",
  "¿Quién es más probable que se sepa la alineación completa de memoria?",
  "¿Quién es más probable que llore si su equipo pierde una final?",
  "¿Quién es más probable que apueste su sueldo entero a un partido?",
  "¿Quién es más probable que se pelee por un gol en el picadito del domingo?",
  "¿Quién es más probable que tenga la camiseta más cara del grupo?",
  "¿Quién es más probable que falle la pregunta bonus de hoy?",
  "¿Quién es más probable que hable de fútbol hasta en un casamiento?",
  "¿Quién es más probable que se olvide de responder el trivia de hoy?",
  "¿Quién es más probable que festeje un gol solo en su casa como si estuviera en la cancha?",
  "¿Quién es más probable que diga 'yo lo hubiera atajado'?",
  "¿Quién es más probable que cambie de hincha por conveniencia?",
  "¿Quién es más probable que se acuerde de un resultado de hace 20 años?",
  "¿Quién es más probable que se despierte a las 4 de la mañana para ver un partido?",
  "¿Quién es más probable que se pierda el gol importante por estar en el baño?",
  "¿Quién es más probable que discuta de fútbol hasta las 3 de la mañana?",
  "¿Quién es más probable que compre una camiseta y nunca se la ponga?",
];

const NUM_DAYS = 20;

async function upsertQuestion(q, scheduled_date, slot) {
  const updateResult = await db.execute({
    sql: `UPDATE questions SET
            question = ?, category = ?, difficulty = ?,
            option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_answer = ?
          WHERE scheduled_date = ? AND slot = ?`,
    args: [
      q.question,
      q.category,
      q.difficulty,
      q.option_a,
      q.option_b,
      q.option_c,
      q.option_d,
      q.correct_answer,
      scheduled_date,
      slot,
    ],
  });

  if (updateResult.rowsAffected === 0) {
    await db.execute({
      sql: `INSERT INTO questions
        (question, category, difficulty, option_a, option_b, option_c, option_d, correct_answer, scheduled_date, slot)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        q.question,
        q.category,
        q.difficulty,
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d,
        q.correct_answer,
        scheduled_date,
        slot,
      ],
    });
  }
}

async function upsertBonusQuestion(prompt, scheduled_date) {
  const updateResult = await db.execute({
    sql: "UPDATE bonus_questions SET prompt = ? WHERE scheduled_date = ?",
    args: [prompt, scheduled_date],
  });

  if (updateResult.rowsAffected === 0) {
    await db.execute({
      sql: "INSERT INTO bonus_questions (prompt, scheduled_date) VALUES (?, ?)",
      args: [prompt, scheduled_date],
    });
  }
}

async function seed() {
  await initSchema();

  for (let day = 0; day < NUM_DAYS; day++) {
    const scheduled_date = dateOffset(day);

    await upsertQuestion(SLOT1_POOL[day % SLOT1_POOL.length], scheduled_date, 1);
    await upsertQuestion(SLOT2_POOL[day % SLOT2_POOL.length], scheduled_date, 2);
    await upsertQuestion(SLOT3_POOL[day % SLOT3_POOL.length], scheduled_date, 3);
    await upsertBonusQuestion(BONUS_POOL[day % BONUS_POOL.length], scheduled_date);
  }

  console.log(
    `Seed completado: ${NUM_DAYS} días x 3 preguntas temáticas (general / liga chilena / europa difícil) + 1 pregunta bonus por día.`
  );
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
