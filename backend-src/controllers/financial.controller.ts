/**
 * FinancialController — Sprint 3
 *
 * Endpoints REST profissionais para gestão financeira:
 * - Filtros de período no fuso horário do Brasil.
 * - Isolamento multi-tenant via contexto.
 * - Suporte a DRE, Fluxo de Caixa, Conciliação, Alertas e Relatórios.
 */

import { Request, Response } from 'express';
import { getTenantId } from '../core/context/TenantContext.js';
import { FinancialAnalyticsService } from '../services/financialAnalytics.service.js';

export const FinancialController = {
  /**
   * GET /api/admin/financial/summary
   */
  async getSummary(req: Request, res: Response) {
    const tenantId = getTenantId();
    const period = String(req.query.period || 'TODAY');
    const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

    const summary = await FinancialAnalyticsService.getFinancialSummary(tenantId, period, startDate, endDate);
    res.json(summary);
  },

  /**
   * GET /api/admin/financial/cash-flow
   */
  async getCashFlow(req: Request, res: Response) {
    const tenantId = getTenantId();
    const period = String(req.query.period || 'LAST_30_DAYS');
    const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

    const cashFlow = await FinancialAnalyticsService.getCashFlow(tenantId, period, startDate, endDate);
    res.json(cashFlow);
  },

  /**
   * GET /api/admin/financial/dre
   */
  async getDRE(req: Request, res: Response) {
    const tenantId = getTenantId();
    const period = String(req.query.period || 'MONTH');
    const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

    const dre = await FinancialAnalyticsService.getDRE(tenantId, period, startDate, endDate);
    res.json(dre);
  },

  /**
   * GET /api/admin/financial/reconciliation
   */
  async getReconciliation(req: Request, res: Response) {
    const tenantId = getTenantId();
    const period = String(req.query.period || 'TODAY');
    const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

    const reconciliation = await FinancialAnalyticsService.getReconciliation(tenantId, period, startDate, endDate);
    res.json(reconciliation);
  },

  /**
   * GET /api/admin/financial/reports/:type
   */
  async getReports(req: Request, res: Response) {
    const tenantId = getTenantId();
    const type = String(req.params.type || 'sales-by-product');
    const period = String(req.query.period || 'MONTH');
    const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

    const report = await FinancialAnalyticsService.getFinancialReports(tenantId, type, period, startDate, endDate);
    res.json(report);
  },

  /**
   * GET /api/admin/financial/alerts
   */
  async getAlerts(_req: Request, res: Response) {
    const tenantId = getTenantId();
    const alerts = await FinancialAnalyticsService.getFinancialAlerts(tenantId);
    res.json(alerts);
  },
};
