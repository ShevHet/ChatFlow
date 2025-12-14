"use client";

import { useState, useEffect } from "react";
import { ExcelData, ExcelViewerState } from "@/lib/types";
import { parseRange } from "@/lib/excel-utils";

interface ExcelViewerProps {
  range: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectRange?: (range: string) => void;
  highlightRange?: string;
}

export default function ExcelViewer({
  range,
  isOpen,
  onClose,
  onSelectRange,
  highlightRange,
}: ExcelViewerProps) {
  const [data, setData] = useState<ExcelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  const [startCell, setStartCell] = useState<{ row: number; col: number } | null>(null);
  const [highlightedCells, setHighlightedCells] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && range) {
      loadData(range);
      // Сбрасываем выделение при открытии
      setSelectedCells(new Set());
      setHighlightedCells(new Set());
    }
  }, [isOpen, range]);

  // Подсветка диапазона при открытии
  useEffect(() => {
    if (highlightRange && data) {
      const highlighted = parseRangeToCells(highlightRange, data);
      setHighlightedCells(highlighted);
    }
  }, [highlightRange, data]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const loadData = async (rangeStr: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/excel?range=${encodeURIComponent(rangeStr)}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        console.error("Failed to load Excel data");
      }
    } catch (error) {
      console.error("Error loading Excel data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Конвертация координат в адрес ячейки (A1, B2, etc.)
  const cellToAddress = (row: number, col: number): string => {
    let colStr = "";
    let colNum = col;
    while (colNum >= 0) {
      colStr = String.fromCharCode(65 + (colNum % 26)) + colStr;
      colNum = Math.floor(colNum / 26) - 1;
    }
    return `${colStr}${row + 1}`;
  };

  // Парсинг диапазона в набор ячеек для подсветки
  const parseRangeToCells = (rangeStr: string, excelData: ExcelData): Set<string> => {
    const { sheet, range: rangePart } = parseRange(rangeStr);
    if (sheet !== excelData.sheet) {
      return new Set();
    }

    const cells = new Set<string>();
    const [start, end] = rangePart.split(":").map((s) => s.trim());
    
    // Парсинг адресов ячеек
    const parseCellAddress = (addr: string): { row: number; col: number } => {
      const match = addr.match(/^([A-Z]+)(\d+)$/);
      if (!match) return { row: 0, col: 0 };
      const colStr = match[1];
      const rowNum = parseInt(match[2], 10) - 1;
      let colNum = 0;
      for (let i = 0; i < colStr.length; i++) {
        colNum = colNum * 26 + (colStr.charCodeAt(i) - 64);
      }
      return { row: rowNum, col: colNum - 1 };
    };

    const startCoords = parseCellAddress(start);
    const endCoords = end ? parseCellAddress(end) : startCoords;

    // Определяем смещение относительно загруженных данных
    const { range: dataRange } = excelData;
    const [dataStart] = dataRange.split(":").map((s) => s.trim());
    const dataStartCoords = parseCellAddress(dataStart);

    // Вычисляем относительные координаты
    for (let row = startCoords.row; row <= endCoords.row; row++) {
      for (let col = startCoords.col; col <= endCoords.col; col++) {
        const relRow = row - dataStartCoords.row;
        const relCol = col - dataStartCoords.col;
        if (relRow >= 0 && relCol >= 0) {
          cells.add(`${relRow},${relCol}`);
        }
      }
    }

    return cells;
  };

  // Парсинг буквенной колонки в число
  const parseCol = (colStr: string): number => {
    let colNum = 0;
    for (let i = 0; i < colStr.length; i++) {
      colNum = colNum * 26 + (colStr.charCodeAt(i) - 64);
    }
    return colNum - 1;
  };

  const handleCellMouseDown = (row: number, col: number) => {
    setSelecting(true);
    setStartCell({ row, col });
    setSelectedCells(new Set([`${row},${col}`]));
  };

  const handleCellMouseEnter = (row: number, col: number) => {
    if (selecting && startCell) {
      const newSelected = new Set<string>();
      const minRow = Math.min(startCell.row, row);
      const maxRow = Math.max(startCell.row, row);
      const minCol = Math.min(startCell.col, col);
      const maxCol = Math.max(startCell.col, col);

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          newSelected.add(`${r},${c}`);
        }
      }
      setSelectedCells(newSelected);
    }
  };

  const handleMouseUp = () => {
    if (selecting && startCell && data) {
      const selectedArray = Array.from(selectedCells);
      if (selectedArray.length > 0) {
        const coords = selectedArray.map((cell) => {
          const [r, c] = cell.split(",").map(Number);
          return { row: r, col: c };
        });
        const minRow = Math.min(...coords.map((c) => c.row));
        const maxRow = Math.max(...coords.map((c) => c.row));
        const minCol = Math.min(...coords.map((c) => c.col));
        const maxCol = Math.max(...coords.map((c) => c.col));

        const startAddr = cellToAddress(minRow, minCol);
        const endAddr = cellToAddress(maxRow, maxCol);
        const rangeStr =
          startAddr === endAddr
            ? `${data.sheet}!${startAddr}`
            : `${data.sheet}!${startAddr}:${endAddr}`;

        if (onSelectRange) {
          onSelectRange(rangeStr);
        }
      }
    }
    setSelecting(false);
    setStartCell(null);
  };

  const handleUseRange = () => {
    if (selectedCells.size > 0 && data) {
      const selectedArray = Array.from(selectedCells);
      const coords = selectedArray.map((cell) => {
        const [r, c] = cell.split(",").map(Number);
        return { row: r, col: c };
      });
      const minRow = Math.min(...coords.map((c) => c.row));
      const maxRow = Math.max(...coords.map((c) => c.row));
      const minCol = Math.min(...coords.map((c) => c.col));
      const maxCol = Math.max(...coords.map((c) => c.col));

      const startAddr = cellToAddress(minRow, minCol);
      const endAddr = cellToAddress(maxRow, maxCol);
      const rangeStr =
        startAddr === endAddr
          ? `${data.sheet}!${startAddr}`
          : `${data.sheet}!${startAddr}:${endAddr}`;

      if (onSelectRange) {
        onSelectRange(rangeStr);
      }
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            Таблица: {data?.sheet} ({data?.range})
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-auto border border-gray-300 rounded">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Загрузка...</div>
          ) : data && data.data.length > 0 ? (
            <table className="w-full border-collapse">
              <tbody>
                {data.data.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {row.map((cell, colIdx) => {
                      const cellKey = `${rowIdx},${colIdx}`;
                      const isSelected = selectedCells.has(cellKey);
                      const isHighlighted = highlightedCells.has(cellKey);
                      return (
                        <td
                          key={colIdx}
                          className={`border border-gray-200 px-3 py-2 text-sm ${
                            isSelected
                              ? "bg-blue-400 border-blue-600"
                              : isHighlighted
                              ? "bg-yellow-200 border-yellow-400"
                              : "bg-white hover:bg-gray-50"
                          } cursor-cell select-none transition-colors`}
                          onMouseDown={() => handleCellMouseDown(rowIdx, colIdx)}
                          onMouseEnter={() => handleCellMouseEnter(rowIdx, colIdx)}
                          onMouseUp={handleMouseUp}
                          title={`Ячейка ${cellToAddress(rowIdx, colIdx)}`}
                        >
                          {cell}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-gray-500">
              Нет данных для отображения
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {selectedCells.size > 0 && (
              <span className="text-blue-600 font-semibold">
                Выбрано ячеек: {selectedCells.size}
              </span>
            )}
            {highlightRange && (
              <span className="ml-4 text-yellow-600">
                Подсвечен диапазон: {highlightRange}
              </span>
            )}
          </div>
          <div className="flex space-x-3">
            {selectedCells.size > 0 && (
              <button
                onClick={handleUseRange}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
              >
                Использовать выбранный диапазон
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}





