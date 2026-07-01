import { Router } from 'express';
import { requireRole } from '../middlewares/requireRole.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { FiscalService } from '../services/FiscalService.js';

export const fiscalRoutes = Router();

// Apenas admins/gerentes podem solicitar emissão avulsa pelo painel
fiscalRoutes.use(requireRole(['ADMIN', 'MANAGER']));

fiscalRoutes.post(
  '/orders/:orderId/issue',
  asyncHandler(async (req, res) => {
    const orderId = req.params.orderId as string;
    
    const doc = await FiscalService.issueNfce(orderId);
    
    res.json({
      message: 'NFC-e emitida com sucesso (MOCK)',
      document: doc
    });
  })
);
