/**
 * Файл миграции для инициализации базы данных
 * 
 * Использует простой механизм миграций для гарантированной
 * инициализации базы данных при первом запуске приложения.
 * 
 * Таблицы создаются автоматически при первом вызове getDatabase().
 */

import Database from 'better-sqlite3';

/**
 * Инициализирует базу данных и создает необходимые таблицы
 * 
 * @param dbPath - Путь к файлу базы данных (по умолчанию 'db.sqlite')
 * @returns Экземпляр Database для работы с SQLite
 * 
 * Создаваемые таблицы:
 * - threads: id (INTEGER PRIMARY KEY), title (TEXT)
 * - messages: id (INTEGER PRIMARY KEY), thread_id (INTEGER), 
 *   user_message (TEXT), assistant_message (TEXT)
 */
export function initializeDatabase(dbPath: string = 'db.sqlite'): Database.Database {
  const db = new Database(dbPath);
  
  db.prepare('CREATE TABLE IF NOT EXISTS threads (id INTEGER PRIMARY KEY, title TEXT)').run();
  db.prepare('CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, thread_id INTEGER, user_message TEXT, assistant_message TEXT)').run();
  
  return db;
}