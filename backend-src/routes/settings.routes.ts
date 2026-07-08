import { Router } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import { requireRole } from '../middlewares/requireRole.js';
import { validateSchema } from '../middlewares/validateZod.js';
import {
  SettingsController,
  updateDeliveryFeeSchema,
  updateStoreSettingsSchema,
} from '../controllers/settings.controller.js';

export const settingsRoutes = Router();

// ─── GET /configuracoes ────────────────────────────────────────────────────────
settingsRoutes.get('/configuracoes', asyncHandler(SettingsController.getSettings));
settingsRoutes.get(
  ['/admin/settings', '/admin/store-settings'],
  requireAdmin,
  requireRole(['OWNER', 'ADMIN']),
  asyncHandler(SettingsController.getSettings),
);

// ─── PUT /configuracoes/taxa-entrega ──────────────────────────────────────────
settingsRoutes.put(
  '/configuracoes/taxa-entrega',
  requireAdmin,
  requireRole(['OWNER', 'ADMIN']),
  validateSchema(updateDeliveryFeeSchema),
  asyncHandler(SettingsController.updateDeliveryFee),
);

// ─── PUT /configuracoes/loja ───────────────────────────────────────────────────
settingsRoutes.put(
  '/configuracoes/loja',
  requireAdmin,
  requireRole(['OWNER', 'ADMIN']),
  validateSchema(updateStoreSettingsSchema),
  asyncHandler(SettingsController.updateStoreSettings),
);
