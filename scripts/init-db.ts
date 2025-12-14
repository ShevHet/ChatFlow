import { initializeDatabase } from '../lib/migrate';

console.log('Инициализация базы данных...');

try {
  const db = initializeDatabase('db.sqlite');
  
  // Проверка таблиц
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('✅ Таблицы в БД:', tables);
  
  // Проверка структуры threads
  const threadsSchema = db.prepare("PRAGMA table_info(threads)").all();
  console.log('✅ Структура таблицы threads:', threadsSchema);
  
  // Проверка структуры messages
  const messagesSchema = db.prepare("PRAGMA table_info(messages)").all();
  console.log('✅ Структура таблицы messages:', messagesSchema);
  
  // Проверка количества записей
  const threadsCount = db.prepare("SELECT COUNT(*) as count FROM threads").get() as { count: number };
  const messagesCount = db.prepare("SELECT COUNT(*) as count FROM messages").get() as { count: number };
  console.log(`📊 Тредов: ${threadsCount.count}, Сообщений: ${messagesCount.count}`);
  
  console.log('✅ База данных успешно инициализирована!');
  console.log('📁 Файл: db.sqlite');
  
  db.close();
} catch (error) {
  console.error('❌ Ошибка при инициализации базы данных:', error);
  process.exit(1);
}

