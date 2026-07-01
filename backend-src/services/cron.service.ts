import cron from 'node-cron';

import { tenantContext } from '../core/context/TenantContext.js';
import { basePrisma, prisma } from '../lib/prisma.js';
import { logger } from '../utils/logger.js';
import { WhatsAppService } from './whatsapp.service.js';
import { CRMService } from './crm.service.js';

async function runForEachTenant(task: (tenantId: string) => Promise<void>) {
  const tenants = await basePrisma.tenant.findMany({ select: { id: true } });

  for (const tenant of tenants) {
    await tenantContext.run({ tenantId: tenant.id }, () => task(tenant.id));
  }
}

export const CronService = {
  start() {
    logger.info('[CRON] Iniciando rotinas agendadas (Cron Jobs)...');
    this.startAbandonedCartCron();
    this.startMarketingDailyCron();
  },

  startAbandonedCartCron() {
    cron.schedule('*/30 * * * *', async () => {
      logger.info('[CRON] Verificando carrinhos abandonados...');

      try {
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

        await runForEachTenant(async () => {
          const abandonedCarts = await prisma.abandonedCart.findMany({
            where: {
              status: 'PENDING',
              lastActiveAt: {
                lte: thirtyMinutesAgo,
              },
            },
            include: { customer: true },
          });

          for (const cart of abandonedCarts) {
            if (!cart.customer.phone || Number(cart.total) <= 0) {
              continue;
            }

            const message = `Ola ${cart.customer.name}! Notamos que voce deixou alguns itens no carrinho (R$ ${Number(cart.total).toFixed(2)}). Finalize seu pedido no nosso site.`;
            const sent = await WhatsAppService.sendMessage(cart.customer.phone, message);

            if (sent) {
              await prisma.abandonedCart.update({
                where: { id: cart.id },
                data: { status: 'LOST' },
              });
            }
          }
        });
      } catch (error) {
        logger.error('[CRON] Erro no worker de carrinhos:', error);
      }
    });
  },

  startMarketingDailyCron() {
    cron.schedule('0 9 * * *', async () => {
      logger.info('[CRON] Executando rotinas diarias de marketing.');

      try {
        await runForEachTenant(async (tenantId) => {
          await CRMService.recalculateSegments(tenantId);
          await CRMService.processWinBackCustomers(tenantId);
          await CRMService.processBirthdays(tenantId);
        });
      } catch (error) {
        logger.error('[CRON] Erro no worker diario:', error);
      }
    });
  },
};
