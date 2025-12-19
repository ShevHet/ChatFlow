import { NextRequest, NextResponse } from 'next/server';
import { ExcelService } from '@/lib/excel-service';
import { createErrorResponse, ErrorType } from '@/lib/error-handler';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return createErrorResponse({
        type: ErrorType.VALIDATION,
        message: 'File is required',
        statusCode: 400,
        retryable: false,
      });
    }

    // Проверяем тип файла
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'application/vnd.ms-excel.sheet.macroEnabled.12', // .xlsm
    ];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv|xlsm)$/i)) {
      return createErrorResponse({
        type: ErrorType.VALIDATION,
        message: 'Invalid file type. Only Excel files (.xlsx, .xls, .csv, .xlsm) are allowed',
        statusCode: 400,
        retryable: false,
      });
    }

    // Конвертируем File в Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Обрабатываем файл
    const excelService = new ExcelService();
    const result = await excelService.processExcelFile(buffer, file.name, { saveToDb: true });

    if (!result.fileId) {
      return createErrorResponse({
        type: ErrorType.INTERNAL_ERROR,
        message: 'Failed to save Excel file to database',
        statusCode: 500,
        retryable: false,
      });
    }

    // Получаем метаданные файла
    const metadata = excelService.getExcelFileMetadata(result.fileId);

    return NextResponse.json({
      success: true,
      fileId: result.fileId,
      metadata,
      result: {
        rowsProcessed: result.rowsProcessed,
        rowsSaved: result.rowsSaved,
        rowsWithErrors: result.rowsWithErrors,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Excel Upload Error]', errorMessage);

    return createErrorResponse({
      type: ErrorType.INTERNAL_ERROR,
      message: `Failed to upload Excel file: ${errorMessage}`,
      statusCode: 500,
      retryable: false,
    });
  }
}

