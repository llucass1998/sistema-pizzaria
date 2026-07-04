import { Router } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { requireRole } from '../middlewares/requireRole.js';
import { ReportsController } from '../controllers/reports.controller.js';

export const reportsRoutes = Router();

// Proteção RBAC dupla (além da montagem no app.ts): Apenas OWNER, ADMIN ou MANAGER
reportsRoutes.use(requireRole(['OWNER', 'ADMIN', 'MANAGER']));

/**
 * GET /api/admin/reports/summary
 * Resumo Executivo Financeiro e Operacional
 */
reportsRoutes.get('/summary', asyncHandler(ReportsController.getGeneralSummary));

/**
 * GET /api/admin/reports/abc-products
 * Curva ABC de Produtos por Receita e Volume
 */
reportsRoutes.get('/abc-products', asyncHandler(ReportsController.getAbcProducts));

/**
 * GET /api/admin/reports/sales-heatmap
 * Heatmap Operacional de Vendas (Dias da Semana x Horário em America/Sao_Paulo)
 */
reportsRoutes.get('/sales-heatmap', asyncHandler(ReportsController.getSalesHeatmap));

/**
 * GET /api/admin/reports/driver-ranking
 * Ranking de Entregadores por Entregas, Faturamento e Taxas
 */
reportsRoutes.get('/driver-ranking', asyncHandler(ReportsController.getDriverRanking));

/**
 * GET /api/admin/reports/payment-methods
 * Mix de Formas de Pagamento
 */
reportsRoutes.get('/payment-methods', asyncHandler(ReportsController.getPaymentMethods));

/**
 * GET /api/admin/reports/cancellations
 * Detalhamento de Cancelamentos e Perdas
 */
reportsRoutes.get('/cancellations', asyncHandler(ReportsController.getCancellations));

export default reportsRoutes;
