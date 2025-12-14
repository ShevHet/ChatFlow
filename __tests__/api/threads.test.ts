/**
 * Интеграционные тесты для API /api/threads
 */

import { GET, POST } from "@/app/api/threads/route";
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

describe("API /api/threads", () => {
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
    it("should return empty array when no threads", async () => {
      const response = await GET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    it("should return all threads", async () => {
      // Настраиваем мок для возврата данных
      (mockDb.prepare as jest.Mock).mockReturnValue({
        run: jest.fn(() => ({ lastInsertRowId: 1 })),
        all: jest.fn(() => [
          { id: 1, title: "Thread 1" },
          { id: 2, title: "Thread 2" },
        ]),
        get: jest.fn(() => ({ id: 1, title: "New Thread" })),
      });

      const response = await GET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe("POST", () => {
    it("should create a new thread", async () => {
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
            get: jest.fn(() => ({ id: 1, title: "New Thread" })),
          };
        } else if (sql.includes("ORDER BY id DESC")) {
          return {
            run: jest.fn(() => ({ lastInsertRowId: 1 })),
            all: jest.fn(() => []),
            get: jest.fn(() => ({ id: 1, title: "New Thread" })),
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
        body: JSON.stringify({ title: "New Thread" }),
      });

      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.title).toBe("New Thread");
      expect(data.id).toBeDefined();
    });

    it("should return 400 if title is missing", async () => {
      const url = new URL("http://localhost:3000/api/threads");
      const request = new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      
      expect(response.status).toBe(400);
    });

    it("should return 400 if title is empty", async () => {
      const url = new URL("http://localhost:3000/api/threads");
      const request = new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({ title: "   " }),
      });

      const response = await POST(request);
      
      expect(response.status).toBe(400);
    });

    it("should trim title whitespace", async () => {
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
            get: jest.fn(() => ({ id: 1, title: "Trimmed Thread" })),
          };
        } else if (sql.includes("ORDER BY id DESC")) {
          return {
            run: jest.fn(() => ({ lastInsertRowId: 1 })),
            all: jest.fn(() => []),
            get: jest.fn(() => ({ id: 1, title: "Trimmed Thread" })),
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
        body: JSON.stringify({ title: "  Trimmed Thread  " }),
      });

      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.title).toBe("Trimmed Thread");
    });
  });
});

