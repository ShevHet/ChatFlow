import { NextRequest, NextResponse } from 'next/server';
import { ExcelService } from '@/lib/excel-service';
import { createErrorResponse, ErrorType } from '@/lib/error-handler';

/**
 * GET /api/excel/[fileId]
 * Получает метаданные и данные Excel файла
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> | { fileId: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const fileId = parseInt(resolvedParams.fileId, 10);

    if (isNaN(fileId) || fileId <= 0) {
      return createErrorResponse({
        type: ErrorType.VALIDATION,
        message: 'Invalid fileId',
        statusCode: 400,
        retryable: false,
      });
    }

    const excelService = new ExcelService();

    // Получаем метаданные
    const metadata = excelService.getExcelFileMetadata(fileId);

    if (!metadata) {
      return createErrorResponse({
        type: ErrorType.NOT_FOUND,
        message: `Excel file with id ${fileId} not found`,
        statusCode: 404,
        retryable: false,
      });
    }

    const searchParams = req.nextUrl.searchParams;

    // Если запрошен конкретный диапазон, возвращаем его данные и markdown-таблицу
    const rangeParam = searchParams.get('range');
    const formulaCell = searchParams.get('formula');
    const sheetParam = searchParams.get('sheetName') || undefined;
    if (rangeParam) {
      const rangeMatch = rangeParam.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
      if (!rangeMatch) {
        return createErrorResponse({
          type: ErrorType.VALIDATION,
          message: `Неверный формат диапазона: ${rangeParam}. Используйте формат A1:B5`,
          statusCode: 400,
          retryable: false,
        });
      }

      const [, startCol, startRowStr, endCol, endRowStr] = rangeMatch;
      const startRow = parseInt(startRowStr, 10);
      const endRow = parseInt(endRowStr, 10);

      const colToNum = (col: string): number => {
        let num = 0;
        for (let i = 0; i < col.length; i++) {
          num = num * 26 + (col.charCodeAt(i) - 64);
        }
        return num - 1;
      };

      const startColNum = colToNum(startCol.toUpperCase());
      const endColNum = colToNum(endCol.toUpperCase());

      const fileData = excelService.getExcelFileData(fileId);
      if (!fileData) {
        return createErrorResponse({
          type: ErrorType.NOT_FOUND,
          message: `Excel file with id ${fileId} not found`,
          statusCode: 404,
          retryable: false,
        });
      }

      const targetSheet = sheetParam || fileData.sheetName;
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

      return NextResponse.json({
        success: true,
        metadata,
        sheetName: targetSheet,
        range: rangeParam,
        data: rows,
        headers: rangeHeaders,
        markdownTable,
        rowCount: rows.length,
      });
    }

    // Объяснение формулы в ячейке
    if (formulaCell) {
      const cellMatch = formulaCell.match(/^([A-Z]+)(\d+)$/i);
      if (!cellMatch) {
        return createErrorResponse({
          type: ErrorType.VALIDATION,
          message: `Неверный формат ячейки: ${formulaCell}`,
          statusCode: 400,
          retryable: false,
        });
      }

      const [, col, rowStr] = cellMatch;
      const row = parseInt(rowStr, 10);
      const colToNum = (c: string): number => {
        let num = 0;
        for (let i = 0; i < c.length; i++) {
          num = num * 26 + (c.charCodeAt(i) - 64);
        }
        return num - 1;
      };

      const colNum = colToNum(col.toUpperCase());
      const fileData = excelService.getExcelFileData(fileId);
      if (!fileData) {
        return createErrorResponse({
          type: ErrorType.NOT_FOUND,
          message: `Excel file with id ${fileId} not found`,
          statusCode: 404,
          retryable: false,
        });
      }

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
        SUM: 'СУММА - складывает все числа в указанном диапазоне',
        AVERAGE: 'СРЗНАЧ - вычисляет среднее арифметическое чисел в диапазоне',
        MAX: 'МАКС - находит максимальное значение в диапазоне',
        MIN: 'МИН - находит минимальное значение в диапазоне',
        COUNT: 'СЧЁТ - подсчитывает количество ячеек с числами',
        IF: 'ЕСЛИ - выполняет логическую проверку',
        VLOOKUP: 'ВПР - ищет значение в первом столбце таблицы',
        CONCATENATE: 'СЦЕПИТЬ - объединяет текстовые строки',
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

      return NextResponse.json({
        success: true,
        metadata,
        fileId,
        sheetName: sheetParam || fileData.sheetName,
        cellRef: formulaCell,
        value: cellValue,
        explanation: formulaExplanation,
      });
    }

    // Пагинация по умолчанию
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '1000', 10);
    const data = excelService.getExcelData(fileId, offset, limit);

    return NextResponse.json({
      success: true,
      metadata,
      data,
      pagination: {
        offset,
        limit,
        total: metadata.rowCount,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Excel Get Error]', errorMessage);

    return createErrorResponse({
      type: ErrorType.INTERNAL_ERROR,
      message: `Failed to get Excel file: ${errorMessage}`,
      statusCode: 500,
      retryable: false,
    });
  }
}

/**
 * DELETE /api/excel/[fileId]
 * Удаляет Excel файл
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> | { fileId: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const fileId = parseInt(resolvedParams.fileId, 10);

    if (isNaN(fileId) || fileId <= 0) {
      return createErrorResponse({
        type: ErrorType.VALIDATION,
        message: 'Invalid fileId',
        statusCode: 400,
        retryable: false,
      });
    }

    const excelService = new ExcelService();
    excelService.deleteExcelFile(fileId);

    return NextResponse.json({
      success: true,
      message: `Excel file ${fileId} deleted successfully`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Проверяем, не ошибка ли "not found"
    if (errorMessage.includes('not found')) {
      return createErrorResponse({
        type: ErrorType.NOT_FOUND,
        message: errorMessage,
        statusCode: 404,
        retryable: false,
      });
    }

    console.error('[Excel Delete Error]', errorMessage);

    return createErrorResponse({
      type: ErrorType.INTERNAL_ERROR,
      message: `Failed to delete Excel file: ${errorMessage}`,
      statusCode: 500,
      retryable: false,
    });
  }
}

/**
 * PATCH /api/excel/[fileId]
 * Обновляет значение ячейки в Excel файле (используется после подтверждения действия)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> | { fileId: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const fileId = parseInt(resolvedParams.fileId, 10);

    if (isNaN(fileId) || fileId <= 0) {
      return createErrorResponse({
        type: ErrorType.VALIDATION,
        message: 'Invalid fileId',
        statusCode: 400,
        retryable: false,
      });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.cellRef !== 'string' || (typeof body.value !== 'string' && typeof body.value !== 'number')) {
      return createErrorResponse({
        type: ErrorType.VALIDATION,
        message: 'cellRef (string) и value (string | number) обязательны',
        statusCode: 400,
        retryable: false,
      });
    }

    const cellMatch = body.cellRef.match(/^([A-Z]+)(\d+)$/i);
    if (!cellMatch) {
      return createErrorResponse({
        type: ErrorType.VALIDATION,
        message: `Неверный формат ячейки: ${body.cellRef}`,
        statusCode: 400,
        retryable: false,
      });
    }

    const excelService = new ExcelService();
    const metadata = excelService.getExcelFileMetadata(fileId);
    if (!metadata) {
      return createErrorResponse({
        type: ErrorType.NOT_FOUND,
        message: `Excel file with id ${fileId} not found`,
        statusCode: 404,
        retryable: false,
      });
    }

    const [, col, rowStr] = cellMatch;
    const row = parseInt(rowStr, 10);
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
      return createErrorResponse({
        type: ErrorType.VALIDATION,
        message: `Колонка ${col} не найдена в файле`,
        statusCode: 400,
        retryable: false,
      });
    }

    const dataRowIndex = row - 2;
    if (dataRowIndex < 0) {
      return createErrorResponse({
        type: ErrorType.VALIDATION,
        message: 'Изменение заголовков не поддерживается',
        statusCode: 400,
        retryable: false,
      });
    }

    excelService.updateExcelCell(fileId, dataRowIndex, colKey, body.value);

    return NextResponse.json({
      success: true,
      fileId,
      cellRef: body.cellRef,
      newValue: body.value,
      message: `Ячейка ${body.cellRef} обновлена`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Excel Patch Error]', errorMessage);
    return createErrorResponse({
      type: ErrorType.INTERNAL_ERROR,
      message: `Failed to update Excel cell: ${errorMessage}`,
      statusCode: 500,
      retryable: false,
    });
  }
}

