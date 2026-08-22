import "dotenv/config";
import { db, initSchema } from "./client.js";

function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const QUESTIONS = [
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
];

async function seed() {
  await initSchema();

  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    const scheduled_date = dateOffset(i);

    const updateResult = await db.execute({
      sql: `UPDATE questions SET
              question = ?, category = ?, difficulty = ?,
              option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_answer = ?
            WHERE scheduled_date = ?`,
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
      ],
    });

    if (updateResult.rowsAffected === 0) {
      await db.execute({
        sql: `INSERT INTO questions
          (question, category, difficulty, option_a, option_b, option_c, option_d, correct_answer, scheduled_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        ],
      });
    }
  }

  console.log(`Seed completado: ${QUESTIONS.length} preguntas sincronizadas (upsert por fecha).`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
