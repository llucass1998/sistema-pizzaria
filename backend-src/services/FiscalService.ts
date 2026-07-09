import { prisma } from '../lib/prisma.js';
import { getTenantId } from '../core/context/TenantContext.js';

type FiscalIssueResult = {
  tenantId: string;
  orderId: string;
  accessKey: string | null;
  status: string;
  environment: string;
  xmlUrl: string | null;
  pdfUrl: string | null;
  message: string;
};

interface FiscalProvider {
  issue(orderId: string): Promise<FiscalIssueResult>;
}

class MockFiscalProvider implements FiscalProvider {
  async issue(orderId: string): Promise<FiscalIssueResult> {
    const tenantId = getTenantId();
    const order = await prisma.order.findUnique({
      where: { id: orderId, tenantId },
      include: { items: true, customer: true },
    });

    if (!order) {
      throw new Error('Pedido nao encontrado.');
    }

    let fiscalConfig = await prisma.fiscalSettings.findUnique({
      where: { tenantId },
    });

    if (!fiscalConfig) {
      fiscalConfig = await prisma.fiscalSettings.create({
        data: {
          tenantId,
          environment: 'HOMOLOGACAO',
        },
      });
    }

    return {
      tenantId,
      orderId,
      accessKey: null,
      status: 'DEMO_ISSUED',
      environment: fiscalConfig.environment,
      xmlUrl: null,
      pdfUrl: null,
      message:
        'Documento fiscal demonstrativo. Nenhuma NFC-e foi transmitida ou autorizada pela SEFAZ.',
    };
  }
}

function getFiscalProvider(): FiscalProvider {
  const provider = String(process.env.FISCAL_PROVIDER ?? 'MOCK')
    .trim()
    .toUpperCase();
  if (provider !== 'MOCK') {
    throw new Error('Provider fiscal real ainda nao configurado neste ambiente.');
  }
  return new MockFiscalProvider();
}

export class FiscalService {
  static async issueNfce(orderId: string) {
    const provider = getFiscalProvider();
    const data = await provider.issue(orderId);

    const existingDoc = await prisma.fiscalDocument.findUnique({
      where: { orderId },
    });

    if (existingDoc && ['ISSUED', 'DEMO_ISSUED'].includes(existingDoc.status)) {
      return {
        ...existingDoc,
        message:
          existingDoc.status === 'DEMO_ISSUED'
            ? 'Documento fiscal demonstrativo ja registrado para este pedido.'
            : existingDoc.message,
      };
    }

    if (existingDoc) {
      return prisma.fiscalDocument.update({
        where: { id: existingDoc.id },
        data,
      });
    }

    return prisma.fiscalDocument.create({ data });
  }
}
