import { Router } from 'express';

import { IntegrationProvider } from '../../generated/prisma/index.js';
import { getTenantId } from '../core/context/TenantContext.js';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import { requireRole } from '../middlewares/requireRole.js';
import { getIdParam } from '../utils/request.js';
import { normalizeText } from '../utils/normalize.js';
import { IfoodService } from '../integrations/ifood/ifood.service.js';

export const integrationRoutes = Router();

integrationRoutes.use(requireAdmin);


function parseProvider(value: unknown) {
  const provider = normalizeText(value).toUpperCase();

  if (provider === 'IFOOD') return IntegrationProvider.IFOOD;
  if (provider === '99FOOD' || provider === 'FOOD_99') return IntegrationProvider.FOOD_99;

  return null;
}

function credentialDto(credential: any) {
  return {
    id: credential.id,
    provider: credential.provider === IntegrationProvider.FOOD_99 ? '99FOOD' : credential.provider,
    merchantId: credential.merchantId ?? '',
    clientId: credential.clientId,
    clientSecret: credential.clientSecret ? '********' : '',
    hasAccessToken: Boolean(credential.accessToken),
    tokenType: credential.tokenType,
    scopes: credential.scopes ?? '',
    expiresAt: credential.expiresAt,
    isActive: credential.isActive,
    metadata: credential.metadata ?? null,
    lastSyncAt: credential.lastSyncAt,
    createdAt: credential.createdAt,
    updatedAt: credential.updatedAt,
  };
}

integrationRoutes.get(
  '/integrations',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'INTEGRATION_MANAGER']),
  asyncHandler(async (_req, res) => {
    const credentials = await prisma.integrationCredential.findMany({
      orderBy: [{ provider: 'asc' }, { createdAt: 'desc' }],
    });

    res.json(credentials.map(credentialDto));
  }),
);

integrationRoutes.get(
  '/integrations/credentials',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'INTEGRATION_MANAGER']),
  asyncHandler(async (_req, res) => {
    const credentials = await prisma.integrationCredential.findMany({
      orderBy: [{ provider: 'asc' }, { createdAt: 'desc' }],
    });

    res.json(credentials.map(credentialDto));
  }),
);

integrationRoutes.get(
  '/integrations/ifood',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'INTEGRATION_MANAGER']),
  asyncHandler(async (_req, res) => {
    const credentials = await prisma.integrationCredential.findMany({
      where: { provider: IntegrationProvider.IFOOD },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({
      provider: 'IFOOD',
      credentials: credentials.map(credentialDto),
    });
  }),
);

integrationRoutes.post(
  '/integrations/credentials',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'INTEGRATION_MANAGER']),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const provider = parseProvider(req.body.provider);
    const merchantId = normalizeText(req.body.merchantId) || null;
    const clientId = normalizeText(req.body.clientId);
    const clientSecret = normalizeText(req.body.clientSecret);

    if (!provider) {
      res.status(400).json({ message: 'Provider invalido. Use IFOOD ou 99FOOD.' });
      return;
    }

    if (!clientId || !clientSecret) {
      res.status(400).json({ message: 'Informe clientId e clientSecret.' });
      return;
    }

    const existing = await prisma.integrationCredential.findFirst({
      where: { tenantId, provider, merchantId },
    });

    const credential = existing
      ? await prisma.integrationCredential.update({
          where: { id: existing.id },
          data: {
            clientId,
            clientSecret,
            metadata: req.body.metadata ?? undefined,
            isActive: typeof req.body.isActive === 'boolean' ? req.body.isActive : true,
          },
        })
      : await prisma.integrationCredential.create({
          data: {
            provider,
            merchantId,
            clientId,
            clientSecret,
            metadata: req.body.metadata ?? undefined,
            isActive: typeof req.body.isActive === 'boolean' ? req.body.isActive : true,
          } as any,
        });

    res.status(201).json(credentialDto(credential));
  }),
);

integrationRoutes.put(
  '/integrations/credentials/:id',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'INTEGRATION_MANAGER']),
  asyncHandler(async (req, res) => {
    const id = getIdParam(req, res);
    if (!id) return;

    const existing = await prisma.integrationCredential.findFirst({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: 'Credencial nao encontrada.' });
      return;
    }

    const provider =
      req.body.provider === undefined ? existing.provider : parseProvider(req.body.provider);
    if (!provider) {
      res.status(400).json({ message: 'Provider invalido. Use IFOOD ou 99FOOD.' });
      return;
    }

    const clientSecret = normalizeText(req.body.clientSecret);
    const shouldKeepSecret = !clientSecret || clientSecret === '********';

    const credential = await prisma.integrationCredential.update({
      where: { id: existing.id },
      data: {
        provider,
        merchantId:
          req.body.merchantId === undefined
            ? existing.merchantId
            : normalizeText(req.body.merchantId) || null,
        clientId:
          req.body.clientId === undefined
            ? existing.clientId
            : normalizeText(req.body.clientId) || existing.clientId,
        clientSecret: shouldKeepSecret ? existing.clientSecret : clientSecret,
        metadata: req.body.metadata === undefined ? existing.metadata : req.body.metadata,
        isActive: typeof req.body.isActive === 'boolean' ? req.body.isActive : existing.isActive,
        accessToken: shouldKeepSecret ? existing.accessToken : null,
        refreshToken: shouldKeepSecret ? existing.refreshToken : null,
        expiresAt: shouldKeepSecret ? existing.expiresAt : null,
      },
    });

    res.json(credentialDto(credential));
  }),
);

integrationRoutes.delete(
  '/integrations/credentials/:id',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'INTEGRATION_MANAGER']),
  asyncHandler(async (req, res) => {
    const id = getIdParam(req, res);
    if (!id) return;

    const credential = await prisma.integrationCredential.findFirst({ where: { id } });
    if (!credential) {
      res.status(404).json({ message: 'Credencial nao encontrada.' });
      return;
    }

    await prisma.integrationCredential.update({
      where: { id },
      data: { isActive: false },
    });

    res.status(204).send();
  }),
);

integrationRoutes.post(
  '/integrations/ifood/poll-now',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'INTEGRATION_MANAGER']),
  asyncHandler(async (req, res) => {
    const id = normalizeText(req.body.credentialId);

    if (id) {
      const credential = await prisma.integrationCredential.findFirst({
        where: { id, provider: IntegrationProvider.IFOOD, isActive: true },
      });

      if (!credential) {
        res.status(404).json({ message: 'Credencial iFood ativa nao encontrada.' });
        return;
      }

      await IfoodService.pollCredential(credential);
      res.json({ ok: true, credentialId: credential.id });
      return;
    }

    const credentials = await prisma.integrationCredential.findMany({
      where: { provider: IntegrationProvider.IFOOD, isActive: true },
    });

    for (const credential of credentials) {
      await IfoodService.pollCredential(credential);
    }

    res.json({ ok: true, credentials: credentials.length });
  }),
);

integrationRoutes.get(
  '/integrations/events',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'INTEGRATION_MANAGER']),
  asyncHandler(async (req, res) => {
    const provider = req.query.provider ? parseProvider(req.query.provider) : null;
    const events = await prisma.integrationEventLog.findMany({
      where: provider ? { provider } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(events);
  }),
);

import { IfoodCatalogService } from '../integrations/ifood/ifood-catalog.service.js';
import { IfoodMerchantService } from '../integrations/ifood/ifood-merchant.service.js';

integrationRoutes.get(
  '/integrations/ifood/catalog/preview',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'INTEGRATION_MANAGER']),
  asyncHandler(async (_req, res) => {
    const tenantId = getTenantId();
    const preview = await IfoodCatalogService.getCatalogPreview(tenantId);
    res.json(preview);
  }),
);

integrationRoutes.post(
  '/integrations/ifood/catalog/sync',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'INTEGRATION_MANAGER']),
  asyncHandler(async (req, res) => {
    const id = normalizeText(req.body.credentialId);
    if (!id) {
      res.status(400).json({ message: 'credentialId is required' });
      return;
    }
    const credential = await prisma.integrationCredential.findFirst({
      where: { id, provider: IntegrationProvider.IFOOD, isActive: true },
    });
    if (!credential) {
      res.status(404).json({ message: 'Credencial ativa nao encontrada.' });
      return;
    }

    const result = await IfoodCatalogService.syncCatalog(credential);
    res.json(result);
  }),
);

integrationRoutes.get(
  '/integrations/ifood/merchant/status',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'INTEGRATION_MANAGER']),
  asyncHandler(async (req, res) => {
    const id = normalizeText(req.query.credentialId);
    if (!id) {
      res.status(400).json({ message: 'credentialId is required' });
      return;
    }
    const credential = await prisma.integrationCredential.findFirst({
      where: { id, provider: IntegrationProvider.IFOOD, isActive: true },
    });
    if (!credential) {
      res.status(404).json({ message: 'Credencial ativa nao encontrada.' });
      return;
    }

    const status = await IfoodMerchantService.getStatus(credential);
    res.json(status);
  }),
);

integrationRoutes.post(
  '/integrations/ifood/merchant/pause',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'INTEGRATION_MANAGER']),
  asyncHandler(async (req, res) => {
    const id = normalizeText(req.body.credentialId);
    const reason = normalizeText(req.body.reason);
    if (!id) {
      res.status(400).json({ message: 'credentialId is required' });
      return;
    }
    if (!reason) {
      res.status(400).json({ message: 'Motivo (reason) is required' });
      return;
    }
    const credential = await prisma.integrationCredential.findFirst({
      where: { id, provider: IntegrationProvider.IFOOD, isActive: true },
    });
    if (!credential) {
      res.status(404).json({ message: 'Credencial ativa nao encontrada.' });
      return;
    }

    const adminId = (req as any).admin?.id;
    const result = await IfoodMerchantService.pauseMerchant(credential, reason, adminId);
    res.json(result);
  }),
);

integrationRoutes.post(
  '/integrations/ifood/merchant/resume',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'INTEGRATION_MANAGER']),
  asyncHandler(async (req, res) => {
    const id = normalizeText(req.body.credentialId);
    if (!id) {
      res.status(400).json({ message: 'credentialId is required' });
      return;
    }
    const credential = await prisma.integrationCredential.findFirst({
      where: { id, provider: IntegrationProvider.IFOOD, isActive: true },
    });
    if (!credential) {
      res.status(404).json({ message: 'Credencial ativa nao encontrada.' });
      return;
    }

    const adminId = (req as any).admin?.id;
    const result = await IfoodMerchantService.resumeMerchant(credential, adminId);
    res.json(result);
  }),
);
