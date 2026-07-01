/**
 * Maquina de estados dos pedidos — padrao ERP fastfood (Catedral/Saipos/TOTVS).
 *
 * Cada fulfillmentType tem seu proprio fluxo de transicoes validas.
 *
 * PICKUP:   PENDING → PREPARING → READY → DELIVERED
 * DELIVERY: PENDING → PREPARING → OUT_FOR_DELIVERY → DELIVERED
 *
 * CANCELED pode ser alvo de qualquer estado exceto DELIVERED.
 * Nao e permitido retroceder nem pular etapas.
 */

import { FulfillmentType, OrderStatus } from '../../generated/prisma/index.js';

type Transition = {
  from: OrderStatus;
  to: OrderStatus[];
};

// Transicoes validas para retirada na loja.
const PICKUP_TRANSITIONS: Transition[] = [
  { from: OrderStatus.PENDING, to: [OrderStatus.PREPARING, OrderStatus.CANCELED] },
  { from: OrderStatus.PREPARING, to: [OrderStatus.READY, OrderStatus.CANCELED] },
  { from: OrderStatus.READY, to: [OrderStatus.DELIVERED, OrderStatus.CANCELED] },
  { from: OrderStatus.DELIVERED, to: [] },
  { from: OrderStatus.CANCELED, to: [] },
];

// Transicoes validas para entrega.
const DELIVERY_TRANSITIONS: Transition[] = [
  { from: OrderStatus.PENDING, to: [OrderStatus.PREPARING, OrderStatus.CANCELED] },
  { from: OrderStatus.PREPARING, to: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELED] },
  { from: OrderStatus.OUT_FOR_DELIVERY, to: [OrderStatus.DELIVERED, OrderStatus.CANCELED] },
  { from: OrderStatus.DELIVERED, to: [] },
  { from: OrderStatus.CANCELED, to: [] },
];

// Mapa de status para labels legiveis (para mensagens de erro).
const STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'Pedido feito',
  [OrderStatus.PREPARING]: 'Pagamento confirmado',
  [OrderStatus.READY]: 'Pronto para retirada',
  [OrderStatus.OUT_FOR_DELIVERY]: 'Saiu para entrega',
  [OrderStatus.DELIVERED]: 'Entregue',
  [OrderStatus.CANCELED]: 'Cancelado',
};

function getTransitions(fulfillmentType: FulfillmentType): Transition[] {
  return fulfillmentType === FulfillmentType.PICKUP ? PICKUP_TRANSITIONS : DELIVERY_TRANSITIONS;
}

export type TransitionResult =
  { ok: true } | { ok: false; message: string; allowedNext: OrderStatus[] };

/**
 * Valida se a transicao de `fromStatus` para `toStatus` e permitida
 * para o tipo de entrega informado.
 */
export function validateStatusTransition(
  fulfillmentType: FulfillmentType,
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
): TransitionResult {
  const transitions = getTransitions(fulfillmentType);
  const rule = transitions.find((t) => t.from === fromStatus);

  if (!rule) {
    return {
      ok: false,
      message: `Status atual desconhecido: ${fromStatus}.`,
      allowedNext: [],
    };
  }

  if (rule.to.includes(toStatus)) {
    return { ok: true };
  }

  if (rule.to.length === 0) {
    return {
      ok: false,
      message: `Pedido ${STATUS_LABELS[fromStatus]} nao pode ser alterado.`,
      allowedNext: [],
    };
  }

  const allowedLabels = rule.to.map((s) => STATUS_LABELS[s]).join(' ou ');
  return {
    ok: false,
    message: `Nao e possivel ir de "${STATUS_LABELS[fromStatus]}" para "${STATUS_LABELS[toStatus]}". Proximo permitido: ${allowedLabels}.`,
    allowedNext: rule.to,
  };
}

/**
 * Retorna os status para os quais um pedido pode transicionar,
 * dado seu estado atual e tipo de entrega.
 */
export function getAllowedNextStatuses(
  fulfillmentType: FulfillmentType,
  currentStatus: OrderStatus,
): OrderStatus[] {
  const transitions = getTransitions(fulfillmentType);
  return transitions.find((t) => t.from === currentStatus)?.to ?? [];
}

/**
 * Verifica se um pedido esta em estado terminal (nao pode mais ser alterado).
 */
export function isTerminalStatus(status: OrderStatus): boolean {
  return status === OrderStatus.DELIVERED || status === OrderStatus.CANCELED;
}
