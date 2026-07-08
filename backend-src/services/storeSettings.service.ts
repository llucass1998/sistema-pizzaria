import { prisma } from '../lib/prisma.js';
import { getTenantId } from '../core/context/TenantContext.js';
import { getTenantFsSettings } from './tenantSettingsFs.service.js';

const DEFAULT_NAVBAR_COLOR = '#970F0F';

// Busca as configuracoes da loja. Se ainda nao existir, cria com valores padrao.
export async function getStoreSettings() {
  const tenantId = getTenantId();

  let existing = await prisma.storeSetting.findUnique({ where: { tenantId } });
  
  if (!existing) {
    existing = await prisma.storeSetting.create({
      data: {
        tenantId,
        storeName: 'Pizzaria',
        hours: '18:00 - 23:30',
        address: 'Av. Principal, 123',
        phone: '(11) 9999-9999',
        whatsappNumber: '5511999999999',
        pixKey: 'sua-chave-pix-aqui',
        pixMerchantName: 'Pizzaria',
        pixCity: 'Rio de Janeiro',
        gatewayEnabled: false,
        depositEnabled: false,
        depositPercent: 50,
        depositRequiredMethods: 'PIX_ONLINE,CARD_ONLINE,MERCADOPAGO',
        allowPayRestOnDelivery: true,
        depositLabel: 'Pague 50% agora e o restante na entrega.',
        deliveryFee: '0.00',
        serviceFee: '2.00',
        navbarColor: DEFAULT_NAVBAR_COLOR,
        brandColor: DEFAULT_NAVBAR_COLOR,
      } as any,
    });
  }

  const fsSettings = await getTenantFsSettings(tenantId);
  return { ...existing, ...fsSettings };
}
