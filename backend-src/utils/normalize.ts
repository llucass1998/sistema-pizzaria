export function normalizeText(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

export function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

export function parseMoney(value: unknown) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  const numericText = text.replace(/[^\d,.-]/g, '');
  const normalized = numericText.includes(',')
    ? numericText.replace(/\./g, '').replace(',', '.')
    : numericText;
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed.toFixed(2) : null;
}

export function normalizeBarcode(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}
