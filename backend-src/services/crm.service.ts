import { logger } from '../utils/logger.js';
import { basePrisma, prisma } from '../lib/prisma.js';
import { WhatsAppService } from './whatsapp.service.js';

type BirthdayCustomer = {
  id: string;
  tenantId: string;
  name: string;
  phone: string | null;
};

export const CRMService = {
  /**
   * Recalcula a segmentação do cliente com base no histórico de pedidos.
   * Deve ser executado em um CRON job diário, por tenant.
   */
  async recalculateSegments(tenantId: string) {
    logger.info(`[CRM] Iniciando recalculo de segmentação para tenant ${tenantId}...`);

    const customers = await prisma.customer.findMany({
      where: { tenantId },
      select: { id: true, lastOrderDate: true, totalOrders: true },
    });

    const now = new Date();

    for (const customer of customers) {
      let segment = 'NOVO';

      if (customer.totalOrders >= 5) {
        segment = 'VIP';
      } else if (customer.totalOrders > 0) {
        segment = 'ATIVO';
      }

      // Calcula dias desde a última compra
      if (customer.lastOrderDate) {
        const diffDays = Math.floor(
          (now.getTime() - customer.lastOrderDate.getTime()) / (1000 * 3600 * 24),
        );

        if ((segment === 'VIP' && diffDays > 30) || (segment === 'ATIVO' && diffDays > 45)) {
          segment = 'EM_RISCO';
        }
      }

      await prisma.customer.update({
        where: { id: customer.id, tenantId },
        data: { segment },
      });
    }

    logger.info(
      `[CRM] Segmentação recalculada para ${customers.length} clientes no tenant ${tenantId}.`,
    );
  },

  /**
   * Processa clientes em risco (WinBack).
   */
  async processWinBackCustomers(tenantId: string) {
    const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const customersAtRisk = await prisma.customer.findMany({
      where: {
        tenantId,
        lastOrderDate: { lte: fortyFiveDaysAgo },
        segment: { not: 'EM_RISCO' },
      },
    });

    for (const customer of customersAtRisk) {
      await prisma.customer.update({
        where: { id: customer.id, tenantId },
        data: { segment: 'EM_RISCO' },
      });

      if (!customer.phone) {
        continue;
      }

      const code = `SAUDADE${customer.id.substring(0, 4).toUpperCase()}`;
      await prisma.coupon.upsert({
        where: { tenantId_code: { tenantId, code } },
        create: {
          tenantId,
          code,
          type: 'PERCENTAGE',
          value: 15,
          isActive: true,
          maxUses: 1,
        },
        update: {},
      });

      const message = `Ola ${customer.name}, estamos com saudades! Use o cupom ${code} para ganhar 15% de desconto.`;
      await WhatsAppService.sendMessage(customer.phone, message);
    }
  },

  /**
   * Processa o gatilho de aniversários (gera cupons e notifica).
   */
  async processBirthdays(tenantId: string) {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    const birthdayCustomers = await basePrisma.$queryRaw<BirthdayCustomer[]>`
      SELECT id, "tenantId", name, phone FROM "Customer"
      WHERE EXTRACT(MONTH FROM "birthDate") = ${currentMonth}
        AND EXTRACT(DAY FROM "birthDate") = ${currentDay}
        AND "tenantId" = ${tenantId}
    `;

    for (const customer of birthdayCustomers) {
      if (!customer.phone) continue;

      const code = `NIVER${customer.id.substring(0, 4).toUpperCase()}`;
      await prisma.coupon.upsert({
        where: { tenantId_code: { tenantId, code } },
        create: {
          tenantId,
          code,
          type: 'PERCENTAGE',
          value: 20, // 20% de desconto
          triggerEvent: 'BIRTHDAY',
          isActive: true,
          maxUses: 1,
        },
        update: {},
      });

      const message = `Feliz aniversario, ${customer.name}! Use o cupom ${code} para ganhar 20% de desconto no seu pedido hoje!`;
      await WhatsAppService.sendMessage(customer.phone, message);
    }
  },

  /**
   * Concede pontos ou cashback de fidelidade baseado na configuração da loja.
   */
  async grantLoyalty(tenantId: string, customerId: string, orderTotal: number) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId, tenantId } });
    if (!customer) return;

    const loyaltyProgram = await prisma.loyaltyProgram.findUnique({
      where: { tenantId },
    });

    if (loyaltyProgram && loyaltyProgram.isActive) {
      if (loyaltyProgram.type === 'CASHBACK') {
        const cashbackEarned = orderTotal * Number(loyaltyProgram.conversionRate);
        await prisma.customer.update({
          where: { id: customer.id, tenantId },
          data: { loyaltyBalance: { increment: cashbackEarned } },
        });

        if (customer.phone && cashbackEarned > 0) {
          WhatsAppService.sendMessage(
            customer.phone,
            `💰 Você ganhou R$ ${cashbackEarned.toFixed(2)} de Cashback nessa compra! Seu saldo atual é R$ ${(Number(customer.loyaltyBalance) + cashbackEarned).toFixed(2)}.`,
          );
        }
      } else if (loyaltyProgram.type === 'POINTS') {
        await prisma.customer.update({
          where: { id: customer.id, tenantId },
          data: { loyaltyBalance: { increment: 1 } },
        });

        const newBalance = Number(customer.loyaltyBalance) + 1;
        if (loyaltyProgram.pointsGoal && newBalance >= loyaltyProgram.pointsGoal) {
          await prisma.customer.update({
            where: { id: customer.id, tenantId },
            data: { loyaltyBalance: { decrement: loyaltyProgram.pointsGoal } },
          });

          if (customer.phone) {
            WhatsAppService.sendMessage(
              customer.phone,
              `🌟 PARABÉNS! Você completou sua cartela de fidelidade e ganhou uma recompensa! Apresente esta mensagem no próximo pedido.`,
            );
          }
        } else if (customer.phone) {
          WhatsAppService.sendMessage(
            customer.phone,
            `🍕 Você ganhou 1 selo de fidelidade! Faltam apenas ${loyaltyProgram.pointsGoal! - newBalance} para sua recompensa.`,
          );
        }
      }
    }
  },

  /**
   * Atualiza as métricas de um cliente.
   */
  async recordOrderStats(tenantId: string, customerId: string, orderTotal: number) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId, tenantId } });
    if (!customer) return;

    await prisma.customer.update({
      where: { id: customerId, tenantId },
      data: {
        totalOrders: { increment: 1 },
        totalSpent: { increment: orderTotal },
        lastOrderDate: new Date(),
      },
    });

    await this.grantLoyalty(tenantId, customerId, orderTotal);
  },
};
