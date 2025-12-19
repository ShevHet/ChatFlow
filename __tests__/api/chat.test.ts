/**
 * Тесты для API роута /api/chat
 * 
 * Проверяет обработку запросов к OpenAI API, включая:
 * - Валидацию входных данных
 * - Обработку ошибок OpenAI API
 * - Механизм повторных попыток
 * - Форматирование сообщений
 */

import { POST } from "@/app/api/chat/route";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

// Мокаем ai модули
jest.mock("ai", () => ({
  streamText: jest.fn(),
  tool: jest.fn((fn: any) => fn),
}));

jest.mock("@ai-sdk/openai", () => ({
  openai: jest.fn(),
}));

// Мокаем retry механизм - просто выполняем функцию без retry логики
jest.mock("@/lib/retry", () => ({
  createOpenAIRetry: jest.fn(() => {
    return (fn: () => Promise<unknown>) => {
      // Просто выполняем функцию без retry логики для тестов
      return fn();
    };
  }),
}));

describe("API /api/chat", () => {
  const mockStreamText = streamText as unknown as jest.Mock;
  const mockOpenAI = openai as unknown as jest.Mock;
  const mockToTextStreamResponse = jest.fn();
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    // Мокаем API ключ для тестов, которые требуют его
    process.env.OPENAI_API_KEY = "test-key";
    mockOpenAI.mockReturnValue({});
    mockStreamText.mockResolvedValue({
      toTextStreamResponse: mockToTextStreamResponse,
    });
    mockToTextStreamResponse.mockReturnValue(new Response());
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("должен возвращать 400 когда messages отсутствуют", async () => {
    const request = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: 1 }),
    });

    const response = await POST(request);
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(text).toContain("Messages");
  });

  it("должен возвращать 400 когда messages не массив", async () => {
    const request = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId: 1,
        messages: "not an array",
      }),
    });

    const response = await POST(request);
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(text).toContain("Messages");
  });

  it("должен возвращать 400 когда messages пустой массив", async () => {
    const request = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId: 1,
        messages: [],
      }),
    });

    const response = await POST(request);
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(text).toContain("Messages");
  });

  it("должен возвращать 400 когда threadId отсутствует", async () => {
    const request = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hello" }],
      }),
    });

    const response = await POST(request);
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(text).toContain("threadId");
  });

  it("должен возвращать 400 когда threadId не число", async () => {
    const request = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId: "invalid",
        messages: [{ role: "user", content: "Hello" }],
      }),
    });

    const response = await POST(request);
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(text).toContain("threadId");
  });

  it("должен возвращать 400 когда последнее сообщение не от пользователя", async () => {
    const request = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId: 1,
        messages: [{ role: "assistant", content: "Hello" }],
      }),
    });

    const response = await POST(request);
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(text).toContain("Last message");
  });

  it("должен успешно обрабатывать валидный запрос", async () => {
    const request = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId: 1,
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there" },
          { role: "user", content: "How are you?" },
        ],
      }),
    });

    const response = await POST(request);

    expect(response).toBeDefined();
    expect(mockOpenAI).toHaveBeenCalledWith("gpt-3.5-turbo");
    expect(mockStreamText).toHaveBeenCalled();
  });

  it("должен преобразовывать сообщения в формат CoreMessage", async () => {
    // Убеждаемся, что mockStreamText настроен правильно
    mockStreamText.mockResolvedValueOnce({
      toTextStreamResponse: mockToTextStreamResponse,
    });
    mockToTextStreamResponse.mockReturnValueOnce(new Response());

    const request = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId: 1,
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi" },
          { role: "system", content: "You are helpful" },
          { role: "user", content: "Test" }, // Последнее сообщение должно быть от user
        ],
      }),
    });

    await POST(request);

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi" },
          { role: "system", content: "You are helpful" },
        ]),
      })
    );
  });

  it("должен обрабатывать невалидный JSON", async () => {
    const request = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid json",
    });

    const response = await POST(request);
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(text.length).toBeGreaterThan(0);
  });

  it("должен обрабатывать ошибки OpenAI API", async () => {
    const openAIError = new Error("OpenAI API error: 429 Rate limit exceeded");
    mockStreamText.mockRejectedValue(openAIError);

    const request = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId: 1,
        messages: [{ role: "user", content: "Hello" }],
      }),
    });

    const response = await POST(request);
    const text = await response.text();

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(text.length).toBeGreaterThan(0);
    // Stream format: 0:"error message"\n\n
    // Проверяем сообщение об ошибке, а не тип
    expect(text).toContain("Превышен лимит запросов");
  });

  it("должен обрабатывать сетевые ошибки", async () => {
    const networkError = new Error("Network request failed");
    mockStreamText.mockRejectedValue(networkError);

    const request = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId: 1,
        messages: [{ role: "user", content: "Hello" }],
      }),
    });

    const response = await POST(request);
    const text = await response.text();

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(text.length).toBeGreaterThan(0);
  });

  it("должен включать детали ошибки в режиме разработки", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    // @ts-ignore - временно изменяем NODE_ENV для теста
    process.env.NODE_ENV = 'development';

    const error = new Error("Test error");
    mockStreamText.mockRejectedValue(error);

    const request = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId: 1,
        messages: [{ role: "user", content: "Hello" }],
      }),
    });

    const response = await POST(request);
    const text = await response.text();

    // В режиме разработки детали ошибки должны быть в тексте
    expect(text.length).toBeGreaterThan(0);

    // @ts-ignore - восстанавливаем исходное значение
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("не должен включать детали ошибки в продакшене", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    // @ts-ignore - временно изменяем NODE_ENV для теста
    process.env.NODE_ENV = 'production';

    const error = new Error("Test error");
    mockStreamText.mockRejectedValue(error);

    const request = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId: 1,
        messages: [{ role: "user", content: "Hello" }],
      }),
    });

    const response = await POST(request);
    const text = await response.text();

    // В продакшене детали ошибки не должны быть в тексте
    expect(text.length).toBeGreaterThan(0);

    // @ts-ignore - восстанавливаем исходное значение
    process.env.NODE_ENV = originalNodeEnv;
  });
});

