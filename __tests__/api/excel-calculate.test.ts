/**
 * Интеграционные тесты для Excel Calculate API
 */

import { POST } from "@/app/api/excel/calculate/route";
import { NextRequest } from "next/server";

describe("API /api/excel/calculate", () => {
  describe("POST", () => {
    it("should calculate sum", async () => {
      const url = new URL("http://localhost:3000/api/excel/calculate");
      const request = new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({
          range: "Sheet1!A1:A3",
          operation: "sum",
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.operation).toBe("sum");
      expect(typeof data.result).toBe("number");
    });

    it("should return 400 if range is missing", async () => {
      const url = new URL("http://localhost:3000/api/excel/calculate");
      const request = new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({
          operation: "sum",
        }),
      });
      const response = await POST(request);
      
      expect(response.status).toBe(400);
    });

    it("should return 400 if operation is missing", async () => {
      const url = new URL("http://localhost:3000/api/excel/calculate");
      const request = new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({
          range: "Sheet1!A1:A3",
        }),
      });
      const response = await POST(request);
      
      expect(response.status).toBe(400);
    });

    it("should return 400 for invalid operation", async () => {
      const url = new URL("http://localhost:3000/api/excel/calculate");
      const request = new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({
          range: "Sheet1!A1:A3",
          operation: "invalid",
        }),
      });
      const response = await POST(request);
      
      expect(response.status).toBe(400);
    });
  });
});

