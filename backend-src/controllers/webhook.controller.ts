import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../utils/logger.js';

export const WebhookController = {
  /**
   * Endpoint generico para receber webhooks de provedores de pagamento (ex: Mercado Pago, Stripe)
   */
  async handlePaymentWebhook(req: Request, res: Response) {
    // 1. Receber e validar payload do provedor (assinatura, secret, etc)
    const payload = req.body;

    logger.info('[Webhook] Recebido webhook de pagamento:', JSON.stringify(payload));

    const externalId = payload.externalId || payload.data?.id || payload.id;
    const paymentStatus = payload.status || 'APPROVED'; // default for mock

    if (!externalId) {
      return res.status(400).json({ message: 'Payload invalido ou incompleto (externalId faltante).' });
    }

    try {
      // 2. Busca a Order pelo banco
      const order = await prisma.order.findFirst({
        where: { paymentExternalId: externalId },
      });

      if (!order) {
        console.warn(`[Webhook] Pedido nao encontrado pelo externalId: ${externalId}`);
        return res.status(404).json({ message: 'Pedido nao encontrado.' });
      }

      // 3. Atualiza status do pagamento
      if (paymentStatus === 'PAID' || paymentStatus === 'approved' || paymentStatus === 'APPROVED') {
        // Opcional: avancar o pedido para 'PREPARING' se for pago
        if (order.status === 'PENDING') {
          await prisma.order.update({
            where: { id: order.id },
            data: { status: 'PREPARING' },
          });
        }
      }

      // 4. Retornar 200 OK rapido para o provedor
      res.status(200).json({ message: 'Webhook processado com sucesso.' });
    } catch (error) {
      console.error('[Webhook] Erro ao processar pagamento:', error);
      res.status(500).json({ message: 'Erro interno no webhook.' });
    }
  },
};
