import { Router } from 'express';
import { InvoicesController } from '../controllers/invoices.controller.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { requireRole } from '../middlewares/requireRole.js';

export const invoicesRouter = Router();

// Apenas OWNER, ADMIN e MANAGER podem gerenciar notas fiscais
invoicesRouter.use(requireRole(['OWNER', 'ADMIN', 'MANAGER']));

invoicesRouter.get('/', asyncHandler(InvoicesController.getInvoices));
invoicesRouter.post('/', asyncHandler(InvoicesController.createInvoice));
invoicesRouter.get('/:id', asyncHandler(InvoicesController.getInvoiceById));
invoicesRouter.put('/:id', asyncHandler(InvoicesController.updateInvoice));
invoicesRouter.patch('/:id/link-purchase', asyncHandler(InvoicesController.linkPurchase));
