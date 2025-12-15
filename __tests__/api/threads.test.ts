import { GET, POST } from "@/app/api/threads/route";
import { getDatabase } from "@/lib/db";

jest.mock("@/lib/db", () => {
  const Database = require("better-sqlite3");
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE IF NOT EXISTS threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);
  
  return {
    getDatabase: () => db,
  };
});

describe("API /api/threads", () => {
  beforeEach(() => {
    const db = getDatabase();
    db.exec("DELETE FROM threads");
  });

  describe("GET", () => {
    it("should return empty array when no threads", async () => {
      const response = await GET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it("should return all threads", async () => {
      const db = getDatabase();
      const stmt = db.prepare("INSERT INTO threads (title, createdAt) VALUES (?, ?)");
      const now = Math.floor(Date.now() / 1000);
      stmt.run("Thread 1", now - 100);
      stmt.run("Thread 2", now);

      const response = await GET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data[0].title).toBe("Thread 2");
      expect(data[1].title).toBe("Thread 1");
    });
  });

  describe("POST", () => {
    it("should create a new thread", async () => {
      const { NextRequest } = require("next/server");
      const request = new NextRequest(new URL("http://localhost:3000/api/threads"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Thread" }),
      });

      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.title).toBe("New Thread");
      expect(data.id).toBeGreaterThan(0);
    });

    it("should handle invalid request - missing title", async () => {
      const { NextRequest } = require("next/server");
      const request = new NextRequest(new URL("http://localhost:3000/api/threads"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain("Title is required");
    });

    it("should handle invalid request - empty title", async () => {
      const { NextRequest } = require("next/server");
      const request = new NextRequest(new URL("http://localhost:3000/api/threads"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "" }),
      });

      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain("Title is required");
    });

    it("should handle invalid request - whitespace-only title", async () => {
      const { NextRequest } = require("next/server");
      const request = new NextRequest(new URL("http://localhost:3000/api/threads"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "   " }),
      });

      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain("Title is required");
    });
  });
});
