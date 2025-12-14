/**
 * Юнит-тесты для ExcelService
 */

import { ExcelService } from "@/lib/excel-service";
import { promises as fs } from "fs";
import path from "path";

describe("ExcelService", () => {
  const testFilePath = path.join(__dirname, "../test-excel.xlsx");
  let excelService: ExcelService;

  beforeEach(() => {
    excelService = new ExcelService(testFilePath);
  });

  afterEach(async () => {
    // Удаляем тестовый файл после каждого теста
    try {
      await fs.unlink(testFilePath);
    } catch {
      // Файл может не существовать
    }
  });

  describe("ensureFile", () => {
    it("should create file if it doesn't exist", async () => {
      await excelService.ensureFile();
      const exists = await fs.access(testFilePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe("readRange", () => {
    beforeEach(async () => {
      await excelService.ensureFile();
    });

    it("should read a single cell", async () => {
      const result = await excelService.readRange("Sheet1!A1");
      expect(result.sheet).toBe("Sheet1");
      expect(result.range).toBe("A1");
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveLength(1);
    });

    it("should read a range", async () => {
      const result = await excelService.readRange("Sheet1!A1:B2");
      expect(result.sheet).toBe("Sheet1");
      expect(result.range).toBe("A1:B2");
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toHaveLength(2);
    });

    it("should throw error for non-existent sheet", async () => {
      await expect(excelService.readRange("NonExistent!A1")).rejects.toThrow();
    });
  });

  describe("writeRange", () => {
    beforeEach(async () => {
      await excelService.ensureFile();
    });

    it("should write a single cell value", async () => {
      const result = await excelService.writeRange("Sheet1!A1", "Test Value");
      expect(result.success).toBe(true);
      
      const readResult = await excelService.readRange("Sheet1!A1");
      expect(readResult.data[0][0]).toBe("Test Value");
    });

    it("should write multiple values", async () => {
      const values = [["A", "B"], ["C", "D"]];
      const result = await excelService.writeRange("Sheet1!A1:B2", undefined, values);
      expect(result.success).toBe(true);
      
      const readResult = await excelService.readRange("Sheet1!A1:B2");
      expect(readResult.data).toEqual(values);
    });

    it("should throw error if neither value nor values provided", async () => {
      await expect(excelService.writeRange("Sheet1!A1")).rejects.toThrow();
    });
  });

  describe("calculateSum", () => {
    beforeEach(async () => {
      await excelService.ensureFile();
      // Записываем тестовые числовые значения
      await excelService.writeRange("Sheet1!A1", 10);
      await excelService.writeRange("Sheet1!A2", 20);
      await excelService.writeRange("Sheet1!A3", 30);
    });

    it("should calculate sum of numeric cells", async () => {
      const sum = await excelService.calculateSum("Sheet1!A1:A3");
      expect(sum).toBe(60);
    });

    it("should ignore non-numeric cells", async () => {
      await excelService.writeRange("Sheet1!A4", "Text");
      const sum = await excelService.calculateSum("Sheet1!A1:A4");
      expect(sum).toBe(60); // Только числовые значения
    });
  });

  describe("calculateAverage", () => {
    beforeEach(async () => {
      await excelService.ensureFile();
      await excelService.writeRange("Sheet1!A1", 10);
      await excelService.writeRange("Sheet1!A2", 20);
      await excelService.writeRange("Sheet1!A3", 30);
    });

    it("should calculate average of numeric cells", async () => {
      const avg = await excelService.calculateAverage("Sheet1!A1:A3");
      expect(avg).toBe(20);
    });
  });

  describe("calculateMin", () => {
    beforeEach(async () => {
      await excelService.ensureFile();
      await excelService.writeRange("Sheet1!A1", 30);
      await excelService.writeRange("Sheet1!A2", 10);
      await excelService.writeRange("Sheet1!A3", 20);
    });

    it("should find minimum value", async () => {
      const min = await excelService.calculateMin("Sheet1!A1:A3");
      expect(min).toBe(10);
    });
  });

  describe("calculateMax", () => {
    beforeEach(async () => {
      await excelService.ensureFile();
      await excelService.writeRange("Sheet1!A1", 10);
      await excelService.writeRange("Sheet1!A2", 30);
      await excelService.writeRange("Sheet1!A3", 20);
    });

    it("should find maximum value", async () => {
      const max = await excelService.calculateMax("Sheet1!A1:A3");
      expect(max).toBe(30);
    });
  });
});

