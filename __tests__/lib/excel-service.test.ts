/**
 * Тесты для сервиса работы с Excel
 */

import { ExcelService } from '@/lib/excel-service';
import { Database } from 'bun:sqlite';

// Мокаем модуль db перед импортом ExcelService
jest.mock('@/lib/db', () => {
  const { Database } = require('bun:sqlite');
  const db = new Database(':memory:');
  
  // Инициализируем схему
  db.exec(`
    CREATE TABLE IF NOT EXISTS excel_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      size INTEGER NOT NULL,
      row_count INTEGER NOT NULL,
      column_count INTEGER NOT NULL,
      headers TEXT NOT NULL,
      uploaded_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS excel_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER NOT NULL,
      row_index INTEGER NOT NULL,
      data TEXT NOT NULL,
      FOREIGN KEY (file_id) REFERENCES excel_files(id) ON DELETE CASCADE
    );
  `);
  
  return {
    getDatabase: jest.fn(() => db),
  };
});

describe('ExcelService', () => {
  let excelService: ExcelService;
  let db: Database;

  beforeEach(() => {
    // Получаем db из мока
    const { getDatabase } = require('@/lib/db');
    db = getDatabase();

    excelService = new ExcelService({
      batchSize: 10,
      chunkSize: 100,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processExcelFile', () => {
    it('должен выбрасывать ошибку для файла, превышающего максимальный размер', async () => {
      const largeBuffer = Buffer.alloc(101 * 1024 * 1024); // 101MB
      
      await expect(
        excelService.processExcelFile(largeBuffer, 'large.xlsx')
      ).rejects.toThrow('exceeds maximum allowed size');
    });

    it('должен обрабатывать файл нормального размера', async () => {
      const buffer = Buffer.from('test data');
      
      const result = await excelService.processExcelFile(buffer, 'test.xlsx');
      
      expect(result.rowsProcessed).toBe(0); // Заглушка возвращает пустой массив
      expect(result.rowsSaved).toBe(0);
    });
  });

  describe('saveToDatabase', () => {
    it('должен сохранять данные в БД батчами', async () => {
      const mockData = Array.from({ length: 25 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: i * 10,
      }));

      const result = await (excelService as any).saveToDatabase(
        mockData,
        'test.xlsx',
        1024
      );

      expect(result.rowsSaved).toBe(25);
      expect(result.fileId).toBeDefined();

      // Проверяем, что данные сохранены в БД
      const fileStmt = db.prepare('SELECT * FROM excel_files WHERE id = ?');
      const file = fileStmt.get(result.fileId);
      
      expect(file).toBeDefined();
      expect((file as any).row_count).toBe(25);
    });

    it('должен обрабатывать ошибки при сохранении отдельных строк', async () => {
      // Создаем данные, которые могут вызвать ошибку
      const mockData = [
        { id: 1, name: 'Valid' },
        { id: 2, name: null }, // Может вызвать проблему
      ];

      // Мокаем insertDataStmt для симуляции ошибки
      const originalPrepare = db.prepare;
      let callCount = 0;
      
      db.prepare = jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('INSERT INTO excel_data')) {
          const stmt = originalPrepare.call(db, sql);
          return {
            ...stmt,
            run: jest.fn().mockImplementation((...args: unknown[]) => {
              callCount++;
              if (callCount === 2) {
                throw new Error('Database error');
              }
              return (stmt.run as (...args: unknown[]) => unknown).apply(stmt, args);
            }),
          };
        }
        return originalPrepare.call(db, sql);
      });

      const result = await (excelService as any).saveToDatabase(
        mockData,
        'test.xlsx',
        1024
      );

      expect(result.rowsWithErrors).toBeGreaterThan(0);
    });
  });

  describe('getExcelData', () => {
    it('должен получать данные из БД с пагинацией', async () => {
      // Создаем тестовые данные
      const insertFileStmt = db.prepare(`
        INSERT INTO excel_files (filename, size, row_count, column_count, headers)
        VALUES (?, ?, ?, ?, ?)
      `);
      const fileResult = insertFileStmt.run('test.xlsx', 1024, 5, 2, '["id","name"]');
      const fileId = Number(fileResult.lastInsertRowid);

      const insertDataStmt = db.prepare(`
        INSERT INTO excel_data (file_id, row_index, data)
        VALUES (?, ?, ?)
      `);

      for (let i = 0; i < 5; i++) {
        insertDataStmt.run(fileId, i, JSON.stringify({ id: i, name: `Item ${i}` }));
      }

      // Получаем данные с пагинацией
      const data = excelService.getExcelData(fileId, 0, 3);
      
      expect(data).toHaveLength(3);
      expect(data[0]).toEqual({ id: 0, name: 'Item 0' });
    });

    it('должен возвращать пустой массив для несуществующего файла', () => {
      const data = excelService.getExcelData(99999);
      
      expect(data).toHaveLength(0);
    });
  });

  describe('getExcelFileMetadata', () => {
    it('должен возвращать метаданные файла', () => {
      const insertStmt = db.prepare(`
        INSERT INTO excel_files (filename, size, row_count, column_count, headers)
        VALUES (?, ?, ?, ?, ?)
      `);
      const result = insertStmt.run(
        'test.xlsx',
        1024,
        100,
        5,
        '["col1","col2","col3","col4","col5"]'
      );
      const fileId = Number(result.lastInsertRowid);

      const metadata = excelService.getExcelFileMetadata(fileId);

      expect(metadata).not.toBeNull();
      expect(metadata?.filename).toBe('test.xlsx');
      expect(metadata?.rowCount).toBe(100);
      expect(metadata?.columnCount).toBe(5);
      expect(metadata?.headers).toHaveLength(5);
    });

    it('должен возвращать null для несуществующего файла', () => {
      const metadata = excelService.getExcelFileMetadata(99999);
      
      expect(metadata).toBeNull();
    });
  });

  describe('deleteExcelFile', () => {
    it('должен удалять файл и все связанные данные', () => {
      // Создаем файл с данными
      const insertFileStmt = db.prepare(`
        INSERT INTO excel_files (filename, size, row_count, column_count, headers)
        VALUES (?, ?, ?, ?, ?)
      `);
      const fileResult = insertFileStmt.run('test.xlsx', 1024, 2, 2, '["id","name"]');
      const fileId = Number(fileResult.lastInsertRowid);

      const insertDataStmt = db.prepare(`
        INSERT INTO excel_data (file_id, row_index, data)
        VALUES (?, ?, ?)
      `);
      insertDataStmt.run(fileId, 0, '{"id":1}');
      insertDataStmt.run(fileId, 1, '{"id":2}');

      // Удаляем файл
      excelService.deleteExcelFile(fileId);

      // Проверяем, что файл удален
      const fileStmt = db.prepare('SELECT * FROM excel_files WHERE id = ?');
      const file = fileStmt.get(fileId);
      expect(file).toBeUndefined();

      // Проверяем, что данные тоже удалены (CASCADE)
      const dataStmt = db.prepare('SELECT * FROM excel_data WHERE file_id = ?');
      const data = dataStmt.all(fileId);
      expect(data).toHaveLength(0);
    });

    it('должен выбрасывать ошибку при попытке удалить несуществующий файл', () => {
      expect(() => {
        excelService.deleteExcelFile(99999);
      }).toThrow('not found');
    });
  });
});

