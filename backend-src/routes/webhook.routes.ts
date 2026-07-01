import { Router } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { WebhookController } from '../controllers/webhook.controller.js';

export const webhookRoutes = Router();

// Webhook endpoint aberto (sem auth middleware) porque eh chamado por terceiros
// Importante: em prod, o Controller deve verificar a assinatura do webhook (Secret do MercadoPago/Stripe)
webhookRoutes.post('/payments/callback', asyncHandler(WebhookController.handlePaymentWebhook));
