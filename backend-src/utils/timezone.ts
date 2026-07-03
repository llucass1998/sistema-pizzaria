/**
 * Timezone Utility — Sprint 3
 *
 * Padronização de datas e períodos comerciais no fuso horário do Brasil (America/Sao_Paulo).
 * Evita bugs de fuso horário onde vendas noturnas caem no dia errado ou relatórios cortam dados.
 */

export type FinancialPeriod = 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'LAST_30_DAYS' | 'CUSTOM';

export interface PeriodDateRange {
  startUtc: Date;
  endUtc: Date;
  label: string;
  timezone: string;
  period: FinancialPeriod;
}

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';
const BRAZIL_OFFSET = '-03:00';

/**
 * Retorna as partes de uma data (ano, mês, dia, dia da semana) no fuso horário especificado.
 */
export function getBrazilDateParts(date: Date = new Date(), timeZone = DEFAULT_TIMEZONE): {
  year: number;
  month: number;
  day: number;
  weekday: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });

  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value || date.getUTCFullYear());
  const month = Number(parts.find((p) => p.type === 'month')?.value || date.getUTCMonth() + 1);
  const day = Number(parts.find((p) => p.type === 'day')?.value || date.getUTCDate());
  
  const weekdayStr = parts.find((p) => p.type === 'weekday')?.value || 'Sun';
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = weekdayMap[weekdayStr] ?? 0;

  return { year, month, day, weekday };
}

/**
 * Cria uma data UTC que corresponde a um horário exato em America/Sao_Paulo.
 */
export function createBrazilDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
): Date {
  const yStr = String(year).padStart(4, '0');
  const mStr = String(month).padStart(2, '0');
  const dStr = String(day).padStart(2, '0');
  const hStr = String(hour).padStart(2, '0');
  const minStr = String(minute).padStart(2, '0');
  const sStr = String(second).padStart(2, '0');
  const msStr = String(ms).padStart(3, '0');

  return new Date(`${yStr}-${mStr}-${dStr}T${hStr}:${minStr}:${sStr}.${msStr}${BRAZIL_OFFSET}`);
}

/**
 * Normaliza e valida um intervalo de datas personalizado no fuso do Brasil.
 */
export function normalizeBrazilDateRange(
  startDate?: string | Date,
  endDate?: string | Date,
  _timezone = DEFAULT_TIMEZONE,
): { startUtc: Date; endUtc: Date } {
  const nowParts = getBrazilDateParts(new Date(), _timezone);
  
  let startYear = nowParts.year;
  let startMonth = nowParts.month;
  let startDay = nowParts.day;

  let endYear = nowParts.year;
  let endMonth = nowParts.month;
  let endDay = nowParts.day;

  if (startDate) {
    const sDate = typeof startDate === 'string' ? new Date(startDate.includes('T') ? startDate : `${startDate}T12:00:00.000${BRAZIL_OFFSET}`) : startDate;
    if (!isNaN(sDate.getTime())) {
      const p = getBrazilDateParts(sDate, _timezone);
      startYear = p.year;
      startMonth = p.month;
      startDay = p.day;
    }
  }

  if (endDate) {
    const eDate = typeof endDate === 'string' ? new Date(endDate.includes('T') ? endDate : `${endDate}T12:00:00.000${BRAZIL_OFFSET}`) : endDate;
    if (!isNaN(eDate.getTime())) {
      const p = getBrazilDateParts(eDate, _timezone);
      endYear = p.year;
      endMonth = p.month;
      endDay = p.day;
    }
  }

  let sDateObj = createBrazilDate(startYear, startMonth, startDay, 0, 0, 0, 0);
  let eDateObj = createBrazilDate(endYear, endMonth, endDay, 0, 0, 0, 0);

  if (sDateObj > eDateObj) {
    const tmpY = startYear, tmpM = startMonth, tmpD = startDay;
    startYear = endYear; startMonth = endMonth; startDay = endDay;
    endYear = tmpY; endMonth = tmpM; endDay = tmpD;
  }

  const startUtc = createBrazilDate(startYear, startMonth, startDay, 0, 0, 0, 0);
  const endUtc = createBrazilDate(endYear, endMonth, endDay, 23, 59, 59, 999);

  return { startUtc, endUtc };
}

/**
 * Retorna os timestamps de início e fim (em UTC) correspondentes a um período no fuso comercial brasileiro.
 */
export function parsePeriodDateRange(
  period: FinancialPeriod | string = 'TODAY',
  startDate?: string | Date,
  endDate?: string | Date,
  timezone = DEFAULT_TIMEZONE,
): PeriodDateRange {
  const nowParts = getBrazilDateParts(new Date(), timezone);

  const formatLabelDate = (y: number, m: number, d: number) =>
    `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;

  switch (period?.toUpperCase() as FinancialPeriod) {
    case 'YESTERDAY': {
      // Subtrair 1 dia
      const todayMid = createBrazilDate(nowParts.year, nowParts.month, nowParts.day, 12, 0, 0, 0);
      const yesterday = new Date(todayMid.getTime() - 86400000);
      const yParts = getBrazilDateParts(yesterday, timezone);
      
      const startUtc = createBrazilDate(yParts.year, yParts.month, yParts.day, 0, 0, 0, 0);
      const endUtc = createBrazilDate(yParts.year, yParts.month, yParts.day, 23, 59, 59, 999);
      
      return {
        startUtc,
        endUtc,
        label: 'Ontem',
        timezone,
        period: 'YESTERDAY',
      };
    }

    case 'WEEK': {
      // Domingo da semana atual até hoje 23:59:59.999
      const todayMid = createBrazilDate(nowParts.year, nowParts.month, nowParts.day, 12, 0, 0, 0);
      const sunday = new Date(todayMid.getTime() - nowParts.weekday * 86400000);
      const sParts = getBrazilDateParts(sunday, timezone);

      const startUtc = createBrazilDate(sParts.year, sParts.month, sParts.day, 0, 0, 0, 0);
      const endUtc = createBrazilDate(nowParts.year, nowParts.month, nowParts.day, 23, 59, 59, 999);

      return {
        startUtc,
        endUtc,
        label: 'Semana Atual',
        timezone,
        period: 'WEEK',
      };
    }

    case 'MONTH': {
      // 1º dia do mês até último dia do mês
      const startUtc = createBrazilDate(nowParts.year, nowParts.month, 1, 0, 0, 0, 0);
      
      // Para achar o último dia do mês, vamos para o dia 1 do próximo mês e voltamos 1 milissegundo
      let nextYear = nowParts.year;
      let nextMonth = nowParts.month + 1;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear++;
      }
      const nextMonthFirst = createBrazilDate(nextYear, nextMonth, 1, 0, 0, 0, 0);
      const endUtc = new Date(nextMonthFirst.getTime() - 1);

      return {
        startUtc,
        endUtc,
        label: 'Mês Atual',
        timezone,
        period: 'MONTH',
      };
    }

    case 'LAST_30_DAYS': {
      // Hoje - 29 dias até hoje
      const todayMid = createBrazilDate(nowParts.year, nowParts.month, nowParts.day, 12, 0, 0, 0);
      const thirtyDaysAgo = new Date(todayMid.getTime() - 29 * 86400000);
      const tParts = getBrazilDateParts(thirtyDaysAgo, timezone);

      const startUtc = createBrazilDate(tParts.year, tParts.month, tParts.day, 0, 0, 0, 0);
      const endUtc = createBrazilDate(nowParts.year, nowParts.month, nowParts.day, 23, 59, 59, 999);

      return {
        startUtc,
        endUtc,
        label: 'Últimos 30 Dias',
        timezone,
        period: 'LAST_30_DAYS',
      };
    }

    case 'CUSTOM': {
      const { startUtc, endUtc } = normalizeBrazilDateRange(startDate, endDate, timezone);
      const sParts = getBrazilDateParts(startUtc, timezone);
      const eParts = getBrazilDateParts(endUtc, timezone);

      return {
        startUtc,
        endUtc,
        label: `${formatLabelDate(sParts.year, sParts.month, sParts.day)} até ${formatLabelDate(eParts.year, eParts.month, eParts.day)}`,
        timezone,
        period: 'CUSTOM',
      };
    }

    case 'TODAY':
    default: {
      const startUtc = createBrazilDate(nowParts.year, nowParts.month, nowParts.day, 0, 0, 0, 0);
      const endUtc = createBrazilDate(nowParts.year, nowParts.month, nowParts.day, 23, 59, 59, 999);

      return {
        startUtc,
        endUtc,
        label: 'Hoje',
        timezone,
        period: 'TODAY',
      };
    }
  }
}

/**
 * Alias de conveniência para parsePeriodDateRange
 */
export const getDateRangeForPeriod = parsePeriodDateRange;
