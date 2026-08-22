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
