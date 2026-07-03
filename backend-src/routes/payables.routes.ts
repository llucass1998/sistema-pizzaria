/**
 * PayablesRoutes — Sprint 1
 *
 * Rotas protegidas pelo middleware RBAC (OWNER, ADMIN, MANAGER).
 */

import { Router } from 'express';
import { PayablesController } from '../controllers/payables.controller.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { requireRole } from '../middlewares/requireRole.js';

export const payablesRouter = Router();

payablesRouter.use(requireRole(['OWNER', 'ADMIN', 'MANAGER']));

payablesRouter.post('/', asyncHandler(PayablesController.createPayable));
payablesRouter.get('/', asyncHandler(PayablesController.getPayables));
payablesRouter.get('/summary', asyncHandler(PayablesController.getPayablesSummary));
payablesRouter.get('/:id', asyncHandler(PayablesController.getPayableById));
payablesRouter.post('/:id/payments', asyncHandler(PayablesController.recordPayment));
payablesRouter.post('/:id/cancel', asyncHandler(PayablesController.cancelPayable));
