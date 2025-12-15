# Система миграций базы данных

Проект использует систему миграций для управления версиями схемы базы данных с поддержкой откатов.

## Структура миграций

Миграции находятся в директории `migrations/` и должны следовать формату:
```
{номер}_{название}.sql
```

Например: `001_initial_schema.sql`, `002_add_indexes.sql`

## Формат файла миграции

Каждый файл миграции должен содержать два блока SQL:
1. **UP MIGRATION** - код для применения миграции
2. **DOWN MIGRATION** - код для отката миграции

Разделитель между блоками: `-- DOWN MIGRATION`

Пример:
```sql
-- UP MIGRATION
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

-- DOWN MIGRATION
DROP TABLE IF EXISTS users;
```

## Команды

### Применить все миграции
```bash
npm run migrate
```

### Применить миграции до определенной версии
```bash
npx tsx scripts/migrate.ts migrate 2
```

### Проверить статус миграций
```bash
npm run migrate:status
```

### Откатить последнюю миграцию
```bash
npm run migrate:rollback
```

### Откатить до определенной версии
```bash
npx tsx scripts/migrate.ts rollback 1
```

## Автоматическое применение

Миграции применяются автоматически при первом вызове `getDatabase()` через функцию `initializeDatabase()`.

## Создание новой миграции

1. Создайте файл в директории `migrations/` с форматом `{номер}_{название}.sql`
2. Номер должен быть больше всех существующих номеров
3. Добавьте блоки UP и DOWN MIGRATION
4. Запустите `npm run migrate` для применения

## Откат миграций

⚠️ **Внимание**: Откат миграций может привести к потере данных. Убедитесь, что у вас есть резервная копия базы данных.

Откат выполняется в обратном порядке (от последней к указанной версии).

## Таблица migrations

Система автоматически создает таблицу `migrations` для отслеживания примененных миграций:

```sql
CREATE TABLE migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

## Примеры

### Добавление новой таблицы
```sql
-- UP MIGRATION
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT
);

-- DOWN MIGRATION
DROP TABLE IF EXISTS settings;
```

### Добавление колонки
```sql
-- UP MIGRATION
ALTER TABLE threads ADD COLUMN created_at TEXT DEFAULT (datetime('now'));

-- DOWN MIGRATION
-- SQLite не поддерживает DROP COLUMN напрямую
-- Необходимо пересоздать таблицу или использовать другой подход
```

### Добавление индекса
```sql
-- UP MIGRATION
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);

-- DOWN MIGRATION
DROP INDEX IF EXISTS idx_messages_thread_id;
```
