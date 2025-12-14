-- Миграция для инициализации базы данных
-- Создание таблиц threads и messages согласно спецификации

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

