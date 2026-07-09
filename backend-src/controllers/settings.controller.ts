import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getStoreSettings } from '../services/storeSettings.service.js';
import { getTenantId } from '../core/context/TenantContext.js';
import { updateTenantFsSettings } from '../services/tenantSettingsFs.service.js';

const DEFAULT_NAVBAR_COLOR = '#970F0F';
const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/;

function normalizeHexColor(value: unknown, fallback = DEFAULT_NAVBAR_COLOR) {
  if (value === undefined) {
    return undefined;
  }

  const color = String(value ?? '').trim();
  return color || fallback;
}

const hexColorSchema = z.preprocess(
  (value) => normalizeHexColor(value),
  z.string().regex(HEX_COLOR_REGEX, 'Cor da navbar invalida. Use uma cor hexadecimal valida.'),
);

const optionalAssetUrlSchema = z.preprocess(
  (value) => {
    if (value === undefined) {
      return undefined;
    }

    const text = String(value ?? '').trim();
    return text || null;
  },
  z
    .string()
    .max(500)
    .nullable()
    .optional()
    .refine((value) => {
      if (!value) {
        return true;
      }

      return (
        value.startsWith('/uploads/') || value.startsWith('https://') || value.startsWith('http://')
      );
    }, 'Informe uma URL de imagem valida.'),
);

export const updateDeliveryFeeSchema = z.object({
  deliveryFee: z.coerce.number().min(0, 'A taxa de entrega não pode ser negativa.'),
});

export const updateStoreSettingsSchema = z.object({
  deliveryFeeMode: z.enum(['FIXED', 'NEIGHBORHOOD', 'DISTANCE']).optional(),
  deliveryFee: z.coerce.number().min(0).optional(),
  serviceFee: z.coerce.number().min(0).optional(),
  isOpen: z.boolean().optional(),
  storeName: z.string().optional(),
  hours: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  whatsappNumber: z.string().optional(),
  pixKey: z.string().optional(),
  pixMerchantName: z.string().optional(),
  pixCity: z.string().optional(),
  gatewayEnabled: z.boolean().optional(),
  depositEnabled: z.boolean().optional(),
  depositPercent: z.coerce
    .number()
    .gt(0, 'Percentual da entrada deve ser maior que 0.')
    .lt(100, 'Percentual da entrada deve ser menor que 100.')
    .optional(),
  depositRequiredMethods: z.string().max(200).optional(),
  allowPayRestOnDelivery: z.boolean().optional(),
  depositLabel: z.string().max(200).optional(),
  logoUrl: optionalAssetUrlSchema,
  faviconUrl: optionalAssetUrlSchema,
  appleTouchIconUrl: optionalAssetUrlSchema,
  openGraphImageUrl: optionalAssetUrlSchema,
  navbarColor: hexColorSchema.optional(),
  brandColor: hexColorSchema.optional(),
  featuredProductId: z.string().nullable().optional(),
  isMaintenance: z.boolean().optional(),
  maintenanceMessage: z.string().nullable().optional(),
  notifyNewOrderWhatsApp: z.boolean().optional(),
  notifyLowStockWhatsApp: z.boolean().optional(),
  notifyDeliveryDoneWhatsApp: z.boolean().optional(),
  notificationWhatsAppNumber: z.string().optional(),
});

export const SettingsController = {
  async getSettings(_req: Request, res: Response) {
    const settings = await getStoreSettings();
    res.json(settings);
  },

  async updateDeliveryFee(req: Request, res: Response) {
    const { deliveryFee } = req.body;
    const tenantId = getTenantId();

    const settings = await prisma.storeSetting.upsert({
      where: { tenantId },
      update: { deliveryFee },
      create: { tenantId, deliveryFee } as any,
    });

    res.json(settings);
  },

  async updateStoreSettings(req: Request, res: Response) {
    const currentSettings = await getStoreSettings();
    const payload = req.body;
    const tenantId = getTenantId();

    const settings = await prisma.storeSetting.upsert({
      where: { tenantId },
      update: {
        isOpen: payload.isOpen ?? currentSettings.isOpen,
        storeName: payload.storeName ?? currentSettings.storeName,
        hours: payload.hours ?? currentSettings.hours,
        address: payload.address ?? currentSettings.address,
        phone: payload.phone ?? currentSettings.phone,
        whatsappNumber: payload.whatsappNumber ?? currentSettings.whatsappNumber,
        pixKey: payload.pixKey ?? currentSettings.pixKey,
        pixMerchantName:
          payload.pixMerchantName ?? payload.storeName ?? currentSettings.pixMerchantName,
        pixCity: payload.pixCity ?? currentSettings.pixCity,
        ...(payload.gatewayEnabled !== undefined ? { gatewayEnabled: payload.gatewayEnabled } : {}),
        ...(payload.depositEnabled !== undefined ? { depositEnabled: payload.depositEnabled } : {}),
        ...(payload.depositPercent !== undefined ? { depositPercent: payload.depositPercent } : {}),
        ...(payload.depositRequiredMethods !== undefined
          ? { depositRequiredMethods: payload.depositRequiredMethods }
          : {}),
        ...(payload.allowPayRestOnDelivery !== undefined
          ? { allowPayRestOnDelivery: payload.allowPayRestOnDelivery }
          : {}),
        ...(payload.depositLabel !== undefined ? { depositLabel: payload.depositLabel } : {}),
        logoUrl: payload.logoUrl !== undefined ? payload.logoUrl : currentSettings.logoUrl,
        faviconUrl:
          payload.faviconUrl !== undefined ? payload.faviconUrl : currentSettings.faviconUrl,
        appleTouchIconUrl:
          payload.appleTouchIconUrl !== undefined
            ? payload.appleTouchIconUrl
            : currentSettings.appleTouchIconUrl,
        openGraphImageUrl:
          payload.openGraphImageUrl !== undefined
            ? payload.openGraphImageUrl
            : currentSettings.openGraphImageUrl,
        navbarColor: payload.navbarColor ?? currentSettings.navbarColor ?? DEFAULT_NAVBAR_COLOR,
        brandColor: payload.brandColor ?? currentSettings.brandColor ?? DEFAULT_NAVBAR_COLOR,
        ...(payload.deliveryFeeMode !== undefined
          ? { deliveryFeeMode: payload.deliveryFeeMode }
          : {}),
        ...(payload.deliveryFee !== undefined ? { deliveryFee: payload.deliveryFee } : {}),
        ...(payload.serviceFee !== undefined ? { serviceFee: payload.serviceFee } : {}),
        ...(payload.featuredProductId !== undefined
          ? { featuredProductId: payload.featuredProductId }
          : {}),
        ...(payload.isMaintenance !== undefined ? { isMaintenance: payload.isMaintenance } : {}),
        ...(payload.maintenanceMessage !== undefined
          ? { maintenanceMessage: payload.maintenanceMessage }
          : {}),
      },
      create: {
        tenantId,
        isOpen: payload.isOpen ?? currentSettings.isOpen,
        storeName: payload.storeName ?? currentSettings.storeName,
        hours: payload.hours ?? currentSettings.hours,
        address: payload.address ?? currentSettings.address,
        phone: payload.phone ?? currentSettings.phone,
        whatsappNumber: payload.whatsappNumber ?? currentSettings.whatsappNumber,
        pixKey: payload.pixKey ?? currentSettings.pixKey,
        pixMerchantName:
          payload.pixMerchantName ?? payload.storeName ?? currentSettings.pixMerchantName,
        pixCity: payload.pixCity ?? currentSettings.pixCity,
        gatewayEnabled: payload.gatewayEnabled ?? currentSettings.gatewayEnabled ?? false,
        depositEnabled: payload.depositEnabled ?? currentSettings.depositEnabled ?? false,
        depositPercent: payload.depositPercent ?? currentSettings.depositPercent ?? 50,
        depositRequiredMethods:
          payload.depositRequiredMethods ??
          currentSettings.depositRequiredMethods ??
          'PIX_ONLINE,CARD_ONLINE,MERCADOPAGO',
        allowPayRestOnDelivery:
          payload.allowPayRestOnDelivery ?? currentSettings.allowPayRestOnDelivery ?? true,
        depositLabel:
          payload.depositLabel ??
          currentSettings.depositLabel ??
          'Pague 50% agora e o restante na entrega.',
        logoUrl: payload.logoUrl !== undefined ? payload.logoUrl : currentSettings.logoUrl,
        faviconUrl:
          payload.faviconUrl !== undefined ? payload.faviconUrl : currentSettings.faviconUrl,
        appleTouchIconUrl:
          payload.appleTouchIconUrl !== undefined
            ? payload.appleTouchIconUrl
            : currentSettings.appleTouchIconUrl,
        openGraphImageUrl:
          payload.openGraphImageUrl !== undefined
            ? payload.openGraphImageUrl
            : currentSettings.openGraphImageUrl,
        navbarColor: payload.navbarColor ?? currentSettings.navbarColor ?? DEFAULT_NAVBAR_COLOR,
        brandColor: payload.brandColor ?? currentSettings.brandColor ?? DEFAULT_NAVBAR_COLOR,
        deliveryFeeMode: payload.deliveryFeeMode ?? currentSettings.deliveryFeeMode ?? 'FIXED',
        deliveryFee: payload.deliveryFee ?? currentSettings.deliveryFee,
        serviceFee: payload.serviceFee ?? currentSettings.serviceFee,
        featuredProductId:
          payload.featuredProductId !== undefined
            ? payload.featuredProductId
            : currentSettings.featuredProductId,
        isMaintenance: payload.isMaintenance ?? currentSettings.isMaintenance ?? false,
        maintenanceMessage:
          payload.maintenanceMessage !== undefined
            ? payload.maintenanceMessage
            : currentSettings.maintenanceMessage,
      } as any,
    });

    const fsPayload: Record<string, any> = {};
    if (payload.notifyNewOrderWhatsApp !== undefined)
      fsPayload['notifyNewOrderWhatsApp'] = payload.notifyNewOrderWhatsApp;
    if (payload.notifyLowStockWhatsApp !== undefined)
      fsPayload['notifyLowStockWhatsApp'] = payload.notifyLowStockWhatsApp;
    if (payload.notifyDeliveryDoneWhatsApp !== undefined)
      fsPayload['notifyDeliveryDoneWhatsApp'] = payload.notifyDeliveryDoneWhatsApp;
    if (payload.notificationWhatsAppNumber !== undefined)
      fsPayload['notificationWhatsAppNumber'] = payload.notificationWhatsAppNumber;

    const fsSettings = await updateTenantFsSettings(tenantId, fsPayload);

    res.json({ ...settings, ...fsSettings });
  },
};
