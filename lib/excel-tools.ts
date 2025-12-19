/**
 * Утилиты для работы с Excel файлами
 * 
 * Предоставляет функции для чтения диапазонов ячеек и обновления значений в ячейках
 */

import * as XLSX from 'xlsx';
import { ExcelService } from './excel-service';

/**
 * Парсит строку диапазона Excel (например, "A1:B5") в объект с координатами
 * @param range - Строка диапазона в формате Excel (например, "A1:B5", "Sheet1!A1:B5")
 * @returns Объект с координатами начала и конца диапазона
 */
export function parseRange(range: string): {
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
  sheetName?: string;
} {
  // Удаляем имя листа, если оно есть (например, "Sheet1!A1:B5" -> "A1:B5")
  const rangeMatch = range.match(/^(?:([^!]+)!)?([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (!rangeMatch) {
    throw new Error(`Invalid range format: ${range}`);
  }

  const [, sheetName, startColStr, startRowStr, endColStr, endRowStr] = rangeMatch;
  
  return {
    sheetName: sheetName || undefined,
    startCol: columnToNumber(startColStr),
    startRow: parseInt(startRowStr, 10) - 1, // Excel использует 1-based индексы, мы используем 0-based
    endCol: columnToNumber(endColStr),
    endRow: parseInt(endRowStr, 10) - 1,
  };
}

/**
 * Преобразует буквенное обозначение столбца (A, B, ..., Z, AA, AB, ...) в число (0-based)
 * @param col - Буквенное обозначение столбца
 * @returns Число столбца (0-based)
 */
export function columnToNumber(col: string): number {
  let result = 0;
  for (let i = 0; i < col.length; i++) {
    result = result * 26 + (col.charCodeAt(i) - 64); // 'A' = 65, но нам нужно 1
  }
  return result - 1; // Возвращаем 0-based индекс
}

/**
 * Преобразует число столбца (0-based) в буквенное обозначение (A, B, ..., Z, AA, AB, ...)
 * @param num - Число столбца (0-based)
 * @returns Буквенное обозначение столбца
 */
export function numberToColumn(num: number): string {
  let result = '';
  num += 1; // Переходим к 1-based для вычислений
  while (num > 0) {
    num--;
    result = String.fromCharCode(65 + (num % 26)) + result;
    num = Math.floor(num / 26);
  }
  return result;
}

/**
 * Читает диапазон ячеек из Excel файла
 * @param filePath - Путь к файлу Excel
 * @param range - Диапазон ячеек в формате Excel (например, "A1:B5")
 * @param sheetName - Имя листа (опционально, по умолчанию первый лист)
 * @returns Двумерный массив значений ячеек
 */
export function getRange(
  filePath: string,
  range: string,
  sheetName?: string
): unknown[][] {
  const workbook = XLSX.readFile(filePath);
  const parsedRange = parseRange(range);
  
  // Используем указанный лист или лист из диапазона, или первый лист
  const targetSheetName = sheetName || parsedRange.sheetName || workbook.SheetNames[0];
  const sheet = workbook.Sheets[targetSheetName];
  
  if (!sheet) {
    throw new Error(`Sheet "${targetSheetName}" not found`);
  }

  const result: unknown[][] = [];
  
  // Читаем ячейки в указанном диапазоне
  for (let row = parsedRange.startRow; row <= parsedRange.endRow; row++) {
    const rowData: unknown[] = [];
    for (let col = parsedRange.startCol; col <= parsedRange.endCol; col++) {
      const cellRef = numberToColumn(col) + (row + 1); // Excel использует 1-based строки
      const cell = sheet[cellRef];
      rowData.push(cell ? (cell.v !== undefined ? cell.v : '') : '');
    }
    result.push(rowData);
  }
  
  return result;
}

/**
 * Читает диапазон ячеек из объекта листа XLSX
 * @param sheet - Объект листа XLSX
 * @param startRow - Начальная строка (1-based)
 * @param endRow - Конечная строка (1-based)
 * @param startCol - Начальный столбец (0-based, A=0, B=1, ...)
 * @param endCol - Конечный столбец (0-based)
 * @returns Двумерный массив значений ячеек
 */
export function getRangeFromSheet(
  sheet: XLSX.WorkSheet,
  startRow: number,
  endRow: number,
  startCol: number = 0,
  endCol: number = 1
): unknown[][] {
  const result: unknown[][] = [];
  
  for (let row = startRow; row <= endRow; row++) {
    const rowData: unknown[] = [];
    for (let col = startCol; col <= endCol; col++) {
      const cellRef = numberToColumn(col) + row;
      const cell = sheet[cellRef];
      rowData.push(cell ? (cell.v !== undefined ? cell.v : '') : '');
    }
    result.push(rowData);
  }
  
  return result;
}

/**
 * Обновляет значение ячейки в Excel файле
 * @param filePath - Путь к файлу Excel
 * @param cellRef - Ссылка на ячейку (например, "A2")
 * @param value - Новое значение
 * @param sheetName - Имя листа (опционально)
 */
export function updateCell(
  filePath: string,
  cellRef: string,
  value: unknown,
  sheetName?: string
): void {
  const workbook = XLSX.readFile(filePath);
  const targetSheetName = sheetName || workbook.SheetNames[0];
  const sheet = workbook.Sheets[targetSheetName];
  
  if (!sheet) {
    throw new Error(`Sheet "${targetSheetName}" not found`);
  }

  // Обновляем значение ячейки
  const isNewCell = !sheet[cellRef];
  if (isNewCell) {
    sheet[cellRef] = { t: 's', v: String(value) };
  } else {
    sheet[cellRef].v = value;
    // Обновляем тип ячейки в зависимости от значения
    if (typeof value === 'number') {
      sheet[cellRef].t = 'n';
    } else if (value instanceof Date) {
      sheet[cellRef].t = 'd';
    } else {
      sheet[cellRef].t = 's';
    }
  }

  // Если создана новая ячейка, обновляем диапазон листа
  if (isNewCell) {
    // Парсим ссылку на ячейку для определения координат
    const cellMatch = cellRef.match(/^([A-Z]+)(\d+)$/);
    if (cellMatch) {
      const col = cellMatch[1];
      const colNum = columnToNumber(col);
      const row = parseInt(cellMatch[2], 10);
      
      // Получаем текущий диапазон или создаем новый
      let range = sheet['!ref'];
      if (range) {
        // Парсим текущий диапазон (например, "A1:B5")
        const rangeMatch = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
        if (rangeMatch) {
          const startCol = rangeMatch[1];
          const startColNum = columnToNumber(startCol);
          const startRow = parseInt(rangeMatch[2], 10);
          const endCol = rangeMatch[3];
          const endColNum = columnToNumber(endCol);
          const endRow = parseInt(rangeMatch[4], 10);
          
          // Расширяем диапазон, если новая ячейка находится за его пределами
          const newStartColNum = startColNum < colNum ? startColNum : colNum;
          const newStartRow = startRow < row ? startRow : row;
          const newEndColNum = endColNum > colNum ? endColNum : colNum;
          const newEndRow = endRow > row ? endRow : row;
          
          const newStartCol = numberToColumn(newStartColNum);
          const newEndCol = numberToColumn(newEndColNum);
          
          sheet['!ref'] = `${newStartCol}${newStartRow}:${newEndCol}${newEndRow}`;
        }
      } else {
        // Если диапазона нет, создаем новый
        sheet['!ref'] = `${cellRef}:${cellRef}`;
      }
    }
  }

  // Сохраняем файл
  XLSX.writeFile(workbook, filePath);
}

/**
 * Обновляет значение ячейки в объекте листа XLSX (без сохранения файла)
 * @param sheet - Объект листа XLSX
 * @param cellRef - Ссылка на ячейку (например, "A2")
 * @param value - Новое значение
 */
export function updateCellInSheet(
  sheet: XLSX.WorkSheet,
  cellRef: string,
  value: unknown
): void {
  const isNewCell = !sheet[cellRef];
  if (isNewCell) {
    sheet[cellRef] = { t: 's', v: String(value) };
  } else {
    sheet[cellRef].v = value;
    // Обновляем тип ячейки в зависимости от значения
    if (typeof value === 'number') {
      sheet[cellRef].t = 'n';
    } else if (value instanceof Date) {
      sheet[cellRef].t = 'd';
    } else {
      sheet[cellRef].t = 's';
    }
  }

  // Если создана новая ячейка, обновляем диапазон листа
  if (isNewCell) {
    const cellMatch = cellRef.match(/^([A-Z]+)(\d+)$/);
    if (cellMatch) {
      const col = cellMatch[1];
      const colNum = columnToNumber(col);
      const row = parseInt(cellMatch[2], 10);
      
      let range = sheet['!ref'];
      if (range) {
        const rangeMatch = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
        if (rangeMatch) {
          const startCol = rangeMatch[1];
          const startColNum = columnToNumber(startCol);
          const startRow = parseInt(rangeMatch[2], 10);
          const endCol = rangeMatch[3];
          const endColNum = columnToNumber(endCol);
          const endRow = parseInt(rangeMatch[4], 10);
          
          const newStartColNum = startColNum < colNum ? startColNum : colNum;
          const newStartRow = startRow < row ? startRow : row;
          const newEndColNum = endColNum > colNum ? endColNum : colNum;
          const newEndRow = endRow > row ? endRow : row;
          
          const newStartCol = numberToColumn(newStartColNum);
          const newEndCol = numberToColumn(newEndColNum);
          
          sheet['!ref'] = `${newStartCol}${newStartRow}:${newEndCol}${newEndRow}`;
        }
      } else {
        sheet['!ref'] = `${cellRef}:${cellRef}`;
      }
    }
  }
}

/**
 * Обновляет ячейку с подтверждением
 * @param confirmCallback - Функция подтверждения, возвращает true если подтверждено
 * @param filePath - Путь к файлу Excel
 * @param cellRef - Ссылка на ячейку
 * @param value - Новое значение
 * @param sheetName - Имя листа (опционально)
 * @returns true если обновление выполнено, false если отменено
 */
export async function updateCellWithConfirmation(
  confirmCallback: (message: string) => boolean | Promise<boolean>,
  filePath: string,
  cellRef: string,
  value: unknown,
  sheetName?: string
): Promise<boolean> {
  const confirmed = await confirmCallback('Are you sure you want to update this cell?');
  if (!confirmed) {
    return false;
  }
  
  updateCell(filePath, cellRef, value, sheetName);
  return true;
}

/**
 * Форматирует данные таблицы в markdown для отображения в чате
 * @param data - Двумерный массив данных
 * @param headers - Заголовки столбцов (опционально)
 * @returns Строка в формате markdown таблицы
 */
export function formatTablePreview(
  data: unknown[][],
  headers?: string[]
): string {
  if (data.length === 0) {
    return 'Таблица пуста';
  }

  let result = '';
  
  // Добавляем заголовки, если они предоставлены
  if (headers && headers.length > 0) {
    result += '| ' + headers.join(' | ') + ' |\n';
    result += '|' + headers.map(() => '---').join('|') + '|\n';
  }

  // Добавляем данные
  for (const row of data) {
    result += '| ' + row.map(cell => String(cell || '')).join(' | ') + ' |\n';
  }

  return result.trim();
}

/**
 * Парсит упоминание диапазона из текста (например, "@Sheet1!A1:B3")
 * @param text - Текст с упоминанием диапазона
 * @returns Массив найденных упоминаний диапазонов
 */
export function parseRangeMentions(text: string): Array<{
  fullMatch: string;
  sheetName?: string;
  range: string;
}> {
  // Паттерн для упоминаний: @SheetName!A1:B3 или @A1:B3
  const mentionRegex = /@(?:([^!]+)!)?([A-Z]+\d+:[A-Z]+\d+)/g;
  const mentions: Array<{ fullMatch: string; sheetName?: string; range: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push({
      fullMatch: match[0],
      sheetName: match[1] || undefined,
      range: match[2],
    });
  }

  return mentions;
}

