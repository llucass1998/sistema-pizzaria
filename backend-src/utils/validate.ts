/**
 * Utilitarios de validacao de entrada — padrao ERP.
 *
 * Centraliza as regras de validacao de campos para reutilizacao
 * em todas as rotas, mantendo consistencia nas mensagens de erro.
 */

import { normalizeText } from './normalize.js';

// Comprimentos maximos dos campos (ERP-grade).
export const FIELD_LIMITS = {
  NAME: 120,
  DESCRIPTION: 500,
  EMAIL: 254, // RFC 5321
  PHONE: 20,
  CPF: 20,
  CEP: 10,
  STREET: 200,
  NEIGHBORHOOD: 100,
  CITY: 100,
  NOTES: 1000,
  CUSTOMIZATIONS: 300,
  IMAGE_URL: 5_500_000,
} as const;

// Categorias validas do cardapio.
export const VALID_CATEGORIES = [
  'pizzas',
  'pizzas-especiais',
  'promocoes',
  'bebidas',
  'sobremesas',
  'combos',
] as const;

export type ValidCategory = (typeof VALID_CATEGORIES)[number];

// Limites de quantidade por item no pedido.
export const ORDER_LIMITS = {
  MAX_ITEMS: 50, // maximo de linhas de item distintas
  MAX_QUANTITY_PER_ITEM: 99, // quantidade maxima de um mesmo item
  MIN_QUANTITY_PER_ITEM: 1,
} as const;

type ValidationError = { field: string; message: string };

/**
 * Valida o comprimento de um campo de texto.
 */
export function validateLength(
  value: string,
  fieldName: string,
  maxLength: number,
  required = false,
): ValidationError | null {
  if (required && !value.trim()) {
    return { field: fieldName, message: `${fieldName} e obrigatorio.` };
  }

  if (value.length > maxLength) {
    return {
      field: fieldName,
      message: `${fieldName} pode ter no maximo ${maxLength} caracteres (enviou ${value.length}).`,
    };
  }

  return null;
}

/**
 * Valida formato basico de email.
 */
export function validateEmail(email: string): ValidationError | null {
  if (!email) {
    return { field: 'email', message: 'Email e obrigatorio.' };
  }

  if (email.length > FIELD_LIMITS.EMAIL) {
    return { field: 'email', message: `Email muito longo (max ${FIELD_LIMITS.EMAIL} caracteres).` };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { field: 'email', message: 'Formato de email invalido.' };
  }

  return null;
}

/**
 * Valida se a categoria e uma das aceitas pelo sistema.
 */
export function validateCategory(category: string): ValidationError | null {
  if (!VALID_CATEGORIES.includes(category as ValidCategory)) {
    return {
      field: 'category',
      message: `Categoria invalida. Use: ${VALID_CATEGORIES.join(', ')}.`,
    };
  }
  return null;
}

/**
 * Valida quantidade de um item de pedido.
 */
export function validateQuantity(quantity: number, fieldName = 'quantity'): ValidationError | null {
  if (!Number.isInteger(quantity) || quantity < ORDER_LIMITS.MIN_QUANTITY_PER_ITEM) {
    return { field: fieldName, message: 'Quantidade deve ser um numero inteiro maior que zero.' };
  }

  if (quantity > ORDER_LIMITS.MAX_QUANTITY_PER_ITEM) {
    return {
      field: fieldName,
      message: `Quantidade maxima por item e ${ORDER_LIMITS.MAX_QUANTITY_PER_ITEM}.`,
    };
  }

  return null;
}

/**
 * Coleta todos os erros de validacao e retorna lista ou null se tudo ok.
 */
export function collectErrors(validators: Array<() => ValidationError | null>): ValidationError[] {
  return validators.map((v) => v()).filter((e): e is ValidationError => e !== null);
}

/**
 * Valida campos de endereco para entrega.
 */
export function validateDeliveryAddress(address: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];
  const street = normalizeText(address.street);
  const number = normalizeText(address.number);
  const neighborhood = normalizeText(address.neighborhood);

  if (!street) errors.push({ field: 'address.street', message: 'Rua e obrigatoria para entrega.' });
  if (!number)
    errors.push({ field: 'address.number', message: 'Numero e obrigatorio para entrega.' });
  if (!neighborhood)
    errors.push({ field: 'address.neighborhood', message: 'Bairro e obrigatorio para entrega.' });

  if (street.length > FIELD_LIMITS.STREET) {
    errors.push({
      field: 'address.street',
      message: `Rua muito longa (max ${FIELD_LIMITS.STREET} chars).`,
    });
  }

  return errors;
}
