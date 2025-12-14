/**
 * Интеграционные тесты для API /api/ai-chat
 */

import { POST } from "@/app/api/ai-chat/route";
import { NextRequest } from "next/server";

// Мокаем OpenAI и AI SDK
jest.mock("@ai-sdk/openai", () => ({
  openai: jest.fn(() => ({
    chat: {
      model: jest.fn(() => "gpt-4o-mini"),
    },
  })),
}));

// Полифиллы для Jest окружения
if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = class {
    encode(str: string) {
      return Buffer.from(str, 'utf-8');
    }
  } as any;
}

if (typeof ReadableStream === 'undefined') {
  global.ReadableStream = class ReadableStream {
    constructor(underlyingSource?: any) {
      // Простая реализация для тестов
    }
  } as any;
}

jest.mock("ai", () => ({
  streamText: jest.fn(() => ({
    toDataStreamResponse: jest.fn(() => {
      // Возвращаем простой Response без реального стрима для тестов
      return new Response('0:"Test response"\n', {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }),
    toTextStreamResponse: jest.fn(() => {
      return new Response("data: Test response\n\n", {
        headers: { "Content-Type": "text/event-stream" },
      });
    }),
  })),
  tool: jest.fn((config: any) => config),
}));

// Мокаем переменные окружения
process.env.OPENAI_API_KEY = "test-api-key";

describe("API /api/ai-chat", () => {
  describe("POST", () => {
    it("should return stream response for valid request", async () => {
      const url = new URL("http://localhost:3000/api/ai-chat");
      const request = new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: "Hello",
            },
          ],
          threadId: 1,
        }),
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text");
    });

    it("should return 400 if messages is missing", async () => {
      const url = new URL("http://localhost:3000/api/ai-chat");
      const request = new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({
          threadId: 1,
        }),
      });

      const response = await POST(request);
      
      expect(response.status).toBe(400);
    });

    it("should return 400 if messages is not an array", async () => {
      const url = new URL("http://localhost:3000/api/ai-chat");
      const request = new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({
          messages: "not an array",
          threadId: 1,
        }),
      });

      const response = await POST(request);
      
      expect(response.status).toBe(400);
    });

    it("should return 400 if messages array is empty", async () => {
      const url = new URL("http://localhost:3000/api/ai-chat");
      const request = new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({
          messages: [],
          threadId: 1,
        }),
      });

      const response = await POST(request);
      
      expect(response.status).toBe(400);
    });

    it("should return 400 if last message is not from user", async () => {
      const url = new URL("http://localhost:3000/api/ai-chat");
      const request = new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({
          messages: [
            {
              role: "assistant",
              content: "Response",
            },
          ],
          threadId: 1,
        }),
      });

      const response = await POST(request);
      
      expect(response.status).toBe(400);
    });

    it("should accept valid messages array", async () => {
      const url = new URL("http://localhost:3000/api/ai-chat");
      const request = new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: "Hello",
            },
            {
              role: "assistant",
              content: "Hi there!",
            },
            {
              role: "user",
              content: "How are you?",
            },
          ],
          threadId: 1,
        }),
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
    });

    it("should handle system messages", async () => {
      const url = new URL("http://localhost:3000/api/ai-chat");
      const request = new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant",
            },
            {
              role: "user",
              content: "Hello",
            },
          ],
          threadId: 1,
        }),
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
    });
  });
});

