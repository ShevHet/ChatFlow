const XLSX = require("xlsx");
import { promises as fs } from "fs";
import path from "path";
import { parseRange } from "./excel-utils";

const EXCEL_FILE_PATH = path.join(process.cwd(), "example.xlsx");

export interface ExcelCellCoords {
  row: number;
  col: number;
}

export interface ExcelRangeCoords {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface ExcelReadResult {
  sheet: string;
  range: string;
  data: (string | number)[][];
}

export interface ExcelWriteResult {
  success: boolean;
  message: string;
}

export class ExcelService {
  private filePath: string;

  constructor(filePath: string = EXCEL_FILE_PATH) {
    this.filePath = filePath;
  }

  async ensureFile(): Promise<void> {
    try {
      await fs.access(this.filePath);
    } catch {
      const data = [
        ["Имя", "Возраст", "Город", "Зарплата"],
        ["Иван", 25, "Москва", 50000],
        ["Мария", 30, "Санкт-Петербург", 60000],
        ["Петр", 28, "Казань", 55000],
        ["Анна", 32, "Новосибирск", 65000],
      ];
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
      XLSX.writeFile(workbook, this.filePath);
    }
  }

  private cellToCoords(cell: string): ExcelCellCoords {
    const match = cell.match(/^([A-Z]+)(\d+)$/);
    if (!match) throw new Error(`Invalid cell address: ${cell}`);
    const col = match[1]
      .split("")
      .reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1;
    const row = parseInt(match[2], 10) - 1;
    return { row, col };
  }

  private rangeToCoords(rangeStr: string): ExcelRangeCoords {
    const [start, end] = rangeStr.split(":").map((cell) => cell.trim());
    const startCoords = this.cellToCoords(start);
    const endCoords = end ? this.cellToCoords(end) : startCoords;
    return {
      startRow: startCoords.row,
      startCol: startCoords.col,
      endRow: endCoords.row,
      endCol: endCoords.col,
    };
  }

  async readRange(range: string): Promise<ExcelReadResult> {
    await this.ensureFile();
    const { sheet, range: rangeStr } = parseRange(range);

    const workbook = XLSX.readFile(this.filePath);
    const worksheet = workbook.Sheets[sheet];

    if (!worksheet) {
      throw new Error(`Sheet "${sheet}" not found`);
    }

    const coords = this.rangeToCoords(rangeStr);
    const data: (string | number)[][] = [];

    for (let row = coords.startRow; row <= coords.endRow; row++) {
      const rowData: (string | number)[] = [];
      for (let col = coords.startCol; col <= coords.endCol; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];
        rowData.push(cell ? cell.v : "");
      }
      data.push(rowData);
    }

    return {
      sheet,
      range: rangeStr,
      data,
    };
  }

  async writeRange(
    range: string,
    value?: string | number,
    values?: (string | number)[][]
  ): Promise<ExcelWriteResult> {
    await this.ensureFile();
    const { sheet, range: rangeStr } = parseRange(range);

    const workbook = XLSX.readFile(this.filePath);

    if (!workbook.Sheets[sheet]) {
      const newSheet = XLSX.utils.aoa_to_sheet([[]]);
      XLSX.utils.book_append_sheet(workbook, newSheet, sheet);
    }

    const worksheet = workbook.Sheets[sheet];

    if (values && Array.isArray(values)) {
      const coords = this.rangeToCoords(rangeStr);
      values.forEach((row: any[], rowIdx: number) => {
        if (Array.isArray(row)) {
          row.forEach((cellValue, colIdx) => {
            const rowNum = coords.startRow + rowIdx;
            const colNum = coords.startCol + colIdx;
            const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
            if (!worksheet[cellAddress]) {
              worksheet[cellAddress] = {};
            }
            worksheet[cellAddress].v = cellValue;
            worksheet[cellAddress].t =
              typeof cellValue === "number" ? "n" : "s";
          });
        }
      });
    } else if (value !== undefined) {
      const coords = this.cellToCoords(rangeStr);
      const cellAddress = XLSX.utils.encode_cell({ r: coords.row, c: coords.col });
      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = {};
      }
      worksheet[cellAddress].v = value;
      worksheet[cellAddress].t = typeof value === "number" ? "n" : "s";
    } else {
      throw new Error("Either 'value' or 'values' is required");
    }

    const rangeObj = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
    const newRange = XLSX.utils.encode_range(rangeObj);
    worksheet["!ref"] = newRange;

    XLSX.writeFile(workbook, this.filePath);

    return {
      success: true,
      message: `Updated ${range}`,
    };
  }

  async calculateSum(range: string): Promise<number> {
    const result = await this.readRange(range);
    let sum = 0;
    for (const row of result.data) {
      for (const cell of row) {
        if (typeof cell === "number") {
          sum += cell;
        }
      }
    }
    return sum;
  }

  async calculateAverage(range: string): Promise<number> {
    const result = await this.readRange(range);
    let sum = 0;
    let count = 0;
    for (const row of result.data) {
      for (const cell of row) {
        if (typeof cell === "number") {
          sum += cell;
          count++;
        }
      }
    }
    return count > 0 ? sum / count : 0;
  }

  async calculateMin(range: string): Promise<number | null> {
    const result = await this.readRange(range);
    let min: number | null = null;
    for (const row of result.data) {
      for (const cell of row) {
        if (typeof cell === "number") {
          if (min === null || cell < min) {
            min = cell;
          }
        }
      }
    }
    return min;
  }

  async calculateMax(range: string): Promise<number | null> {
    const result = await this.readRange(range);
    let max: number | null = null;
    for (const row of result.data) {
      for (const cell of row) {
        if (typeof cell === "number") {
          if (max === null || cell > max) {
            max = cell;
          }
        }
      }
    }
    return max;
  }
}

export const excelService = new ExcelService();

