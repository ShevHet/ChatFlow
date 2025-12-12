import { getDatabase, Thread, Message } from "@/lib/db";
import Database from "better-sqlite3";

describe("Database Integration", () => {
  let originalDb: Database.Database | null = null;

  beforeAll(() => {
    originalDb = new Database(":memory:");
  });

  afterAll(() => {
    if (originalDb) {
      originalDb.close();
    }
  });

  it("should initialize database with getDatabase", () => {
    const db = getDatabase();
    expect(db).toBeDefined();
    expect(db).toBeInstanceOf(Database);
  });

  it("should create threads table", () => {
    const db = getDatabase();
    const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='threads'");
    const result = stmt.get();
    expect(result).toBeDefined();
  });

  it("should create messages table", () => {
    const db = getDatabase();
    const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'");
    const result = stmt.get();
    expect(result).toBeDefined();
  });

  it("should create indexes", () => {
    const db = getDatabase();
    const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_messages%'");
    const indexes = stmt.all();
    expect(indexes.length).toBeGreaterThan(0);
  });

  it("should return same database instance on multiple calls", () => {
    const db1 = getDatabase();
    const db2 = getDatabase();
    expect(db1).toBe(db2);
  });
});

