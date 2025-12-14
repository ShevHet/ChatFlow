import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

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
  private db: Database.Database;
  private migrationsPath: string;

  constructor(db: Database.Database, migrationsPath: string = 'migrations') {
    this.db = db;
    this.migrationsPath = join(process.cwd(), migrationsPath);
    this.ensureMigrationsTable();
  }

  private ensureMigrationsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  private parseMigrationFile(filename: string): Migration | null {
    if (!filename.endsWith('.sql')) {
      return null;
    }

    const match = filename.match(/^(\d+)_(.+)\.sql$/);
    if (!match) {
      return null;
    }

    const version = parseInt(match[1], 10);
    const name = match[2];
    const filePath = join(this.migrationsPath, filename);
    
    try {
      const content = readFileSync(filePath, 'utf-8');
      const parts = content.split('-- DOWN MIGRATION');
      
      if (parts.length !== 2) {
        throw new Error(`Migration ${filename} must contain -- DOWN MIGRATION separator`);
      }

      return {
        version,
        name,
        up: parts[0].trim(),
        down: parts[1].trim(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse migration ${filename}: ${errorMessage}`);
    }
  }

  private loadMigrations(): Migration[] {
    try {
      const files = readdirSync(this.migrationsPath)
        .filter(f => f.endsWith('.sql'))
        .sort();

      const migrations: Migration[] = [];
      for (const file of files) {
        const migration = this.parseMigrationFile(file);
        if (migration) {
          migrations.push(migration);
        }
      }

      return migrations;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load migrations: ${errorMessage}`);
    }
  }

  private getAppliedMigrations(): MigrationRecord[] {
    const stmt = this.db.prepare('SELECT version, name, applied_at FROM migrations ORDER BY version');
    return stmt.all() as MigrationRecord[];
  }

  private getCurrentVersion(): number {
    const stmt = this.db.prepare('SELECT MAX(version) as version FROM migrations');
    const result = stmt.get() as { version: number | null } | undefined;
    return result?.version ?? 0;
  }

  async migrate(targetVersion?: number): Promise<void> {
    const migrations = this.loadMigrations();
    const applied = this.getAppliedMigrations();
    const appliedVersions = new Set(applied.map(m => m.version));
    const currentVersion = this.getCurrentVersion();

    const pendingMigrations = migrations.filter(m => !appliedVersions.has(m.version));

    if (targetVersion !== undefined) {
      if (targetVersion < currentVersion) {
        throw new Error(`Cannot migrate to version ${targetVersion}: current version is ${currentVersion}`);
      }
      const targetMigrations = migrations.filter(m => m.version <= targetVersion && !appliedVersions.has(m.version));
      await this.applyMigrations(targetMigrations);
    } else {
      await this.applyMigrations(pendingMigrations);
    }
  }

  private async applyMigrations(migrations: Migration[]): Promise<void> {
    for (const migration of migrations) {
      try {
        console.log(`Applying migration ${migration.version}_${migration.name}...`);
        
        this.db.exec('BEGIN TRANSACTION');
        
        try {
          this.db.exec(migration.up);
          
          const stmt = this.db.prepare('INSERT INTO migrations (version, name) VALUES (?, ?)');
          stmt.run(migration.version, migration.name);
          
          this.db.exec('COMMIT');
          console.log(`Migration ${migration.version}_${migration.name} applied successfully`);
        } catch (error) {
          this.db.exec('ROLLBACK');
          throw error;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to apply migration ${migration.version}_${migration.name}: ${errorMessage}`);
      }
    }
  }

  async rollback(targetVersion?: number): Promise<void> {
    const applied = this.getAppliedMigrations();
    const migrations = this.loadMigrations();
    const migrationMap = new Map(migrations.map(m => [m.version, m]));

    if (applied.length === 0) {
      throw new Error('No migrations to rollback');
    }

    const currentVersion = this.getCurrentVersion();
    const target = targetVersion ?? (currentVersion - 1);

    if (target < 0) {
      throw new Error('Cannot rollback below version 0');
    }

    if (target >= currentVersion) {
      throw new Error(`Cannot rollback to version ${target}: current version is ${currentVersion}`);
    }

    const migrationsToRollback = applied
      .filter(m => m.version > target)
      .sort((a, b) => b.version - a.version);

    for (const record of migrationsToRollback) {
      const migration = migrationMap.get(record.version);
      if (!migration) {
        throw new Error(`Migration ${record.version}_${record.name} not found in migration files`);
      }

      try {
        console.log(`Rolling back migration ${migration.version}_${migration.name}...`);
        
        this.db.exec('BEGIN TRANSACTION');
        
        try {
          this.db.exec(migration.down);
          
          const stmt = this.db.prepare('DELETE FROM migrations WHERE version = ?');
          stmt.run(migration.version);
          
          this.db.exec('COMMIT');
          console.log(`Migration ${migration.version}_${migration.name} rolled back successfully`);
        } catch (error) {
          this.db.exec('ROLLBACK');
          throw error;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to rollback migration ${migration.version}_${migration.name}: ${errorMessage}`);
      }
    }
  }

  getStatus(): { currentVersion: number; appliedMigrations: MigrationRecord[]; pendingMigrations: Migration[] } {
    const migrations = this.loadMigrations();
    const applied = this.getAppliedMigrations();
    const appliedVersions = new Set(applied.map(m => m.version));
    const pendingMigrations = migrations.filter(m => !appliedVersions.has(m.version));

    return {
      currentVersion: this.getCurrentVersion(),
      appliedMigrations: applied,
      pendingMigrations,
    };
  }
}
