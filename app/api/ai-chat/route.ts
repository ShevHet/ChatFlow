import { streamText, type CoreMessage, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { NextRequest, NextResponse } from 'next/server';

const excelTools = {
  getRange: tool({
    description: "Читает диапазон ячеек из Excel таблицы example.xlsx. Диапазон должен быть в формате Sheet1!A1:B3 или просто A1:B3",
    parameters: z.object({
      range: z.string().describe("Диапазон ячеек в формате Sheet1!A1:B3 или A1:B3"),
    }),
    execute: async ({ range }) => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/excel?range=${encodeURIComponent(range)}`
        );
        if (!response.ok) {
          return { error: "Не удалось прочитать диапазон из таблицы" };
        }
        const data = await response.json();
        return {
          success: true,
          sheet: data.sheet,
          range: data.range,
          data: data.data,
        };
      } catch (error) {
        return { error: "Ошибка при чтении таблицы" };
      }
    },
  }),

  updateCell: tool({
    description: "Обновляет значение ячейки или диапазона в Excel таблице. Требует подтверждения пользователя через UI. Используйте этот tool только после того, как пользователь подтвердил действие.",
    parameters: z.object({
      range: z.string().describe("Диапазон ячеек в формате Sheet1!A1 или Sheet1!A1:B3"),
      value: z.union([z.string(), z.number()]).optional().describe("Значение для одной ячейки"),
      values: z.array(z.array(z.union([z.string(), z.number()]))).optional().describe("Массив значений для диапазона"),
    }),
    execute: async ({ range, value, values }) => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/excel`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ range, value, values }),
          }
        );
        if (!response.ok) {
          return { error: "Не удалось обновить ячейки в таблице" };
        }
        const data = await response.json();
        return {
          success: true,
          message: data.message || "Ячейки успешно обновлены",
        };
      } catch (error) {
        return { error: "Ошибка при обновлении таблицы" };
      }
    },
  }),

  confirmAction: tool({
    description: "Показывает пользователю диалог подтверждения с вопросом и кнопками Да/Нет. Используйте этот tool перед выполнением опасных действий (удаление, изменение данных).",
    parameters: z.object({
      question: z.string().describe("Вопрос для пользователя"),
      actionId: z.string().describe("Уникальный идентификатор действия для последующего выполнения"),
    }),
    execute: async ({ question, actionId }) => {
      return {
        requiresConfirmation: true,
        question,
        actionId,
        message: "Требуется подтверждение пользователя",
      };
    },
  }),

  highlightCells: tool({
    description: "Выделяет диапазон ячеек в модальном окне ExcelViewer. Используйте этот tool для визуального выделения диапазона при открытии таблицы.",
    parameters: z.object({
      range: z.string().describe("Диапазон ячеек для выделения в формате Sheet1!A1:B3"),
    }),
    execute: async ({ range }) => {
      return {
        success: true,
        message: `Диапазон ${range} будет выделен при открытии таблицы`,
        range,
      };
    },
  }),

  calculateRange: tool({
    description: "Вычисляет значения в диапазоне Excel таблицы. Поддерживает операции: sum (сумма), average (среднее), min (минимум), max (максимум).",
    parameters: z.object({
      range: z.string().describe("Диапазон ячеек в формате Sheet1!A1:B3"),
      operation: z.enum(["sum", "average", "min", "max"]).describe("Операция для вычисления: sum, average, min, max"),
    }),
    execute: async ({ range, operation }) => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/excel/calculate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ range, operation }),
          }
        );
        if (!response.ok) {
          return { error: "Не удалось вычислить значение диапазона" };
        }
        const data = await response.json();
        return {
          success: true,
          operation: data.operation,
          range: data.range,
          result: data.result,
        };
      } catch (error) {
        return { error: "Ошибка при вычислении диапазона" };
      }
    },
  }),
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, threadId } = body;

    if (!messages) {
      return NextResponse.json({ error: "Messages are required" }, { status: 400 });
    }

    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages must be an array" }, { status: 400 });
    }

    if (messages.length === 0) {
      return NextResponse.json({ error: "At least one message is required" }, { status: 400 });
    }

    const validMessages = messages.filter((msg: any) => 
      msg && typeof msg === "object" && msg.role && msg.content
    );

    if (validMessages.length === 0) {
      return NextResponse.json({ error: "No valid messages found" }, { status: 400 });
    }

    const hasUserMessage = validMessages.some((msg: any) => msg.role === "user");
    if (!hasUserMessage) {
      return NextResponse.json({ error: "At least one user message is required" }, { status: 400 });
    }

    const lastUserIndex = validMessages.map((m: any) => m.role).lastIndexOf("user");
    const relevantMessages = lastUserIndex >= 0 
      ? validMessages.slice(0, lastUserIndex + 1)
      : validMessages;

    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is not set");
      return NextResponse.json({ error: "OpenAI API key is not configured" }, { status: 500 });
    }

    const coreMessages: CoreMessage[] = relevantMessages.map((msg: { role: string; content: string }) => {
      if (msg.role === "user") {
        return { role: "user", content: msg.content };
      } else if (msg.role === "assistant") {
        return { role: "assistant", content: msg.content };
      } else if (msg.role === "system") {
        return { role: "system", content: msg.content };
      }
      return { role: "user", content: String(msg.content) };
    });

    const systemPrompt = `Вы - помощник для работы с Excel таблицами. 

Важные инструкции:
1. При чтении диапазона используйте tool getRange с форматом "Sheet1!A1:B3" или просто "A1:B3" (по умолчанию Sheet1).
2. При записи в ячейку/диапазон используйте tool updateCell - он автоматически покажет диалог подтверждения пользователю.
3. Для подтверждения опасных действий используйте tool confirmAction перед выполнением операции.
4. В ответах вы можете использовать упоминания диапазонов в формате @Sheet1!A1:B3 для ссылки на диапазоны таблицы.
5. Пользователь может кликнуть на упоминание диапазона, чтобы открыть его в модальном окне.
6. Все операции записи защищены подтверждением через UI (кнопки "Да" / "Нет").

Примеры:
- "Прочитай диапазон Sheet1!A1:D5" -> используйте getRange
- "Обнови ячейку A1 значением 100" -> используйте updateCell (покажется диалог подтверждения)
- "Покажи мне данные из @Sheet1!A1:B3" -> используйте getRange для Sheet1!A1:B3, затем упомяните диапазон в ответе`;

    const model = openai("gpt-4o-mini");
    
    const result = await streamText({
      model,
      system: systemPrompt,
      messages: coreMessages,
      tools: excelTools,
      maxSteps: 5,
    });

    return result.toDataStreamResponse();
  } catch (error: any) {
    console.error("Error in AI chat API:", error);
    console.error("Error details:", {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      cause: error?.cause,
    });
    
    let errorMessage = "Internal server error";
    let statusCode = 500;
    
    if (error?.message) {
      errorMessage = error.message;
      
      if (errorMessage.includes("Country, region, or territory not supported")) {
        errorMessage = "Ваш регион не поддерживается OpenAI API. Пожалуйста, используйте VPN или обратитесь в поддержку OpenAI.";
        statusCode = 403;
      } else if (errorMessage.includes("API key")) {
        errorMessage = "Проблема с API ключом OpenAI. Проверьте правильность ключа в .env.local";
        statusCode = 401;
      } else if (errorMessage.includes("rate limit") || errorMessage.includes("quota") || errorMessage.includes("429")) {
        const retryAfter = error?.response?.headers?.get?.("retry-after") || 
                          error?.headers?.get?.("retry-after") ||
                          error?.retryAfter;
        
        if (retryAfter) {
          errorMessage = `Превышен лимит запросов к OpenAI API. Попробуйте через ${retryAfter} секунд.`;
        } else {
          errorMessage = "Превышен лимит запросов к OpenAI API.\n\n" +
            "💡 Если вы используете бесплатный аккаунт:\n" +
            "• Бесплатные аккаунты имеют очень низкие лимиты (обычно $5 кредитов)\n" +
            "• Подождите 1-2 часа для сброса лимита\n" +
            "• Или перейдите на платный план Pay-as-you-go на https://platform.openai.com/account/billing\n\n" +
            "Для платных аккаунтов: подождите несколько минут и попробуйте снова.";
        }
        statusCode = 429;
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

