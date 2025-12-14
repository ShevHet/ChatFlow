/**
 * Юнит-тесты для компонента ChatInterface
 */

import { render, screen, waitFor } from "@testing-library/react";
import ChatInterface from "@/components/ChatInterface";

// Мокаем scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

// Мокаем useChat хук
const mockSetMessages = jest.fn();
const mockAppend = jest.fn();
const mockHandleInputChange = jest.fn();
const mockHandleSubmit = jest.fn();

jest.mock("ai/react", () => ({
  useChat: jest.fn(() => ({
    messages: [],
    input: "",
    handleInputChange: mockHandleInputChange,
    handleSubmit: mockHandleSubmit,
    isLoading: false,
    setMessages: mockSetMessages,
    append: mockAppend,
  })),
}));

// Мокаем fetch
global.fetch = jest.fn();

describe("ChatInterface", () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
    mockSetMessages.mockClear();
    mockAppend.mockClear();
    mockHandleInputChange.mockClear();
    mockHandleSubmit.mockClear();
  });

  it("should render chat interface", () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<ChatInterface threadId={1} />);

    expect(screen.getByPlaceholderText(/введите сообщение/i)).toBeInTheDocument();
  });

  it("should load messages when threadId changes", async () => {
    const mockMessages = [
      {
        id: 1,
        thread_id: 1,
        user_message: "Hello",
        assistant_message: "Hi there!",
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockMessages,
    });

    const { rerender } = render(<ChatInterface threadId={1} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/messages?threadId=1")
      );
    });

    (global.fetch as jest.Mock).mockClear();

    rerender(<ChatInterface threadId={2} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/messages?threadId=2")
      );
    });
  });

  it("should display input field", () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<ChatInterface threadId={1} />);

    const input = screen.getByPlaceholderText(/введите сообщение/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "text");
  });

  it("should display send button", () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<ChatInterface threadId={1} />);

    const sendButton = screen.getByRole("button", { name: /отправить/i });
    expect(sendButton).toBeInTheDocument();
  });
});

