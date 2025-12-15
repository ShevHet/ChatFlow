"use client";

import { useChat } from "ai/react";
import { useEffect, useRef, useCallback } from "react";
import { Message } from "@/lib/db";

interface ChatInterfaceProps {
  threadId: number;
}

export default function ChatInterface({ threadId }: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages, error } = useChat({
    api: "/api/chat",
    body: {
      threadId,
    },
    onFinish: async (message) => {
      try {
        const response = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId,
            sender: "assistant",
            message: message.content,
          }),
        });
        if (!response.ok) {
          throw new Error(`Failed to save message: ${response.statusText}`);
        }
      } catch (error) {
        console.error("Failed to save assistant message:", error);
      }
    },
    onError: (error) => {
      console.error("Chat error:", error);
    },
  });

  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const loadMessages = async () => {
    try {
      const response = await fetch(`/api/messages?threadId=${threadId}`);
      if (!response.ok) {
        throw new Error(`Failed to load messages: ${response.statusText}`);
      }
      const dbMessages: Message[] = await response.json();
      const formattedMessages = dbMessages.map((msg) => ({
        id: msg.id.toString(),
        role: (msg.sender === "user" ? "user" : "assistant") as "user" | "assistant",
        content: msg.message,
      }));
      setMessages(formattedMessages);
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          sender: "user",
          message: userMessage,
        }),
      });
      if (!response.ok) {
        throw new Error(`Failed to save message: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Failed to save user message:", error);
      return;
    }

    handleSubmit(e);
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.currentTarget.blur();
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-white" role="main" aria-label="Чат интерфейс">
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Сообщения чата"
        tabIndex={0}
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
            role="article"
            aria-label={message.role === "user" ? "Ваше сообщение" : "Сообщение ассистента"}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-800"
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start" role="status" aria-live="polite" aria-label="Загрузка ответа">
            <div className="bg-gray-200 text-gray-800 rounded-lg px-4 py-2">
              <div className="flex space-x-1" aria-hidden="true">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
              </div>
              <span className="sr-only">Ожидание ответа от ассистента</span>
            </div>
          </div>
        )}
        {error && (
          <div
            className="flex justify-start"
            role="alert"
            aria-live="assertive"
            aria-label="Ошибка"
          >
            <div className="bg-red-100 border border-red-400 text-red-700 rounded-lg px-4 py-2">
              Произошла ошибка при отправке сообщения. Пожалуйста, попробуйте еще раз.
            </div>
          </div>
        )}
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>
      <form
        onSubmit={onSubmit}
        className="border-t border-gray-200 p-4"
        role="form"
        aria-label="Форма отправки сообщения"
      >
        <div className="flex space-x-2">
          <label htmlFor="message-input" className="sr-only">
            Введите сообщение
          </label>
          <input
            id="message-input"
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Введите сообщение..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
            aria-label="Поле ввода сообщения"
            aria-describedby="message-input-hint"
            aria-invalid={error ? "true" : "false"}
            aria-required="true"
            autoComplete="off"
          />
          <span id="message-input-hint" className="sr-only">
            Введите текст сообщения и нажмите Enter или кнопку Отправить
          </span>
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Отправить сообщение"
            aria-disabled={isLoading || !input.trim()}
          >
            Отправить
          </button>
        </div>
      </form>
    </div>
  );
}

