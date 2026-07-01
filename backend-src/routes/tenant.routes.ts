import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

export const tenantRoutes = Router();

// GET /api/public/resolve-store
// Usado pelo frontend ao carregar a página para saber qual Tenant acessar.
// Pode enviar 'slug' (modo de desenvolvimento ou fallback) ou 'host' (domínio real).
tenantRoutes.get(
  '/public/resolve-store',
  asyncHandler(async (req, res) => {
    console.log('HIT resolve-store', req.query);
    const { slug, host } = req.query;

    let tenant = null;

    if (slug) {
      tenant = await prisma.tenant.findFirst({
        where: { slug: String(slug), isActive: true },
        include: { storeSettings: true }
      });
    } else if (host) {
      const parsedHost = String(host).replace(/^https?:\/\//, '').split(':')[0]; // remove http e porta
      
      tenant = await prisma.tenant.findFirst({
        where: {
          isActive: true,
          OR: [
            { customDomain: parsedHost },
            { subdomain: parsedHost.split('.')[0] }
          ]
        },
        include: { storeSettings: true }
      });
    }

    if (!tenant) {
      // Fallback para o primeiro tenant se nada bater (evitar quebrar dev)
      // Em uma aplicação SaaS real estrita, retornaríamos 404.
      tenant = await prisma.tenant.findFirst({
        where: { isActive: true },
        include: { storeSettings: true }
      });

      if (!tenant) {
         res.status(404).json({ message: 'Nenhuma loja encontrada.' });
         return;
      }
    }

    const settings = tenant.storeSettings[0];

    // Retorna o tenant e configs básicas visuais que o App.jsx precisa imediatamente
    res.json({
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      storeName: settings?.storeName,
      logoUrl: settings?.logoUrl,
      faviconUrl: settings?.faviconUrl,
      navbarColor: settings?.navbarColor,
      brandColor: settings?.brandColor,
      isOpen: settings?.isOpen ?? true,
      isMaintenance: settings?.isMaintenance ?? false,
      maintenanceMessage: settings?.maintenanceMessage,
      pixKey: settings?.pixKey,
      pixMerchantName: settings?.pixMerchantName,
      pixCity: settings?.pixCity,
    });
  })
);
