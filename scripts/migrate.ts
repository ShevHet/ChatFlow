import Database from 'better-sqlite3';
import { MigrationManager } from '../lib/migration-manager';

const command = process.argv[2];
const targetVersion = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;

const db = new Database('db.sqlite');
const migrationManager = new MigrationManager(db);

async function main() {
  try {
    switch (command) {
      case 'up':
      case 'migrate':
        await migrationManager.migrate(targetVersion);
        console.log('Migrations applied successfully');
        break;

      case 'down':
      case 'rollback':
        await migrationManager.rollback(targetVersion);
        console.log('Migrations rolled back successfully');
        break;

      case 'status':
        const status = migrationManager.getStatus();
        console.log(`Current version: ${status.currentVersion}`);
        console.log(`Applied migrations: ${status.appliedMigrations.length}`);
        status.appliedMigrations.forEach(m => {
          console.log(`  ✓ ${m.version}_${m.name} (applied at ${m.applied_at})`);
        });
        console.log(`Pending migrations: ${status.pendingMigrations.length}`);
        status.pendingMigrations.forEach(m => {
          console.log(`  ○ ${m.version}_${m.name}`);
        });
        break;

      default:
        console.log('Usage:');
        console.log('  bun run scripts/migrate.ts migrate [version]  - Apply migrations');
        console.log('  bun run scripts/migrate.ts rollback [version] - Rollback migrations');
        console.log('  bun run scripts/migrate.ts status            - Show migration status');
        process.exit(1);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error:', errorMessage);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
