"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { ExcelFileMetadata } from '@/lib/excel-service';

export interface ExcelViewerProps {
  /** ID файла для отображения */
  fileId: number;
  /** Callback при выделении ячейки */
  onCellSelect?: (cellRef: string, value: unknown) => void;
  /** Callback при закрытии */
  onClose?: () => void;
  /** Максимальное количество строк для отображения за раз */
  pageSize?: number;
  /** Начальная ячейка для выделения (например, "A1", "B5") */
  initialSelectedCell?: string | null;
  /** Callback при вставке диапазона в чат */
  onInsertRange?: (rangeMention: string) => void;
  /** Имя листа для меншонов */
  sheetName?: string;
}

export interface ExcelCell {
  column: string;
  row: number;
  value: unknown;
  cellRef: string; // Например, "A1", "B2"
}

/**
 * Компонент для просмотра Excel файлов
 * 
 * Отображает таблицу с данными Excel файла с поддержкой:
 * - Выделения ячеек
 * - Пагинации для больших файлов
 * - Клавиатурной навигации
 * - Доступности (ARIA)
 */
export default function ExcelViewer({
  fileId,
  onCellSelect,
  onClose,
  pageSize = 100,
  initialSelectedCell,
  onInsertRange,
  sheetName = 'Sheet1',
}: ExcelViewerProps) {
  const [metadata, setMetadata] = useState<ExcelFileMetadata | null>(null);
  const [data, setData] = useState<Array<Record<string, unknown>>>([]);
  const [selectedCell, setSelectedCell] = useState<string | null>(initialSelectedCell || null);
  const [selectionStart, setSelectionStart] = useState<{ col: number; row: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ col: number; row: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const tableRef = useRef<HTMLTableElement>(null);

  // Обновляем выделенную ячейку при изменении initialSelectedCell
  useEffect(() => {
    if (initialSelectedCell) {
      setSelectedCell(initialSelectedCell);
      // Прокручиваем к нужной странице, если ячейка не на текущей странице
      const cellMatch = initialSelectedCell.match(/^([A-Z]+)(\d+)$/);
      if (cellMatch) {
        const rowNumber = parseInt(cellMatch[2], 10);
        const targetPage = Math.floor((rowNumber - 1) / pageSize);
        if (targetPage !== currentPage) {
          setCurrentPage(targetPage);
        }
      }
    }
  }, [initialSelectedCell, pageSize, currentPage]);

  // Загрузка данных файла
  useEffect(() => {
    loadExcelData();
  }, [fileId, currentPage]);

  const loadExcelData = async () => {
    setLoading(true);
    setError(null);

    try {
      const offset = currentPage * pageSize;
      const response = await fetch(
        `/api/excel/${fileId}?offset=${offset}&limit=${pageSize}`
      );

      if (!response.ok) {
        throw new Error(`Failed to load Excel file: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to load Excel file');
      }

      setMetadata(result.metadata);
      setData(result.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      console.error('Failed to load Excel data:', err);
    } finally {
      setLoading(false);
    }
  };

  const columnToNum = (col: string): number => {
    let num = 0;
    for (let i = 0; i < col.length; i++) {
      num = num * 26 + (col.charCodeAt(i) - 64);
    }
    return num - 1;
  };

  // Генерация ссылок на ячейки (A, B, C, ..., Z, AA, AB, ...)
  const getColumnLabel = useCallback((index: number): string => {
    let label = '';
    let num = index;
    while (num >= 0) {
      label = String.fromCharCode(65 + (num % 26)) + label;
      num = Math.floor(num / 26) - 1;
    }
    return label;
  }, []);

  const handleCellMouseDown = useCallback(
    (colIndex: number, rowIndex: number, e: React.MouseEvent) => {
      e.preventDefault();
      const actualRowIndex = currentPage * pageSize + rowIndex + 1;
      setSelectionStart({ col: colIndex, row: actualRowIndex });
      setSelectionEnd({ col: colIndex, row: actualRowIndex });
      setIsSelecting(true);
    },
    [currentPage, pageSize]
  );

  const handleCellMouseEnter = useCallback(
    (colIndex: number, rowIndex: number) => {
      if (isSelecting && selectionStart) {
        const actualRowIndex = currentPage * pageSize + rowIndex + 1;
        setSelectionEnd({ col: colIndex, row: actualRowIndex });
      }
    },
    [isSelecting, selectionStart, currentPage, pageSize]
  );

  const handleMouseUp = useCallback(() => {
    if (isSelecting && selectionStart && selectionEnd) {
      const minCol = Math.min(selectionStart.col, selectionEnd.col);
      const maxCol = Math.max(selectionStart.col, selectionEnd.col);
      const minRow = Math.min(selectionStart.row, selectionEnd.row);
      const maxRow = Math.max(selectionStart.row, selectionEnd.row);
      
      const startCellRef = `${getColumnLabel(minCol)}${minRow}`;
      const endCellRef = `${getColumnLabel(maxCol)}${maxRow}`;
      
      if (startCellRef === endCellRef) {
        setSelectedCell(startCellRef);
      } else {
        setSelectedCell(`${startCellRef}:${endCellRef}`);
      }
    }
    setIsSelecting(false);
  }, [isSelecting, selectionStart, selectionEnd, getColumnLabel]);

  useEffect(() => {
    const handleGlobalMouseUp = () => handleMouseUp();
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [handleMouseUp]);

  const isCellInSelection = useCallback(
    (colIndex: number, rowIndex: number): boolean => {
      if (!selectionStart || !selectionEnd) return false;
      const actualRowIndex = currentPage * pageSize + rowIndex + 1;
      const minCol = Math.min(selectionStart.col, selectionEnd.col);
      const maxCol = Math.max(selectionStart.col, selectionEnd.col);
      const minRow = Math.min(selectionStart.row, selectionEnd.row);
      const maxRow = Math.max(selectionStart.row, selectionEnd.row);
      return colIndex >= minCol && colIndex <= maxCol && actualRowIndex >= minRow && actualRowIndex <= maxRow;
    },
    [selectionStart, selectionEnd, currentPage, pageSize]
  );

  const handleInsertToChat = useCallback(() => {
    if (selectedCell && onInsertRange) {
      const rangeMention = `@${sheetName}!${selectedCell}`;
      onInsertRange(rangeMention);
    }
  }, [selectedCell, onInsertRange, sheetName]);

  // Обработка клика по ячейке
  const handleCellClick = useCallback(
    (column: string, rowIndex: number, value: unknown) => {
      const actualRowIndex = currentPage * pageSize + rowIndex + 1;
      const cellRef = `${column}${actualRowIndex}`;
      setSelectedCell(cellRef);
      setSelectionStart({ col: columnToNum(column), row: actualRowIndex });
      setSelectionEnd({ col: columnToNum(column), row: actualRowIndex });

      if (onCellSelect) {
        onCellSelect(cellRef, value);
      }
    },
    [currentPage, pageSize, onCellSelect]
  );

  if (loading && !metadata) {
    return (
      <div
        className="flex items-center justify-center p-8"
        role="status"
        aria-label="Загрузка Excel файла"
      >
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg"
        role="alert"
        aria-live="assertive"
      >
        <p className="font-semibold">Ошибка загрузки файла</p>
        <p>{error}</p>
        {onClose && (
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Закрыть
          </button>
        )}
      </div>
    );
  }

  if (!metadata || data.length === 0) {
    return (
      <div className="p-4 text-gray-600" role="status">
        Файл не содержит данных
      </div>
    );
  }

  const headers = metadata.headers;
  const totalPages = Math.ceil(metadata.rowCount / pageSize);
  const startRow = currentPage * pageSize + 1;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Заголовок */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{metadata.filename}</h2>
          <p className="text-sm text-gray-600">
            {metadata.rowCount} строк, {metadata.columnCount} столбцов
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
            aria-label="Закрыть просмотр Excel файла"
          >
            Закрыть
          </button>
        )}
      </div>

      {/* Таблица */}
      <div className="flex-1 overflow-auto">
        <table
          ref={tableRef}
          className="min-w-full border-collapse"
          role="table"
          aria-label={`Excel файл ${metadata.filename}`}
        >
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {/* Ячейка для номеров строк */}
              <th className="border border-gray-300 bg-gray-100 p-2 text-center font-semibold text-gray-700 min-w-[60px]">
                #
              </th>
              {headers.map((header, index) => {
                const columnLabel = getColumnLabel(index);
                return (
                  <th
                    key={index}
                    className="border border-gray-300 p-2 text-left font-semibold text-gray-700 min-w-[120px]"
                    scope="col"
                  >
                    <div className="flex items-center justify-between">
                      <span>{header}</span>
                      <span className="text-xs text-gray-500 ml-2">{columnLabel}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => {
              const actualRowNumber = startRow + rowIndex;
              return (
                <tr key={rowIndex} className="hover:bg-gray-50">
                  {/* Номер строки */}
                  <td className="border border-gray-300 bg-gray-100 p-2 text-center text-gray-600 font-semibold">
                    {actualRowNumber}
                  </td>
                  {headers.map((header, colIndex) => {
                    const columnLabel = getColumnLabel(colIndex);
                    const cellRef = `${columnLabel}${actualRowNumber}`;
                    const value = row[header] ?? '';
                    const isInSelection = isCellInSelection(colIndex, rowIndex);
                    const isSingleSelected = selectedCell === cellRef;

                    return (
                      <td
                        key={colIndex}
                        className={`border border-gray-300 p-2 cursor-pointer transition-colors select-none ${
                          isInSelection || isSingleSelected
                            ? 'bg-blue-200 ring-2 ring-blue-500'
                            : 'hover:bg-blue-50'
                        }`}
                        onMouseDown={(e) => handleCellMouseDown(colIndex, rowIndex, e)}
                        onMouseEnter={() => handleCellMouseEnter(colIndex, rowIndex)}
                        onClick={() => handleCellClick(columnLabel, rowIndex, value)}
                        role="gridcell"
                        aria-selected={isInSelection || isSingleSelected}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleCellClick(columnLabel, rowIndex, value);
                          }
                        }}
                        title={`${cellRef}: ${String(value)}`}
                      >
                        <div className="truncate" title={String(value)}>
                          {String(value)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Пагинация */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            Страница {currentPage + 1} из {totalPages}
            <span className="ml-2">
              (строки {startRow} - {Math.min(startRow + pageSize - 1, metadata.rowCount)})
            </span>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-500"
              aria-label="Предыдущая страница"
            >
              Предыдущая
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-500"
              aria-label="Следующая страница"
            >
              Следующая
            </button>
          </div>
        </div>
      )}

      {/* Информация о выделенной ячейке и кнопка вставки */}
      {selectedCell && (
        <div className="p-3 bg-blue-50 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Выбрана ячейка: <strong className="font-mono bg-blue-100 px-2 py-1 rounded">{selectedCell}</strong>
          </div>
          {onInsertRange && (
            <button
              onClick={handleInsertToChat}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center gap-2 text-sm font-medium transition-colors"
              title={`Вставить @${sheetName}!${selectedCell} в чат`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Вставить в чат
            </button>
          )}
        </div>
      )}
    </div>
  );
}

