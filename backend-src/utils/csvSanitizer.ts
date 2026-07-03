/**
 * CSV Sanitizer Utility — Sprint 3
 *
 * Proteção contra CSV Injection (fórmulas maliciosas no Excel/LibreOffice Calc)
 * Formatação padronizada em BRL e pt-BR.
 */

const DANGEROUS_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Sanitiza uma string para evitar execução de fórmulas em planilhas (CSV Injection).
 * Se o valor iniciar com caracteres perigosos, adiciona um apóstrofo (') no início.
 */
export function sanitizeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const raw = String(value);
  const str = raw.trim();
  if (str.length === 0) {
    return '';
  }

  if (DANGEROUS_PREFIXES.some((prefix) => raw.startsWith(prefix) || str.startsWith(prefix))) {
    return `'${raw}`;
  }

  return raw;
}

/**
 * Formata valores numéricos para moeda BRL (ex: "1250,00" ou "R$ 1.250,00").
 */
export function formatCsvCurrency(amount: unknown, includeSymbol = false): string {
  const num = Number(amount) || 0;
  if (!includeSymbol) {
    return num.toFixed(2).replace('.', ',');
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

/**
 * Formata datas para o padrão pt-BR (dd/mm/yyyy hh:mm ou dd/mm/yyyy).
 */
export function formatCsvDate(date: unknown, includeTime = false): string {
  if (!date) return '';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : (date as Date);
  if (isNaN(d.getTime())) return '';

  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
    ...(includeTime && { hour: '2-digit', minute: '2-digit' }),
  };

  return new Intl.DateTimeFormat('pt-BR', options).format(d);
}

/**
 * Converte um array de objetos ou linhas em uma string CSV segura e sanitizada.
 */
export function generateSafeCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const escapedHeaders = headers.map((h) => `"${sanitizeCsvField(h).replace(/"/g, '""')}"`).join(';');
  const escapedRows = rows.map((row) =>
    row.map((cell) => `"${sanitizeCsvField(cell).replace(/"/g, '""')}"`).join(';'),
  );

  return '\uFEFF' + [escapedHeaders, ...escapedRows].join('\n');
}
