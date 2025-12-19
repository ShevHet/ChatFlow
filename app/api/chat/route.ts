
import { streamText, type CoreMessage, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { createAppError, ErrorType } from "@/lib/error-handler";
import { createOpenAIRetry } from "@/lib/retry";
import { ExcelService } from "@/lib/excel-service";
import { z } from "zod";

/**
 * Creates a stream response with an error message that the useChat hook can parse.
 * Uses the data stream protocol format with double newlines as separators.
 */
function createStreamErrorResponse(errorMessage: string, statusCode: number = 500): Response {
  const encoder = new TextEncoder();
  
  // Format the error message to match the AI SDK's data stream protocol
  // The format uses double newlines (\n\n) as separators between chunks
  // Each chunk is: 0:"text content"\n\n
  // We need to properly escape the message
  const escapedMessage = errorMessage
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/"/g, '\\"')    // Escape quotes
    .replace(/\n/g, '\\n')    // Escape newlines
    .replace(/\r/g, '\\r');   // Escape carriage returns
  
  const stream = new ReadableStream({
    start(controller) {
      try {
        // Send error as text chunk in the data stream protocol format
        // Format: 0:"text content"\n\n (double newline is the separator)
        const chunk = `0:"${escapedMessage}"\n\n`;
        controller.enqueue(encoder.encode(chunk));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    status: statusCode,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

export async function POST(req: Request) {
  try {
    // Сначала валидируем входные данные, потом проверяем API ключ
    let body;
    try {
      body = await req.json();
    } catch (error) {
      return createStreamErrorResponse(
        "Invalid JSON in request body",
        400
      );
    }

    const { messages, threadId } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return createStreamErrorResponse(
        "Messages array is required and must not be empty",
        400
      );
    }

    if (!threadId || typeof threadId !== "number") {
      return createStreamErrorResponse(
        "Valid threadId is required",
        400
      );
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "user") {
      return createStreamErrorResponse(
        "Last message must be from user",
        400
      );
    }

    // Проверяем API ключ только после валидации входных данных
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is not set");
      return createStreamErrorResponse(
        "OpenAI API key is not configured. Please set OPENAI_API_KEY in .env.local",
        500
      );
    }

    const systemMessage: CoreMessage = {
      role: "system",
      content: `Ты - умный AI-ассистент для работы с Excel файлами. 

ВАЖНЫЕ ПРАВИЛА для работы с Excel файлами:
1. Когда пользователь просит показать, открыть или работать с Excel файлом по имени - СНАЧАЛА используй инструмент findExcelFileByName чтобы найти файл и получить его ID.
2. После получения ID файла используй инструмент showExcelFile для открытия файла.
3. Если файл не найден, сообщи об этом пользователю и предложи загрузить файл.
4. Для просмотра всех доступных файлов используй getExcelFiles.

РАБОТА С ДИАПАЗОНАМИ И МЕНШОНАМИ:
- Когда пользователь использует меншон вида @Sheet1!A1:B5 или @example.xlsx!A1:D10, это означает ссылку на диапазон ячеек.
- Формат меншона: @[ИмяЛиста]![Диапазон] или @[ИмяФайла]![Диапазон]
- Используй getRange для чтения данных из указанного диапазона.
- При выводе данных таблицы ВСЕГДА отображай их в виде markdown таблицы для визуализации.

ЧТЕНИЕ ДАННЫХ:
- Используй getRange(fileId, range, sheetName) для чтения диапазона ячеек.
- В ответе выводи markdown таблицу с данными.

ЗАПИСЬ ДАННЫХ:
- Используй updateCell для изменения ячеек. Это ЗАПИСЫВАЮЩЕЕ действие!
- ВСЕГДА сначала запрашивай подтверждение через showConfirmation перед изменением данных.
- Только после получения подтверждения (confirmed: true) выполняй изменение.

ФОРМУЛЫ:
- Используй explainFormula чтобы объяснить формулу в ячейке.

ОТПРАВКА ПРИГЛАШЕНИЙ:
- Используй sendInvitations для отправки email приглашений (демо-функция).
- Сначала получи список email через getRange, затем отправь приглашения.

Пример: "Возьми email из @Sheet1!B2:B5 и отправь приглашения"
1. Найди файл через findExcelFileByName
2. Прочитай диапазон через getRange
3. Извлеки email адреса из полученных данных
4. Используй sendInvitations с этими email

Отвечай на русском языке.`
    };

    const userMessages: CoreMessage[] = messages.map(
      (msg: { role: string; content: string }) => {
        if (msg.role === "user") {
          return { role: "user", content: msg.content };
        } else if (msg.role === "assistant") {
          return { role: "assistant", content: msg.content };
        } else if (msg.role === "system") {
          return { role: "system", content: msg.content };
        }
        return { role: "user", content: String(msg.content) };
      }
    );
    
    const coreMessages: CoreMessage[] = [systemMessage, ...userMessages];

    const model = openai("gpt-3.5-turbo");
    const retryWithOpenAI = createOpenAIRetry();
    
    const result = await retryWithOpenAI(async () => {
      return await streamText({
        model,
        messages: coreMessages,
        maxRetries: 0,
        maxSteps: 5,
        tools: {
          getExcelFiles: tool({
            description: 'Получает список всех загруженных Excel файлов. ВСЕГДА используйте этот инструмент СНАЧАЛА, когда пользователь упоминает Excel файл по имени, чтобы найти его ID.',
            parameters: z.object({}),
            execute: async () => {
              try {
                const excelService = new ExcelService();
                const files = excelService.getAllExcelFiles();
                return {
                  tool: 'get_excel_files',
                  files: files.map(f => ({
                    fileId: f.fileId,
                    filename: f.filename,
                    rowCount: f.rowCount,
                    columnCount: f.columnCount,
                    headers: f.headers,
                  })),
                  count: files.length,
                };
              } catch (error) {
                return {
                  tool: 'get_excel_files',
                  error: error instanceof Error ? error.message : String(error),
                  files: [],
                  count: 0,
                };
              }
            },
          }),
          findExcelFileByName: tool({
            description: 'Ищет Excel файл по имени или части имени. Используйте этот инструмент, когда пользователь упоминает конкретный файл по имени (например, "покажи файл people_data.xlsx").',
            parameters: z.object({
              filename: z.string().describe('Имя файла или его часть для поиска'),
            }),
            execute: async ({ filename }) => {
              try {
                const excelService = new ExcelService();
                const files = excelService.getAllExcelFiles();
                const searchLower = filename.toLowerCase();
                const matchedFiles = files.filter(f => 
                  f.filename.toLowerCase().includes(searchLower)
                );
                
                if (matchedFiles.length === 0) {
                  return {
                    tool: 'find_excel_file',
                    found: false,
                    message: `Файл "${filename}" не найден. Доступные файлы: ${files.map(f => f.filename).join(', ') || 'нет загруженных файлов'}`,
                    availableFiles: files.map(f => ({ fileId: f.fileId, filename: f.filename })),
                  };
                }
                
                return {
                  tool: 'find_excel_file',
                  found: true,
                  files: matchedFiles.map(f => ({
                    fileId: f.fileId,
                    filename: f.filename,
                    rowCount: f.rowCount,
                    columnCount: f.columnCount,
                    headers: f.headers,
                  })),
                };
              } catch (error) {
                return {
                  tool: 'find_excel_file',
                  found: false,
                  error: error instanceof Error ? error.message : String(error),
                };
              }
            },
          }),
          showConfirmation: tool({
            description: 'Открывает диалог подтверждения для критичных операций. Используйте этот инструмент, когда пользователь хочет выполнить действие, которое требует подтверждения (например, удаление файла, изменение данных).',
            parameters: z.object({
              title: z.string().describe('Заголовок диалога подтверждения'),
              message: z.string().describe('Сообщение, объясняющее действие, которое требуется подтвердить'),
              type: z.enum(['default', 'danger', 'warning']).optional().default('default').describe('Тип диалога: default - обычное действие, danger - опасное действие (удаление, удаление данных), warning - предупреждение'),
              actionType: z.string().describe('Тип действия, которое будет выполнено после подтверждения (например, "delete_file", "update_data")'),
              actionParams: z.record(z.unknown()).optional().describe('Параметры для действия, которое будет выполнено после подтверждения'),
            }),
            execute: async ({ title, message, type, actionType, actionParams }) => {
              return {
                tool: 'show_confirmation',
                title,
                message,
                type: type || 'default',
                actionType,
                actionParams: actionParams || {},
              };
            },
          }),
          showExcelFile: tool({
            description: 'Открывает Excel файл в просмотрщике по его ID. ВАЖНО: Сначала используйте getExcelFiles или findExcelFileByName чтобы найти ID файла, затем используйте этот инструмент.',
            parameters: z.object({
              fileId: z.number().describe('ID Excel файла для отображения (получите ID через getExcelFiles или findExcelFileByName)'),
            }),
            execute: async ({ fileId }) => {
              return {
                tool: 'show_excel_file',
                fileId,
              };
            },
          }),
          highlightExcelCell: tool({
            description: 'Выделяет указанную ячейку в открытом Excel файле. Используйте этот инструмент, когда пользователь упоминает конкретную ячейку (например, "покажи ячейку A1", "что в B5?")',
            parameters: z.object({
              fileId: z.number().describe('ID Excel файла'),
              cellRef: z.string().describe('Ссылка на ячейку в формате Excel (например, "A1", "B5", "AA10")'),
            }),
            execute: async ({ fileId, cellRef }) => {
              return {
                tool: 'highlight_excel_cell',
                fileId,
                cellRef,
              };
            },
          }),
          getRange: tool({
            description: 'Читает диапазон ячеек из Excel файла. Возвращает данные в виде таблицы. Используйте для получения данных из конкретного диапазона (например, @Sheet1!A1:B5, A1:D10). Если пользователь использует меншон вида @Sheet1!A1:B5, извлеките имя листа и диапазон.',
            parameters: z.object({
              fileId: z.number().describe('ID Excel файла'),
              range: z.string().describe('Диапазон ячеек в формате Excel (например, "A1:B5", "A1:D10")'),
              sheetName: z.string().optional().describe('Имя листа (опционально, по умолчанию первый лист)'),
            }),
            execute: async ({ fileId, range, sheetName }) => {
              try {
                const excelService = new ExcelService();
                const fileData = excelService.getExcelFileData(fileId);
                
                if (!fileData) {
                  return {
                    tool: 'get_range',
                    success: false,
                    error: `Файл с ID ${fileId} не найден`,
                  };
                }

                const targetSheet = sheetName || fileData.sheetName;
                const rangeMatch = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
                
                if (!rangeMatch) {
                  return {
                    tool: 'get_range',
                    success: false,
                    error: `Неверный формат диапазона: ${range}. Используйте формат A1:B5`,
                  };
                }

                const [, startCol, startRowStr, endCol, endRowStr] = rangeMatch;
                const startRow = parseInt(startRowStr);
                const endRow = parseInt(endRowStr);
                
                const colToNum = (col: string): number => {
                  let num = 0;
                  for (let i = 0; i < col.length; i++) {
                    num = num * 26 + (col.charCodeAt(i) - 64);
                  }
                  return num - 1;
                };
                
                const startColNum = colToNum(startCol.toUpperCase());
                const endColNum = colToNum(endCol.toUpperCase());

                const rows: unknown[][] = [];
                const headers = fileData.headers || [];
                
                for (let r = startRow; r <= Math.min(endRow, fileData.data.length + 1); r++) {
                  const rowData: unknown[] = [];
                  const dataRowIndex = r - 2;
                  
                  for (let c = startColNum; c <= endColNum; c++) {
                    if (r === 1) {
                      rowData.push(headers[c] || '');
                    } else if (dataRowIndex >= 0 && dataRowIndex < fileData.data.length) {
                      const row = fileData.data[dataRowIndex];
                      const colKey = headers[c];
                      rowData.push(colKey && row[colKey] !== undefined ? row[colKey] : '');
                    } else {
                      rowData.push('');
                    }
                  }
                  rows.push(rowData);
                }

                const numToCol = (num: number): string => {
                  let col = '';
                  num++;
                  while (num > 0) {
                    const remainder = (num - 1) % 26;
                    col = String.fromCharCode(65 + remainder) + col;
                    num = Math.floor((num - 1) / 26);
                  }
                  return col;
                };

                const rangeHeaders: string[] = [];
                for (let c = startColNum; c <= endColNum; c++) {
                  rangeHeaders.push(numToCol(c));
                }

                let markdownTable = '| ' + rangeHeaders.join(' | ') + ' |\n';
                markdownTable += '| ' + rangeHeaders.map(() => '---').join(' | ') + ' |\n';
                rows.forEach((row) => {
                  markdownTable += '| ' + row.map(cell => String(cell ?? '')).join(' | ') + ' |\n';
                });

                return {
                  tool: 'get_range',
                  success: true,
                  fileId,
                  filename: fileData.filename,
                  sheetName: targetSheet,
                  range,
                  data: rows,
                  headers: rangeHeaders,
                  rowCount: rows.length,
                  markdownTable,
                };
              } catch (error) {
                return {
                  tool: 'get_range',
                  success: false,
                  error: error instanceof Error ? error.message : String(error),
                };
              }
            },
          }),
          updateCell: tool({
            description: 'Обновляет значение ячейки в Excel файле. ВАЖНО: Это записывающее действие, которое требует подтверждения от пользователя. Сначала покажите пользователю диалог подтверждения с помощью showConfirmation.',
            parameters: z.object({
              fileId: z.number().describe('ID Excel файла'),
              cellRef: z.string().describe('Ссылка на ячейку (например, "A1", "B5")'),
              value: z.union([z.string(), z.number()]).describe('Новое значение для ячейки'),
              sheetName: z.string().optional().describe('Имя листа (опционально)'),
              confirmed: z.boolean().optional().default(false).describe('Подтверждено ли действие пользователем'),
            }),
            execute: async ({ fileId, cellRef, value, sheetName, confirmed }) => {
              if (!confirmed) {
                return {
                  tool: 'update_cell',
                  requiresConfirmation: true,
                  message: `Для изменения ячейки ${cellRef} на значение "${value}" требуется подтверждение. Используйте showConfirmation для запроса подтверждения у пользователя.`,
                  pendingAction: {
                    actionType: 'update_cell',
                    actionParams: { fileId, cellRef, value, sheetName },
                  },
                };
              }

              try {
                const excelService = new ExcelService();
                const metadata = excelService.getExcelFileMetadata(fileId);
                
                if (!metadata) {
                  return {
                    tool: 'update_cell',
                    success: false,
                    error: `Файл с ID ${fileId} не найден`,
                  };
                }

                const cellMatch = cellRef.match(/^([A-Z]+)(\d+)$/i);
                if (!cellMatch) {
                  return {
                    tool: 'update_cell',
                    success: false,
                    error: `Неверный формат ячейки: ${cellRef}`,
                  };
                }

                const [, col, rowStr] = cellMatch;
                const row = parseInt(rowStr);
                
                const colToNum = (c: string): number => {
                  let num = 0;
                  for (let i = 0; i < c.length; i++) {
                    num = num * 26 + (c.charCodeAt(i) - 64);
                  }
                  return num - 1;
                };
                
                const colNum = colToNum(col.toUpperCase());
                const headers = metadata.headers || [];
                const colKey = headers[colNum];

                if (!colKey) {
                  return {
                    tool: 'update_cell',
                    success: false,
                    error: `Колонка ${col} не найдена в файле`,
                  };
                }

                const dataRowIndex = row - 2;
                if (dataRowIndex < 0) {
                  return {
                    tool: 'update_cell',
                    success: false,
                    error: 'Изменение заголовков не поддерживается',
                  };
                }

                excelService.updateExcelCell(fileId, dataRowIndex, colKey, value);

                return {
                  tool: 'update_cell',
                  success: true,
                  fileId,
                  cellRef,
                  oldValue: null,
                  newValue: value,
                  message: `Ячейка ${cellRef} успешно обновлена на "${value}"`,
                };
              } catch (error) {
                return {
                  tool: 'update_cell',
                  success: false,
                  error: error instanceof Error ? error.message : String(error),
                };
              }
            },
          }),
          explainFormula: tool({
            description: 'Объясняет формулу в указанной ячейке Excel файла. Используйте когда пользователь спрашивает "объясни формулу в ячейке D4" или подобное.',
            parameters: z.object({
              fileId: z.number().describe('ID Excel файла'),
              cellRef: z.string().describe('Ссылка на ячейку с формулой (например, "D4", "F12")'),
              sheetName: z.string().optional().describe('Имя листа (опционально)'),
            }),
            execute: async ({ fileId, cellRef, sheetName }) => {
              try {
                const excelService = new ExcelService();
                const fileData = excelService.getExcelFileData(fileId);
                
                if (!fileData) {
                  return {
                    tool: 'explain_formula',
                    success: false,
                    error: `Файл с ID ${fileId} не найден`,
                  };
                }

                const cellMatch = cellRef.match(/^([A-Z]+)(\d+)$/i);
                if (!cellMatch) {
                  return {
                    tool: 'explain_formula',
                    success: false,
                    error: `Неверный формат ячейки: ${cellRef}`,
                  };
                }

                const [, col, rowStr] = cellMatch;
                const row = parseInt(rowStr);
                
                const colToNum = (c: string): number => {
                  let num = 0;
                  for (let i = 0; i < c.length; i++) {
                    num = num * 26 + (c.charCodeAt(i) - 64);
                  }
                  return num - 1;
                };
                
                const colNum = colToNum(col.toUpperCase());
                const headers = fileData.headers || [];
                const colKey = headers[colNum];
                const dataRowIndex = row - 2;

                let cellValue: unknown = null;
                if (row === 1) {
                  cellValue = headers[colNum];
                } else if (dataRowIndex >= 0 && dataRowIndex < fileData.data.length) {
                  const rowData = fileData.data[dataRowIndex];
                  cellValue = colKey ? rowData[colKey] : null;
                }

                const commonFormulas: Record<string, string> = {
                  'SUM': 'СУММА - складывает все числа в указанном диапазоне',
                  'AVERAGE': 'СРЗНАЧ - вычисляет среднее арифметическое чисел в диапазоне',
                  'MAX': 'МАКС - находит максимальное значение в диапазоне',
                  'MIN': 'МИН - находит минимальное значение в диапазоне',
                  'COUNT': 'СЧЁТ - подсчитывает количество ячеек с числами',
                  'IF': 'ЕСЛИ - выполняет логическую проверку',
                  'VLOOKUP': 'ВПР - ищет значение в первом столбце таблицы',
                  'CONCATENATE': 'СЦЕПИТЬ - объединяет текстовые строки',
                };

                let formulaExplanation = 'Эта ячейка содержит обычное значение, не формулу.';
                const strValue = String(cellValue || '');
                
                if (strValue.startsWith('=') || /^[A-Z]+\d*[\+\-\*\/]/.test(strValue)) {
                  formulaExplanation = `Формула: ${strValue}\n\n`;
                  
                  for (const [func, desc] of Object.entries(commonFormulas)) {
                    if (strValue.toUpperCase().includes(func)) {
                      formulaExplanation += `• ${desc}\n`;
                    }
                  }
                  
                  const rangeMatches = strValue.match(/[A-Z]+\d+:[A-Z]+\d+/gi);
                  if (rangeMatches) {
                    formulaExplanation += `\nИспользуемые диапазоны: ${rangeMatches.join(', ')}`;
                  }
                }

                return {
                  tool: 'explain_formula',
                  success: true,
                  fileId,
                  cellRef,
                  sheetName: sheetName || fileData.sheetName,
                  value: cellValue,
                  explanation: formulaExplanation,
                };
              } catch (error) {
                return {
                  tool: 'explain_formula',
                  success: false,
                  error: error instanceof Error ? error.message : String(error),
                };
              }
            },
          }),
          sendInvitations: tool({
            description: 'Отправляет приглашения на email адреса. Используйте когда пользователь просит отправить приглашения на email из таблицы. Это демонстрационная функция - реальная отправка не происходит.',
            parameters: z.object({
              emails: z.array(z.string()).describe('Список email адресов для отправки приглашений'),
              subject: z.string().optional().default('Приглашение').describe('Тема письма'),
              message: z.string().optional().default('Вы приглашены!').describe('Текст приглашения'),
            }),
            execute: async ({ emails, subject, message }) => {
              console.log('[sendInvitations] Отправка приглашений (демо):', { emails, subject, message });
              
              return {
                tool: 'send_invitations',
                success: true,
                sentTo: emails,
                count: emails.length,
                subject,
                message: `[ДЕМО] Приглашения отправлены на ${emails.length} адресов: ${emails.join(', ')}`,
                note: 'Это демонстрационная функция. Реальная отправка писем не происходит.',
              };
            },
          }),
        },
      });
    });

    return result.toTextStreamResponse();
  } catch (error) {
    const appError = createAppError(error, "chat API");
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      statusCode: ('statusCode' in error ? (error as any).statusCode : undefined),
      cause: ('cause' in error ? (error as any).cause : undefined),
    } : { error };
    
    console.error(`[Chat API Error] ${appError.type} (${appError.statusCode || 'N/A'}): ${appError.message} | Original: ${JSON.stringify(errorDetails)}`);
    
    // Return error as a stream response so useChat can parse it
    return createStreamErrorResponse(
      appError.message,
      appError.statusCode || 500
    );
  }
}
