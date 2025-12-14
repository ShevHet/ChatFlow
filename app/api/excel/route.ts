import { NextRequest, NextResponse } from "next/server";
import { excelService } from "@/lib/excel-service";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const range = searchParams.get("range") || "Sheet1!A1:D5";
    const result = await excelService.readRange(range);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error reading Excel file:", error);
    return NextResponse.json(
      { error: error.message || "Failed to read Excel file" },
      { status: error.message?.includes("not found") ? 404 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { range, value, values } = body;

    if (!range) {
      return NextResponse.json(
        { error: "Range is required" },
        { status: 400 }
      );
    }

    const result = await excelService.writeRange(range, value, values);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error updating Excel file:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update Excel file" },
      { status: 500 }
    );
  }
}
