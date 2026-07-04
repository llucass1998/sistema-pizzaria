import { Router } from 'express';
import { ReconciliationController } from '../controllers/reconciliation.controller.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { requireRole } from '../middlewares/requireRole.js';

export const reconciliationRouter = Router();

// Apenas OWNER, ADMIN e MANAGER podem realizar conciliação
reconciliationRouter.use(requireRole(['OWNER', 'ADMIN', 'MANAGER']));

reconciliationRouter.get('/summary', asyncHandler(ReconciliationController.getSummary));
reconciliationRouter.get('/issues', asyncHandler(ReconciliationController.getIssues));
reconciliationRouter.post('/match', asyncHandler(ReconciliationController.match));
reconciliationRouter.post('/unmatch', asyncHandler(ReconciliationController.unmatch));
