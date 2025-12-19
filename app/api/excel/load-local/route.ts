import { NextRequest, NextResponse } from 'next/server';
import { ExcelService } from '@/lib/excel-service';
import { createErrorResponse, ErrorType } from '@/lib/error-handler';
import * as fs from 'fs';
import * as path from 'path';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { filename } = body;

    if (!filename) {
      return createErrorResponse({
        type: ErrorType.VALIDATION,
        message: 'filename is required',
        statusCode: 400,
        retryable: false,
      });
    }

    const projectRoot = process.cwd();
    const filePath = path.join(projectRoot, filename);

    if (!fs.existsSync(filePath)) {
      return createErrorResponse({
        type: ErrorType.NOT_FOUND,
        message: `File not found: ${filename}`,
        statusCode: 404,
        retryable: false,
      });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const excelService = new ExcelService();
    const result = await excelService.processExcelFile(fileBuffer, filename, { saveToDb: true });

    if (!result.fileId) {
      return createErrorResponse({
        type: ErrorType.INTERNAL_ERROR,
        message: 'Failed to save Excel file to database',
        statusCode: 500,
        retryable: false,
      });
    }

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
    console.error('[Excel Load Local Error]', errorMessage);

    return createErrorResponse({
      type: ErrorType.INTERNAL_ERROR,
      message: `Failed to load Excel file: ${errorMessage}`,
      statusCode: 500,
      retryable: false,
    });
  }
}

