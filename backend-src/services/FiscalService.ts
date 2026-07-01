import { prisma } from '../lib/prisma.js';
import { getTenantId } from '../core/context/TenantContext.js';

export class FiscalService {
  /**
   * MOCK de emissão de NFC-e. 
   * Em produção, isso bateria numa API como WebmaniaBR, Focus NFe, ou Sefaz direta.
   */
  static async issueNfce(orderId: string) {
    const tenantId = getTenantId();

    const order = await prisma.order.findUnique({
      where: { id: orderId, tenantId },
      include: { items: true, customer: true }
    });

    if (!order) {
      throw new Error('Pedido não encontrado.');
    }

    // Busca configuracao fiscal do tenant
    let fiscalConfig = await prisma.fiscalSettings.findUnique({
      where: { tenantId }
    });

    if (!fiscalConfig) {
      // Cria config padrao se nao existir
      fiscalConfig = await prisma.fiscalSettings.create({
        data: {
          tenantId,
          environment: 'HOMOLOGACAO'
        }
      });
    }

    // Verifica se ja existe doc fiscal
    const existingDoc = await prisma.fiscalDocument.findUnique({
      where: { orderId }
    });

    if (existingDoc && existingDoc.status === 'ISSUED') {
      throw new Error('NFC-e já emitida para este pedido.');
    }

    // Simula tempo de processamento da Sefaz
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const mockAccessKey = Array.from({ length: 44 }, () => Math.floor(Math.random() * 10)).join('');
    
    const data = {
      tenantId,
      orderId,
      accessKey: mockAccessKey,
      status: 'ISSUED',
      environment: fiscalConfig.environment,
      xmlUrl: `https://mock-sefaz.com/nfce/${mockAccessKey}.xml`,
      pdfUrl: `https://mock-sefaz.com/nfce/${mockAccessKey}.pdf`,
      message: 'Autorizado o uso da NFC-e'
    };

    if (existingDoc) {
      return prisma.fiscalDocument.update({
        where: { id: existingDoc.id },
        data
      });
    }

    return prisma.fiscalDocument.create({ data });
  }
}
