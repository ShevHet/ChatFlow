// Типы для параметров tools
export interface GetRangeParams {
  range: string;
}

export interface UpdateCellParams {
  range: string;
  value?: string | number;
  values?: (string | number)[][];
}

export interface ConfirmActionParams {
  question: string;
  actionId: string;
}

export interface HighlightCellsParams {
  range: string;
  sheet?: string;
}

// Типы для диапазонов таблицы
export interface ExcelRange {
  sheet: string;
  range: string;
  fullRange: string; // Sheet1!A1:B3
}

export interface ExcelCellCoords {
  row: number;
  col: number;
}

export interface ExcelRangeCoords {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface ExcelData {
  sheet: string;
  range: string;
  data: (string | number)[][];
}

// Типы для pending actions
export type PendingActionType = "updateCell" | "deleteMessage" | "deleteThread" | "custom";

export interface PendingAction {
  actionId: string;
  type: PendingActionType;
  range?: string;
  value?: string | number;
  values?: (string | number)[][];
  threadId?: number;
  messageId?: number;
  customData?: Record<string, any>;
}

// Типы для tool results
export interface ToolResult {
  result: string | { error: string } | { success: boolean; [key: string]: any };
}

// Типы для UI состояний
export interface ConfirmationDialogState {
  isOpen: boolean;
  question: string;
  actionId: string | null;
}

export interface ExcelViewerState {
  isOpen: boolean;
  range: string;
  highlightRange?: string;
}

