const WAHA_URL = process.env.WAHA_URL || 'http://localhost:3001/api';
import { logger } from '../utils/logger.js';

/**
 * Remove formatacoes de telefone e garante o sufixo @c.us exigido pelo WAHA.
 */
function formatWhatsAppNumber(phone: string): string | null {
  if (!phone) return null;
  // Remove tudo que nao e numero
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 10) return null; // Invalido

  // Assume DDI 55 (Brasil) se nao tiver 13 digitos
  const withDDI = clean.length <= 11 ? `55${clean}` : clean;
  return `${withDDI}@c.us`;
}

export const WhatsAppService = {
  /**
   * Envia uma mensagem de texto simples.
   */
  async sendMessage(phone: string, text: string) {
    const chatId = formatWhatsAppNumber(phone);
    if (!chatId) {
      logger.warn(`[WAHA] Telefone invalido, mensagem cancelada: ${phone}`);
      return false;
    }

    try {
      const response = await fetch(`${WAHA_URL}/sendText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          text,
          session: 'default',
        }),
      });

      if (!response.ok) {
        logger.error(`[WAHA] Erro ao enviar mensagem para ${chatId}: ${response.statusText}`);
        return false;
      }

      logger.info(`[WAHA] Mensagem enviada com sucesso para ${chatId}`);
      return true;
    } catch (error) {
      logger.error(`[WAHA] Falha de conexao com o servico WAHA:`, String(error));
      return false;
    }
  },

  /**
   * Notifica alteracao de status do pedido.
   */
  async notifyOrderStatus(phone: string, customerName: string, status: string, orderId: string) {
    let statusText = '';

    switch (status) {
      case 'PREPARING':
        statusText = 'Opa! Seu pedido ja esta na cozinha sendo preparado com muito capricho! 🍕👨‍🍳';
        break;
      case 'READY':
        statusText = 'Seu pedido esta pronto para retirada no balcao! Te aguardamos. 🍕🎉';
        break;
      case 'OUT_FOR_DELIVERY':
        statusText = 'O motoboy acabou de sair com o seu pedido! Fique de olho na porta! 🛵💨';
        break;
      case 'DELIVERED':
        statusText = 'Pedido entregue! Esperamos que goste. Bom apetite! 🍕❤️';
        break;
      case 'CANCELED':
        statusText =
          'Poxa, o seu pedido foi cancelado. Entre em contato conosco caso tenha alguma duvida.';
        break;
      default:
        return; // Nao notifica PENDING
    }

    const message = `Ola ${customerName}!\n\n${statusText}\n\n*Pedido:* #${orderId.substring(0, 8).toUpperCase()}`;
    await this.sendMessage(phone, message);
  },
};
