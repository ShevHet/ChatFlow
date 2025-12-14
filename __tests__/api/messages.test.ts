/**
 * Интеграционные тесты для API /api/messages
 */

import { GET, POST } from "@/app/api/messages/route";
import { NextRequest } from "next/server";

// Мокаем базу данных перед импортом
const mockDb = {
  prepare: jest.fn((sql: string) => ({
    run: jest.fn((...params: any[]) => {
      if (sql.includes("INSERT")) {
        return { lastInsertRowId: 1 };
      }
      return {};
    }),
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

describe("API /api/messages", () => {
  let threadId: number = 1;

  beforeEach(() => {
    // Сбрасываем моки
    jest.clearAllMocks();
    
    // Настраиваем мок для prepare
    (mockDb.prepare as jest.Mock).mockReturnValue({
      run: jest.fn(() => ({ lastInsertRowId: 1 })),
      all: jest.fn(() => []),
      get: jest.fn(() => null),
    });
  });

  describe("GET", () => {
    it("should return empty array when no messages", async () => {
      const url = new URL(`http://localhost:3000/api/messages?threadId=${threadId}`);
      const request = new NextRequest(url);
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it("should return all messages for thread", async () => {
      // Настраиваем мок для возврата сообщений
      (mockDb.prepare as jest.Mock).mockReturnValue({
        run: jest.fn(() => ({ lastInsertRowId: 1 })),
        all: jest.fn(() => [
          { id: 1, thread_id: threadId, user_message: "Hello", assistant_message: "Hi there!" },
          { id: 2, thread_id: threadId, user_message: "How are you?", assistant_message: "I'm fine" },
        ]),
        get: jest.fn(() => null),
      });

      const url = new URL(`http://localhost:3000/api/messages?threadId=${threadId}`);
      const request = new NextRequest(url);
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data[0].user_message).toBe("Hello");
      expect(data[0].assistant_message).toBe("Hi there!");
      expect(data[1].user_message).toBe("How are you?");
      expect(data[1].assistant_message).toBe("I'm fine");
    });

    it("should return only messages for specified thread", async () => {
      // Настраиваем мок для возврата только сообщений первого треда
      (mockDb.prepare as jest.Mock).mockReturnValue({
        run: jest.fn(() => ({ lastInsertRowId: 1 })),
        all: jest.fn(() => [
          { id: 1, thread_id: threadId, user_message: "Message 1", assistant_message: "Response 1" },
        ]),
        get: jest.fn(() => null),
      });

      const url = new URL(`http://localhost:3000/api/messages?threadId=${threadId}`);
      const request = new NextRequest(url);
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].user_message).toBe("Message 1");
    });

    it("should return 400 if threadId is missing", async () => {
      const url = new URL("http://localhost:3000/api/messages");
      const request = new NextRequest(url);
      const response = await GET(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("threadId is required");
    });

    it("should handle null message values", async () => {
      // Настраиваем мок для возврата сообщения с null
      (mockDb.prepare as jest.Mock).mockReturnValue({
        run: jest.fn(() => ({ lastInsertRowId: 1 })),
        all: jest.fn(() => [
          { id: 1, thread_id: threadId, user_message: null, assistant_message: "Response only" },
        ]),
        get: jest.fn(() => null),
      });

      const url = new URL(`http://localhost:3000/api/messages?threadId=${threadId}`);
      const request = new NextRequest(url);
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].user_message).toBeNull();
      expect(data[0].assistant_message).toBe("Response only");
    });
  });

  describe("POST", () => {
    it("should create a new message", async () => {
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
              user_message: "Test message",
              assistant_message: "Test response",
            })),
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
          userMessage: "Test message",
          assistantMessage: "Test response",
        }),
      });

      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.thread_id).toBe(threadId);
      expect(data.user_message).toBe("Test message");
      expect(data.assistant_message).toBe("Test response");
      expect(data.id).toBeDefined();
    });

    it("should return 400 if threadId is missing", async () => {
      const url = new URL("http://localhost:3000/api/messages");
      const request = new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({
          userMessage: "Test",
          assistantMessage: "Response",
        }),
      });

      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("threadId is required");
    });

    it("should allow null values for messages", async () => {
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
              user_message: null,
              assistant_message: "Response only",
            })),
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
          userMessage: null,
          assistantMessage: "Response only",
        }),
      });

      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.user_message).toBeNull();
      expect(data.assistant_message).toBe("Response only");
    });

    it("should create message with only user message", async () => {
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
              user_message: "User only",
              assistant_message: null,
            })),
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
          userMessage: "User only",
          assistantMessage: null,
        }),
      });

      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.user_message).toBe("User only");
      expect(data.assistant_message).toBeNull();
    });
  });
});

