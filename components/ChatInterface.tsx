"use client";

import { useChat } from "ai/react";
import { useEffect, useRef, useState } from "react";
import { Message } from "@/lib/db";
import ConfirmationDialog from "./ConfirmationDialog";
import ExcelViewer from "./ExcelViewer";
import { extractRangeMentions, parseRange } from "@/lib/excel-utils";
import {
  PendingAction,
  PendingActionType,
  ConfirmationDialogState,
  ExcelViewerState,
  ExcelData,
  GetRangeParams,
  UpdateCellParams,
  ConfirmActionParams,
} from "@/lib/types";

interface ChatInterfaceProps {
  threadId: number;
}

export default function ChatInterface({ threadId }: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [confirmationDialog, setConfirmationDialog] = useState<ConfirmationDialogState>({
    isOpen: false,
    question: "",
    actionId: null,
  });
  const [excelViewer, setExcelViewer] = useState<ExcelViewerState>({
    isOpen: false,
    range: "Sheet1!A1:D5",
  });
  const [pendingActions, setPendingActions] = useState<Map<string, PendingAction>>(
    new Map()
  );
  const [excelData, setExcelData] = useState<Map<string, ExcelData>>(new Map());

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages, append, error } = useChat({
    api: "/api/ai-chat",
    body: {
      threadId,
    },
    onError: (error) => {
      console.error("Chat error:", error);
      let errorMessage = "Извините, произошла ошибка при обработке запроса.";
      
      if (error?.message) {
        const msg = error.message.toLowerCase();
        if (msg.includes("country") || msg.includes("region") || msg.includes("territory")) {
          errorMessage = "Ваш регион не поддерживается OpenAI API. Пожалуйста, используйте VPN или обратитесь в поддержку OpenAI.";
        } else if (msg.includes("api key") || msg.includes("authentication")) {
          errorMessage = "Проблема с API ключом OpenAI. Проверьте правильность ключа в .env.local";
        } else if (msg.includes("rate limit") || msg.includes("quota") || msg.includes("429")) {
          errorMessage = "⏱️ Превышен лимит запросов к OpenAI API.\n\n" +
            "💡 Если вы используете БЕСПЛАТНЫЙ аккаунт:\n" +
            "• Бесплатные аккаунты имеют очень низкие лимиты (обычно $5 кредитов)\n" +
            "• Подождите 1-2 часа для сброса лимита\n" +
            "• Или перейдите на платный план Pay-as-you-go\n\n" +
            "📋 Что делать:\n" +
            "• Подождите 1-2 часа (для бесплатных) или 1-2 минуты (для платных)\n" +
            "• Не отправляйте много запросов подряд\n" +
            "• Проверьте ваш план: https://platform.openai.com/account/billing\n" +
            "• Для платных аккаунтов: добавьте способ оплаты для увеличения лимитов";
        } else if (msg.includes("at least one user message")) {
          console.warn("Validation error, likely due to empty messages array");
          return;
        } else if (msg.includes("failed to parse stream") || msg.includes("no separator found")) {
          errorMessage = "Ошибка при обработке ответа от AI.\n\n" +
            "Возможные причины:\n" +
            "• Проблема с подключением к OpenAI API\n" +
            "• Несовместимость версий библиотек\n" +
            "• Временная проблема с сервером OpenAI\n\n" +
            "Попробуйте:\n" +
            "• Обновить страницу (F5)\n" +
            "• Подождать несколько секунд и попробовать снова\n" +
            "• Проверить, что API ключ правильный";
        } else {
          errorMessage = `Ошибка: ${error.message}`;
        }
      }
      
      if (messages.length > 0) {
        setMessages([...messages, {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: errorMessage,
        }]);
      }
    },
    onFinish: async (message) => {
      const userMessages = messages.filter(m => m.role === "user");
      const lastUserMessage = userMessages[userMessages.length - 1];
      
      if (lastUserMessage) {
        try {
          await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              threadId,
              userMessage: lastUserMessage.content,
              assistantMessage: message.content,
            }),
          });
        } catch (error) {
          console.error("Failed to save assistant message:", error);
        }
      }
    },
    onToolCall: async ({ toolCall }) => {
      if (toolCall.toolName === "confirmAction") {
        const args = toolCall.args as ConfirmActionParams;
        setConfirmationDialog({
          isOpen: true,
          question: args.question,
          actionId: args.actionId,
        });
        return { result: "waiting_for_confirmation" };
      }

      if (toolCall.toolName === "getRange") {
        const args = toolCall.args as GetRangeParams;
        try {
          const response = await fetch(`/api/excel?range=${encodeURIComponent(args.range)}`);
          if (response.ok) {
            const data: ExcelData = await response.json();
            setExcelData((prev) => {
              const newMap = new Map(prev);
              newMap.set(args.range, data);
              return newMap;
            });
            // Форматируем данные для отображения в чате
            const tableMarkdown = formatExcelDataAsMarkdown(data);
            return {
              result: `Диапазон ${args.range} успешно прочитан:\n\n${tableMarkdown}`,
            };
          } else {
            return { result: "Ошибка при чтении диапазона" };
          }
        } catch (error) {
          console.error("Error reading range:", error);
          return { result: "Ошибка при чтении диапазона" };
        }
      }

      if (toolCall.toolName === "updateCell") {
        const args = toolCall.args as UpdateCellParams;
        
        const actionId = `update_${args.range}_${Date.now()}`;
        setPendingActions((prev) => {
          const newMap = new Map(prev);
          newMap.set(actionId, {
            actionId,
            type: "updateCell",
            range: args.range,
            value: args.value,
            values: args.values,
          });
          return newMap;
        });

        const valuePreview = args.values 
          ? `массив из ${args.values.length} строк`
          : args.value !== undefined 
          ? String(args.value)
          : "пустое значение";
        
        setConfirmationDialog({
          isOpen: true,
          question: `Вы уверены, что хотите обновить диапазон ${args.range} значением "${valuePreview}"?`,
          actionId,
        });

        return { result: "waiting_for_confirmation" };
      }

      if (toolCall.toolName === "highlightCells") {
        const { range } = toolCall.args as { range: string };
        setExcelViewer({ isOpen: true, range, highlightRange: range });
        return { result: `Диапазон ${range} будет выделен в таблице` };
      }

      return { result: "unknown_tool" };
    },
  });

  useEffect(() => {
    loadMessages();
  }, [threadId]);

  const loadMessages = async () => {
    try {
      const response = await fetch(`/api/messages?threadId=${threadId}`);
      if (response.ok) {
        const dbMessages: Message[] = await response.json();
        const formattedMessages: Array<{ id: string; role: "user" | "assistant"; content: string }> = [];
        
        dbMessages.forEach((msg) => {
          if (msg.user_message) {
            formattedMessages.push({
              id: `user-${msg.id}`,
              role: "user",
              content: msg.user_message,
            });
          }
          if (msg.assistant_message) {
            formattedMessages.push({
              id: `assistant-${msg.id}`,
              role: "assistant",
              content: msg.assistant_message,
            });
          }
        });
        
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleConfirmAction = async () => {
    if (!confirmationDialog.actionId) {
      setConfirmationDialog({ isOpen: false, question: "", actionId: null });
      return;
    }

    const action = pendingActions.get(confirmationDialog.actionId);
    if (action && action.type === "updateCell") {
      try {
        const response = await fetch("/api/excel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            range: action.range,
            value: action.value,
            values: action.values,
          }),
        });

        if (response.ok) {
          // Отправляем сообщение о успешном выполнении
          await append({
            role: "user",
            content: `Подтверждаю обновление диапазона ${action.range}`,
          });
        } else {
          await append({
            role: "user",
            content: "Ошибка при обновлении диапазона",
          });
        }
      } catch (error) {
        await append({
          role: "user",
          content: "Ошибка при обновлении диапазона",
        });
      }
    }
    
    setPendingActions((prev) => {
      const newMap = new Map(prev);
      newMap.delete(confirmationDialog.actionId!);
      return newMap;
    });

    setConfirmationDialog({ isOpen: false, question: "", actionId: null });
  };

  const handleCancelAction = async () => {
    await append({
      role: "user",
      content: "Действие отменено пользователем",
    });
    
    if (confirmationDialog.actionId) {
      setPendingActions((prev) => {
        const newMap = new Map(prev);
        newMap.delete(confirmationDialog.actionId!);
        return newMap;
      });
    }
    
    setConfirmationDialog({ isOpen: false, question: "", actionId: null });
  };

  const handleOpenExcelViewer = (range: string) => {
    setExcelViewer({ isOpen: true, range, highlightRange: range });
  };

  const handleSelectRange = (range: string) => {
    const mention = `@${range}`;
    append({
      role: "user",
      content: `Использовать диапазон ${mention}`,
    });
    setExcelViewer({ isOpen: false, range: "" });
  };

  const formatExcelDataAsMarkdown = (data: ExcelData): string => {
    if (!data.data || data.data.length === 0) {
      return "Нет данных";
    }

    let markdown = `**${data.sheet}** (${data.range}):\n\n`;
    markdown += "| " + data.data[0].map(() => "").join(" | ") + " |\n";
    markdown += "| " + data.data[0].map(() => "---").join(" | ") + " |\n";
    
    data.data.forEach((row) => {
      markdown += "| " + row.map((cell) => String(cell || "")).join(" | ") + " |\n";
    });

    return markdown;
  };

  const formatMessageContent = (content: string): React.ReactNode => {
    const mentions = extractRangeMentions(content);
    
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let processedContent = content;

    mentions.forEach((mention) => {
      const regex = new RegExp(`@${mention.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g");
      processedContent = processedContent.replace(
        regex,
        `<button class="text-blue-600 underline hover:text-blue-800 cursor-pointer" data-range="${mention}">@${mention}</button>`
      );
    });

    const excelDataEntries = Array.from(excelData.entries());
    
    if (excelDataEntries.length > 0) {
      const MAX_PREVIEW_ROWS = 5;
      return (
        <div className="space-y-4">
          <div dangerouslySetInnerHTML={{ __html: processedContent }} />
          {excelDataEntries.map(([range, data]) => {
            const previewData = data.data.slice(0, MAX_PREVIEW_ROWS);
            const hasMoreRows = data.data.length > MAX_PREVIEW_ROWS;
            const remainingRows = data.data.length - MAX_PREVIEW_ROWS;
            
            return (
              <div key={range} className="mt-4 border border-gray-200 rounded-lg p-4 bg-gray-50 shadow-sm">
                <div className="text-sm text-gray-600 mb-3 font-semibold flex items-center justify-between">
                  <span>
                    Диапазон: <span className="text-blue-600 font-mono">{range}</span>
                  </span>
                  {hasMoreRows && (
                    <span className="text-xs text-gray-500">
                      Показано {MAX_PREVIEW_ROWS} из {data.data.length} строк
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto rounded border border-gray-200 bg-white">
                  <table className="min-w-full table-auto border-collapse">
                    <thead className="bg-gray-100">
                      {previewData.length > 0 && (
                        <tr>
                          {previewData[0].map((_, colIdx) => (
                            <th
                              key={colIdx}
                              className="border border-gray-300 px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase"
                            >
                              {String.fromCharCode(65 + colIdx)}
                            </th>
                          ))}
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {previewData.map((row: (string | number)[], rowIdx: number) => (
                        <tr key={rowIdx} className="hover:bg-gray-50">
                          {row.map((cell: string | number, colIdx: number) => (
                            <td
                              key={colIdx}
                              className="border border-gray-300 px-4 py-2 text-sm min-w-[80px]"
                            >
                              {String(cell || "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  {hasMoreRows && (
                    <div className="text-xs text-gray-500">
                      +{remainingRows} строк скрыто
                    </div>
                  )}
                  <button
                    onClick={() => handleOpenExcelViewer(range)}
                    className="ml-auto px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline bg-white border border-blue-300 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    aria-label={`Открыть диапазон ${range} в модальном окне`}
                  >
                    📊 Открыть полностью
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return <div dangerouslySetInnerHTML={{ __html: processedContent }} />;
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input;
    
    try {
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          userMessage: userMessage,
          assistantMessage: null,
        }),
      });
    } catch (error) {
      console.error("Failed to save user message:", error);
    }
    
    handleSubmit(e);
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.dataset.range) {
        handleOpenExcelViewer(target.dataset.range);
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-800"
              }`}
            >
              <div className="whitespace-pre-wrap">
                {message.role === "assistant" ? formatMessageContent(message.content) : message.content}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 text-gray-800 rounded-lg px-4 py-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="flex justify-start">
            <div className="bg-red-100 border border-red-400 text-red-700 rounded-lg px-4 py-2 max-w-[80%]">
              <p className="font-semibold">Ошибка:</p>
              <p className="text-sm">{error.message || "Произошла ошибка при отправке сообщения"}</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={onSubmit} className="border-t border-gray-200 p-4">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Введите сообщение..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
            disabled={isLoading}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:shadow-none"
            aria-label="Отправить сообщение"
          >
            {isLoading ? "Отправка..." : "Отправить"}
          </button>
        </div>
      </form>

      <ConfirmationDialog
        isOpen={confirmationDialog.isOpen}
        question={confirmationDialog.question}
        onConfirm={handleConfirmAction}
        onCancel={handleCancelAction}
      />

      <ExcelViewer
        isOpen={excelViewer.isOpen}
        range={excelViewer.range}
        onClose={() => setExcelViewer({ isOpen: false, range: "" })}
        onSelectRange={handleSelectRange}
        highlightRange={excelViewer.highlightRange}
      />
    </div>
  );
}
