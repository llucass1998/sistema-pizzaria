import { prisma } from '../../lib/prisma.js';
import { logger } from '../../utils/logger.js';
import {
  IntegrationProvider,
  type IntegrationCredential,
} from '../../../generated/prisma/index.js';

export class IfoodCatalogService {
  static async getCatalogPreview(tenantId: string) {
    // 1. Load Categories
    const categories = await prisma.menuCategory.findMany({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    // 2. Load Products with variants and optionGroups
    const products = await prisma.product.findMany({
      where: { tenantId, isAvailable: true },
      include: {
        menuCategory: true,
        variants: { where: { isAvailable: true } },
        optionGroups: {
          include: {
            options: { where: { isAvailable: true } },
          },
        },
      },
    });

    const validItems: any[] = [];
    const invalidItems: any[] = [];

    for (const product of products) {
      if (!product.name) {
        invalidItems.push({ id: product.id, name: 'Sem nome', reason: 'Produto nao possui nome' });
        continue;
      }

      if (Number(product.price) <= 0 && (!product.variants || product.variants.length === 0)) {
        invalidItems.push({
          id: product.id,
          name: product.name,
          reason: 'Produto sem preco base ou variacoes',
        });
        continue;
      }

      const ifoodItem = {
        id: product.id,
        name: product.name,
        description: product.description || '',
        externalCode: product.id,
        status: 'AVAILABLE',
        price: {
          value: Number(product.price),
          currency: 'BRL',
        },
        categoryId: product.categoryId,
        categoryName: product.menuCategory?.name || 'Geral',
        shifts: [],
        optionGroups:
          product.optionGroups?.map((opt: any) => ({
            id: opt.id,
            name: opt.name,
            minQuantity: opt.minChoices,
            maxQuantity: opt.maxChoices,
            options:
              opt.options?.map((item: any) => ({
                id: item.id,
                name: item.name,
                price: Number(item.price || 0),
                status: 'AVAILABLE',
              })) || [],
          })) || [],
      };

      validItems.push(ifoodItem);
    }

    return {
      totalCategories: categories.length,
      categories: categories.map((c: any) => ({ id: c.id, name: c.name })),
      totalValidItems: validItems.length,
      totalInvalidItems: invalidItems.length,
      validItems,
      invalidItems,
    };
  }

  static async syncCatalog(credential: IntegrationCredential) {
    const preview = await this.getCatalogPreview(credential.tenantId);

    if (preview.totalValidItems === 0) {
      throw new Error('Nenhum produto valido para sincronizar.');
    }

    logger.info(
      `[iFood Catalog] Sincronizando ${preview.totalValidItems} itens para a loja ${credential.merchantId}`,
    );

    // Em uma integracao real, aqui fariamos os POSTs para a API do iFood
    // Ex: POST /catalog/v1.0/merchants/{merchantId}/catalogs
    // Mockando para homologacao

    await prisma.integrationEventLog.create({
      data: {
        tenantId: credential.tenantId,
        provider: IntegrationProvider.IFOOD,
        eventId: `CATALOG_SYNC_${Date.now()}`,
        eventType: 'CATALOG_SYNC',
        status: 'PROCESSED',
        payload: {
          validItems: preview.totalValidItems,
          invalidItems: preview.totalInvalidItems,
        } as any,
      } as any,
    });

    return {
      success: true,
      syncedItems: preview.totalValidItems,
    };
  }
}
