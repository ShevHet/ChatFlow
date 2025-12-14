/**
 * API роут для вычислений в Excel
 * Поддерживает: SUM, AVERAGE, MIN, MAX
 */

import { NextRequest, NextResponse } from "next/server";
import { excelService } from "@/lib/excel-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { range, operation } = body;

    if (!range) {
      return NextResponse.json(
        { error: "Range is required" },
        { status: 400 }
      );
    }

    if (!operation) {
      return NextResponse.json(
        { error: "Operation is required (sum, average, min, max)" },
        { status: 400 }
      );
    }

    let result: number | null;

    switch (operation.toLowerCase()) {
      case "sum":
        result = await excelService.calculateSum(range);
        break;
      case "average":
        result = await excelService.calculateAverage(range);
        break;
      case "min":
        result = await excelService.calculateMin(range);
        break;
      case "max":
        result = await excelService.calculateMax(range);
        break;
      default:
        return NextResponse.json(
          { error: "Invalid operation. Use: sum, average, min, max" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      operation: operation.toLowerCase(),
      range,
      result,
    });
  } catch (error: any) {
    console.error("Error calculating Excel data:", error);
    return NextResponse.json(
      { error: error.message || "Failed to calculate" },
      { status: 500 }
    );
  }
}

