/**
 * Юнит-тесты для excel-utils
 */

import {
  parseRange,
  formatRange,
  isRangeMention,
  extractRangeMentions,
  isValidRange,
  normalizeRange,
} from "@/lib/excel-utils";

describe("excel-utils", () => {
  describe("parseRange", () => {
    it("should parse range with sheet name", () => {
      const result = parseRange("Sheet1!A1:B3");
      expect(result.sheet).toBe("Sheet1");
      expect(result.range).toBe("A1:B3");
    });

    it("should default to Sheet1 if no sheet specified", () => {
      const result = parseRange("A1:B3");
      expect(result.sheet).toBe("Sheet1");
      expect(result.range).toBe("A1:B3");
    });
  });

  describe("formatRange", () => {
    it("should format range with sheet name", () => {
      const result = formatRange("Sheet1", "A1:B3");
      expect(result).toBe("Sheet1!A1:B3");
    });
  });

  describe("isRangeMention", () => {
    it("should detect range mention", () => {
      expect(isRangeMention("@Sheet1!A1:B3")).toBe(true);
      expect(isRangeMention("Not a mention")).toBe(false);
    });
  });

  describe("extractRangeMentions", () => {
    it("should extract range mentions from text", () => {
      const text = "Check @Sheet1!A1:B3 and @Sheet2!C1:D2";
      const mentions = extractRangeMentions(text);
      expect(mentions).toEqual(["Sheet1!A1:B3", "Sheet2!C1:D2"]);
    });

    it("should return empty array if no mentions", () => {
      const text = "No mentions here";
      const mentions = extractRangeMentions(text);
      expect(mentions).toEqual([]);
    });
  });

  describe("isValidRange", () => {
    it("should validate single cell", () => {
      expect(isValidRange("Sheet1!A1")).toBe(true);
    });

    it("should validate range", () => {
      expect(isValidRange("Sheet1!A1:B3")).toBe(true);
    });

    it("should reject invalid range", () => {
      expect(isValidRange("Sheet1!Invalid")).toBe(false);
    });
  });

  describe("normalizeRange", () => {
    it("should normalize range", () => {
      const result = normalizeRange("sheet1!a1:b3");
      expect(result).toBe("sheet1!A1:B3");
    });
  });
});

