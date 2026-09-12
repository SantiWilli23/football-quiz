CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar TEXT,
  avatar_config TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS groups_t (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  avatar TEXT,
  invite_code TEXT UNIQUE NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS group_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES groups_t(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer TEXT NOT NULL CHECK (correct_answer IN ('a','b','c','d')),
  scheduled_date TEXT NOT NULL,
  slot INTEGER NOT NULL DEFAULT 1,
  UNIQUE(scheduled_date, slot)
);

CREATE INDEX IF NOT EXISTS idx_questions_date ON questions(scheduled_date);

CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  question_id INTEGER NOT NULL REFERENCES questions(id),
  answer TEXT NOT NULL CHECK (answer IN ('a','b','c','d')),
  is_correct INTEGER NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  answered_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_answers_user ON answers(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);

CREATE TABLE IF NOT EXISTS bonus_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt TEXT NOT NULL,
  scheduled_date TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS bonus_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bonus_question_id INTEGER NOT NULL REFERENCES bonus_questions(id),
  group_id INTEGER NOT NULL REFERENCES groups_t(id),
  voter_id INTEGER NOT NULL REFERENCES users(id),
  voted_for_id INTEGER NOT NULL REFERENCES users(id),
  voted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(bonus_question_id, group_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_bonus_votes_lookup ON bonus_votes(bonus_question_id, group_id);

CREATE TABLE IF NOT EXISTS special_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('quien_es_mas', 'que_prefieres')),
  prompt TEXT NOT NULL,
  option_a TEXT,
  option_b TEXT,
  scheduled_date TEXT NOT NULL,
  UNIQUE(type, scheduled_date)
);

CREATE TABLE IF NOT EXISTS special_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  special_question_id INTEGER NOT NULL REFERENCES special_questions(id),
  group_id INTEGER NOT NULL REFERENCES groups_t(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  answer_value TEXT NOT NULL,
  answered_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(special_question_id, group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_special_answers_lookup ON special_answers(special_question_id, group_id);

CREATE TABLE IF NOT EXISTS personality_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES groups_t(id),
  personality_name TEXT NOT NULL,
  prompt_template TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  UNIQUE(group_id, scheduled_date)
);

CREATE INDEX IF NOT EXISTS idx_special_questions_date ON special_questions(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_personality_questions_date ON personality_questions(scheduled_date);

CREATE TABLE IF NOT EXISTS personality_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  personality_question_id INTEGER NOT NULL REFERENCES personality_questions(id),
  group_id INTEGER NOT NULL REFERENCES groups_t(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  answer TEXT NOT NULL CHECK (answer IN ('a','b','c','d')),
  answered_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(personality_question_id, group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_personality_answers_lookup ON personality_answers(personality_question_id, group_id);

CREATE TABLE IF NOT EXISTS mode_b_predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_kind TEXT NOT NULL CHECK (question_kind IN ('quien_es_mas', 'que_prefieres', 'personalidad', 'grupal')),
  question_id INTEGER NOT NULL,
  group_id INTEGER NOT NULL REFERENCES groups_t(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  predicted_value TEXT NOT NULL,
  predicted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(question_kind, question_id, group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mode_b_predictions_lookup ON mode_b_predictions(question_kind, question_id, group_id);

CREATE TABLE IF NOT EXISTS mode_b_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_kind TEXT NOT NULL CHECK (question_kind IN ('quien_es_mas', 'que_prefieres', 'personalidad', 'grupal')),
  question_id INTEGER NOT NULL,
  group_id INTEGER NOT NULL REFERENCES groups_t(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  emoji TEXT NOT NULL,
  reacted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(question_kind, question_id, group_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_mode_b_reactions_lookup ON mode_b_reactions(question_kind, question_id, group_id);

CREATE TABLE IF NOT EXISTS mode_b_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  group_id INTEGER NOT NULL REFERENCES groups_t(id),
  scheduled_date TEXT NOT NULL,
  answered_count INTEGER NOT NULL DEFAULT 0,
  correct_predictions INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  settled_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, group_id, scheduled_date)
);

CREATE INDEX IF NOT EXISTS idx_mode_b_scores_group ON mode_b_scores(group_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_mode_b_scores_user ON mode_b_scores(user_id);

CREATE TABLE IF NOT EXISTS group_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES groups_t(id),
  author_id INTEGER NOT NULL REFERENCES users(id),
  prompt TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT,
  option_d TEXT,
  scheduled_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(group_id, scheduled_date)
);

CREATE TABLE IF NOT EXISTS group_question_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_question_id INTEGER NOT NULL REFERENCES group_questions(id),
  group_id INTEGER NOT NULL REFERENCES groups_t(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  answer TEXT NOT NULL CHECK (answer IN ('a','b','c','d')),
  answered_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(group_question_id, group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_questions_date ON group_questions(group_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_group_question_answers_lookup ON group_question_answers(group_question_id, group_id);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS push_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scheduled_date TEXT UNIQUE NOT NULL,
  sent_count INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS group_question_bank (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES groups_t(id),
  author_id INTEGER NOT NULL REFERENCES users(id),
  prompt TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT,
  option_d TEXT,
  used_on TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_group_question_bank_pending ON group_question_bank(group_id, used_on);

CREATE TABLE IF NOT EXISTS duel_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT UNIQUE NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer TEXT NOT NULL CHECK (correct_answer IN ('a','b','c','d')),
  difficulty TEXT NOT NULL DEFAULT 'dificil' CHECK (difficulty IN ('dificil','ultra','demonio'))
);

CREATE TABLE IF NOT EXISTS duels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES groups_t(id),
  challenger_id INTEGER NOT NULL REFERENCES users(id),
  opponent_id INTEGER NOT NULL REFERENCES users(id),
  question_ids TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'dificil' CHECK (difficulty IN ('dificil','ultra','demonio')),
  challenger_correct INTEGER,
  opponent_correct INTEGER,
  winner_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'esperando' CHECK (status IN ('esperando', 'terminado')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_duels_group ON duels(group_id, status);
CREATE INDEX IF NOT EXISTS idx_duels_players ON duels(challenger_id, opponent_id);

CREATE TABLE IF NOT EXISTS duel_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  duel_id INTEGER NOT NULL REFERENCES duels(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  question_id INTEGER NOT NULL REFERENCES duel_questions(id),
  answer TEXT NOT NULL CHECK (answer IN ('a','b','c','d')),
  is_correct INTEGER NOT NULL,
  answered_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(duel_id, user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_duel_answers_lookup ON duel_answers(duel_id, user_id);

CREATE TABLE IF NOT EXISTS football_cache (
  cache_key TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Equipo-Jugador: cadena de conexiones futbolísticas (jugador -> equipo -> jugador...).
-- Datos cargados una sola vez desde server/data/equipo-jugador-players.json
-- (ver server/db/seed-equipo-jugador.js), sin scraping ni API en vivo dentro del juego.
CREATE TABLE IF NOT EXISTS ej_clubs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  normalized_name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS ej_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  normalized_name TEXT UNIQUE NOT NULL,
  nationality TEXT,
  position TEXT,
  birth_year INTEGER
);

CREATE TABLE IF NOT EXISTS ej_player_clubs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES ej_players(id),
  club_id INTEGER NOT NULL REFERENCES ej_clubs(id),
  start_year INTEGER,
  end_year INTEGER,
  UNIQUE(player_id, club_id, start_year)
);

CREATE INDEX IF NOT EXISTS idx_ej_pc_player ON ej_player_clubs(player_id);
CREATE INDEX IF NOT EXISTS idx_ej_pc_club ON ej_player_clubs(club_id);
CREATE INDEX IF NOT EXISTS idx_ej_players_name ON ej_players(normalized_name);
CREATE INDEX IF NOT EXISTS idx_ej_clubs_name ON ej_clubs(normalized_name);

-- Puntajes de los "retos" (versión semanal de cada juego + trivia diaria),
-- para el ranking de grupo. period_key es "YYYY-MM-DD" para trivia (se
-- resetea cada día) o "YYYY-Www" (semana ISO) para el resto. Guarda el MEJOR
-- puntaje de cada usuario en ese período — el ranking/los puntos (100/50/30/10)
-- se calculan al leer, no se guardan, así no hay que recalcular nada si
-- alguien mejora su marca a mitad de semana.
CREATE TABLE IF NOT EXISTS challenge_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_key TEXT NOT NULL,
  period_key TEXT NOT NULL,
  group_id INTEGER NOT NULL REFERENCES groups_t(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  score REAL NOT NULL,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(game_key, period_key, group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_scores_lookup ON challenge_scores(game_key, period_key, group_id);

-- Modo Carrera DT Online: una liga que arma un usuario e invita a amigos por
-- código. Cada uno elige un club real de la liga elegida (Premier/La Liga) y
-- el resto de los clubes de esa liga quedan controlados por la CPU. Fase 1:
-- solo lobby (crear/unirse/elegir equipo) — la fixture y los resultados de
-- partido son la fase siguiente.
CREATE TABLE IF NOT EXISTS dt_leagues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  league_key TEXT NOT NULL CHECK (league_key IN ('premier', 'laliga')),
  invite_code TEXT UNIQUE NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  -- La liga pertenece a UN grupo general (Trivia/Duelos/etc): solo esos
  -- miembros pueden unirse. Nullable por compatibilidad con ligas viejas de
  -- antes de esta columna, que no se restringen retroactivamente.
  group_id INTEGER REFERENCES groups_t(id),
  status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'in_progress', 'finished')),
  current_week INTEGER NOT NULL DEFAULT 0,
  total_weeks INTEGER NOT NULL DEFAULT 0,
  weeks_per_month INTEGER NOT NULL DEFAULT 4,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dt_league_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  league_id INTEGER NOT NULL REFERENCES dt_leagues(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  team_id TEXT,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(league_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_dt_league_members_league ON dt_league_members(league_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dt_league_members_team ON dt_league_members(league_id, team_id) WHERE team_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS dt_league_fixtures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  league_id INTEGER NOT NULL REFERENCES dt_leagues(id),
  week INTEGER NOT NULL,
  month INTEGER NOT NULL DEFAULT 1,
  home_team_id TEXT NOT NULL,
  away_team_id TEXT NOT NULL,
  home_goals INTEGER,
  away_goals INTEGER,
  played INTEGER NOT NULL DEFAULT 0,
  -- Partidos humano-vs-humano: velocidad elegida, cuándo se conectó el
  -- primero (para el walkover a los 3 días) y quién de los dos ya entró.
  speed REAL NOT NULL DEFAULT 1,
  live_started_at TEXT,
  live_home_joined INTEGER NOT NULL DEFAULT 0,
  live_away_joined INTEGER NOT NULL DEFAULT 0,
  walkover TEXT
);

CREATE INDEX IF NOT EXISTS idx_dt_fixtures_league_week ON dt_league_fixtures(league_id, week);

-- Táctica que cada usuario elige para SU club (mentalidad + pressing + tempo,
-- versión resumida de la del modo Carrera single-player). Los clubes CPU no
-- tienen fila acá y usan los valores por defecto al resolver sus partidos.
CREATE TABLE IF NOT EXISTS dt_league_tactics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  league_id INTEGER NOT NULL REFERENCES dt_leagues(id),
  team_id TEXT NOT NULL,
  mentality INTEGER NOT NULL DEFAULT 3,
  pressing INTEGER NOT NULL DEFAULT 50,
  tempo INTEGER NOT NULL DEFAULT 50,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(league_id, team_id)
);

-- Puntos semanales de la Liga Online DT hacia el ranking general del grupo
-- (mismo ranking que trivia/duelos/Modo B, ver rankingBetween en stats.js).
-- Se suma UNA fila por jornada jugada por cada usuario — no por partido de
-- CPU, esos no puntúan porque nadie los jugó. El puntaje ya viene ajustado
-- por diferencia de nivel entre los dos clubes (ver dtWeeklyPoints en
-- utils/dt-match.js): ganarle a un club más grande vale mucho más que
-- ganarle al que "tenía" que ganarte, y un club grande que pierde contra uno
-- chico resta — la Real Sociedad y el Barça no parten del mismo objetivo.
CREATE TABLE IF NOT EXISTS dt_league_weekly_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  league_id INTEGER NOT NULL REFERENCES dt_leagues(id),
  group_id INTEGER NOT NULL REFERENCES groups_t(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  week INTEGER NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  settled_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(league_id, user_id, week)
);

CREATE INDEX IF NOT EXISTS idx_dt_weekly_scores_group ON dt_league_weekly_scores(group_id, settled_at);
CREATE INDEX IF NOT EXISTS idx_dt_weekly_scores_user ON dt_league_weekly_scores(user_id);

-- Copa grupal: torneo de eliminación directa dentro de un grupo. Cada
-- participante arma su "equipo" draftando jugadores reales del mismo pool de
-- Equipo-Jugador (ej_players) — no hay un rating oficial de esos jugadores en
-- la base, así que la fuerza del plantel se deriva de forma determinística
-- del id de cada jugador (ver ratingForPlayer en group-cup.js). Los cupos que
-- nadie eligió se llenan con CPU (plantel al azar) para completar el bracket.
CREATE TABLE IF NOT EXISTS group_cups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES groups_t(id),
  name TEXT NOT NULL,
  bracket_size INTEGER NOT NULL,
  squad_size INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'in_progress', 'finished')),
  round INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_group_cups_group ON group_cups(group_id);

CREATE TABLE IF NOT EXISTS group_cup_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cup_id INTEGER NOT NULL REFERENCES group_cups(id),
  user_id INTEGER REFERENCES users(id),
  is_cpu INTEGER NOT NULL DEFAULT 0,
  team_name TEXT NOT NULL,
  squad TEXT NOT NULL,
  rating REAL NOT NULL,
  seed INTEGER,
  eliminated INTEGER NOT NULL DEFAULT 0,
  UNIQUE(cup_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_cup_participants_cup ON group_cup_participants(cup_id);

CREATE TABLE IF NOT EXISTS group_cup_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cup_id INTEGER NOT NULL REFERENCES group_cups(id),
  round INTEGER NOT NULL,
  slot_index INTEGER NOT NULL,
  participant_a_id INTEGER REFERENCES group_cup_participants(id),
  participant_b_id INTEGER REFERENCES group_cup_participants(id),
  score_a INTEGER,
  score_b INTEGER,
  winner_id INTEGER REFERENCES group_cup_participants(id),
  played INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_group_cup_matches_cup ON group_cup_matches(cup_id, round);
