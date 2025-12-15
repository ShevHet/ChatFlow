/**
 * Тесты для компонента ChatInterface
 * 
 * Проверяет функциональность чата, включая:
 * - Отображение сообщений
 * - Отправку сообщений
 * - Загрузку истории
 * - Обработку ошибок
 * - Доступность (ARIA, клавиатурная навигация)
 */

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatInterface from "@/components/ChatInterface";
import { useChat } from "ai/react";

// Мокаем ai/react
jest.mock("ai/react", () => ({
  useChat: jest.fn(),
}));

// Мокаем fetch для API вызовов
global.fetch = jest.fn();

describe("ChatInterface", () => {
  const mockSetMessages = jest.fn();
  const mockHandleSubmit = jest.fn();
  const mockHandleInputChange = jest.fn();

  const defaultUseChatReturn = {
    messages: [],
    input: "",
    handleInputChange: mockHandleInputChange,
    handleSubmit: mockHandleSubmit,
    isLoading: false,
    setMessages: mockSetMessages,
    error: undefined,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    (useChat as jest.Mock).mockReturnValue(defaultUseChatReturn);
    
    // Мокаем fetch для загрузки сообщений (должен возвращать массив)
    (global.fetch as jest.Mock).mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes("/api/messages") && url.includes("threadId") && !options?.method) {
        // GET запрос для загрузки сообщений - возвращаем массив
        return Promise.resolve({
          ok: true,
          json: async () => [],
        });
      }
      // POST запросы и другие
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });
  });

  it("должен отображать пустой список сообщений", () => {
    render(<ChatInterface threadId={1} />);

    const messagesContainer = screen.getByRole("log", { name: /сообщения чата/i });
    expect(messagesContainer).toBeInTheDocument();
  });

  it("должен отображать сообщения пользователя", () => {
    (useChat as jest.Mock).mockReturnValue({
      ...defaultUseChatReturn,
      messages: [
        {
          id: "1",
          role: "user" as const,
          content: "Привет!",
        },
      ],
    });

    render(<ChatInterface threadId={1} />);

    expect(screen.getByText("Привет!")).toBeInTheDocument();
    const userMessage = screen.getByText("Привет!").closest('[role="article"]');
    expect(userMessage).toHaveAttribute("aria-label", "Ваше сообщение");
  });

  it("должен отображать сообщения ассистента", () => {
    (useChat as jest.Mock).mockReturnValue({
      ...defaultUseChatReturn,
      messages: [
        {
          id: "2",
          role: "assistant" as const,
          content: "Здравствуйте!",
        },
      ],
    });

    render(<ChatInterface threadId={1} />);

    expect(screen.getByText("Здравствуйте!")).toBeInTheDocument();
    const assistantMessage = screen.getByText("Здравствуйте!").closest('[role="article"]');
    expect(assistantMessage).toHaveAttribute("aria-label", "Сообщение ассистента");
  });

  it("должен отображать индикатор загрузки", () => {
    (useChat as jest.Mock).mockReturnValue({
      ...defaultUseChatReturn,
      isLoading: true,
    });

    render(<ChatInterface threadId={1} />);

    const loadingIndicator = screen.getByRole("status", { name: /загрузка ответа/i });
    expect(loadingIndicator).toBeInTheDocument();
    expect(screen.getByText(/ожидание ответа от ассистента/i)).toBeInTheDocument();
  });

  it("должен отображать ошибку при ошибке загрузки", () => {
    (useChat as jest.Mock).mockReturnValue({
      ...defaultUseChatReturn,
      error: new Error("Network error"),
    });

    render(<ChatInterface threadId={1} />);

    const errorAlert = screen.getByRole("alert", { name: /ошибка/i });
    expect(errorAlert).toBeInTheDocument();
    expect(screen.getByText(/произошла ошибка при отправке сообщения/i)).toBeInTheDocument();
  });

  it("должен загружать сообщения при изменении threadId", async () => {
    const { rerender } = render(<ChatInterface threadId={1} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/messages?threadId=1")
      );
    });

    rerender(<ChatInterface threadId={2} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/messages?threadId=2")
      );
    });
  });

  it("должен отправлять сообщение при отправке формы", async () => {
    const user = userEvent.setup();
    (useChat as jest.Mock).mockReturnValue({
      ...defaultUseChatReturn,
      input: "Тестовое сообщение",
    });

    // Мокаем fetch для POST запроса
    (global.fetch as jest.Mock).mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      }
      // GET запрос для загрузки сообщений
      return Promise.resolve({
        ok: true,
        json: async () => [],
      });
    });

    render(<ChatInterface threadId={1} />);

    const input = screen.getByLabelText(/поле ввода сообщения/i);
    const submitButton = screen.getByRole("button", { name: /отправить/i });

    await user.type(input, "Тестовое сообщение");
    await user.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/messages",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId: 1,
            sender: "user",
            message: "Тестовое сообщение",
          }),
        })
      );
    });

    expect(mockHandleSubmit).toHaveBeenCalled();
  });

  it("не должен отправлять пустое сообщение", async () => {
    const user = userEvent.setup();
    (useChat as jest.Mock).mockReturnValue({
      ...defaultUseChatReturn,
      input: "   ",
    });

    render(<ChatInterface threadId={1} />);

    const submitButton = screen.getByRole("button", { name: /отправить/i });
    expect(submitButton).toBeDisabled();
  });

  it("должен блокировать отправку во время загрузки", () => {
    (useChat as jest.Mock).mockReturnValue({
      ...defaultUseChatReturn,
      isLoading: true,
      input: "Сообщение",
    });

    render(<ChatInterface threadId={1} />);

    const input = screen.getByLabelText(/поле ввода сообщения/i);
    const submitButton = screen.getByRole("button", { name: /отправить/i });

    expect(input).toBeDisabled();
    expect(submitButton).toBeDisabled();
  });

  it("должен обрабатывать клавишу Escape", async () => {
    const user = userEvent.setup();
    (useChat as jest.Mock).mockReturnValue({
      ...defaultUseChatReturn,
      input: "Текст",
    });

    render(<ChatInterface threadId={1} />);

    const input = screen.getByLabelText(/поле ввода сообщения/i);
    input.focus();

    await user.keyboard("{Escape}");

    expect(document.activeElement).not.toBe(input);
  });

  it("должен иметь правильные ARIA атрибуты", () => {
    render(<ChatInterface threadId={1} />);

    const main = screen.getByRole("main", { name: /чат интерфейс/i });
    expect(main).toBeInTheDocument();

    const messagesLog = screen.getByRole("log", { name: /сообщения чата/i });
    expect(messagesLog).toHaveAttribute("aria-live", "polite");
    expect(messagesLog).toHaveAttribute("aria-atomic", "false");

    const form = screen.getByRole("form", { name: /форма отправки сообщения/i });
    expect(form).toBeInTheDocument();

    const input = screen.getByLabelText(/поле ввода сообщения/i);
    expect(input).toHaveAttribute("aria-required", "true");
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("должен форматировать и отображать сообщения с переносами строк", () => {
    (useChat as jest.Mock).mockReturnValue({
      ...defaultUseChatReturn,
      messages: [
        {
          id: "1",
          role: "user" as const,
          content: "Строка 1\nСтрока 2\nСтрока 3",
        },
      ],
    });

    render(<ChatInterface threadId={1} />);

    // Используем getAllByText и берем первый элемент с классом whitespace-pre-wrap
    const messageContainers = screen.getAllByText((content, element) => {
      return element?.textContent?.includes("Строка 1") ?? false;
    });
    const messageContainer = messageContainers.find(el => el.classList.contains("whitespace-pre-wrap"));
    expect(messageContainer).toBeDefined();
    expect(messageContainer).toHaveClass("whitespace-pre-wrap");
  });

  it("должен обрабатывать ошибку при загрузке сообщений", async () => {
    // Мокаем fetch для возврата ошибки
    (global.fetch as jest.Mock).mockImplementation(() => {
      return Promise.reject(new Error("Network error"));
    });

    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    render(<ChatInterface threadId={1} />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to load messages:",
        expect.any(Error)
      );
    }, { timeout: 3000 });

    consoleSpy.mockRestore();
  });

  it("должен обрабатывать ошибку при сохранении сообщения", async () => {
    const user = userEvent.setup();
    (useChat as jest.Mock).mockReturnValue({
      ...defaultUseChatReturn,
      input: "Сообщение",
    });

    // Мокаем fetch: первый вызов (GET) успешен, второй (POST) с ошибкой
    let callCount = 0;
    (global.fetch as jest.Mock).mockImplementation((url: string, options?: RequestInit) => {
      callCount++;
      if (options?.method === "POST") {
        return Promise.resolve({
          ok: false,
          statusText: "Internal Server Error",
        });
      }
      // GET запрос для загрузки сообщений
      return Promise.resolve({
        ok: true,
        json: async () => [],
      });
    });

    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    render(<ChatInterface threadId={1} />);

    const submitButton = screen.getByRole("button", { name: /отправить/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    }, { timeout: 3000 });

    consoleSpy.mockRestore();
  });
});

