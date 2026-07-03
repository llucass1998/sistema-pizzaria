import { describe, it, expect } from 'vitest';
import {
  parsePeriodDateRange,
  getDateRangeForPeriod,
  normalizeBrazilDateRange,
  createBrazilDate,
  getBrazilDateParts,
} from './timezone.js';

describe('Timezone Utility (America/Sao_Paulo)', () => {
  it('should get correct date parts in America/Sao_Paulo', () => {
    // 2026-07-02T23:30:00.000Z in UTC is 20:30:00 in São Paulo (still July 2nd)
    const date = new Date('2026-07-02T23:30:00.000Z');
    const parts = getBrazilDateParts(date);
    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(7);
    expect(parts.day).toBe(2);
  });

  it('should create Brazil date with -03:00 offset correctly', () => {
    const bDate = createBrazilDate(2026, 7, 2, 0, 0, 0, 0);
    // Midnight in SP is 03:00 AM UTC
    expect(bDate.toISOString()).toBe('2026-07-02T03:00:00.000Z');
  });

  it('should parse TODAY period correctly', () => {
    const res = parsePeriodDateRange('TODAY');
    expect(res.period).toBe('TODAY');
    expect(res.label).toBe('Hoje');
    expect(res.timezone).toBe('America/Sao_Paulo');
    
    // Check if difference between end and start is exactly 1 day minus 1 ms
    const diff = res.endUtc.getTime() - res.startUtc.getTime();
    expect(diff).toBe(86400000 - 1);
  });

  it('should parse YESTERDAY period correctly', () => {
    const res = parsePeriodDateRange('YESTERDAY');
    expect(res.period).toBe('YESTERDAY');
    expect(res.label).toBe('Ontem');
    
    const diff = res.endUtc.getTime() - res.startUtc.getTime();
    expect(diff).toBe(86400000 - 1);
    
    const todayRes = parsePeriodDateRange('TODAY');
    expect(todayRes.startUtc.getTime() - res.startUtc.getTime()).toBe(86400000);
  });

  it('should parse MONTH period correctly', () => {
    const res = parsePeriodDateRange('MONTH');
    expect(res.period).toBe('MONTH');
    expect(res.label).toBe('Mês Atual');
    
    const sParts = getBrazilDateParts(res.startUtc);
    expect(sParts.day).toBe(1);
  });

  it('should parse CUSTOM period with start and end date strings', () => {
    const res = parsePeriodDateRange('CUSTOM', '2026-07-01', '2026-07-05');
    expect(res.period).toBe('CUSTOM');
    expect(res.startUtc.toISOString()).toBe('2026-07-01T03:00:00.000Z');
    expect(res.endUtc.toISOString()).toBe('2026-07-06T02:59:59.999Z');
    expect(res.label).toBe('01/07/2026 até 05/07/2026');
  });

  it('should normalize inverted start and end dates in CUSTOM', () => {
    const { startUtc, endUtc } = normalizeBrazilDateRange('2026-07-10', '2026-07-01');
    expect(startUtc.toISOString()).toBe('2026-07-01T03:00:00.000Z');
    expect(endUtc.toISOString()).toBe('2026-07-11T02:59:59.999Z');
  });

  it('should alias getDateRangeForPeriod to parsePeriodDateRange', () => {
    expect(getDateRangeForPeriod).toBe(parsePeriodDateRange);
  });
});
