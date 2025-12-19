"use client";

import { useChat } from "ai/react";
import { useEffect, useRef, useCallback, useState } from "react";
import { Message } from "@/lib/db";
import ConfirmationDialog, { ConfirmationDialogProps } from "./ConfirmationDialog";
import ExcelViewer from "./ExcelViewer";

interface ChatInterfaceProps {
  threadId: number;
}

export default function ChatInterface({ threadId }: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // Состояние для диалога подтверждения
  const [confirmationDialog, setConfirmationDialog] = useState<Omit<ConfirmationDialogProps, 'onConfirm' | 'onCancel'> | null>(null);
  const [pendingAction, setPendingAction] = useState<{ type: string; params: Record<string, unknown>; toolCallId?: string } | null>(null);
  
  // Состояние для Excel viewer
  const [excelViewerFileId, setExcelViewerFileId] = useState<number | null>(null);
  const [excelViewerSelectedCell, setExcelViewerSelectedCell] = useState<string | null>(null);
  const [inlineTable, setInlineTable] = useState<{ markdown: string; title: string } | null>(null);
  const [activeTableData, setActiveTableData] = useState<{
    fileId?: number;
    range?: string;
    sheetName?: string;
    markdown?: string;
  } | null>(null);

  // Состояние для отслеживания загрузки сообщений
  const [messagesLoaded, setMessagesLoaded] = useState(false);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages, error, addToolResult } = useChat({
    api: "/api/chat",
    streamProtocol: "text",
    body: {
      threadId,
    },
    onToolCall: async ({ toolCall }) => {
      // Обработка вызовов инструментов от AI
      if (toolCall.toolName === 'showConfirmation') {
        const { title, message, type, actionType, actionParams } = toolCall.args as {
          title: string;
          message: string;
          type?: 'default' | 'danger' | 'warning';
          actionType: string;
          actionParams?: Record<string, unknown>;
        };
        
        setConfirmationDialog({
          isOpen: true,
          title,
          message,
          type: type || 'default',
        });
        setPendingAction({
          type: actionType,
          params: actionParams || {},
          toolCallId: (toolCall as any).toolCallId ?? (toolCall as any).id,
        });
      } else if (toolCall.toolName === 'showExcelFile') {
        const { fileId } = toolCall.args as { fileId: number };
        setExcelViewerFileId(fileId);
        if ((toolCall as any).toolCallId || (toolCall as any).id) {
          addToolResult({
            toolCallId: (toolCall as any).toolCallId ?? (toolCall as any).id,
            result: { tool: 'show_excel_file', fileId, opened: true },
          });
        }
      } else if (toolCall.toolName === 'highlightExcelCell') {
        const { fileId, cellRef } = toolCall.args as { fileId: number; cellRef: string };
        setExcelViewerFileId(fileId);
        setExcelViewerSelectedCell(cellRef);
        if ((toolCall as any).toolCallId || (toolCall as any).id) {
          addToolResult({
            toolCallId: (toolCall as any).toolCallId ?? (toolCall as any).id,
            result: { tool: 'highlight_excel_cell', fileId, cellRef },
          });
        }
      } else if (toolCall.toolName === 'getRange') {
        const { fileId, range, sheetName } = toolCall.args as { fileId: number; range: string; sheetName?: string };
        try {
          const resp = await fetch(`/api/excel/${fileId}?range=${encodeURIComponent(range)}${sheetName ? `&sheetName=${encodeURIComponent(sheetName)}` : ''}`);
          const json = await resp.json();
          if (resp.ok && json?.markdownTable) {
            setInlineTable({ markdown: json.markdownTable, title: `${json.metadata?.filename || 'Excel'}:${json.range}` });
            appendAssistantMessage(`Диапазон ${json.range}:\n\n${json.markdownTable}`);
            if (json?.fileId && json?.range) {
              appendTableMessage({
                fileId: json.fileId,
                range: json.range,
                sheetName: json.sheetName,
                markdownTable: json.markdownTable,
                filename: json.metadata?.filename,
              });
            }
          }
          if ((toolCall as any).toolCallId || (toolCall as any).id) {
            addToolResult({
              toolCallId: (toolCall as any).toolCallId ?? (toolCall as any).id,
              result: json,
            });
          }
        } catch (err) {
          console.error('getRange tool error', err);
        }
      } else if (toolCall.toolName === 'explainFormula') {
        const { fileId, cellRef, sheetName } = toolCall.args as { fileId: number; cellRef: string; sheetName?: string };
        try {
          const resp = await fetch(`/api/excel/${fileId}?formula=${encodeURIComponent(cellRef)}${sheetName ? `&sheetName=${encodeURIComponent(sheetName)}` : ''}`);
          const json = await resp.json().catch(() => ({}));
          const explanation = json?.explanation || `Формула в ${cellRef}`;
          appendAssistantMessage(`Объяснение формулы ${cellRef}:\n${explanation}`);
          if ((toolCall as any).toolCallId || (toolCall as any).id) {
            addToolResult({
              toolCallId: (toolCall as any).toolCallId ?? (toolCall as any).id,
              result: json,
            });
          }
        } catch (err) {
          console.error('explainFormula tool error', err);
        }
      } else if (toolCall.toolName === 'sendInvitations') {
        const { emails, subject, message: inviteMessage } = toolCall.args as { emails: string[]; subject?: string; message?: string };
        const summary = `[ДЕМО] Приглашения отправлены: ${emails.join(', ')} (${subject || 'Приглашение'})`;
        appendAssistantMessage(summary);
        if ((toolCall as any).toolCallId || (toolCall as any).id) {
          addToolResult({
            toolCallId: (toolCall as any).toolCallId ?? (toolCall as any).id,
            result: { tool: 'send_invitations', success: true, sentTo: emails, subject, message: inviteMessage },
          });
        }
      } else if (toolCall.toolName === 'getExcelFiles' || toolCall.toolName === 'findExcelFileByName') {
        try {
          const filenameQuery = (toolCall.args as any)?.filename as string | undefined;
          const resp = await fetch('/api/excel/list');
          const json = await resp.json();
          let files = json?.files || [];
          if (filenameQuery) {
            const q = filenameQuery.toLowerCase();
            files = files.filter((f: any) => f.filename.toLowerCase().includes(q));
          }
          const list = files.map((f: any) => `• ${f.filename} (id ${f.fileId})`).join('\n') || 'Файлы не найдены';
          appendAssistantMessage(filenameQuery ? `Результат поиска "${filenameQuery}":\n${list}` : `Доступные Excel файлы:\n${list}`);
          if ((toolCall as any).toolCallId || (toolCall as any).id) {
            addToolResult({
              toolCallId: (toolCall as any).toolCallId ?? (toolCall as any).id,
              result: { files, count: files.length, filteredBy: filenameQuery },
            });
          }
        } catch (err) {
          console.error('list files tool error', err);
        }
      }
    },
    onFinish: async (message) => {
      try {
        // Извлекаем текстовое содержимое сообщения
        // message.content может быть строкой, массивом или объектом
        let messageText = "";
        const contentVal: any = (message as any).content;
        if (typeof contentVal === "string") {
          messageText = contentVal;
        } else if (Array.isArray(contentVal)) {
          // Если content - массив, извлекаем текстовые части
          const arr = contentVal as any[];
          messageText = arr
            .filter((part: any) => part && part.type === "text")
            .map((part: any) => part.text ?? part.content ?? "")
            .join(" ");
        } else if (contentVal && typeof contentVal === "object") {
          // Если content - объект, пытаемся извлечь текст
          messageText = String(contentVal);
        } else {
          messageText = String(contentVal || "");
        }

        // Сохраняем только если есть текстовое содержимое
        if (messageText.trim().length > 0) {
          const response = await fetch("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              threadId,
              sender: "assistant",
              message: messageText.trim(),
            }),
          });
          if (!response.ok) {
            const errorText = await response.text().catch(() => response.statusText);
            throw new Error(`Failed to save message: ${errorText}`);
          }
        }
      } catch (error) {
        console.error("Failed to save assistant message:", error);
      }
    },
    onError: (error) => {
      console.error("Chat error:", error);
    },
  });

  const appendAssistantMessage = useCallback(
    (content: string) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `tool-${Date.now()}`,
          role: "assistant",
          content,
        },
      ]);
    },
    [setMessages]
  );

  const appendTableMessage = useCallback(
    (payload: { fileId: number; range: string; sheetName?: string; markdownTable: string; filename?: string }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `table-${Date.now()}`,
          role: "assistant",
          content: `[table:${payload.fileId}:${payload.sheetName || ''}:${payload.range}]`,
          data: payload,
        } as any,
      ]);
    },
    [setMessages]
  );

  // Обработка подтверждения действия
  const handleConfirm = useCallback(async () => {
    if (!pendingAction) return;

    try {
      if (pendingAction.type === 'update_cell') {
        const { fileId, cellRef, value } = pendingAction.params as { fileId: number; cellRef: string; value: string | number };
        const response = await fetch(`/api/excel/${fileId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cellRef, value }),
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Не удалось обновить ячейку');
        }

        if (pendingAction.toolCallId) {
          addToolResult({
            toolCallId: pendingAction.toolCallId,
            result: {
              tool: 'update_cell',
              ...result,
            },
          });
        }
      } else if (pendingAction.toolCallId) {
        addToolResult({
          toolCallId: pendingAction.toolCallId,
          result: {
            tool: pendingAction.type,
            confirmed: true,
            params: pendingAction.params,
          },
        });
      }
    } catch (err) {
      console.error('Failed to execute confirmed action', err);
      if (pendingAction.toolCallId) {
        addToolResult({
          toolCallId: pendingAction.toolCallId,
          result: {
            tool: pendingAction.type,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }
    } finally {
      setConfirmationDialog(null);
      setPendingAction(null);
    }
  }, [addToolResult, pendingAction]);

  // Обработка отмены действия
  const handleCancel = useCallback(() => {
    if (pendingAction?.toolCallId) {
      addToolResult({
        toolCallId: pendingAction.toolCallId,
        result: {
          tool: pendingAction.type,
          confirmed: false,
          cancelled: true,
        },
      });
    }
    setConfirmationDialog(null);
    setPendingAction(null);
  }, [addToolResult, pendingAction]);

  // Загружаем сообщения из БД только один раз при монтировании или смене threadId
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const response = await fetch(`/api/messages?threadId=${threadId}`);
        if (!response.ok) {
          throw new Error(`Failed to load messages: ${response.statusText}`);
        }
        const dbMessages: Message[] = await response.json();
        console.log("Loaded messages from DB:", dbMessages);
        const formattedMessages = dbMessages.map((msg) => ({
          id: msg.id.toString(),
          role: (msg.sender === "user" ? "user" : "assistant") as "user" | "assistant",
          content: msg.message,
        }));
        console.log("Formatted messages:", formattedMessages);
        // Устанавливаем сообщения в useChat только если они есть
        if (formattedMessages.length > 0) {
          console.log("Setting messages in useChat:", formattedMessages.length);
          setMessages(formattedMessages);
        }
        setMessagesLoaded(true);
      } catch (error) {
        console.error("Failed to load messages:", error);
      }
    };
    
    // Загружаем сообщения с небольшой задержкой, чтобы useChat успел инициализироваться
    const timer = setTimeout(() => {
      loadMessages();
    }, 100);
    
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, setMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Отладочная информация в development режиме
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log("Messages state updated:", messages.length, "messages");
      messages.forEach((msg, idx) => {
        console.log(`Message ${idx}:`, {
          id: msg.id,
          role: msg.role,
          contentType: typeof msg.content,
          contentLength: typeof msg.content === "string" ? msg.content.length : "N/A",
          contentPreview: typeof msg.content === "string" ? msg.content.substring(0, 50) : String(msg.content).substring(0, 50)
        });
      });
    }
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
    <div className="flex flex-col h-full bg-white relative" role="main" aria-label="Чат интерфейс">
      {/* Диалог подтверждения */}
      {confirmationDialog && (
        <ConfirmationDialog
          {...confirmationDialog}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      {/* Excel Viewer */}
      {excelViewerFileId && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <ExcelViewer
            fileId={excelViewerFileId}
            initialSelectedCell={excelViewerSelectedCell}
            onClose={() => {
              setExcelViewerFileId(null);
              setExcelViewerSelectedCell(null);
            }}
            onCellSelect={(cellRef, value) => {
              setExcelViewerSelectedCell(cellRef);
              console.log('Cell selected:', cellRef, value);
            }}
            onInsertRange={(rangeMention) => {
              const inputField = document.querySelector('textarea[name="message"]') as HTMLTextAreaElement | null;
              if (inputField) {
                const currentValue = inputField.value;
                const newValue = currentValue ? `${currentValue} ${rangeMention}` : rangeMention;
                handleInputChange({ target: { value: newValue } } as React.ChangeEvent<HTMLTextAreaElement>);
              }
              setExcelViewerFileId(null);
              setExcelViewerSelectedCell(null);
            }}
          />
        </div>
      )}

      {inlineTable && (
        <div className="p-3 border border-gray-200 rounded bg-white shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <div className="font-semibold text-gray-800">{inlineTable.title}</div>
            <button
              onClick={() => setInlineTable(null)}
              className="text-sm text-blue-600 hover:underline"
            >
              Закрыть
            </button>
          </div>
          <pre className="text-xs whitespace-pre-wrap font-mono">{inlineTable.markdown}</pre>
        </div>
      )}

      {activeTableData && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded shadow-lg max-w-3xl w-full p-4">
            <div className="flex justify-between items-center mb-3">
              <div className="font-semibold text-gray-900">
                {activeTableData.fileId ? `Файл ${activeTableData.fileId}` : 'Таблица'} {activeTableData.range ? `(${activeTableData.range})` : ''}
              </div>
              <button
                onClick={() => setActiveTableData(null)}
                className="text-sm text-blue-600 hover:underline"
              >
                Закрыть
              </button>
            </div>
            {activeTableData.markdown && (
              <pre className="text-xs whitespace-pre-wrap font-mono bg-gray-50 border border-gray-200 rounded p-2 overflow-auto max-h-[60vh]">
                {activeTableData.markdown}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Основной интерфейс чата */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Сообщения чата"
        tabIndex={0}
      >
        {/* Отладочная информация */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-gray-400 p-2">
            Debug: messages.length = {messages.length}, isLoading = {String(isLoading)}
          </div>
        )}
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-gray-500 py-8">
            Нет сообщений. Начните разговор, отправив сообщение.
          </div>
        )}
        {isLoading && messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            Загрузка...
          </div>
        )}
        {messages.map((message) => {
          console.log("Rendering message:", message.id, message.role, typeof message.content, message.content);
          
          // Нормализуем content в строку
          let content = "";
          const contentVal: any = (message as any).content;
          if (typeof contentVal === "string") {
            content = contentVal;
          } else if (Array.isArray(contentVal)) {
            // Если content - массив, извлекаем текстовые части
            const arr = contentVal as any[];
            content = arr
              .filter((p: any) => p && (p.type === "text" || typeof p === "string"))
              .map((p: any) => {
                if (typeof p === "string") return p;
                return p.text || p.content || "";
              })
              .join(" ");
          } else if (contentVal && typeof contentVal === "object") {
            // Если content - объект, пытаемся извлечь текст
            content = String(contentVal);
          } else {
            content = String(contentVal || "");
          }
          
          console.log("Normalized content:", content, "length:", content.length);
          
          // Пропускаем сообщения без содержимого
          if (!content || content.trim().length === 0) {
            console.log("Skipping empty message:", message.id);
            return null;
          }
          
      // Сообщение с таблицей (tool-ответ)
      const tableData = (message as any).data as { fileId?: number; range?: string; sheetName?: string; markdownTable?: string; filename?: string } | undefined;
      const isTableMessage = tableData && tableData.markdownTable;

      return (
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
            <div className="whitespace-pre-wrap">
                {/* Сообщение-таблица */}
                {isTableMessage ? (
                  <div
                    className="cursor-pointer"
                    onClick={() => {
                      if (tableData?.fileId) {
                        setExcelViewerFileId(tableData.fileId);
                        setActiveTableData({
                          fileId: tableData.fileId,
                          range: tableData.range,
                          sheetName: tableData.sheetName,
                          markdown: tableData.markdownTable,
                        });
                      }
                    }}
                    title="Открыть таблицу"
                  >
                    <div className="text-sm font-semibold text-gray-800 mb-2">
                      {tableData?.filename || 'Excel'} {tableData?.range ? `(${tableData.range})` : ''}
                    </div>
                    <pre className="text-xs whitespace-pre-wrap font-mono bg-white border border-gray-200 rounded p-2">
                      {tableData?.markdownTable}
                    </pre>
                  </div>
                ) : (
                  /* Обрабатываем текст сообщения и выделяем меншоны ячеек Excel */
                  (() => {
                  // Используем уже нормализованный content
                  const cellMentionRegex = /\b(?:@([\w.-]+)!)?([A-Z]+\d+(?::[A-Z]+\d+)?)/g;
                  const parts: Array<{ type: 'text' | 'mention'; content: string; cellRef?: string; sheet?: string }> = [];
                  let lastIndex = 0;
                  let match: RegExpExecArray | null;

                  while ((match = cellMentionRegex.exec(content)) !== null) {
                    // Добавляем текст до меншона
                    if (match.index > lastIndex) {
                      parts.push({
                        type: 'text',
                        content: content.substring(lastIndex, match.index),
                      });
                    }

                    // Добавляем меншон
                    const sheet = match[1];
                    const cellRef = match[2];
                    parts.push({
                      type: 'mention',
                      content: match[0],
                      cellRef,
                      sheet,
                    });

                    lastIndex = match.index + match[0].length;
                  }

                  // Добавляем оставшийся текст
                  if (lastIndex < content.length) {
                    parts.push({
                      type: 'text',
                      content: content.substring(lastIndex),
                    });
                  }

                  // Если нет меншонов, возвращаем обычный текст
                  if (parts.length === 0) {
                    return <span>{content}</span>;
                  }

                  return parts.map((part, idx) => {
                    if (part.type === 'mention' && part.cellRef) {
                      const cellRefValue = part.cellRef;

                      if (cellRefValue.includes(':')) {
                        const [startCell, endCell] = cellRefValue.split(':').filter(Boolean);
                        return (
                          <span key={idx} className="inline-flex items-center space-x-1">
                            {[startCell || cellRefValue, endCell]
                              .filter(Boolean)
                              .map((value, subIdx) => (
                                <span
                                  key={`${idx}-${subIdx}`}
                                  className="mx-1 px-2 py-1 bg-blue-100 text-blue-800 rounded cursor-pointer hover:bg-blue-200 transition-colors inline-block"
                                  onClick={() => {
                                    console.log("Cell mention clicked:", value);
                                    const openViewer = async () => {
                                      if (!excelViewerFileId) {
                                        try {
                                          const resp = await fetch('/api/excel/list');
                                          const data = await resp.json();
                                          if (data?.files && data.files.length > 0) {
                                            setExcelViewerFileId(data.files[0].fileId);
                                            setExcelViewerSelectedCell(value as string);
                                            try {
                                              const range = (value as string).includes(':') ? (value as string) : `${value}:${value}`;
                                              const r = await fetch(`/api/excel/${data.files[0].fileId}?range=${encodeURIComponent(range)}`);
                                              const j = await r.json().catch(() => ({}));
                                              if (r.ok && j?.markdownTable) {
                                                setInlineTable({ markdown: j.markdownTable, title: `${j.metadata?.filename || 'Excel'}:${range}` });
                                                appendAssistantMessage(`Диапазон ${range}:\n\n${j.markdownTable}`);
                                                if (j?.fileId && j?.range) {
                                                  appendTableMessage({
                                                    fileId: j.fileId,
                                                    range: j.range,
                                                    sheetName: j.sheetName,
                                                    markdownTable: j.markdownTable,
                                                    filename: j.metadata?.filename,
                                                  });
                                                }
                                              }
                                            } catch (err) {
                                              console.error('Не удалось получить диапазон по меньшону', err);
                                            }
                                          }
                                        } catch (err) {
                                          console.error('Не удалось открыть файл для меньшона', err);
                                        }
                                      } else {
                                        setExcelViewerSelectedCell(value as string);
                                        try {
                                          const range = (value as string).includes(':') ? (value as string) : `${value}:${value}`;
                                          const r = await fetch(`/api/excel/${excelViewerFileId}?range=${encodeURIComponent(range)}`);
                                          const j = await r.json().catch(() => ({}));
                                          if (r.ok && j?.markdownTable) {
                                            setInlineTable({ markdown: j.markdownTable, title: `${j.metadata?.filename || 'Excel'}:${range}` });
                                            appendAssistantMessage(`Диапазон ${range}:\n\n${j.markdownTable}`);
                                            if (j?.fileId && j?.range) {
                                              appendTableMessage({
                                                fileId: j.fileId,
                                                range: j.range,
                                                sheetName: j.sheetName,
                                                markdownTable: j.markdownTable,
                                                filename: j.metadata?.filename,
                                              });
                                            }
                                          }
                                        } catch (err) {
                                          console.error('Не удалось получить диапазон по меньшону', err);
                                        }
                                      }
                                    };
                                    openViewer();
                                  }}
                                  title={`Ячейка ${value} - нажмите для выделения`}
                                >
                                  {value as string}
                                </span>
                              ))}
                          </span>
                        );
                      }

                      return (
                        <span
                          key={idx}
                          className="mx-1 px-2 py-1 bg-blue-100 text-blue-800 rounded cursor-pointer hover:bg-blue-200 transition-colors inline-block"
                          onClick={() => {
                            console.log("Cell mention clicked:", cellRefValue);
                            const openViewer = async () => {
                              if (!excelViewerFileId) {
                                try {
                                  const resp = await fetch('/api/excel/list');
                                  const data = await resp.json();
                                  if (data?.files && data.files.length > 0) {
                                    setExcelViewerFileId(data.files[0].fileId);
                                    setExcelViewerSelectedCell(cellRefValue);
                                    try {
                                      const range = cellRefValue.includes(':') ? cellRefValue : `${cellRefValue}:${cellRefValue}`;
                                      const r = await fetch(`/api/excel/${data.files[0].fileId}?range=${encodeURIComponent(range)}`);
                                      const j = await r.json().catch(() => ({}));
                                      if (r.ok && j?.markdownTable) {
                                        setInlineTable({ markdown: j.markdownTable, title: `${j.metadata?.filename || 'Excel'}:${range}` });
                                        appendAssistantMessage(`Диапазон ${range}:\n\n${j.markdownTable}`);
                                        if (j?.fileId && j?.range) {
                                          appendTableMessage({
                                            fileId: j.fileId,
                                            range: j.range,
                                            sheetName: j.sheetName,
                                            markdownTable: j.markdownTable,
                                            filename: j.metadata?.filename,
                                          });
                                        }
                                      }
                                    } catch (err) {
                                      console.error('Не удалось получить диапазон по меньшону', err);
                                    }
                                  }
                                } catch (err) {
                                  console.error('Не удалось открыть файл для меншона', err);
                                }
                              } else {
                                setExcelViewerSelectedCell(cellRefValue);
                                try {
                                  const range = cellRefValue.includes(':') ? cellRefValue : `${cellRefValue}:${cellRefValue}`;
                                  const r = await fetch(`/api/excel/${excelViewerFileId}?range=${encodeURIComponent(range)}`);
                                  const j = await r.json().catch(() => ({}));
                                  if (r.ok && j?.markdownTable) {
                                    setInlineTable({ markdown: j.markdownTable, title: `${j.metadata?.filename || 'Excel'}:${range}` });
                                    appendAssistantMessage(`Диапазон ${range}:\n\n${j.markdownTable}`);
                                    if (j?.fileId && j?.range) {
                                      appendTableMessage({
                                        fileId: j.fileId,
                                        range: j.range,
                                        sheetName: j.sheetName,
                                        markdownTable: j.markdownTable,
                                        filename: j.metadata?.filename,
                                      });
                                    }
                                  }
                                } catch (err) {
                                  console.error('Не удалось получить диапазон по меньшону', err);
                                }
                              }
                            };
                            openViewer();
                          }}
                          title={`Ячейка ${cellRefValue} - нажмите для выделения`}
                        >
                          {part.content}
                        </span>
                      );
                    }
                    return <span key={idx}>{part.content}</span>;
                  });
                })()
              )}
              </div>
            </div>
          </div>
          );
        })}
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

