import { Router } from 'express';
import { ReceivablesController } from '../controllers/receivables.controller.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { requireRole } from '../middlewares/requireRole.js';

export const receivablesRouter = Router();

receivablesRouter.use(requireRole(['OWNER', 'ADMIN', 'MANAGER']));

receivablesRouter.get('/invoices', asyncHandler(ReceivablesController.getInvoices));
receivablesRouter.post('/invoices/:invoiceId/payments', asyncHandler(ReceivablesController.recordPayment));
