/**
 * Интеграционные тесты для API /api/chat
 */

import { GET, POST } from "@/app/api/chat/route";
import { NextRequest } from "next/server";

// Мокаем базу данных
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

describe("API /api/chat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Настраиваем мок для prepare
    (mockDb.prepare as jest.Mock).mockReturnValue({
      run: jest.fn(() => ({ lastInsertRowId: 1 })),
      all: jest.fn(() => []),
      get: jest.fn(() => null),
    });
  });

  describe("GET", () => {
    it("should return all threads", async () => {
      // Настраиваем мок для возврата данных
      (mockDb.prepare as jest.Mock).mockReturnValue({
        run: jest.fn(() => ({ lastInsertRowId: 1 })),
        all: jest.fn(() => [
          { id: 1, title: "Thread 1" },
        ]),
        get: jest.fn(() => null),
      });

      const url = new URL("http://localhost:3000/api/chat");
      const request = new NextRequest(url);
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].title).toBe("Thread 1");
    });
  });

  describe("POST", () => {
    it("should save message to database", async () => {
      const threadId = 1;

      const url = new URL("http://localhost:3000/api/chat");
      const request = new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({
          threadId,
          userMessage: "Hello",
          assistantMessage: "Hi there!",
        }),
      });

      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.message).toBe("Message saved");
    });

    it("should return 400 if threadId is missing", async () => {
      const url = new URL("http://localhost:3000/api/chat");
      const request = new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({
          userMessage: "Hello",
          assistantMessage: "Hi there!",
        }),
      });

      const response = await POST(request);
      
      expect(response.status).toBe(400);
    });

    it("should allow null values for messages", async () => {
      const threadId = 1;

      const url = new URL("http://localhost:3000/api/chat");
      const request = new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({
          threadId,
          userMessage: null,
          assistantMessage: "Response",
        }),
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
    });
  });
});

