import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  tenantFindFirst: vi.fn(),
  storeSettingFindUnique: vi.fn(),
  storeSettingCreate: vi.fn(),
  menuCategoryCount: vi.fn(),
  menuCategoryFindMany: vi.fn(),
  productFindMany: vi.fn(),
}));

vi.mock('../core/context/TenantContext.js', () => ({
  getTenantId: () => 'tenant-e2e',
}));

vi.mock('../lib/prisma.js', () => ({
  basePrisma: {
    tenant: {
      findFirst: mocks.tenantFindFirst,
    },
  },
  prisma: {
    tenant: {
      findFirst: mocks.tenantFindFirst,
    },
    storeSetting: {
      findUnique: mocks.storeSettingFindUnique,
      create: mocks.storeSettingCreate,
    },
    menuCategory: {
      count: mocks.menuCategoryCount,
      findMany: mocks.menuCategoryFindMany,
    },
    product: {
      findMany: mocks.productFindMany,
    },
  },
  rlsContext: {
    run: (_context: unknown, callback: () => void) => callback(),
  },
}));

vi.mock('../services/ProductAvailabilityService.js', () => ({
  ProductAvailabilityService: {
    getAvailabilityMap: async () => new Map(),
  },
}));

const { statusRoutes } = await import('./status.routes.js');
const { tenantRoutes } = await import('./tenant.routes.js');
const { settingsRoutes } = await import('./settings.routes.js');
const { productRoutes } = await import('./product.routes.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', tenantRoutes, statusRoutes, settingsRoutes, productRoutes);
  return app;
}

const storeSettings = {
  id: 'settings-1',
  tenantId: 'tenant-e2e',
  isOpen: true,
  isMaintenance: false,
  storeName: 'E2E_TEST_Pizzaria',
  hours: '18:00 - 23:30',
  address: 'Rua E2E_TEST, 123',
  phone: '(21) 99999-0000',
  whatsappNumber: '5521999990000',
  deliveryFee: '7.00',
  serviceFee: '2.00',
  navbarColor: '#970F0F',
  brandColor: '#970F0F',
};

const category = {
  id: 'category-1',
  slug: 'pizzas',
  name: 'Pizzas',
  description: 'E2E_TEST_Categoria',
  icon: null,
  imageUrl: null,
  sortOrder: 10,
  isActive: true,
  allowSizes: true,
  allowHalfAndHalf: true,
  halfAndHalfGroup: 'pizza-salgada',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const product = {
  id: 'product-1',
  categoryId: 'category-1',
  category: 'pizzas',
  menuCategory: category,
  name: 'E2E_TEST_Pizza',
  barcode: '7891234567890',
  description: 'Produto de contrato para smoke test',
  price: '39.90',
  imageUrl: null,
  isAvailable: true,
  variants: [],
  optionGroups: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('API smoke contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tenantFindFirst.mockResolvedValue({
      id: 'tenant-e2e',
      slug: 'demo',
      name: 'E2E_TEST_Tenant',
      storeSettings: [storeSettings],
    });
    mocks.storeSettingFindUnique.mockResolvedValue(storeSettings);
    mocks.storeSettingCreate.mockResolvedValue(storeSettings);
    mocks.menuCategoryCount.mockResolvedValue(1);
    mocks.menuCategoryFindMany.mockResolvedValue([category]);
    mocks.productFindMany.mockResolvedValue([product]);
  });

  it('responds to /api/status without touching production data', async () => {
    const response = await request(createApp()).get('/api/status');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, service: 'pizzaria-api' });
  });

  it('resolves a public store by host and returns visual/open flags', async () => {
    const response = await request(createApp())
      .get('/api/public/resolve-store')
      .query({ host: 'pizzarialucas.istigestao.com.br', slug: '' });

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body).toMatchObject({
      id: 'tenant-e2e',
      slug: 'demo',
      isOpen: true,
      isMaintenance: false,
      storeName: 'E2E_TEST_Pizzaria',
    });
    expect(mocks.tenantFindFirst).toHaveBeenCalled();
  });

  it('returns public settings needed by checkout and store status', async () => {
    const response = await request(createApp()).get('/api/configuracoes');

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body).toMatchObject({
      tenantId: 'tenant-e2e',
      isOpen: true,
      deliveryFee: '7.00',
      serviceFee: '2.00',
    });
  });

  it('lists categories and products with tenant-scoped Prisma filters', async () => {
    const app = createApp();

    const categoriesResponse = await request(app).get('/api/categorias');
    const productsResponse = await request(app).get('/api/produtos');
    const productsAliasResponse = await request(app).get('/api/products');

    expect(categoriesResponse.status, JSON.stringify(categoriesResponse.body)).toBe(200);
    expect(productsResponse.status, JSON.stringify(productsResponse.body)).toBe(200);
    expect(productsAliasResponse.status, JSON.stringify(productsAliasResponse.body)).toBe(200);
    expect(categoriesResponse.body[0]).toMatchObject({ slug: 'pizzas', isActive: true });
    expect(productsResponse.body[0]).toMatchObject({
      id: 'product-1',
      name: 'E2E_TEST_Pizza',
      price: 39.9,
    });
    expect(mocks.menuCategoryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-e2e', isActive: true }),
      }),
    );
    expect(mocks.productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-e2e' },
      }),
    );
  });

  it('blocks admin category creation when no admin token is present', async () => {
    const response = await request(createApp())
      .post('/api/categorias')
      .send({ name: 'E2E_TEST_Categoria' });

    expect(response.status).toBe(401);
    expect(response.body.message).toContain('administrador');
  });

  it('searches products by barcode', async () => {
    const response = await request(createApp())
      .get('/api/produtos')
      .query({ barcode: '7891234567890' });

    expect(response.status).toBe(200);
    expect(response.body[0]).toMatchObject({
      id: 'product-1',
      barcode: '7891234567890',
    });
  });
});
