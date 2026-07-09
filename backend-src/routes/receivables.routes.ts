import { Router } from 'express';
import { ReceivablesController } from '../controllers/receivables.controller.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { requireRole } from '../middlewares/requireRole.js';

export const receivablesRouter = Router();

receivablesRouter.use(requireRole(['OWNER', 'ADMIN', 'MANAGER']));

receivablesRouter.get('/invoices', asyncHandler(ReceivablesController.getInvoices));
receivablesRouter.get('/invoices/summary', asyncHandler(ReceivablesController.getSummary));
receivablesRouter.post(
  '/invoices/:invoiceId/payments',
  asyncHandler(ReceivablesController.recordPayment),
);
receivablesRouter.put('/invoices/:id', asyncHandler(ReceivablesController.updateInvoice));
receivablesRouter.delete(
  '/invoices/:invoiceId/payments/:paymentId',
  asyncHandler(ReceivablesController.reversePayment),
);
