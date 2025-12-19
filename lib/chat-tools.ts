import { z } from 'zod';

/**
 * Инструменты (tools) для AI чата
 * 
 * Эти инструменты выполняются на клиенте после того, как AI запросит их выполнение.
 * Используются для подтверждения действий, работы с Excel файлами и других клиентских операций.
 * 
 * В Vercel AI SDK версии 3.x tools определяются через объекты с описанием и параметрами.
 */

/**
 * Тип для определения tool
 */
interface ToolDefinition {
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  execute?: (args: any) => Promise<any> | any;
}

/**
 * Инструмент для открытия диалога подтверждения действия
 */
export const showConfirmationTool: ToolDefinition = {
  description: 'Открывает диалог подтверждения для критичных операций. Используйте этот инструмент, когда пользователь хочет выполнить действие, которое требует подтверждения (например, удаление файла, изменение данных).',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Заголовок диалога подтверждения' },
      message: { type: 'string', description: 'Сообщение, объясняющее действие, которое требуется подтвердить' },
      type: { 
        type: 'string', 
        enum: ['default', 'danger', 'warning'], 
        default: 'default', 
        description: 'Тип диалога: default - обычное действие, danger - опасное действие (удаление, удаление данных), warning - предупреждение' 
      },
      actionType: { type: 'string', description: 'Тип действия, которое будет выполнено после подтверждения (например, "delete_file", "update_data")' },
      actionParams: { type: 'object', description: 'Параметры для действия, которое будет выполнено после подтверждения' },
    },
    required: ['title', 'message', 'actionType'],
  },
  execute: async ({ title, message, type, actionType, actionParams }: {
    title: string;
    message: string;
    type?: 'default' | 'danger' | 'warning';
    actionType: string;
    actionParams?: Record<string, unknown>;
  }) => {
    // Этот инструмент возвращает данные, которые будут обработаны на клиенте
    // Фактическое выполнение происходит в ChatInterface через onToolCall
    return {
      tool: 'show_confirmation',
      title,
      message,
      type: type || 'default',
      actionType,
      actionParams: actionParams || {},
    };
  },
};

/**
 * Инструмент для открытия Excel файла в просмотрщике
 */
export const showExcelFileTool: ToolDefinition = {
  description: 'Открывает Excel файл в просмотрщике. Используйте этот инструмент, когда пользователь просит показать или открыть Excel файл.',
  parameters: {
    type: 'object',
    properties: {
      fileId: { type: 'number', description: 'ID Excel файла для отображения' },
    },
    required: ['fileId'],
  },
  execute: async ({ fileId }: { fileId: number }) => {
    // Этот инструмент возвращает данные, которые будут обработаны на клиенте
    return {
      tool: 'show_excel_file',
      fileId,
    };
  },
};

/**
 * Инструмент для выделения ячейки в Excel файле
 */
export const highlightExcelCellTool: ToolDefinition = {
  description: 'Выделяет указанную ячейку в открытом Excel файле. Используйте этот инструмент, когда пользователь упоминает конкретную ячейку (например, "покажи ячейку A1", "что в B5?")',
  parameters: {
    type: 'object',
    properties: {
      fileId: { type: 'number', description: 'ID Excel файла' },
      cellRef: { type: 'string', description: 'Ссылка на ячейку в формате Excel (например, "A1", "B5", "AA10")' },
    },
    required: ['fileId', 'cellRef'],
  },
  execute: async ({ fileId, cellRef }: { fileId: number; cellRef: string }) => {
    return {
      tool: 'highlight_excel_cell',
      fileId,
      cellRef,
    };
  },
};

/**
 * Все доступные инструменты для чата
 */
export const chatTools = {
  showConfirmation: showConfirmationTool,
  showExcelFile: showExcelFileTool,
  highlightExcelCell: highlightExcelCellTool,
};
