/**
 * Тесты для MigrationManager
 * 
 * Проверяет функциональность системы миграций:
 * - Загрузку миграций
 * - Применение миграций
 * - Откат миграций
 * - Валидацию миграций
 * - Обработку ошибок
 */

import { MigrationManager, Migration } from "@/lib/migration-manager";
import { Database } from "bun:sqlite";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync, readdirSync } from "fs";
import { rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("MigrationManager", () => {
  let db: Database;
  let migrationsPath: string;
  let manager: MigrationManager;

  beforeEach(async () => {
    // Создаем временную БД в памяти
    db = new Database(":memory:");

    // Создаем уникальную временную директорию для миграций вне OneDrive
    migrationsPath = mkdtempSync(join(tmpdir(), "chatflow-migrations-"));

    // Создаем тестовые миграции
    createTestMigrations();

    manager = new MigrationManager(db, migrationsPath);
  });

  afterEach(() => {
    db.close();
    if (existsSync(migrationsPath)) {
      try {
        // Удаляем все файлы в директории
        const files = readdirSync(migrationsPath);
        for (const file of files) {
          try {
            rmSync(join(migrationsPath, file), { force: true });
          } catch (e) {
            // Игнорируем ошибки удаления отдельных файлов
          }
        }
        // Пытаемся удалить директорию
        try {
          rmSync(migrationsPath, { recursive: true, force: true });
        } catch (e) {
          // Игнорируем ошибку, если директория не пуста
        }
      } catch (e) {
        // Игнорируем ошибки очистки
      }
    }
  });

  function createTestMigrations() {
    // Миграция 1
    writeFileSync(
      join(migrationsPath, "001_initial_schema.sql"),
      `-- UP MIGRATION
CREATE TABLE IF NOT EXISTS test_table (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
-- DOWN MIGRATION
DROP TABLE IF EXISTS test_table;`
    );

    // Миграция 2
    writeFileSync(
      join(migrationsPath, "002_add_column.sql"),
      `-- UP MIGRATION
ALTER TABLE test_table ADD COLUMN email TEXT;
-- DOWN MIGRATION
-- SQLite не поддерживает DROP COLUMN, требуется пересоздание таблицы
CREATE TABLE IF NOT EXISTS test_table_backup (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
INSERT INTO test_table_backup SELECT id, name FROM test_table;
DROP TABLE test_table;
ALTER TABLE test_table_backup RENAME TO test_table;`
    );
  }

  describe("Конструктор", () => {
    it("должен создавать таблицу migrations при инициализации", () => {
      const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'");
      const result = stmt.get();
      expect(result).toBeDefined();
    });

    it("должен выбрасывать ошибку если директория миграций не существует", () => {
      expect(() => {
        new MigrationManager(db, "non-existent-directory");
      }).toThrow("not found");
    });
  });

  describe("getStatus", () => {
    it("должен возвращать статус с текущей версией 0 если миграции не применены", () => {
      const status = manager.getStatus();

      expect(status.currentVersion).toBe(0);
      expect(status.appliedMigrations).toHaveLength(0);
      expect(status.pendingMigrations).toHaveLength(2);
    });

    it("должен возвращать правильный статус после применения миграций", async () => {
      await manager.migrate();

      const status = manager.getStatus();

      expect(status.currentVersion).toBe(2);
      expect(status.appliedMigrations).toHaveLength(2);
      expect(status.pendingMigrations).toHaveLength(0);
    });
  });

  describe("migrate", () => {
    it("должен применять все ожидающие миграции", async () => {
      await manager.migrate();

      const stmt = db.prepare("SELECT COUNT(*) as count FROM migrations");
      const result = stmt.get() as { count: number };
      expect(result.count).toBe(2);

      // Проверяем, что таблица создана
      const tableStmt = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'"
      );
      const table = tableStmt.get();
      expect(table).toBeDefined();
    });

    it("должен применять миграции в правильном порядке", async () => {
      await manager.migrate();

      const stmt = db.prepare("SELECT version FROM migrations ORDER BY version");
      const migrations = stmt.all() as Array<{ version: number }>;

      expect(migrations[0].version).toBe(1);
      expect(migrations[1].version).toBe(2);
    });

    it("должен применять миграции до указанной версии", async () => {
      await manager.migrate(1);

      const status = manager.getStatus();
      expect(status.currentVersion).toBe(1);
      expect(status.appliedMigrations).toHaveLength(1);
    });

    it("должен выбрасывать ошибку при попытке откатиться назад", async () => {
      await manager.migrate(2);

      await expect(manager.migrate(1)).rejects.toThrow("Cannot migrate");
    });

    it("должен откатывать транзакцию при ошибке", async () => {
      // Создаем миграцию с ошибкой
      writeFileSync(
        join(migrationsPath, "003_invalid_migration.sql"),
        `-- UP MIGRATION
INVALID SQL SYNTAX;
-- DOWN MIGRATION
-- Nothing to rollback`
      );

      await expect(manager.migrate()).rejects.toThrow();

      // Проверяем, что предыдущие миграции не откатились
      const stmt = db.prepare("SELECT COUNT(*) as count FROM migrations");
      const result = stmt.get() as { count: number };
      expect(result.count).toBe(2); // Только первые две миграции применены
    });
  });

  describe("rollback", () => {
    beforeEach(async () => {
      await manager.migrate();
    });

    it("должен откатывать последнюю миграцию", async () => {
      await manager.rollback();

      const status = manager.getStatus();
      expect(status.currentVersion).toBe(1);
      expect(status.appliedMigrations).toHaveLength(1);
    });

    it("должен откатывать миграции до указанной версии", async () => {
      await manager.rollback(0);

      const status = manager.getStatus();
      expect(status.currentVersion).toBe(0);
      expect(status.appliedMigrations).toHaveLength(0);
    });

    it("должен выбрасывать ошибку при попытке откатиться ниже версии 0", async () => {
      await expect(manager.rollback(-1)).rejects.toThrow("Cannot rollback below version 0");
    });

    it("должен выбрасывать ошибку при попытке откатиться вперед", async () => {
      await expect(manager.rollback(3)).rejects.toThrow("Cannot rollback");
    });

    it("должен выбрасывать ошибку если нет миграций для отката", async () => {
      await manager.rollback(0);

      await expect(manager.rollback()).rejects.toThrow("No migrations to rollback");
    });

    it("должен откатывать транзакцию при ошибке", async () => {
      // Создаем миграцию с невалидным DOWN
      writeFileSync(
        join(migrationsPath, "003_another_migration.sql"),
        `-- UP MIGRATION
CREATE TABLE IF NOT EXISTS another_table (id INTEGER);
-- DOWN MIGRATION
INVALID SQL SYNTAX;`
      );

      await manager.migrate();

      // Попытка отката должна провалиться, но предыдущие миграции не должны пострадать
      await expect(manager.rollback()).rejects.toThrow();

      const status = manager.getStatus();
      expect(status.currentVersion).toBe(3); // Все миграции остались примененными
    });
  });

  describe("Валидация миграций", () => {
    it("должен выбрасывать ошибку для миграции без DOWN секции", () => {
      writeFileSync(
        join(migrationsPath, "003_no_down.sql"),
        `-- UP MIGRATION
CREATE TABLE test (id INTEGER);`
      );

      expect(() => {
        manager.getStatus();
      }).toThrow("must contain exactly one \"-- DOWN MIGRATION\" separator");
    });

    it("должен выбрасывать ошибку для миграции с пустой UP секцией", () => {
      writeFileSync(
        join(migrationsPath, "003_empty_up.sql"),
        `-- UP MIGRATION
-- DOWN MIGRATION
DROP TABLE test;`
      );

      expect(() => {
        manager.getStatus();
      }).toThrow("UP section is empty");
    });

    it("должен выбрасывать ошибку для миграции с пустой DOWN секцией", () => {
      writeFileSync(
        join(migrationsPath, "003_empty_down.sql"),
        `-- UP MIGRATION
CREATE TABLE test (id INTEGER);
-- DOWN MIGRATION
`
      );

      expect(() => {
        manager.getStatus();
      }).toThrow("DOWN section is empty");
    });

    it("должен выбрасывать ошибку для дубликатов версий", () => {
      writeFileSync(
        join(migrationsPath, "001_duplicate.sql"),
        `-- UP MIGRATION
CREATE TABLE duplicate (id INTEGER);
-- DOWN MIGRATION
DROP TABLE duplicate;`
      );

      expect(() => {
        manager.getStatus();
      }).toThrow("Duplicate migration version");
    });
  });
});

