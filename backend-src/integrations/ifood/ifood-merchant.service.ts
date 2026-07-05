import { prisma } from '../../lib/prisma.js';
import { logger } from '../../utils/logger.js';
import { IntegrationProvider, type IntegrationCredential } from '../../../generated/prisma/index.js';

export class IfoodMerchantService {
  static async getStatus(credential: IntegrationCredential) {
    if (!credential.merchantId) throw new Error('Merchant ID nao configurado.');
    
    // API Real: GET /merchant/v1.0/merchants/{id}/status
    // Mockando para homologacao
    return {
      merchantId: credential.merchantId,
      status: 'AVAILABLE',
      lastUpdate: new Date().toISOString(),
    };
  }

  static async pauseMerchant(credential: IntegrationCredential, reason: string, adminId?: string) {
    if (!credential.merchantId) throw new Error('Merchant ID nao configurado.');
    if (!reason) throw new Error('Motivo e obrigatorio para pausar a loja.');

    logger.info(`[iFood Merchant] Pausando loja ${credential.merchantId}. Motivo: ${reason}`);

    // API Real: POST /merchant/v1.0/merchants/{id}/interruptions
    // Mockando sucesso

    await prisma.integrationEventLog.create({
      data: {
        tenantId: credential.tenantId,
        provider: IntegrationProvider.IFOOD,
        eventId: `MERCHANT_PAUSE_${Date.now()}`,
        eventType: 'MERCHANT_STATUS',
        status: 'PROCESSED',
        payload: { action: 'PAUSE', reason, adminId } as any,
      } as any
    });

    return { success: true, status: 'UNAVAILABLE', reason };
  }

  static async resumeMerchant(credential: IntegrationCredential, adminId?: string) {
    if (!credential.merchantId) throw new Error('Merchant ID nao configurado.');

    logger.info(`[iFood Merchant] Retomando loja ${credential.merchantId}.`);

    // API Real: DELETE /merchant/v1.0/merchants/{id}/interruptions
    // Mockando sucesso

    await prisma.integrationEventLog.create({
      data: {
        tenantId: credential.tenantId,
        provider: IntegrationProvider.IFOOD,
        eventId: `MERCHANT_RESUME_${Date.now()}`,
        eventType: 'MERCHANT_STATUS',
        status: 'PROCESSED',
        payload: { action: 'RESUME', adminId } as any,
      } as any
    });

    return { success: true, status: 'AVAILABLE' };
  }
}
