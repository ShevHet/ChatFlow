/**
 * Интеграционные тесты для Excel API
 */

import { GET, POST } from "@/app/api/excel/route";
import { NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const EXCEL_FILE_PATH = path.join(process.cwd(), "test-excel-api.xlsx");

describe("API /api/excel", () => {
  beforeEach(async () => {
    // Удаляем тестовый файл перед каждым тестом
    try {
      await fs.unlink(EXCEL_FILE_PATH);
    } catch {
      // Файл может не существовать
    }
  });

  afterEach(async () => {
    // Удаляем тестовый файл после каждого теста
    try {
      await fs.unlink(EXCEL_FILE_PATH);
    } catch {
      // Файл может не существовать
    }
  });

  describe("GET", () => {
    it("should read range from Excel file", async () => {
      const url = new URL("http://localhost:3000/api/excel?range=Sheet1!A1:B2");
      const request = new NextRequest(url);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sheet).toBe("Sheet1");
      expect(data.range).toBe("A1:B2");
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("should return 404 for non-existent sheet", async () => {
      const url = new URL("http://localhost:3000/api/excel?range=NonExistent!A1");
      const request = new NextRequest(url);
      const response = await GET(request);
      
      expect(response.status).toBe(404);
    });
  });

  describe("POST", () => {
    it("should write value to cell", async () => {
      const url = new URL("http://localhost:3000/api/excel");
      const request = new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({
          range: "Sheet1!A1",
          value: "Test Value",
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should return 400 if range is missing", async () => {
      const url = new URL("http://localhost:3000/api/excel");
      const request = new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({
          value: "Test",
        }),
      });
      const response = await POST(request);
      
      expect(response.status).toBe(400);
    });
  });
});

