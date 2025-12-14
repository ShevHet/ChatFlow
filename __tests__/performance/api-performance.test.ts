/**
 * Тесты производительности API
 */

import { GET, POST } from "@/app/api/threads/route";
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

describe("API Performance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Настраиваем мок для prepare
    (mockDb.prepare as jest.Mock).mockReturnValue({
      run: jest.fn(() => ({ lastInsertRowId: 1 })),
      all: jest.fn(() => []),
      get: jest.fn(() => null),
    });
  });

  describe("GET /api/threads", () => {
    it("should respond within acceptable time for empty list", async () => {
      const startTime = Date.now();
      const response = await GET();
      await response.json();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Меньше 1 секунды
    });

    it("should respond within acceptable time for multiple threads", async () => {
      // Настраиваем мок для возврата 100 тредов
      const mockThreads = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        title: `Thread ${i}`,
      }));
      
      (mockDb.prepare as jest.Mock).mockReturnValue({
        run: jest.fn(() => ({ lastInsertRowId: 1 })),
        all: jest.fn(() => mockThreads),
        get: jest.fn(() => null),
      });

      const startTime = Date.now();
      const response = await GET();
      const data = await response.json();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);
      expect(data).toHaveLength(100);
    });
  });

  describe("POST /api/threads", () => {
    it("should create thread within acceptable time", async () => {
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
            get: jest.fn(() => ({ id: 1, title: "Performance Test" })),
          };
        } else if (sql.includes("ORDER BY id DESC")) {
          return {
            run: jest.fn(() => ({ lastInsertRowId: 1 })),
            all: jest.fn(() => []),
            get: jest.fn(() => ({ id: 1, title: "Performance Test" })),
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
        body: JSON.stringify({ title: "Performance Test" }),
      });

      const startTime = Date.now();
      const response = await POST(request);
      await response.json();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500); // Меньше 500мс
    });
  });
});

