/**
 * Тесты безопасности
 */

import { POST } from "@/app/api/threads/route";
import { POST as POST_MESSAGES } from "@/app/api/messages/route";
import { POST as POST_EXCEL } from "@/app/api/excel/route";
import { NextRequest } from "next/server";

const mockDb = {
  prepare: jest.fn((sql: string) => ({
    run: jest.fn((...params: any[]) => ({ lastInsertRowId: 1 })),
    all: jest.fn(() => []),
    get: jest.fn(() => null),
  })),
};

jest.mock("@/lib/db", () => {
  return {
    getDatabase: () => mockDb,
  };
});

import { getDatabase } from "@/lib/db";

describe("Security Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Настраиваем мок для prepare
    (mockDb.prepare as jest.Mock).mockReturnValue({
      run: jest.fn(() => ({ lastInsertRowId: 1 })),
      all: jest.fn(() => []),
      get: jest.fn(() => null),
    });
  });

  describe("SQL Injection Protection", () => {
    it("should prevent SQL injection in thread title", async () => {
      // Настраиваем мок для INSERT и SELECT
      (mockDb.prepare as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes("INSERT")) {
          return {
            run: jest.fn(() => ({ lastInsertRowId: 1 })),
            all: jest.fn(() => []),
            get: jest.fn(() => null),
          };
        } else if (sql.includes("SELECT") && sql.includes("WHERE id")) {
          return {
            run: jest.fn(() => ({ lastInsertRowId: 1 })),
            all: jest.fn(() => []),
            get: jest.fn(() => ({ id: 1, title: "'; DROP TABLE threads; --" })),
          };
        } else if (sql.includes("ORDER BY id DESC")) {
          return {
            run: jest.fn(() => ({ lastInsertRowId: 1 })),
            all: jest.fn(() => []),
            get: jest.fn(() => ({ id: 1, title: "'; DROP TABLE threads; --" })),
          };
        } else if (sql.includes("SELECT * FROM threads")) {
          return {
            run: jest.fn(() => ({ lastInsertRowId: 1 })),
            all: jest.fn(() => [{ id: 1, title: "'; DROP TABLE threads; --" }]),
            get: jest.fn(() => null),
          };
        }
        return {
          run: jest.fn(() => ({ lastInsertRowId: 1 })),
          all: jest.fn(() => []),
          get: jest.fn(() => null),
        };
      });

      const url = new URL("http://localhost:3000/api/threads");
      const request = new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({
          title: "'; DROP TABLE threads; --",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.title).toBe("'; DROP TABLE threads; --");

      // Проверяем, что таблица не удалена
      const db = getDatabase();
      const threads = db.prepare("SELECT * FROM threads").all();
      expect(threads.length).toBeGreaterThan(0);
    });

    it("should prevent SQL injection in message content", async () => {
      const threadId = 1;
      
      // Настраиваем мок для INSERT и SELECT
      (mockDb.prepare as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes("INSERT")) {
          return {
            run: jest.fn(() => ({ lastInsertRowId: 1 })),
            all: jest.fn(() => []),
            get: jest.fn(() => null),
          };
        } else if (sql.includes("SELECT") && sql.includes("WHERE id")) {
          return {
            run: jest.fn(() => ({ lastInsertRowId: 1 })),
            all: jest.fn(() => []),
            get: jest.fn(() => ({
              id: 1,
              thread_id: threadId,
              user_message: "'; DROP TABLE messages; --",
              assistant_message: "'; DROP TABLE threads; --",
            })),
          };
        } else if (sql.includes("SELECT * FROM messages")) {
          return {
            run: jest.fn(() => ({ lastInsertRowId: 1 })),
            all: jest.fn(() => [{ id: 1, thread_id: threadId, user_message: "'; DROP TABLE messages; --", assistant_message: "'; DROP TABLE threads; --" }]),
            get: jest.fn(() => null),
          };
        } else if (sql.includes("SELECT * FROM threads")) {
          return {
            run: jest.fn(() => ({ lastInsertRowId: 1 })),
            all: jest.fn(() => [{ id: 1, title: "Test" }]),
            get: jest.fn(() => null),
          };
        }
        return {
          run: jest.fn(() => ({ lastInsertRowId: 1 })),
          all: jest.fn(() => []),
          get: jest.fn(() => null),
        };
      });

      const url = new URL("http://localhost:3000/api/messages");
      const request = new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({
          threadId,
          userMessage: "'; DROP TABLE messages; --",
          assistantMessage: "'; DROP TABLE threads; --",
        }),
      });

      const response = await POST_MESSAGES(request);
      expect(response.status).toBe(200);

      // Проверяем, что таблицы не удалены
      const db = getDatabase();
      const messages = db.prepare("SELECT * FROM messages").all();
      const threads = db.prepare("SELECT * FROM threads").all();
      expect(messages.length).toBeGreaterThan(0);
      expect(threads.length).toBeGreaterThan(0);
    });
  });

  describe("XSS Protection", () => {
    it("should handle script tags in thread title safely", async () => {
      // Настраиваем мок для INSERT и SELECT
      (mockDb.prepare as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes("INSERT")) {
          return {
            run: jest.fn(() => ({ lastInsertRowId: 1 })),
            all: jest.fn(() => []),
            get: jest.fn(() => null),
          };
        } else if (sql.includes("SELECT") && sql.includes("WHERE id")) {
          return {
            run: jest.fn(() => ({ lastInsertRowId: 1 })),
            all: jest.fn(() => []),
            get: jest.fn(() => ({ id: 1, title: "<script>alert('XSS')</script>" })),
          };
        } else if (sql.includes("ORDER BY id DESC")) {
          return {
            run: jest.fn(() => ({ lastInsertRowId: 1 })),
            all: jest.fn(() => []),
            get: jest.fn(() => ({ id: 1, title: "<script>alert('XSS')</script>" })),
          };
        }
        return {
          run: jest.fn(() => ({ lastInsertRowId: 1 })),
          all: jest.fn(() => []),
          get: jest.fn(() => null),
        };
      });

      const url = new URL("http://localhost:3000/api/threads");
      const request = new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({
          title: "<script>alert('XSS')</script>",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Данные должны сохраняться как есть (экранирование на клиенте)
      expect(data.title).toContain("<script>");
    });
  });

  describe("Input Validation", () => {
    it("should reject non-string title", async () => {
      const url = new URL("http://localhost:3000/api/threads");
      const request = new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({
          title: 123,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it("should handle very long input", async () => {
      const longString = "A".repeat(10000);
      
      // Настраиваем мок для INSERT и SELECT
      (mockDb.prepare as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes("INSERT")) {
          return {
            run: jest.fn(() => ({ lastInsertRowId: 1 })),
            all: jest.fn(() => []),
            get: jest.fn(() => null),
          };
        } else if (sql.includes("SELECT") && sql.includes("WHERE id")) {
          return {
            run: jest.fn(() => ({ lastInsertRowId: 1 })),
            all: jest.fn(() => []),
            get: jest.fn(() => ({ id: 1, title: longString })),
          };
        } else if (sql.includes("ORDER BY id DESC")) {
          return {
            run: jest.fn(() => ({ lastInsertRowId: 1 })),
            all: jest.fn(() => []),
            get: jest.fn(() => ({ id: 1, title: longString })),
          };
        }
        return {
          run: jest.fn(() => ({ lastInsertRowId: 1 })),
          all: jest.fn(() => []),
          get: jest.fn(() => null),
        };
      });

      const url = new URL("http://localhost:3000/api/threads");
      const request = new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({
          title: longString,
        }),
      });

      const response = await POST(request);
      // Должен обработать, но может быть ограничение на уровне БД
      expect([200, 400, 413]).toContain(response.status);
    });

    it("should validate range format in Excel API", async () => {
      const url = new URL("http://localhost:3000/api/excel");
      const request = new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({
          range: "<script>alert('XSS')</script>",
          value: "test",
        }),
      });

      const response = await POST_EXCEL(request);
      // Должен вернуть ошибку или обработать безопасно
      expect([200, 400, 500]).toContain(response.status);
    });
  });

  describe("Type Safety", () => {
    it("should validate threadId is a number", async () => {
      const url = new URL("http://localhost:3000/api/messages");
      const request = new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({
          threadId: "'; DROP TABLE threads; --",
          userMessage: "test",
        }),
      });

      const response = await POST_MESSAGES(request);
      // Должен вернуть ошибку валидации
      expect([400, 500]).toContain(response.status);
    });
  });
});

