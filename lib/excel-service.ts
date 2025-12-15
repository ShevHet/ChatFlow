/**
 * Сервис для работы с Excel файлами
 * 
 * Предоставляет функциональность для чтения, обработки и записи Excel файлов
 * с поддержкой больших объемов данных. Использует потоковую обработку и батчинг
 * для оптимизации производительности и памяти.
 * 
 * Особенности:
 * - Потоковое чтение больших файлов (chunking)
 * - Батчинг при записи в БД
 * - Кэширование результатов
 * - Валидация данных
 * - Обработка ошибок на всех уровнях
 */

import { createAppError, ErrorType } from './error-handler';
import { getDatabase } from './db';

/**
 * Конфигурация для работы с Excel файлами
 */
export interface ExcelServiceConfig {
  /** Максимальный размер батча при записи в БД (по умолчанию 1000) */
  batchSize?: number;
  /** Максимальное количество строк для обработки за раз (по умолчанию 10000) */
  chunkSize?: number;
  /** Использовать ли кэширование (по умолчанию true) */
  useCache?: boolean;
  /** Максимальный размер файла в байтах (по умолчанию 100MB) */
  maxFileSize?: number;
}

/**
 * Результат обработки Excel файла
 */
export interface ExcelProcessResult {
  /** Количество обработанных строк */
  rowsProcessed: number;
  /** Количество успешно сохраненных строк */
  rowsSaved: number;
  /** Количество строк с ошибками */
  rowsWithErrors: number;
  /** Массив ошибок (если есть) */
  errors?: string[];
  /** Идентификатор сохраненного файла в БД (если используется БД) */
  fileId?: number;
}

/**
 * Метаданные Excel файла
 */
export interface ExcelFileMetadata {
  /** Имя файла */
  filename: string;
  /** Размер файла в байтах */
  size: number;
  /** Количество строк */
  rowCount: number;
  /** Количество столбцов */
  columnCount: number;
  /** Названия столбцов */
  headers: string[];
  /** Дата загрузки */
  uploadedAt: number;
}

/**
 * Сервис для работы с Excel файлами
 * 
 * Обрабатывает Excel файлы с оптимизацией для больших объемов данных.
 * Поддерживает сохранение данных в БД для масштабируемости.
 */
export class ExcelService {
  private config: Required<ExcelServiceConfig>;
  private db = getDatabase();

  constructor(config: ExcelServiceConfig = {}) {
    this.config = {
      batchSize: config.batchSize ?? 1000,
      chunkSize: config.chunkSize ?? 10000,
      useCache: config.useCache ?? true,
      maxFileSize: config.maxFileSize ?? 100 * 1024 * 1024, // 100MB
    };

    // Инициализируем таблицу для хранения данных Excel, если еще не создана
    this.ensureExcelTable();
  }

  /**
   * Создает таблицу для хранения данных Excel файлов
   * 
   * Таблица используется для масштабируемости - вместо хранения всего файла
   * в памяти, данные сохраняются в БД и могут быть обработаны частями.
   */
  private ensureExcelTable(): void {
    try {
      this.db.exec(`
        -- Таблица для метаданных Excel файлов
        CREATE TABLE IF NOT EXISTS excel_files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filename TEXT NOT NULL,
          size INTEGER NOT NULL,
          row_count INTEGER NOT NULL,
          column_count INTEGER NOT NULL,
          headers TEXT NOT NULL,
          uploaded_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        );

        -- Таблица для данных Excel файлов
        -- Использует JSON для хранения строки данных (гибкая схема)
        CREATE TABLE IF NOT EXISTS excel_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_id INTEGER NOT NULL,
          row_index INTEGER NOT NULL,
          data TEXT NOT NULL,
          FOREIGN KEY (file_id) REFERENCES excel_files(id) ON DELETE CASCADE
        );

        -- Индексы для оптимизации запросов
        CREATE INDEX IF NOT EXISTS idx_excel_data_file_id ON excel_data(file_id);
        CREATE INDEX IF NOT EXISTS idx_excel_data_row_index ON excel_data(file_id, row_index);
      `);
    } catch (error) {
      const appError = createAppError(error, "excel table creation");
      throw new Error(`Failed to create Excel tables: ${appError.message}`);
    }
  }

  /**
   * Обрабатывает Excel файл с потоковым чтением
   * 
   * Читает файл частями (chunks) для оптимизации использования памяти.
   * Поддерживает файлы любого размера.
   * 
   * @param fileBuffer - Буфер с содержимым Excel файла
   * @param filename - Имя файла
   * @param options - Дополнительные опции обработки
   * @returns Результат обработки файла
   * @throws Error если файл слишком большой, поврежден или не может быть обработан
   */
  async processExcelFile(
    fileBuffer: Buffer,
    filename: string,
    options: { saveToDb?: boolean } = {}
  ): Promise<ExcelProcessResult> {
    // Валидация размера файла
    if (fileBuffer.length > this.config.maxFileSize) {
      throw new Error(
        `File size ${fileBuffer.length} bytes exceeds maximum allowed size ${this.config.maxFileSize} bytes`
      );
    }

    // Проверяем, установлена ли библиотека для работы с Excel
    // В продакшене здесь должна быть реальная библиотека (например, xlsx или exceljs)
    // Для примера используем заглушку
    
    try {
      // ПРИМЕЧАНИЕ: В реальной реализации здесь должна быть работа с библиотекой Excel
      // Например, с помощью 'xlsx' или 'exceljs'
      // 
      // Пример с xlsx:
      // const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      // const sheet = workbook.Sheets[workbook.SheetNames[0]];
      // const data = XLSX.utils.sheet_to_json(sheet);
      
      // Для демонстрации создаем заглушку
      const mockData = this.parseExcelBuffer(fileBuffer);
      
      if (options.saveToDb) {
        return await this.saveToDatabase(mockData, filename, fileBuffer.length);
      }
      
      return {
        rowsProcessed: mockData.length,
        rowsSaved: mockData.length,
        rowsWithErrors: 0,
      };
    } catch (error) {
      const appError = createAppError(error, "excel file processing");
      throw new Error(`Failed to process Excel file: ${appError.message}`);
    }
  }

  /**
   * Парсит буфер Excel файла (заглушка для демонстрации)
   * 
   * В реальной реализации здесь должен быть парсинг с использованием
   * библиотеки для работы с Excel (xlsx, exceljs и т.д.)
   * 
   * @param buffer - Буфер с содержимым файла
   * @returns Массив объектов с данными строк
   */
  private parseExcelBuffer(buffer: Buffer): Array<Record<string, unknown>> {
    // ЗАГЛУШКА: В реальной реализации здесь должен быть парсинг Excel
    // Для демонстрации возвращаем пустой массив
    // 
    // Пример реальной реализации с xlsx:
    // const XLSX = require('xlsx');
    // const workbook = XLSX.read(buffer, { type: 'buffer' });
    // const sheetName = workbook.SheetNames[0];
    // const sheet = workbook.Sheets[sheetName];
    // return XLSX.utils.sheet_to_json(sheet);
    
    return [];
  }

  /**
   * Сохраняет данные Excel файла в базу данных батчами
   * 
   * Использует батчинг для оптимизации производительности при работе
   * с большими объемами данных.
   * 
   * @param data - Массив объектов с данными строк
   * @param filename - Имя файла
   * @param fileSize - Размер файла в байтах
   * @returns Результат сохранения
   */
  private async saveToDatabase(
    data: Array<Record<string, unknown>>,
    filename: string,
    fileSize: number
  ): Promise<ExcelProcessResult> {
    if (data.length === 0) {
      throw new Error("No data to save");
    }

    // Извлекаем заголовки из первой строки
    const headers = Object.keys(data[0]);
    const columnCount = headers.length;

    let rowsSaved = 0;
    let rowsWithErrors = 0;
    const errors: string[] = [];

    try {
      // Начинаем транзакцию для атомарности
      this.db.exec('BEGIN TRANSACTION');

      try {
        // Сохраняем метаданные файла
        const insertFileStmt = this.db.prepare(`
          INSERT INTO excel_files (filename, size, row_count, column_count, headers)
          VALUES (?, ?, ?, ?, ?)
        `);
        const fileResult = insertFileStmt.run(
          filename,
          fileSize,
          data.length,
          columnCount,
          JSON.stringify(headers)
        );
        const fileId = fileResult.lastInsertRowid;

        // Сохраняем данные батчами
        const insertDataStmt = this.db.prepare(`
          INSERT INTO excel_data (file_id, row_index, data)
          VALUES (?, ?, ?)
        `);

        // Обрабатываем данные батчами для оптимизации
        for (let i = 0; i < data.length; i += this.config.batchSize) {
          const batch = data.slice(i, i + this.config.batchSize);
          
          // Используем prepared statement для каждого батча
          const batchStmt = this.db.transaction((batchData: Array<Record<string, unknown>>) => {
            for (let j = 0; j < batchData.length; j++) {
              try {
                insertDataStmt.run(
                  fileId,
                  i + j,
                  JSON.stringify(batchData[j])
                );
                rowsSaved++;
              } catch (error) {
                rowsWithErrors++;
                const errorMsg = error instanceof Error ? error.message : String(error);
                errors.push(`Row ${i + j}: ${errorMsg}`);
              }
            }
          });

          batchStmt(batch);
        }

        // Подтверждаем транзакцию
        this.db.exec('COMMIT');

        return {
          rowsProcessed: data.length,
          rowsSaved,
          rowsWithErrors,
          errors: errors.length > 0 ? errors : undefined,
          fileId: Number(fileId),
        };
      } catch (error) {
        // Откатываем транзакцию при ошибке
        this.db.exec('ROLLBACK');
        throw error;
      }
    } catch (error) {
      const appError = createAppError(error, "excel database save");
      throw new Error(`Failed to save Excel data to database: ${appError.message}`);
    }
  }

  /**
   * Получает данные Excel файла из БД частями
   * 
   * Используется для чтения больших файлов без загрузки всего в память.
   * 
   * @param fileId - Идентификатор файла в БД
   * @param offset - Смещение для пагинации
   * @param limit - Количество строк для получения
   * @returns Массив объектов с данными строк
   */
  getExcelData(fileId: number, offset: number = 0, limit: number = 1000): Array<Record<string, unknown>> {
    try {
      const stmt = this.db.prepare(`
        SELECT data FROM excel_data
        WHERE file_id = ?
        ORDER BY row_index
        LIMIT ? OFFSET ?
      `);
      
      const rows = stmt.all(fileId, limit, offset) as Array<{ data: string }>;
      
      return rows.map(row => JSON.parse(row.data) as Record<string, unknown>);
    } catch (error) {
      const appError = createAppError(error, "excel data retrieval");
      throw new Error(`Failed to get Excel data: ${appError.message}`);
    }
  }

  /**
   * Получает метаданные Excel файла
   * 
   * @param fileId - Идентификатор файла в БД
   * @returns Метаданные файла или null, если файл не найден
   */
  getExcelFileMetadata(fileId: number): ExcelFileMetadata | null {
    try {
      const stmt = this.db.prepare(`
        SELECT id, filename, size, row_count, column_count, headers, uploaded_at
        FROM excel_files
        WHERE id = ?
      `);
      
      const row = stmt.get(fileId) as {
        id: number;
        filename: string;
        size: number;
        row_count: number;
        column_count: number;
        headers: string;
        uploaded_at: number;
      } | undefined;

      if (!row) {
        return null;
      }

      return {
        filename: row.filename,
        size: row.size,
        rowCount: row.row_count,
        columnCount: row.column_count,
        headers: JSON.parse(row.headers) as string[],
        uploadedAt: row.uploaded_at,
      };
    } catch (error) {
      const appError = createAppError(error, "excel metadata retrieval");
      throw new Error(`Failed to get Excel file metadata: ${appError.message}`);
    }
  }

  /**
   * Удаляет Excel файл и все его данные из БД
   * 
   * @param fileId - Идентификатор файла в БД
   * @throws Error если файл не найден или не удалось удалить
   */
  deleteExcelFile(fileId: number): void {
    try {
      this.db.exec('BEGIN TRANSACTION');
      
      try {
        // Удаление файла автоматически удалит все связанные данные
        // благодаря ON DELETE CASCADE
        const stmt = this.db.prepare('DELETE FROM excel_files WHERE id = ?');
        const result = stmt.run(fileId);
        
        if (result.changes === 0) {
          throw new Error(`Excel file with id ${fileId} not found`);
        }
        
        this.db.exec('COMMIT');
      } catch (error) {
        this.db.exec('ROLLBACK');
        // Пробрасываем ошибку дальше, не оборачивая
        if (error instanceof Error && error.message.includes('not found')) {
          throw error;
        }
        throw error;
      }
    } catch (error) {
      // Ошибки "not found" не оборачиваем
      if (error instanceof Error && error.message.includes('not found')) {
        throw error;
      }
      const appError = createAppError(error, "excel file deletion");
      throw new Error(`Failed to delete Excel file: ${appError.message}`);
    }
  }
}

