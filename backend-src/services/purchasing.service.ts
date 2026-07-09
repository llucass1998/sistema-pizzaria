/**
 * PurchasingService — P1
 *
 * Implementa o fluxo RFQ → PO → recebimento parcial/total com:
 * - Anti-dupla entrada via idempotencyKey por linha de recibimento.
 * - Bloqueio de excesso: rejeita se quantidade recebida ultrapassar pedida.
 * - Atualização atômica de status do PO (PARTIALLY_RECEIVED / RECEIVED).
 * - moveStock delegado ao InventoryService já auditado no P0.
 */

import { basePrisma } from '../lib/prisma.js';
import { InventoryService } from './inventory.service.js';

type Db = typeof basePrisma;

// ─── Tipos de entrada ────────────────────────────────────────────────────────

export interface ReceiveLine {
  ingredientId: string;
  quantityReceived: number;
  unitCost: number;
}

export interface ReceivePOInput {
  tenantId: string;
  purchaseOrderId: string;
  lines: ReceiveLine[];
  notes?: string;
  inboundInvoiceId?: string;
  /** ISO datetime; defaults to now */
  receivedAt?: string;
}

export interface ConvertRFQInput {
  tenantId: string;
  purchaseRequestId: string;
  /** Se omitido, usa o supplierId do RFQ (obrigatório nesse caso) */
  supplierId?: string;
  notes?: string;
  expectedDate?: string;
  items: Array<{
    ingredientId: string;
    quantityOrdered: number;
    unitCost: number;
  }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function businessError(message: string, status = 400): Error {
  return Object.assign(new Error(message), { statusCode: status });
}

const RECEIVABLE_STATUSES = new Set(['APPROVED', 'PARTIALLY_RECEIVED']);

// ─── Serviço ─────────────────────────────────────────────────────────────────

export class PurchasingService {
  /**
   * Registra um recebimento (total ou parcial) de um PO.
   *
   * Regras:
   * 1. PO deve pertencer ao tenant e estar em APPROVED ou PARTIALLY_RECEIVED.
   * 2. A soma de quantidade já recebida + nova quantidade não pode exceder quantityOrdered.
   * 3. Cada linha gera InventoryTransaction com idempotencyKey único.
   * 4. Status do PO é atualizado atomicamente na mesma transação.
   */
  static async receivePartialPO(input: ReceivePOInput, db: Db | any = basePrisma) {
    if (!input.lines || input.lines.length === 0) {
      throw businessError('Informe pelo menos uma linha de recebimento.', 422);
    }

    const execute = async (tx: any) => {
      // ── 1. Carregar PO com itens e recibos anteriores ───────────────────────
      const po = await tx.purchaseOrder.findFirst({
        where: { id: input.purchaseOrderId, tenantId: input.tenantId },
        include: {
          items: true,
          receipts: { include: { lines: true } },
        },
      });

      if (!po) {
        throw businessError('Pedido de compra nao encontrado para esta loja.', 404);
      }

      if (!RECEIVABLE_STATUSES.has(po.status)) {
        throw businessError(
          `Pedido de compra em status "${po.status}" nao pode ser recebido.`,
          422,
        );
      }

      // ── 2. Calcular quantidades já recebidas por ingrediente ────────────────
      const alreadyReceived = new Map<string, number>();
      for (const receipt of po.receipts) {
        for (const line of receipt.lines) {
          const prev = alreadyReceived.get(line.ingredientId) ?? 0;
          alreadyReceived.set(line.ingredientId, prev + Number(line.quantityReceived));
        }
      }

      // ── 3. Validar excesso por linha ────────────────────────────────────────
      const orderedMap = new Map<string, number>(
        po.items.map((item: any) => [item.ingredientId, Number(item.quantityOrdered)]),
      );

      for (const line of input.lines) {
        const ordered = orderedMap.get(line.ingredientId);
        if (ordered === undefined) {
          throw businessError(
            `Ingrediente ${line.ingredientId} nao consta no pedido de compra.`,
            422,
          );
        }
        if (line.quantityReceived <= 0) {
          throw businessError('Quantidade recebida deve ser maior que zero.', 422);
        }
        const totalWillReceive =
          (alreadyReceived.get(line.ingredientId) ?? 0) + line.quantityReceived;
        if (totalWillReceive > ordered) {
          throw businessError(
            `Quantidade recebida (${totalWillReceive}) excede a pedida (${ordered}) para ingrediente ${line.ingredientId}.`,
            422,
          );
        }
      }

      // ── 4. Criar PurchaseReceipt ────────────────────────────────────────────
      const receipt = await tx.purchaseReceipt.create({
        data: {
          tenantId: input.tenantId,
          purchaseOrderId: input.purchaseOrderId,
          inboundInvoiceId: input.inboundInvoiceId ?? null,
          receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
          notes: input.notes ?? null,
          lines: {
            create: input.lines.map((line) => ({
              ingredientId: line.ingredientId,
              quantityReceived: line.quantityReceived.toFixed(4),
              unitCost: line.unitCost.toFixed(2),
            })),
          },
        },
        include: { lines: true },
      });

      // ── 5. Dar entrada no estoque via InventoryService (idempotente) ────────
      for (const line of input.lines) {
        const poItem = po.items.find((item: any) => item.ingredientId === line.ingredientId);
        await InventoryService.moveStock(
          {
            tenantId: input.tenantId,
            ingredientId: line.ingredientId,
            type: 'INBOUND_INVOICE',
            quantity: line.quantityReceived,
            cost: line.unitCost,
            notes: `Recebimento PO ${input.purchaseOrderId} (recibo ${receipt.id})`,
            referenceType: 'PURCHASE_RECEIPT',
            referenceId: receipt.id,
            idempotencyKey: `RECEIPT:${receipt.id}:INGREDIENT:${line.ingredientId}`,
          },
          tx,
        );

        // Atualizar custo médio do ingrediente caso unitCost informado
        if (line.unitCost > 0) {
          await tx.ingredient.updateMany({
            where: { id: line.ingredientId, tenantId: input.tenantId },
            data: { cost: line.unitCost.toFixed(2) },
          });
        }

        // Suprimir aviso de unused var
        void poItem;
      }

      // ── 6. Calcular novo status do PO ────────────────────────────────────────
      const updatedReceived = new Map<string, number>(alreadyReceived);
      for (const line of input.lines) {
        const prev = updatedReceived.get(line.ingredientId) ?? 0;
        updatedReceived.set(line.ingredientId, prev + line.quantityReceived);
      }

      const allFullyReceived = po.items.every((item: any) => {
        const received = updatedReceived.get(item.ingredientId) ?? 0;
        return received >= Number(item.quantityOrdered);
      });

      const newStatus = allFullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

      await tx.purchaseOrder.updateMany({
        where: { id: input.purchaseOrderId, tenantId: input.tenantId },
        data: { status: newStatus, updatedAt: new Date() },
      });

      return { receipt, poStatus: newStatus };
    };

    if (typeof db.$transaction === 'function') {
      return db.$transaction(execute);
    }
    return execute(db);
  }

  /**
   * Converte um RFQ aprovado em PO.
   *
   * Regras:
   * 1. RFQ deve pertencer ao tenant e estar em APPROVED.
   * 2. RFQ já convertido rejeita com 422.
   * 3. supplierId pode vir do input ou do RFQ (obrigatório em um dos dois lugares).
   */
  static async convertRFQtoPO(input: ConvertRFQInput, db: Db | any = basePrisma) {
    if (!input.items || input.items.length === 0) {
      throw businessError('Informe pelo menos um item para o pedido de compra.', 422);
    }

    const execute = async (tx: any) => {
      const rfq = await tx.purchaseRequest.findFirst({
        where: { id: input.purchaseRequestId, tenantId: input.tenantId },
      });

      if (!rfq) {
        throw businessError('RFQ nao encontrado para esta loja.', 404);
      }
      if (rfq.status !== 'APPROVED') {
        throw businessError(
          `RFQ em status "${rfq.status}" nao pode ser convertido em PO. Status esperado: APPROVED.`,
          422,
        );
      }

      const supplierId = input.supplierId ?? rfq.supplierId;
      if (!supplierId) {
        throw businessError('Informe o fornecedor para o pedido de compra.', 422);
      }

      // Verificar fornecedor
      const supplier = await tx.supplier.findFirst({
        where: { id: supplierId, tenantId: input.tenantId, isActive: true },
        select: { id: true },
      });
      if (!supplier) {
        throw businessError('Fornecedor nao encontrado ou inativo para esta loja.', 404);
      }

      // Calcular total
      const totalAmount = input.items.reduce(
        (sum, item) => sum + item.quantityOrdered * item.unitCost,
        0,
      );

      const po = await tx.purchaseOrder.create({
        data: {
          tenantId: input.tenantId,
          supplierId,
          purchaseRequestId: rfq.id,
          status: 'APPROVED',
          notes: input.notes ?? null,
          expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
          totalAmount: totalAmount.toFixed(2),
          items: {
            create: input.items.map((item) => ({
              ingredientId: item.ingredientId,
              quantityOrdered: item.quantityOrdered.toFixed(4),
              unitCost: item.unitCost.toFixed(2),
              totalCost: (item.quantityOrdered * item.unitCost).toFixed(2),
            })),
          },
        },
        include: { items: true },
      });

      // Marcar RFQ como convertido
      await tx.purchaseRequest.updateMany({
        where: { id: rfq.id, tenantId: input.tenantId },
        data: { status: 'CONVERTED', updatedAt: new Date() },
      });

      return po;
    };

    if (typeof db.$transaction === 'function') {
      return db.$transaction(execute);
    }
    return execute(db);
  }
}
