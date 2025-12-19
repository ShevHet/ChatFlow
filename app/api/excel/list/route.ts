import { NextResponse } from 'next/server';
import { ExcelService } from '@/lib/excel-service';
import { createErrorResponse, ErrorType } from '@/lib/error-handler';

/**
 * GET /api/excel/list
 * Получает список всех загруженных Excel файлов
 */
export async function GET() {
  try {
    const excelService = new ExcelService();
    const files = excelService.getAllExcelFiles();

    return NextResponse.json({
      success: true,
      files,
      count: files.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Excel List Error]', errorMessage);

    return createErrorResponse({
      type: ErrorType.INTERNAL_ERROR,
      message: `Failed to get Excel files list: ${errorMessage}`,
      statusCode: 500,
      retryable: false,
    });
  }
}

