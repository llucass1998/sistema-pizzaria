/**
 * Middleware global de tratamento de erros — padrao ERP.
 *
 * Captura todos os erros nao tratados nas rotas e retorna uma
 * resposta JSON consistente, sem expor detalhes internos ao cliente.
 */

import type { ErrorRequestHandler } from 'express';

// Tipos de erro do Prisma que queremos tratar de forma especifica.
type PrismaErrorCode =
  | 'P2002' // Unique constraint violation
  | 'P2025' // Record not found
  | 'P2003' // Foreign key constraint
  | 'P2014' // Relation violation
  | string;

type PrismaKnownError = {
  code: PrismaErrorCode;
  meta?: { target?: string[] };
};

function isPrismaError(error: unknown): error is PrismaKnownError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    (error as { code: string }).code.startsWith('P')
  );
}

function getHttpStatusCode(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof (error as { statusCode: unknown }).statusCode === 'number'
  ) {
    return (error as { statusCode: number }).statusCode;
  }

  return null;
}

import { ZodError } from 'zod';

// Handler global de erros — deve ser o ULTIMO middleware registrado.
// Captura qualquer erro nao tratado pelas rotas e retorna resposta JSON limpa.
export const globalErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  // Log completo do erro no servidor (sem expor ao cliente).
  console.error('[ERROR]', new Date().toISOString(), error);

  if (error instanceof ZodError) {
    res.status(400).json({
      message: 'Dados de entrada inválidos.',
      code: 'VALIDATION_ERROR',
      issues: error.issues,
    });
    return;
  }

  const statusCode = getHttpStatusCode(error);
  if (statusCode && error instanceof Error) {
    res.status(statusCode).json({
      message: error.message,
      code: 'BUSINESS_RULE',
    });
    return;
  }

  // Erros do Prisma com mensagens amigaveis.
  if (isPrismaError(error)) {
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] ?? 'campo';
      res.status(409).json({
        message: `Ja existe um registro com o mesmo ${field}. Verifique os dados e tente novamente.`,
        code: 'DUPLICATE_ENTRY',
      });
      return;
    }

    if (error.code === 'P2025') {
      res.status(404).json({
        message: 'Registro nao encontrado.',
        code: 'NOT_FOUND',
      });
      return;
    }

    if (error.code === 'P2003') {
      res.status(400).json({
        message: 'Referencia invalida. Verifique os dados enviados.',
        code: 'INVALID_REFERENCE',
      });
      return;
    }
  }

  // Erros com mensagem legivel (lancados intencionalmente).
  if (error instanceof Error && error.message) {
    // Nao expoe stack trace — apenas a mensagem.
    res.status(500).json({
      message: 'Erro interno do servidor. Tente novamente em instantes.',
      code: 'INTERNAL_ERROR',
    });
    return;
  }

  res.status(500).json({
    message: 'Erro inesperado. Tente novamente.',
    code: 'UNKNOWN_ERROR',
  });
};
