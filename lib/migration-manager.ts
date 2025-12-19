/**
 * Система управления миграциями базы данных
 * 
 * Предоставляет функциональность для применения и отката миграций схемы БД.
 * Поддерживает версионирование и отслеживание примененных миграций.
 * 
 * @example
 * ```sql
 * -- UP MIGRATION
 * ALTER TABLE threads ADD COLUMN description TEXT;
 * 
 * -- DOWN MIGRATION
 * -- SQLite не поддерживает DROP COLUMN напрямую, требуется пересоздание таблицы
 * ```
 */

import { Database } from 'bun:sqlite';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, isAbsolute } from 'path';
import { createAppError } from './error-handler';

/**
 * Интерфейс для представления миграции
 */
export interface Migration {
  version: number;
  name: string;
  up: string;
  down: string;
}

export interface MigrationRecord {
  version: number;
  name: string;
  applied_at: string;
}

export class MigrationManager {
  private db: Database;
  private migrationsPath: string;

  /**
   * Создает новый экземпляр MigrationManager
   * 
   * @param db - Подключение к базе данных
   * @param migrationsPath - Путь к директории с файлами миграций (относительно process.cwd())
   * @throws Error если директория миграций не существует
   */
  constructor(db: Database, migrationsPath: string = 'migrations') {
    this.db = db;
    this.migrationsPath = isAbsolute(migrationsPath)
      ? migrationsPath
      : join(process.cwd(), migrationsPath);
    
    // Проверяем существование директории миграций
    if (!existsSync(this.migrationsPath)) {
      throw new Error(`Migrations directory not found: ${this.migrationsPath}`);
    }
    
    this.ensureMigrationsTable();
  }

  /**
   * Создает таблицу для отслеживания примененных миграций
   * 
   * Вызывается автоматически при создании MigrationManager.
   * Таблица используется для определения, какие миграции уже применены.
   */
  private ensureMigrationsTable(): void {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
    } catch (error) {
      const appError = createAppError(error, "migrations table creation");
      throw new Error(`Failed to create migrations table: ${appError.message}`);
    }
  }

  /**
   * Парсит файл миграции и извлекает информацию о ней
   * 
   * Ожидает формат имени файла: {version}_{name}.sql
   * Файл должен содержать два блока SQL, разделенных "-- DOWN MIGRATION"
   * 
   * @param filename - Имя файла миграции
   * @returns Объект Migration или null, если файл не соответствует формату
   * @throws Error если файл существует, но не может быть прочитан или отпарсен
   */
  private parseMigrationFile(filename: string): Migration | null {
    // Пропускаем файлы, не являющиеся SQL
    if (!filename.endsWith('.sql')) {
      return null;
    }

    // Извлекаем версию и имя из формата: {version}_{name}.sql
    const match = filename.match(/^(\d+)_(.+)\.sql$/);
    if (!match) {
      return null;
    }

    const version = parseInt(match[1], 10);
    const name = match[2];
    const filePath = join(this.migrationsPath, filename);
    
    try {
      // Читаем содержимое файла
      const content = readFileSync(filePath, 'utf-8');
      
      // Разделяем на UP и DOWN миграции
      const parts = content.split('-- DOWN MIGRATION');
      
      if (parts.length !== 2) {
        throw new Error(
          `Migration ${filename} must contain exactly one "-- DOWN MIGRATION" separator. ` +
          `Found ${parts.length - 1} separator(s).`
        );
      }

      // Валидация: UP миграция не должна быть пустой
      // Убираем "-- UP MIGRATION" заголовок и проверяем, что осталось содержимое
      // Используем более точную проверку - после заголовка должно быть что-то кроме пробелов и переносов строк
      const upContent = parts[0];
      // Убираем заголовок и все пробелы/переносы строк до "-- DOWN MIGRATION"
      const upWithoutHeader = upContent.replace(/^--\s*UP\s*MIGRATION\s*/i, '').trim();
      // Проверяем, что осталось содержимое (не пусто и не только "-- DOWN MIGRATION")
      if (upWithoutHeader.length === 0 || upWithoutHeader.startsWith('-- DOWN')) {
        throw new Error(`Migration ${filename} UP section is empty`);
      }

      // Валидация: DOWN миграция не должна быть пустой
      const downMigration = parts[1].trim();
      if (downMigration.length === 0) {
        throw new Error(`Migration ${filename} DOWN section is empty`);
      }

      return {
        version,
        name,
        up: upWithoutHeader,
        down: downMigration,
      };
    } catch (error) {
      // Ошибки валидации не оборачиваем, чтобы сохранить оригинальное сообщение
      if (error instanceof Error && (
        error.message.includes("must contain") ||
        error.message.includes("section is empty") ||
        error.message.includes("Duplicate migration version")
      )) {
        throw error;
      }
      const appError = createAppError(error, `migration parsing - ${filename}`);
      throw new Error(`Failed to parse migration ${filename}: ${appError.message}`);
    }
  }

  /**
   * Загружает все миграции из директории
   * 
   * Сканирует директорию миграций, парсит все SQL файлы и возвращает
   * отсортированный по версии список миграций.
   * 
   * @returns Массив миграций, отсортированный по версии
   * @throws Error если не удалось прочитать директорию или файлы
   */
  private loadMigrations(): Migration[] {
    try {
      // Получаем список всех SQL файлов в директории
      const files = readdirSync(this.migrationsPath)
        .filter(f => f.endsWith('.sql'))
        .sort(); // Сортируем по имени (версии)

      const migrations: Migration[] = [];
      const seenVersions = new Set<number>();

      for (const file of files) {
        try {
          const migration = this.parseMigrationFile(file);
          if (migration) {
            // Проверяем на дубликаты версий
            if (seenVersions.has(migration.version)) {
              throw new Error(
                `Duplicate migration version ${migration.version} found. ` +
                `Each migration must have a unique version number.`
              );
            }
            seenVersions.add(migration.version);
            migrations.push(migration);
          }
        } catch (error) {
          // Ошибки валидации из parseMigrationFile пробрасываем дальше
          if (error instanceof Error && (
            error.message.includes("must contain") ||
            error.message.includes("section is empty") ||
            error.message.includes("Duplicate migration version")
          )) {
            throw error;
          }
          // Другие ошибки игнорируем (невалидные файлы)
        }
      }

      // Сортируем по версии для гарантии правильного порядка применения
      migrations.sort((a, b) => a.version - b.version);

      return migrations;
    } catch (error) {
      // Ошибки валидации не оборачиваем, чтобы сохранить оригинальное сообщение
      if (error instanceof Error && (
        error.message.includes("must contain") ||
        error.message.includes("section is empty") ||
        error.message.includes("Duplicate migration version")
      )) {
        throw error;
      }
      const appError = createAppError(error, "migration loading");
      throw new Error(`Failed to load migrations: ${appError.message}`);
    }
  }

  /**
   * Получает список всех примененных миграций из БД
   * 
   * @returns Массив записей о примененных миграциях
   */
  private getAppliedMigrations(): MigrationRecord[] {
    try {
      const stmt = this.db.prepare(
        'SELECT version, name, applied_at FROM migrations ORDER BY version'
      );
      return stmt.all() as MigrationRecord[];
    } catch (error) {
      const appError = createAppError(error, "get applied migrations");
      throw new Error(`Failed to get applied migrations: ${appError.message}`);
    }
  }

  /**
   * Получает текущую версию БД (номер последней примененной миграции)
   * 
   * @returns Номер версии или 0, если миграции еще не применялись
   */
  private getCurrentVersion(): number {
    try {
      const stmt = this.db.prepare('SELECT MAX(version) as version FROM migrations');
      const result = stmt.get() as { version: number | null } | undefined;
      return result?.version ?? 0;
    } catch (error) {
      const appError = createAppError(error, "get current version");
      throw new Error(`Failed to get current version: ${appError.message}`);
    }
  }

  /**
   * Применяет все ожидающие миграции или миграции до указанной версии
   * 
   * Миграции применяются последовательно в порядке возрастания версии.
   * Каждая миграция выполняется в отдельной транзакции для обеспечения атомарности.
   * 
   * @param targetVersion - Опциональная целевая версия (применяются все миграции до этой версии включительно)
   * @throws Error если не удалось применить миграции или целевая версия меньше текущей
   */
  async migrate(targetVersion?: number): Promise<void> {
    const migrations = this.loadMigrations();
    const applied = this.getAppliedMigrations();
    const appliedVersions = new Set(applied.map(m => m.version));
    const currentVersion = this.getCurrentVersion();

    // Определяем миграции, которые нужно применить
    let migrationsToApply: Migration[];

    if (targetVersion !== undefined) {
      // Валидация: нельзя откатиться назад через migrate
      if (targetVersion < currentVersion) {
        throw new Error(
          `Cannot migrate to version ${targetVersion}: current version is ${currentVersion}. ` +
          `Use rollback() to downgrade.`
        );
      }
      
      // Применяем все миграции до целевой версии включительно
      migrationsToApply = migrations.filter(
        m => m.version <= targetVersion && !appliedVersions.has(m.version)
      );
    } else {
      // Применяем все ожидающие миграции
      migrationsToApply = migrations.filter(m => !appliedVersions.has(m.version));
    }

    if (migrationsToApply.length === 0) {
      console.log('No pending migrations to apply.');
      return;
    }

    console.log(`Applying ${migrationsToApply.length} migration(s)...`);
    await this.applyMigrations(migrationsToApply);
    console.log('All migrations applied successfully.');
  }

  /**
   * Применяет список миграций последовательно
   * 
   * Каждая миграция выполняется в отдельной транзакции. При ошибке транзакция
   * откатывается, и процесс останавливается.
   * 
   * @param migrations - Массив миграций для применения (должен быть отсортирован по версии)
   * @throws Error если не удалось применить какую-либо миграцию
   */
  private async applyMigrations(migrations: Migration[]): Promise<void> {
    for (const migration of migrations) {
      try {
        console.log(`Applying migration ${migration.version}_${migration.name}...`);
        
        // Начинаем транзакцию для атомарности
        this.db.exec('BEGIN TRANSACTION');
        
        try {
          // Выполняем UP миграцию
          this.db.exec(migration.up);
          
          // Записываем факт применения миграции
          const stmt = this.db.prepare(
            'INSERT INTO migrations (version, name) VALUES (?, ?)'
          );
          stmt.run(migration.version, migration.name);
          
          // Подтверждаем транзакцию
          this.db.exec('COMMIT');
          console.log(
            `✓ Migration ${migration.version}_${migration.name} applied successfully`
          );
        } catch (error) {
          // Откатываем транзакцию при ошибке
          this.db.exec('ROLLBACK');
          throw error;
        }
      } catch (error) {
        const appError = createAppError(
          error,
          `migration application - ${migration.version}_${migration.name}`
        );
        throw new Error(
          `Failed to apply migration ${migration.version}_${migration.name}: ${appError.message}`
        );
      }
    }
  }

  /**
   * Откатывает миграции до указанной версии или на одну версию назад
   * 
   * Миграции откатываются в обратном порядке (от новых к старым).
   * Каждый откат выполняется в отдельной транзакции.
   * 
   * @param targetVersion - Опциональная целевая версия (откатываются все миграции после этой версии)
   *                        Если не указана, откатывается только последняя миграция
   * @throws Error если нет миграций для отката или целевая версия некорректна
   */
  async rollback(targetVersion?: number): Promise<void> {
    const applied = this.getAppliedMigrations();
    const migrations = this.loadMigrations();
    const migrationMap = new Map(migrations.map(m => [m.version, m]));

    // Проверяем, есть ли миграции для отката
    if (applied.length === 0) {
      throw new Error('No migrations to rollback. Database is at version 0.');
    }

    const currentVersion = this.getCurrentVersion();
    const target = targetVersion ?? (currentVersion - 1);

    // Валидация целевой версии
    if (target < 0) {
      throw new Error('Cannot rollback below version 0');
    }

    if (target >= currentVersion) {
      throw new Error(
        `Cannot rollback to version ${target}: current version is ${currentVersion}. ` +
        `Target version must be less than current version.`
      );
    }

    // Определяем миграции для отката (все миграции после целевой версии)
    const migrationsToRollback = applied
      .filter(m => m.version > target)
      .sort((a, b) => b.version - a.version); // Сортируем по убыванию версии

    if (migrationsToRollback.length === 0) {
      console.log(`Already at version ${target}. Nothing to rollback.`);
      return;
    }

    console.log(`Rolling back ${migrationsToRollback.length} migration(s)...`);
    
    for (const record of migrationsToRollback) {
      const migration = migrationMap.get(record.version);
      if (!migration) {
        throw new Error(
          `Migration ${record.version}_${record.name} not found in migration files. ` +
          `Cannot rollback without migration file.`
        );
      }

      try {
        console.log(`Rolling back migration ${migration.version}_${migration.name}...`);
        
        // Начинаем транзакцию
        this.db.exec('BEGIN TRANSACTION');
        
        try {
          // Выполняем DOWN миграцию
          this.db.exec(migration.down);
          
          // Удаляем запись о примененной миграции
          const stmt = this.db.prepare('DELETE FROM migrations WHERE version = ?');
          stmt.run(migration.version);
          
          // Подтверждаем транзакцию
          this.db.exec('COMMIT');
          console.log(
            `✓ Migration ${migration.version}_${migration.name} rolled back successfully`
          );
        } catch (error) {
          // Откатываем транзакцию при ошибке
          this.db.exec('ROLLBACK');
          throw error;
        }
      } catch (error) {
        const appError = createAppError(
          error,
          `migration rollback - ${migration.version}_${migration.name}`
        );
        throw new Error(
          `Failed to rollback migration ${migration.version}_${migration.name}: ${appError.message}`
        );
      }
    }
    
    console.log('All migrations rolled back successfully.');
  }

  /**
   * Получает статус миграций БД
   * 
   * Возвращает информацию о текущей версии БД, примененных миграциях
   * и ожидающих миграциях.
   * 
   * @returns Объект со статусом миграций
   */
  getStatus(): {
    currentVersion: number;
    appliedMigrations: MigrationRecord[];
    pendingMigrations: Migration[];
  } {
    try {
      const migrations = this.loadMigrations();
      const applied = this.getAppliedMigrations();
      const appliedVersions = new Set(applied.map(m => m.version));
      const pendingMigrations = migrations.filter(m => !appliedVersions.has(m.version));

      return {
        currentVersion: this.getCurrentVersion(),
        appliedMigrations: applied,
        pendingMigrations,
      };
    } catch (error) {
      // Ошибки валидации не оборачиваем, чтобы сохранить оригинальное сообщение
      if (error instanceof Error && (
        error.message.includes("must contain") ||
        error.message.includes("section is empty") ||
        error.message.includes("Duplicate migration version")
      )) {
        throw error;
      }
      const appError = createAppError(error, "get migration status");
      throw new Error(`Failed to get migration status: ${appError.message}`);
    }
  }
}
