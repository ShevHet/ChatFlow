import Database from 'better-sqlite3';
import { initializeDatabase } from './migrate';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    db = initializeDatabase('db.sqlite');
  }
  return db;
}

export interface Thread {
  id: number;
  title: string | null;
}

export interface Message {
  id: number;
  thread_id: number;
  user_message: string | null;
  assistant_message: string | null;
}
