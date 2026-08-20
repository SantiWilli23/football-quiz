import "dotenv/config";
import { db, initSchema } from "./client.js";

function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const QUESTIONS = [
  {
    question: "¿Qué selección ganó el Mundial de Qatar 2022?",
    category: "Mundiales",
    difficulty: "facil",
    option_a: "Francia",
    option_b: "Argentina",
    option_c: "Brasil",
    option_d: "Croacia",
    correct_answer: "b",
  },
  {
    question: "¿Cuántos Balones de Oro ha ganado Lionel Messi (hasta 2023)?",
    category: "Individuales",
    difficulty: "media",
    option_a: "6",
    option_b: "7",
    option_c: "8",
    option_d: "5",
    correct_answer: "c",
  },
  {
    question: "¿Qué club ganó la primera edición de la Champions League (1955-56)?",
    category: "Champions League",
    difficulty: "dificil",
    option_a: "Real Madrid",
    option_b: "AC Milan",
    option_c: "Benfica",
    option_d: "Manchester United",
    correct_answer: "a",
  },
  {
    question: "¿Cuál es el máximo goleador histórico de la Champions League?",
    category: "Champions League",
    difficulty: "media",
    option_a: "Karim Benzema",
    option_b: "Robert Lewandowski",
    option_c: "Cristiano Ronaldo",
    option_d: "Lionel Messi",
    correct_answer: "c",
  },
  {
    question: "¿Qué país organizó el Mundial de 2018?",
    category: "Mundiales",
    difficulty: "facil",
    option_a: "Brasil",
    option_b: "Rusia",
    option_c: "Sudáfrica",
    option_d: "Alemania",
    correct_answer: "b",
  },
  {
    question: "¿Cuántos jugadores conforman un equipo de fútbol en el campo (sin contar suplentes)?",
    category: "Reglas",
    difficulty: "facil",
    option_a: "10",
    option_b: "12",
    option_c: "11",
    option_d: "9",
    correct_answer: "c",
  },
  {
    question: "¿Qué jugador tiene el récord de más goles en una sola edición de un Mundial (13 goles)?",
    category: "Mundiales",
    difficulty: "dificil",
    option_a: "Just Fontaine",
    option_b: "Pelé",
    option_c: "Ronaldo Nazário",
    option_d: "Miroslav Klose",
    correct_answer: "a",
  },
  {
    question: "¿Qué club ha ganado más títulos de la Copa Libertadores?",
    category: "Libertadores",
    difficulty: "media",
    option_a: "Boca Juniors",
    option_b: "River Plate",
    option_c: "Independiente",
    option_d: "Peñarol",
    correct_answer: "c",
  },
  {
    question: "¿En qué año se fundó la FIFA?",
    category: "Historia",
    difficulty: "dificil",
    option_a: "1904",
    option_b: "1920",
    option_c: "1888",
    option_d: "1930",
    correct_answer: "a",
  },
  {
    question: "¿Qué selección europea ganó la Eurocopa 2016?",
    category: "Eurocopa",
    difficulty: "facil",
    option_a: "Francia",
    option_b: "Alemania",
    option_c: "Portugal",
    option_d: "España",
    correct_answer: "c",
  },
];

async function seed() {
  await initSchema();

  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    const scheduled_date = dateOffset(i);
    await db.execute({
      sql: `INSERT OR IGNORE INTO questions
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

  console.log(`Seed completado: ${QUESTIONS.length} preguntas insertadas (INSERT OR IGNORE).`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
