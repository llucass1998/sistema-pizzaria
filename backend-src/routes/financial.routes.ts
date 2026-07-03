/**
 * FinancialRoutes — Sprint 3
 *
 * Rotas protegidas pelo middleware RBAC (OWNER, ADMIN, MANAGER).
 */

import { Router } from 'express';
import { FinancialController } from '../controllers/financial.controller.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { requireRole } from '../middlewares/requireRole.js';

export const financialRouter = Router();

financialRouter.use(requireRole(['OWNER', 'ADMIN', 'MANAGER']));

financialRouter.get('/summary', asyncHandler(FinancialController.getSummary));
financialRouter.get('/cash-flow', asyncHandler(FinancialController.getCashFlow));
financialRouter.get('/dre', asyncHandler(FinancialController.getDRE));
financialRouter.get('/reconciliation', asyncHandler(FinancialController.getReconciliation));
financialRouter.get('/reports/:type', asyncHandler(FinancialController.getReports));
financialRouter.get('/alerts', asyncHandler(FinancialController.getAlerts));
