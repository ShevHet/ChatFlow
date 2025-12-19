import { Database } from "bun:sqlite";
import { getDatabase, Thread, Message } from "@/lib/db";

describe("Database", () => {
  let testDb: Database;
  const testDbPath = ":memory:";

  beforeEach(() => {
    testDb = new Database(testDbPath);
    testDb.exec(`
      CREATE TABLE IF NOT EXISTS threads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        createdAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        threadId INTEGER NOT NULL,
        sender TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (threadId) REFERENCES threads(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_threadId ON messages(threadId);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
    `);
  });

  afterEach(() => {
    testDb.close();
  });

  describe("Threads", () => {
    it("should create a thread", () => {
      const stmt = testDb.prepare("INSERT INTO threads (title) VALUES (?)");
      const result = stmt.run("Test Thread");
      expect(result.lastInsertRowid).toBeGreaterThan(0);
    });

    it("should retrieve threads", () => {
      const insertStmt = testDb.prepare("INSERT INTO threads (title) VALUES (?)");
      insertStmt.run("Thread 1");
      insertStmt.run("Thread 2");

      const selectStmt = testDb.prepare("SELECT * FROM threads");
      const threads = selectStmt.all() as Thread[];
      
      expect(threads).toHaveLength(2);
      expect(threads[0].title).toBe("Thread 1");
      expect(threads[1].title).toBe("Thread 2");
    });

    it("should order threads by createdAt DESC", () => {
      const insertStmt = testDb.prepare("INSERT INTO threads (title, createdAt) VALUES (?, ?)");
      insertStmt.run("Old Thread", Math.floor(Date.now() / 1000) - 1000);
      insertStmt.run("New Thread", Math.floor(Date.now() / 1000));

      const selectStmt = testDb.prepare("SELECT * FROM threads ORDER BY createdAt DESC");
      const threads = selectStmt.all() as Thread[];
      
      expect(threads[0].title).toBe("New Thread");
      expect(threads[1].title).toBe("Old Thread");
    });

    it("should have correct thread structure", () => {
      const stmt = testDb.prepare("INSERT INTO threads (title) VALUES (?)");
      stmt.run("Test Thread");
      
      const selectStmt = testDb.prepare("SELECT * FROM threads WHERE title = ?");
      const thread = selectStmt.get("Test Thread") as Thread;
      
      expect(thread).toHaveProperty("id");
      expect(thread).toHaveProperty("title");
      expect(thread).toHaveProperty("createdAt");
      expect(thread.title).toBe("Test Thread");
      expect(typeof thread.id).toBe("number");
      expect(typeof thread.createdAt).toBe("number");
    });
  });

  describe("Messages", () => {
    let threadId: number;

    beforeEach(() => {
      const stmt = testDb.prepare("INSERT INTO threads (title) VALUES (?)");
      const result = stmt.run("Test Thread");
      threadId = Number(result.lastInsertRowid);
    });

    it("should create a message", () => {
      const stmt = testDb.prepare(
        "INSERT INTO messages (threadId, sender, message) VALUES (?, ?, ?)"
      );
      const result = stmt.run(threadId, "user", "Hello");
      expect(result.lastInsertRowid).toBeGreaterThan(0);
    });

    it("should retrieve messages for a thread", () => {
      const insertStmt = testDb.prepare(
        "INSERT INTO messages (threadId, sender, message) VALUES (?, ?, ?)"
      );
      insertStmt.run(threadId, "user", "Message 1");
      insertStmt.run(threadId, "assistant", "Message 2");

      const selectStmt = testDb.prepare(
        "SELECT * FROM messages WHERE threadId = ? ORDER BY timestamp ASC"
      );
      const messages = selectStmt.all(threadId) as Message[];
      
      expect(messages).toHaveLength(2);
      expect(messages[0].message).toBe("Message 1");
      expect(messages[1].message).toBe("Message 2");
    });

    it("should cascade delete messages when thread is deleted", () => {
      const insertStmt = testDb.prepare(
        "INSERT INTO messages (threadId, sender, message) VALUES (?, ?, ?)"
      );
      insertStmt.run(threadId, "user", "Message 1");

      const deleteStmt = testDb.prepare("DELETE FROM threads WHERE id = ?");
      deleteStmt.run(threadId);

      const selectStmt = testDb.prepare("SELECT * FROM messages WHERE threadId = ?");
      const messages = selectStmt.all(threadId) as Message[];
      
      expect(messages).toHaveLength(0);
    });

    it("should have correct message structure", () => {
      const stmt = testDb.prepare(
        "INSERT INTO messages (threadId, sender, message) VALUES (?, ?, ?)"
      );
      stmt.run(threadId, "user", "Test message");
      
      const selectStmt = testDb.prepare("SELECT * FROM messages WHERE threadId = ?");
      const message = selectStmt.get(threadId) as Message;
      
      expect(message).toHaveProperty("id");
      expect(message).toHaveProperty("threadId");
      expect(message).toHaveProperty("sender");
      expect(message).toHaveProperty("message");
      expect(message).toHaveProperty("timestamp");
      expect(message.sender).toBe("user");
      expect(message.message).toBe("Test message");
      expect(message.threadId).toBe(threadId);
    });

    it("should order messages by timestamp ASC", () => {
      const insertStmt = testDb.prepare(
        "INSERT INTO messages (threadId, sender, message, timestamp) VALUES (?, ?, ?, ?)"
      );
      const now = Math.floor(Date.now() / 1000);
      insertStmt.run(threadId, "user", "First", now - 100);
      insertStmt.run(threadId, "assistant", "Second", now);

      const selectStmt = testDb.prepare(
        "SELECT * FROM messages WHERE threadId = ? ORDER BY timestamp ASC"
      );
      const messages = selectStmt.all(threadId) as Message[];
      
      expect(messages[0].message).toBe("First");
      expect(messages[1].message).toBe("Second");
    });
  });
});
