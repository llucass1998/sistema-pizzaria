import { describe, it, expect } from 'vitest';
import {
  sanitizeCsvField,
  formatCsvCurrency,
  formatCsvDate,
  generateSafeCsv,
} from './csvSanitizer.js';

describe('CSV Sanitizer Utility', () => {
  it('should leave normal strings unchanged', () => {
    expect(sanitizeCsvField('Pizza Margherita')).toBe('Pizza Margherita');
    expect(sanitizeCsvField('Joao Silva')).toBe('Joao Silva');
    expect(sanitizeCsvField(123.45)).toBe('123.45');
  });

  it('should prefix dangerous CSV characters with single quote', () => {
    expect(sanitizeCsvField('=1+1')).toBe("'=1+1");
    expect(sanitizeCsvField("=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0");
    expect(sanitizeCsvField('+1234567890')).toBe("'+1234567890");
    expect(sanitizeCsvField('-100')).toBe("'-100");
    expect(sanitizeCsvField('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
    expect(sanitizeCsvField('\tDangerous Tab')).toBe("'\tDangerous Tab");
  });

  it('should handle null, undefined or empty strings', () => {
    expect(sanitizeCsvField(null)).toBe('');
    expect(sanitizeCsvField(undefined)).toBe('');
    expect(sanitizeCsvField('   ')).toBe('');
  });

  it('should format currency correctly without symbol', () => {
    expect(formatCsvCurrency(1250.5)).toBe('1250,50');
    expect(formatCsvCurrency(0)).toBe('0,00');
  });

  it('should format dates correctly for CSV', () => {
    expect(formatCsvDate(null)).toBe('');
    expect(formatCsvDate('data-invalida')).toBe('');
    const date = new Date(Date.UTC(2026, 6, 3, 12, 0, 0)); // 2026-07-03 12:00 UTC
    expect(formatCsvDate(date)).toContain('03/07/2026');
  });

  it('should generate safe CSV with UTF-8 BOM and escaped cells', () => {
    const headers = ['Nome', 'Observação'];
    const rows = [
      ['Joao', 'Normal text'],
      ['Maria', "=cmd|' /C calc'!A0"],
      ['Carlos', 'He said "Hello"'],
    ];

    const csv = generateSafeCsv(headers, rows);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Joao";"Normal text"');
    expect(csv).toContain('"Maria";"\'=cmd|\' /C calc\'!A0"');
    expect(csv).toContain('"Carlos";"He said ""Hello"""');
  });
});
