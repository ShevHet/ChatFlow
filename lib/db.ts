
import Database from "better-sqlite3";
import { createAppError } from "./error-handler";

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    try {
      db = new Database("chatflow.db");
      db.pragma("foreign_keys = ON");
      db.pragma("journal_mode = WAL");
      initializeDatabase(db);
    } catch (error) {
      if (db) {
        db.close();
        db = null;
      }
      const appError = createAppError(error, "database initialization");
      throw new Error(`Failed to initialize database: ${appError.message}`);
    }
  }
  return db;
}

function initializeDatabase(database: Database.Database): void {
  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS threads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        createdAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        threadId INTEGER NOT NULL,
        sender TEXT NOT NULL CHECK (sender IN ('user', 'assistant')),
        message TEXT NOT NULL,
        timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (threadId) REFERENCES threads(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_threadId ON messages(threadId);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
    `);
  } catch (error) {
    const appError = createAppError(error, "database schema initialization");
    throw new Error(`Failed to initialize database schema: ${appError.message}`);
  }
}

export function closeDatabase(): void {
  if (db) {
    try {
      db.close();
      db = null;
    } catch (error) {
      const appError = createAppError(error, "database close");
      throw new Error(`Failed to close database: ${appError.message}`);
    }
  }
}

export interface Thread {
  id: number;
  title: string;
  createdAt: number;
}

export interface Message {
  id: number;
  threadId: number;
  sender: "user" | "assistant";
  message: string;
  timestamp: number;
}
