/**
 * Интеграционные тесты для работы с базой данных
 * 
 * Примечание: Эти тесты требуют Bun runtime, так как используют bun:sqlite
 * В Jest окружении они пропускаются
 */

describe.skip("Database", () => {
  // Тесты пропущены, так как bun:sqlite не работает в Jest окружении
  // Для запуска этих тестов используйте Bun: bun test __tests__/lib/db.test.ts

  describe("Threads", () => {
    it("should create a thread", () => {
      const result = testDb.run("INSERT INTO threads (title) VALUES (?)", ["Test Thread"]);
      expect(result.lastInsertRowId).toBeGreaterThan(0);
    });

    it("should retrieve threads", () => {
      testDb.run("INSERT INTO threads (title) VALUES (?)", ["Thread 1"]);
      testDb.run("INSERT INTO threads (title) VALUES (?)", ["Thread 2"]);

      const threads = testDb.query("SELECT * FROM threads").all() as Thread[];
      
      expect(threads).toHaveLength(2);
      expect(threads[0].title).toBe("Thread 1");
      expect(threads[1].title).toBe("Thread 2");
    });

    it("should allow null title", () => {
      const result = testDb.run("INSERT INTO threads (title) VALUES (?)", [null]);
      const thread = testDb.query("SELECT * FROM threads WHERE id = ?").get(Number(result.lastInsertRowId)) as Thread;
      
      expect(thread.title).toBeNull();
    });
  });

  describe("Messages", () => {
    let threadId: number;

    beforeEach(() => {
      const result = testDb.run("INSERT INTO threads (title) VALUES (?)", ["Test Thread"]);
      threadId = Number(result.lastInsertRowId);
    });

    it("should create a message", () => {
      const result = testDb.run(
        "INSERT INTO messages (thread_id, user_message, assistant_message) VALUES (?, ?, ?)",
        [threadId, "Hello", "Hi there!"]
      );
      expect(result.lastInsertRowId).toBeGreaterThan(0);
    });

    it("should retrieve messages for a thread", () => {
      testDb.run(
        "INSERT INTO messages (thread_id, user_message, assistant_message) VALUES (?, ?, ?)",
        [threadId, "Message 1", "Response 1"]
      );
      testDb.run(
        "INSERT INTO messages (thread_id, user_message, assistant_message) VALUES (?, ?, ?)",
        [threadId, "Message 2", "Response 2"]
      );

      const messages = testDb.query("SELECT * FROM messages WHERE thread_id = ?").all(threadId) as Message[];
      
      expect(messages).toHaveLength(2);
      expect(messages[0].user_message).toBe("Message 1");
      expect(messages[1].user_message).toBe("Message 2");
    });

    it("should allow null values for messages", () => {
      const result = testDb.run(
        "INSERT INTO messages (thread_id, user_message, assistant_message) VALUES (?, ?, ?)",
        [threadId, null, "Response only"]
      );
      
      const message = testDb.query("SELECT * FROM messages WHERE id = ?").get(Number(result.lastInsertRowId)) as Message;
      expect(message.user_message).toBeNull();
      expect(message.assistant_message).toBe("Response only");
    });
  });
});

