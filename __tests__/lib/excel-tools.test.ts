/**
 * Тесты для утилит работы с Excel файлами
 * 
 * Покрывает все требования из промпта для тестирования функций работы с XLSX-таблицей
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import {
  getRange,
  getRangeFromSheet,
  updateCell,
  updateCellInSheet,
  updateCellWithConfirmation,
  formatTablePreview,
  parseRangeMentions,
  parseRange,
  columnToNumber,
  numberToColumn,
} from '@/lib/excel-tools';

const TEMP_DIR = path.join(os.tmpdir(), 'chatflow-excel-tests');
const ensureTempDir = () => {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
  return TEMP_DIR;
};
const tempPath = (name: string) => path.join(ensureTempDir(), name);

// Путь к тестовому файлу Excel
const TEST_EXCEL_FILE = tempPath('test-data.xlsx');
const TEST_EXCEL_FILE_COPY = tempPath('test-data-copy.xlsx');

describe('Excel Tools', () => {
  // Создаем тестовый Excel файл перед всеми тестами
  beforeAll(() => {
    ensureTempDir();
    // Создаем тестовый файл с данными
    const workbook = XLSX.utils.book_new();
    const testData = [
      ['Email', 'Sum'],
      ['email1@example.com', 100],
      ['email2@example.com', 150],
      ['email3@example.com', 200],
      ['email4@example.com', 250],
      ['email5@example.com', 300],
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(testData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    
    // Сохраняем файл
    XLSX.writeFile(workbook, TEST_EXCEL_FILE);
  });

  // Копируем файл перед каждым тестом для изоляции
  beforeEach(async () => {
    // Удаляем старую копию, если она существует
    if (fs.existsSync(TEST_EXCEL_FILE_COPY)) {
      try {
        fs.unlinkSync(TEST_EXCEL_FILE_COPY);
      } catch (e) {
        // Игнорируем ошибки удаления
      }
    }
    
    if (fs.existsSync(TEST_EXCEL_FILE)) {
      try {
        // Используем асинхронное копирование для Windows
        await fs.promises.copyFile(TEST_EXCEL_FILE, TEST_EXCEL_FILE_COPY);
      } catch (e) {
        // Если не удалось скопировать, создаем новый файл
        try {
          const workbook = XLSX.readFile(TEST_EXCEL_FILE);
          await new Promise<void>((resolve, reject) => {
            try {
              XLSX.writeFile(workbook, TEST_EXCEL_FILE_COPY);
              // Небольшая задержка для Windows
              setTimeout(resolve, 10);
            } catch (err) {
              reject(err);
            }
          });
        } catch (writeError) {
          // Игнорируем ошибки записи
        }
      }
    }
  });

  // Удаляем копию после каждого теста
  afterEach(() => {
    if (fs.existsSync(TEST_EXCEL_FILE_COPY)) {
      fs.unlinkSync(TEST_EXCEL_FILE_COPY);
    }
  });

  // Удаляем тестовый файл после всех тестов
  afterAll(() => {
    if (fs.existsSync(TEST_EXCEL_FILE)) {
      fs.unlinkSync(TEST_EXCEL_FILE);
    }
    if (fs.existsSync(TEST_EXCEL_FILE_COPY)) {
      fs.unlinkSync(TEST_EXCEL_FILE_COPY);
    }
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  });

  describe('1. Тестирование чтения диапазона ячеек (getRange)', () => {
    it('should read the range A1:B5 correctly from the XLSX file', () => {
      const range = getRange(TEST_EXCEL_FILE, 'A1:B5');
      
      expect(range).toBeDefined();
      expect(range.length).toBe(5);
      expect(range[0]).toEqual(['Email', 'Sum']);
      expect(range[1]).toEqual(['email1@example.com', 100]);
      expect(range[2]).toEqual(['email2@example.com', 150]);
    });

    it('should read range with sheet name', () => {
      const range = getRange(TEST_EXCEL_FILE, 'Sheet1!A1:B3');
      
      expect(range).toBeDefined();
      expect(range.length).toBe(3);
      expect(range[0]).toEqual(['Email', 'Sum']);
    });

    it('should read single cell range', () => {
      const range = getRange(TEST_EXCEL_FILE, 'A1:A1');
      
      expect(range).toBeDefined();
      expect(range.length).toBe(1);
      expect(range[0]).toEqual(['Email']);
    });

    it('should handle empty cells correctly', () => {
      // Создаем файл с пустыми ячейками
      const workbook = XLSX.utils.book_new();
      const testData = [
        ['A', 'B', 'C'],
        ['1', '', '3'],
        ['', '2', ''],
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(testData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      const tempFile = tempPath(`temp-${randomUUID()}.xlsx`);
      XLSX.writeFile(workbook, tempFile);

      const range = getRange(tempFile, 'A1:C2');
      
      expect(range[0]).toEqual(['A', 'B', 'C']);
      expect(range[1]).toEqual(['1', '', '3']);
      
      fs.unlinkSync(tempFile);
    });
  });

  describe('2. Тестирование записи в ячейку (updateCell)', () => {
    it('should update cell correctly in the XLSX file', () => {
      updateCell(TEST_EXCEL_FILE_COPY, 'A2', 'new-email@example.com');
      
      // Проверяем, что значение обновилось
      const workbook = XLSX.readFile(TEST_EXCEL_FILE_COPY);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const updatedCell = sheet['A2'];
      
      expect(updatedCell).toBeDefined();
      expect(updatedCell.v).toBe('new-email@example.com');
    });

    it('should update numeric cell', () => {
      updateCell(TEST_EXCEL_FILE_COPY, 'B2', 999);
      
      const workbook = XLSX.readFile(TEST_EXCEL_FILE_COPY);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const updatedCell = sheet['B2'];
      
      expect(updatedCell.v).toBe(999);
      expect(updatedCell.t).toBe('n'); // number type
    });

    it('should create new cell if it does not exist', () => {
      updateCell(TEST_EXCEL_FILE_COPY, 'Z100', 'new cell value');
      
      const workbook = XLSX.readFile(TEST_EXCEL_FILE_COPY);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const newCell = sheet['Z100'];
      
      expect(newCell).toBeDefined();
      expect(newCell.v).toBe('new cell value');
    });

    it('should update cell in specific sheet', () => {
      // Создаем файл с несколькими листами
      const workbook = XLSX.utils.book_new();
      const sheet1 = XLSX.utils.aoa_to_sheet([['A1', 'B1']]);
      const sheet2 = XLSX.utils.aoa_to_sheet([['A2', 'B2']]);
      XLSX.utils.book_append_sheet(workbook, sheet1, 'Sheet1');
      XLSX.utils.book_append_sheet(workbook, sheet2, 'Sheet2');
      const tempFile = tempPath(`temp-${randomUUID()}.xlsx`);
      XLSX.writeFile(workbook, tempFile);

      updateCell(tempFile, 'A1', 'Updated', 'Sheet2');
      
      const updatedWorkbook = XLSX.readFile(tempFile);
      const updatedSheet2 = updatedWorkbook.Sheets['Sheet2'];
      expect(updatedSheet2['A1'].v).toBe('Updated');
      
      // Sheet1 не должен измениться
      const originalSheet1 = updatedWorkbook.Sheets['Sheet1'];
      expect(originalSheet1['A1'].v).toBe('A1');
      
      fs.unlinkSync(tempFile);
    });
  });

  describe('3. Тестирование подтверждения записи', () => {
    it('should require confirmation before updating the cell', async () => {
      const mockConfirm = jest.fn(() => true);
      
      const result = await updateCellWithConfirmation(
        mockConfirm,
        TEST_EXCEL_FILE_COPY,
        'A2',
        'confirmed-email@example.com'
      );
      
      expect(mockConfirm).toHaveBeenCalledWith('Are you sure you want to update this cell?');
      expect(result).toBe(true);
      
      // Проверяем, что ячейка обновилась
      const workbook = XLSX.readFile(TEST_EXCEL_FILE_COPY);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      expect(sheet['A2'].v).toBe('confirmed-email@example.com');
    });

    it('should not update cell if confirmation is rejected', async () => {
      const mockConfirm = jest.fn(() => false);
      const originalValue = getRange(TEST_EXCEL_FILE_COPY, 'A2:A2')[0][0];
      
      const result = await updateCellWithConfirmation(
        mockConfirm,
        TEST_EXCEL_FILE_COPY,
        'A2',
        'should-not-update@example.com'
      );
      
      expect(mockConfirm).toHaveBeenCalled();
      expect(result).toBe(false);
      
      // Проверяем, что ячейка не изменилась
      const workbook = XLSX.readFile(TEST_EXCEL_FILE_COPY);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      expect(sheet['A2'].v).toBe(originalValue);
    });

    it('should handle async confirmation callback', async () => {
      const mockConfirm = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return true;
      });
      
      const result = await updateCellWithConfirmation(
        mockConfirm,
        TEST_EXCEL_FILE_COPY,
        'A2',
        'async-confirmed@example.com'
      );
      
      expect(result).toBe(true);
      expect(mockConfirm).toHaveBeenCalled();
    });
  });

  describe('4. Тестирование визуализации таблицы в чате', () => {
    it('should render table preview correctly in the chat', () => {
      const data = [
        ['email1@example.com', 100],
        ['email2@example.com', 150],
      ];
      
      const tablePreview = formatTablePreview(data, ['Email', 'Sum']);
      
      expect(tablePreview).toContain('email1@example.com');
      expect(tablePreview).toContain('100');
      expect(tablePreview).toContain('email2@example.com');
      expect(tablePreview).toContain('150');
      expect(tablePreview).toContain('|');
      expect(tablePreview).toContain('Email');
      expect(tablePreview).toContain('Sum');
    });

    it('should render table without headers', () => {
      const data = [
        ['email1@example.com', 100],
        ['email2@example.com', 150],
      ];
      
      const tablePreview = formatTablePreview(data);
      
      expect(tablePreview).toContain('email1@example.com');
      expect(tablePreview).toContain('100');
      expect(tablePreview).not.toContain('Email'); // Нет заголовков
    });

    it('should handle empty table', () => {
      const tablePreview = formatTablePreview([]);
      
      expect(tablePreview).toBe('Таблица пуста');
    });

    it('should handle empty cells in table', () => {
      const data = [
        ['email1@example.com', ''],
        ['', 150],
      ];
      
      const tablePreview = formatTablePreview(data, ['Email', 'Sum']);
      
      expect(tablePreview).toContain('email1@example.com');
      expect(tablePreview).toContain('150');
    });
  });

  describe('5. Тестирование работы с getRangeFromSheet', () => {
    it('should read range from sheet object', () => {
      const workbook = XLSX.readFile(TEST_EXCEL_FILE);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      
      const range = getRangeFromSheet(sheet, 1, 5, 0, 1); // A1:B5 (1-based rows, 0-based cols)
      
      expect(range).toBeDefined();
      expect(range.length).toBe(5);
      expect(range[0]).toEqual(['Email', 'Sum']);
      expect(range[1]).toEqual(['email1@example.com', 100]);
    });

    it('should handle single row range', () => {
      const workbook = XLSX.readFile(TEST_EXCEL_FILE);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      
      const range = getRangeFromSheet(sheet, 1, 1, 0, 1);
      
      expect(range.length).toBe(1);
      expect(range[0]).toEqual(['Email', 'Sum']);
    });
  });

  describe('6. Тестирование работы с меншонами диапазонов', () => {
    it('should parse range mention from text', () => {
      const text = 'Check the range @Sheet1!A1:B3';
      const mentions = parseRangeMentions(text);
      
      expect(mentions).toHaveLength(1);
      expect(mentions[0].fullMatch).toBe('@Sheet1!A1:B3');
      expect(mentions[0].sheetName).toBe('Sheet1');
      expect(mentions[0].range).toBe('A1:B3');
    });

    it('should parse range mention without sheet name', () => {
      const text = 'Look at @A1:B3';
      const mentions = parseRangeMentions(text);
      
      expect(mentions).toHaveLength(1);
      expect(mentions[0].fullMatch).toBe('@A1:B3');
      expect(mentions[0].sheetName).toBeUndefined();
      expect(mentions[0].range).toBe('A1:B3');
    });

    it('should parse multiple range mentions', () => {
      const text = 'Check @Sheet1!A1:B3 and @Sheet2!C1:D5';
      const mentions = parseRangeMentions(text);
      
      expect(mentions).toHaveLength(2);
      expect(mentions[0].sheetName).toBe('Sheet1');
      expect(mentions[1].sheetName).toBe('Sheet2');
    });

    it('should return empty array if no mentions found', () => {
      const text = 'No mentions here';
      const mentions = parseRangeMentions(text);
      
      expect(mentions).toHaveLength(0);
    });
  });

  describe('7. Тестирование вспомогательных функций', () => {
    describe('parseRange', () => {
      it('should parse simple range', () => {
        const parsed = parseRange('A1:B5');
        
        expect(parsed.startCol).toBe(0); // A = 0
        expect(parsed.startRow).toBe(0); // 1-based to 0-based
        expect(parsed.endCol).toBe(1); // B = 1
        expect(parsed.endRow).toBe(4); // 5-based to 0-based
      });

      it('should parse range with sheet name', () => {
        const parsed = parseRange('Sheet1!A1:B5');
        
        expect(parsed.sheetName).toBe('Sheet1');
        expect(parsed.startCol).toBe(0);
      });

      it('should throw error for invalid range', () => {
        expect(() => parseRange('invalid')).toThrow('Invalid range format');
      });
    });

    describe('columnToNumber and numberToColumn', () => {
      it('should convert column letters to numbers', () => {
        expect(columnToNumber('A')).toBe(0);
        expect(columnToNumber('B')).toBe(1);
        expect(columnToNumber('Z')).toBe(25);
        expect(columnToNumber('AA')).toBe(26);
        expect(columnToNumber('AB')).toBe(27);
      });

      it('should convert numbers to column letters', () => {
        expect(numberToColumn(0)).toBe('A');
        expect(numberToColumn(1)).toBe('B');
        expect(numberToColumn(25)).toBe('Z');
        expect(numberToColumn(26)).toBe('AA');
        expect(numberToColumn(27)).toBe('AB');
      });

      it('should be reversible', () => {
        for (let i = 0; i < 100; i++) {
          const col = numberToColumn(i);
          const num = columnToNumber(col);
          expect(num).toBe(i);
        }
      });
    });

    describe('updateCellInSheet', () => {
      it('should update cell in sheet object without saving file', () => {
        const workbook = XLSX.readFile(TEST_EXCEL_FILE);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const originalValue = sheet['A2']?.v;
        
        updateCellInSheet(sheet, 'A2', 'updated-in-memory');
        
        expect(sheet['A2'].v).toBe('updated-in-memory');
        
        // Проверяем, что файл не изменился
        const originalWorkbook = XLSX.readFile(TEST_EXCEL_FILE);
        const originalSheet = originalWorkbook.Sheets[originalWorkbook.SheetNames[0]];
        expect(originalSheet['A2']?.v).toBe(originalValue);
      });
    });
  });

  describe('8. Интеграционные тесты', () => {
    it('should read range, update cell, and read again', () => {
      // Читаем исходное значение
      const originalRange = getRange(TEST_EXCEL_FILE_COPY, 'A2:A2');
      const originalValue = originalRange[0][0];
      
      // Обновляем ячейку
      updateCell(TEST_EXCEL_FILE_COPY, 'A2', 'integration-test@example.com');
      
      // Читаем обновленное значение
      const updatedRange = getRange(TEST_EXCEL_FILE_COPY, 'A2:A2');
      expect(updatedRange[0][0]).toBe('integration-test@example.com');
      expect(updatedRange[0][0]).not.toBe(originalValue);
    });

    it('should format updated range as table preview', () => {
      // Обновляем несколько ячеек
      updateCell(TEST_EXCEL_FILE_COPY, 'A2', 'test1@example.com');
      updateCell(TEST_EXCEL_FILE_COPY, 'B2', 999);
      
      // Читаем диапазон
      const range = getRange(TEST_EXCEL_FILE_COPY, 'A1:B2');
      
      // Форматируем как таблицу
      const preview = formatTablePreview(range, ['Email', 'Sum']);
      
      expect(preview).toContain('test1@example.com');
      expect(preview).toContain('999');
    });
  });
});

