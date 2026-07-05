import { Router } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { WebhookController } from '../controllers/webhook.controller.js';

export const webhookRoutes = Router();

// Webhook endpoint aberto (sem auth middleware) porque eh chamado por terceiros
// Importante: em prod, o Controller deve verificar a assinatura do webhook (Secret do MercadoPago/Stripe)
webhookRoutes.post('/payments/callback', asyncHandler(WebhookController.handlePaymentWebhook));

import { basePrisma } from '../lib/prisma.js';
import { IfoodService } from '../integrations/ifood/ifood.service.js';
import { logger } from '../utils/logger.js';
import { IntegrationProvider } from '../../generated/prisma/index.js';
import { tenantContext } from '../core/context/TenantContext.js';

webhookRoutes.post('/ifood', async (req, res) => {
  try {
    const signature = req.headers['x-webhook-secret'] || req.query.secret;
    const expectedSecret = process.env.IFOOD_WEBHOOK_SECRET;

    if (expectedSecret && signature !== expectedSecret) {
      logger.warn('[iFood Webhook] Assinatura/Secret invalido.');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const events = Array.isArray(req.body) ? req.body : [req.body];

    if (events.length === 0 || !events[0].merchantId) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const merchantId = events[0].merchantId;

    const credential = await basePrisma.integrationCredential.findFirst({
      where: {
        provider: IntegrationProvider.IFOOD,
        merchantId,
        isActive: true,
      },
    });

    if (!credential) {
      logger.warn(`[iFood Webhook] Credencial ativa nao encontrada para merchantId: ${merchantId}`);
      res.status(200).send('OK');
      return;
    }

    // Retornar rapidamente para o iFood (fire and forget)
    res.status(202).send('Accepted');

    for (const event of events) {
      try {
        await tenantContext.run({ tenantId: credential.tenantId }, async () => {
          await IfoodService.processEvent(credential, event);
        });
      } catch (err) {
        logger.error(`[iFood Webhook] Erro ao processar evento no webhook:`, err);
      }
    }
  } catch (error) {
    logger.error('[iFood Webhook] Erro critico no webhook:', error);
    if (!res.headersSent) {
      res.status(500).send('Internal Server Error');
    }
  }
});
