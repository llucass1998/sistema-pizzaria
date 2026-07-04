import { Router } from 'express';
import { PurchasesController } from '../controllers/purchases.controller.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { requireRole } from '../middlewares/requireRole.js';

export const purchasesRouter = Router();

purchasesRouter.use(requireRole(['OWNER', 'ADMIN', 'MANAGER']));

// ── Fornecedores ─────────────────────────────────────────────────────────────
purchasesRouter.get('/suppliers', asyncHandler(PurchasesController.getSuppliers));
purchasesRouter.post('/suppliers', asyncHandler(PurchasesController.createSupplier));

// ── NF de Entrada direta (fluxo legado) ──────────────────────────────────────
purchasesRouter.get('/inbound-invoices', asyncHandler(PurchasesController.getInboundInvoices));
purchasesRouter.post('/inbound-invoices', asyncHandler(PurchasesController.createInboundInvoice));

// ── RFQ / Cotação de Compra ───────────────────────────────────────────────────
//   GET    /api/purchases/rfqs              — lista com filtros de status/supplier
//   POST   /api/purchases/rfqs              — cria RFQ em DRAFT
//   PATCH  /api/purchases/rfqs/:id/status   — transição de status (SENT, APPROVED, REJECTED)
//   POST   /api/purchases/rfqs/:id/convert-to-po — converte RFQ APPROVED em PO
purchasesRouter.get('/rfqs', asyncHandler(PurchasesController.getRFQs));
purchasesRouter.post('/rfqs', asyncHandler(PurchasesController.createRFQ));
purchasesRouter.patch('/rfqs/:id/status', asyncHandler(PurchasesController.updateRFQStatus));
purchasesRouter.post(
  '/rfqs/:id/convert-to-po',
  asyncHandler(PurchasesController.convertRFQtoPO),
);

// ── Pedidos de Compra (PO) ────────────────────────────────────────────────────
//   GET    /api/purchases/orders            — lista com filtros
//   POST   /api/purchases/orders            — cria PO diretamente (sem RFQ)
//   GET    /api/purchases/orders/:id        — detalhe com itens e recibos
//   POST   /api/purchases/orders/:id/receive — recebe parcial ou total
purchasesRouter.get('/orders', asyncHandler(PurchasesController.getPurchaseOrders));
purchasesRouter.post('/orders', asyncHandler(PurchasesController.createPurchaseOrder));
purchasesRouter.get('/orders/:id', asyncHandler(PurchasesController.getPurchaseOrderById));
purchasesRouter.put('/orders/:id', asyncHandler(PurchasesController.updatePurchaseOrder));
purchasesRouter.patch('/orders/:id/cancel', asyncHandler(PurchasesController.cancelPurchaseOrder));
purchasesRouter.post(
  '/orders/:id/receive',
  asyncHandler(PurchasesController.receivePurchaseOrder),
);

// Apelidos na raiz para compatibilidade com a REST API padrão (GET /api/admin/purchases)
purchasesRouter.get('/', asyncHandler(PurchasesController.getPurchaseOrders));
purchasesRouter.post('/', asyncHandler(PurchasesController.createPurchaseOrder));
purchasesRouter.get('/:id', asyncHandler(PurchasesController.getPurchaseOrderById));
purchasesRouter.put('/:id', asyncHandler(PurchasesController.updatePurchaseOrder));
purchasesRouter.patch('/:id/cancel', asyncHandler(PurchasesController.cancelPurchaseOrder));

