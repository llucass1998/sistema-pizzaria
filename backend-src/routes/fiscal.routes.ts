import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import { requireRole } from '../middlewares/requireRole.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { FiscalService } from '../services/FiscalService.js';
import { prisma } from '../lib/prisma.js';
import { getTenantId } from '../core/context/TenantContext.js';

export const fiscalRoutes = Router();

// Apenas admins/gerentes podem acessar rotas fiscais no painel administrativo
fiscalRoutes.use(requireAdmin);
fiscalRoutes.use(requireRole(['OWNER', 'ADMIN', 'MANAGER']));

const updateSettingsSchema = z.object({
  environment: z.enum(['HOMOLOGACAO', 'PRODUCAO']).optional(),
  certificateUrl: z.string().optional().nullable(),
  certificatePassword: z.string().optional().nullable(),
  tokenSefaz: z.string().optional().nullable(),
});

function fiscalSettingsDto(settings: {
  id: string;
  tenantId: string;
  environment: string;
  certificateUrl: string | null;
  certificatePassword: string | null;
  tokenSefaz: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: settings.id,
    tenantId: settings.tenantId,
    environment: settings.environment,
    certificateUrl: settings.certificateUrl ?? '',
    certificatePassword: settings.certificatePassword ? '********' : '',
    tokenSefaz: settings.tokenSefaz ? '********' : '',
    hasCertificatePassword: Boolean(settings.certificatePassword),
    hasTokenSefaz: Boolean(settings.tokenSefaz),
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
  };
}

fiscalRoutes.get(
  '/',
  asyncHandler(async (_req, res) => {
    const tenantId = getTenantId();
    const [settings, documentsCount] = await Promise.all([
      prisma.fiscalSettings.findUnique({ where: { tenantId } }),
      prisma.fiscalDocument.count({ where: { tenantId } }),
    ]);

    res.json({
      module: 'fiscal',
      provider: 'MOCK',
      environment: settings?.environment ?? 'HOMOLOGACAO',
      documentsCount,
    });
  }),
);

/**
 * GET /api/admin/fiscal/settings
 * Retorna configurações fiscais da loja. Se não existirem, cria o padrão HOMOLOGACAO.
 */
fiscalRoutes.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    const tenantId = getTenantId();

    let settings = await prisma.fiscalSettings.findUnique({
      where: { tenantId },
    });

    if (!settings) {
      settings = await prisma.fiscalSettings.create({
        data: {
          tenantId,
          environment: 'HOMOLOGACAO',
        },
      });
    }

    res.json(fiscalSettingsDto(settings));
  }),
);

/**
 * PATCH /api/admin/fiscal/settings
 * Atualiza configurações fiscais da loja (Ambiente, Token SEFAZ, etc).
 */
fiscalRoutes.patch(
  '/settings',
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const payload = updateSettingsSchema.parse(req.body);

    const certificatePassword = payload.certificatePassword?.trim();
    const tokenSefaz = payload.tokenSefaz?.trim();
    const keepCertificatePassword = !certificatePassword || certificatePassword === '********';
    const keepTokenSefaz = !tokenSefaz || tokenSefaz === '********';

    const updated = await prisma.fiscalSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        environment: payload.environment ?? 'HOMOLOGACAO',
        certificateUrl: payload.certificateUrl,
        certificatePassword: keepCertificatePassword ? null : certificatePassword,
        tokenSefaz: keepTokenSefaz ? null : tokenSefaz,
      },
      update: {
        ...(payload.environment ? { environment: payload.environment } : {}),
        ...(payload.certificateUrl !== undefined ? { certificateUrl: payload.certificateUrl } : {}),
        ...(!keepCertificatePassword ? { certificatePassword } : {}),
        ...(!keepTokenSefaz ? { tokenSefaz } : {}),
      },
    });

    res.json(fiscalSettingsDto(updated));
  }),
);

/**
 * GET /api/admin/fiscal/documents
 * Lista documentos fiscais emitidos pela loja (com dados do pedido e cliente associado).
 */
fiscalRoutes.get(
  '/documents',
  asyncHandler(async (_req, res) => {
    const tenantId = getTenantId();

    const docs = await prisma.fiscalDocument.findMany({
      where: { tenantId },
      include: {
        order: {
          select: {
            id: true,
            total: true,
            status: true,
            createdAt: true,
            customer: {
              select: {
                name: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(
      docs.map((d) => ({
        ...d,
        orderTotal: d.order ? Number(d.order.total) : 0,
      })),
    );
  }),
);

/**
 * POST /api/admin/fiscal/orders/:orderId/issue
 * Solicita emissão avulsa / demonstrativa da NFC-e de um pedido.
 */
fiscalRoutes.post(
  '/orders/:orderId/issue',
  asyncHandler(async (req, res) => {
    const orderId = req.params.orderId as string;

    const doc = await FiscalService.issueNfce(orderId);

    res.json({
      message: 'Fiscal demonstrativo registrado. Nenhuma NFC-e real foi emitida.',
      document: doc,
    });
  }),
);
