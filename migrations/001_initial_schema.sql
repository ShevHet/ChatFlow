-- UP MIGRATION
CREATE TABLE IF NOT EXISTS threads (
  id INTEGER PRIMARY KEY,
  title TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  thread_id INTEGER,
  user_message TEXT,
  assistant_message TEXT
);

-- DOWN MIGRATION
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS threads;
