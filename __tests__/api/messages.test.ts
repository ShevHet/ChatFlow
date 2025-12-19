import { GET, POST } from "@/app/api/messages/route";
import { getDatabase } from "@/lib/db";

jest.mock("@/lib/db", () => {
  const { Database } = require("bun:sqlite");
  const db = new Database(":memory:");
  db.exec(`
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
  `);
  
  return {
    getDatabase: () => db,
  };
});

describe("API /api/messages", () => {
  let threadId: number;

  beforeEach(() => {
    const db = getDatabase();
    db.exec("DELETE FROM messages");
    db.exec("DELETE FROM threads");
    
    const stmt = db.prepare("INSERT INTO threads (title) VALUES (?)");
    const result = stmt.run("Test Thread");
    threadId = Number(result.lastInsertRowid);
  });

  describe("GET", () => {
    it("should return 400 when threadId is missing", async () => {
      const { NextRequest } = require("next/server");
      const request = new NextRequest(new URL("http://localhost:3000/api/messages"));
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain("threadId");
    });

    it("should return 400 when threadId is invalid", async () => {
      const { NextRequest } = require("next/server");
      const request = new NextRequest(new URL("http://localhost:3000/api/messages?threadId=invalid"));
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain("positive integer");
    });

    it("should return empty array when no messages", async () => {
      const { NextRequest } = require("next/server");
      const request = new NextRequest(new URL(`http://localhost:3000/api/messages?threadId=${threadId}`));
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it("should return messages for a thread", async () => {
      const db = getDatabase();
      const stmt = db.prepare(
        "INSERT INTO messages (threadId, sender, message) VALUES (?, ?, ?)"
      );
      stmt.run(threadId, "user", "Hello");
      stmt.run(threadId, "assistant", "Hi there");

      const { NextRequest } = require("next/server");
      const request = new NextRequest(new URL(`http://localhost:3000/api/messages?threadId=${threadId}`));
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data[0].message).toBe("Hello");
      expect(data[1].message).toBe("Hi there");
    });
  });

  describe("POST", () => {
    it("should return 400 when required fields are missing", async () => {
      const { NextRequest } = require("next/server");
      const request = new NextRequest(new URL("http://localhost:3000/api/messages"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain("threadId");
    });

    it("should return 400 when sender is invalid", async () => {
      const { NextRequest } = require("next/server");
      const request = new NextRequest(new URL("http://localhost:3000/api/messages"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          sender: "invalid",
          message: "Test",
        }),
      });

      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain("sender");
    });

    it("should return 404 when thread does not exist", async () => {
      const { NextRequest } = require("next/server");
      const request = new NextRequest(new URL("http://localhost:3000/api/messages"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: 99999,
          sender: "user",
          message: "Test",
        }),
      });

      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data.error).toContain("does not exist");
    });

    it("should create a new message", async () => {
      const { NextRequest } = require("next/server");
      const request = new NextRequest(new URL("http://localhost:3000/api/messages"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          sender: "user",
          message: "Test message",
        }),
      });

      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.message).toBe("Test message");
      expect(data.sender).toBe("user");
      expect(data.threadId).toBe(threadId);
    });

    it("should return 400 when message is empty", async () => {
      const { NextRequest } = require("next/server");
      const request = new NextRequest(new URL("http://localhost:3000/api/messages"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          sender: "user",
          message: "   ",
        }),
      });

      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain("message");
    });

    it("should handle invalid JSON gracefully", async () => {
      const { NextRequest } = require("next/server");
      const request = new NextRequest(new URL("http://localhost:3000/api/messages"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json",
      });

      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });
});
