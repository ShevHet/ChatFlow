export function parseRange(rangeStr: string): { sheet: string; range: string } {
  const match = rangeStr.match(/^([^!]+)!(.+)$/);
  if (match) {
    return { sheet: match[1], range: match[2] };
  }
  return { sheet: "Sheet1", range: rangeStr };
}

export function formatRange(sheet: string, range: string): string {
  return `${sheet}!${range}`;
}

export function isRangeMention(text: string): boolean {
  return /@[^!]+![A-Z]+\d+(:[A-Z]+\d+)?/.test(text);
}

export function extractRangeMentions(text: string): string[] {
  const regex = /@([^!@\s]+![A-Z]+\d+(?::[A-Z]+\d+)?)/g;
  const matches = text.match(regex);
  return matches ? matches.map((m) => m.substring(1)) : [];
}

export function isValidRange(rangeStr: string): boolean {
  const { range } = parseRange(rangeStr);
  const cellRegex = /^[A-Z]+\d+$/;
  const rangeRegex = /^[A-Z]+\d+:[A-Z]+\d+$/;
  return cellRegex.test(range) || rangeRegex.test(range);
}

export function normalizeRange(rangeStr: string): string {
  const { sheet, range } = parseRange(rangeStr);
  const normalizedRange = range.replace(/\s+/g, "").toUpperCase();
  return formatRange(sheet, normalizedRange);
}
