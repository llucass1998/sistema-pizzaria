import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import { getIdParam } from '../utils/request.js';
import { normalizeText, normalizeBarcode, parseMoney } from '../utils/normalize.js';
import { FIELD_LIMITS, validateLength } from '../utils/validate.js';
import { getTenantId } from '../core/context/TenantContext.js';
import { ProductOptionType } from '../../generated/prisma/index.js';
import { ProductAvailabilityService } from '../services/ProductAvailabilityService.js';

export const productRoutes = Router();

const defaultCategory = 'pizzas';

const defaultCategories = [
  {
    slug: 'pizzas',
    name: 'Pizzas',
    description: 'Sabores classicos da casa com massa leve e bastante recheio.',
    imageUrl:
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=80',
    sortOrder: 10,
    allowSizes: true,
    allowHalfAndHalf: true,
    halfAndHalfGroup: 'pizza-salgada',
  },
  {
    slug: 'pizzas-especiais',
    name: 'Pizzas Especiais',
    description: 'Receitas caprichadas para quem quer sair do basico.',
    imageUrl:
      'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=900&q=80',
    sortOrder: 20,
    allowSizes: true,
    allowHalfAndHalf: true,
    halfAndHalfGroup: 'pizza-salgada',
  },
  {
    slug: 'promocoes',
    name: 'Promocoes',
    description: 'Combos e ofertas para pedir bem sem gastar demais.',
    imageUrl:
      'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=80',
    sortOrder: 30,
    allowSizes: false,
    allowHalfAndHalf: false,
    halfAndHalfGroup: null,
  },
  {
    slug: 'bebidas',
    name: 'Bebidas',
    description: 'Refrigerantes e bebidas geladas para acompanhar a pizza.',
    imageUrl:
      'https://andinacocacola.vtexassets.com/arquivos/ids/159382-800-auto?aspect=true&height=auto&v=639163193134500000&width=800',
    sortOrder: 40,
    allowSizes: false,
    allowHalfAndHalf: false,
    halfAndHalfGroup: null,
  },
  {
    slug: 'sobremesas',
    name: 'Sobremesas',
    description: 'Doces para fechar o pedido no clima certo.',
    imageUrl:
      'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=80',
    sortOrder: 50,
    allowSizes: false,
    allowHalfAndHalf: false,
    halfAndHalfGroup: null,
  },
  {
    slug: 'combos',
    name: 'Combos',
    description: 'Pedidos prontos para dividir com a familia ou amigos.',
    imageUrl:
      'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80',
    sortOrder: 60,
    allowSizes: false,
    allowHalfAndHalf: false,
    halfAndHalfGroup: null,
  },
];

const defaultPizzaVariants = [
  { code: 'P', name: 'Pequena', offset: 0, sortOrder: 10 },
  { code: 'M', name: 'Media', offset: 8, sortOrder: 20 },
  { code: 'G', name: 'Grande', offset: 16, sortOrder: 30 },
  { code: 'FAMILIA', name: 'Familia', offset: 28, sortOrder: 40 },
];

const stockImpactTypes = [
  'NO_STOCK_IMPACT',
  'ADD_INGREDIENT',
  'REMOVE_INGREDIENT',
  'REPLACE_INGREDIENT',
] as const;

function parseInteger(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function toSlug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function validateTextField(value: string, label: string, maxLength: number, required = false) {
  return validateLength(value, label, maxLength, required);
}

function categoryAllowsSizes(category: { allowSizes?: boolean; slug?: string }) {
  return (
    Boolean(category.allowSizes) ||
    category.slug === 'pizzas' ||
    category.slug === 'pizzas-especiais'
  );
}

function categoryDto(category: any) {
  return {
    id: category.id,
    slug: category.slug,
    path: category.slug,
    name: category.name,
    description: category.description ?? '',
    icon: category.icon ?? '',
    imageUrl: category.imageUrl ?? '',
    image: category.icon ?? category.imageUrl ?? '',
    sortOrder: category.sortOrder ?? 0,
    isActive: category.isActive ?? true,
    allowSizes: category.allowSizes ?? false,
    allowHalfAndHalf: category.allowHalfAndHalf ?? false,
    halfAndHalfGroup: category.halfAndHalfGroup ?? '',
    kdsStation: category.kdsStation ?? null,
    prepTimeMinutes: category.prepTimeMinutes ?? null,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

function variantDto(variant: any) {
  return {
    id: variant.id,
    productId: variant.productId,
    code: variant.code,
    name: variant.name,
    price: Number(variant.price ?? 0),
    sortOrder: variant.sortOrder ?? 0,
    isAvailable: variant.isAvailable ?? true,
  };
}

function productDto(product: any) {
  const categorySlug = product.menuCategory?.slug ?? product.category ?? defaultCategory;
  const categoryName = product.menuCategory?.name ?? categorySlug;
  const category = product.menuCategory ?? null;

  return {
    id: product.id,
    productId: product.id,
    categoryId: product.categoryId ?? null,
    category: categorySlug,
    categoryName,
    categoryMeta: category ? categoryDto(category) : null,
    allowSizes: category?.allowSizes ?? categoryAllowsSizes({ slug: categorySlug }),
    allowHalfAndHalf: category?.allowHalfAndHalf ?? false,
    halfAndHalfGroup: category?.halfAndHalfGroup ?? '',
    name: product.name,
    barcode: product.barcode ?? null,
    description: product.description ?? '',
    price: Number(product.price ?? 0),
    imageUrl: product.imageUrl ?? '',
    isAvailable: product.isAvailable ?? true,
    kdsStation: product.kdsStation ?? null,
    prepTimeMinutes: product.prepTimeMinutes ?? null,
    calculatedAvailability: availabilityDto(product.calculatedAvailability),
    variants: (product.variants ?? [])
      .slice()
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map(variantDto),
    optionGroups: (product.optionGroups ?? [])
      .slice()
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map(optionGroupDto),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function optionGroupDto(group: any) {
  return {
    id: group.id,
    productId: group.productId,
    name: group.name,
    description: group.description ?? '',
    isRequired: group.isRequired ?? false,
    minChoices: group.minChoices ?? 0,
    maxChoices: group.maxChoices ?? 1,
    sortOrder: group.sortOrder ?? 0,
    options: (group.options ?? [])
      .slice()
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map(optionItemDto),
  };
}

function optionItemDto(option: any) {
  return {
    id: option.id,
    groupId: option.groupId,
    name: option.name,
    price: Number(option.price ?? 0),
    isAvailable: option.isAvailable ?? true,
    sortOrder: option.sortOrder ?? 0,
    stockImpactType: option.stockImpactType ?? 'NO_STOCK_IMPACT',
    ingredientId: option.ingredientId ?? '',
    ingredientQuantity:
      option.ingredientQuantity === null || option.ingredientQuantity === undefined
        ? ''
        : Number(option.ingredientQuantity),
    replacementIngredientId: option.replacementIngredientId ?? '',
  };
}

function optionDto(option: any) {
  return {
    id: option.id,
    type: option.type,
    name: option.name,
    description: option.description ?? '',
    price: Number(option.price ?? 0),
    sortOrder: option.sortOrder ?? 0,
    isAvailable: option.isAvailable ?? true,
    stockImpactType: option.stockImpactType ?? 'NO_STOCK_IMPACT',
    ingredientId: option.ingredientId ?? '',
    ingredientQuantity:
      option.ingredientQuantity === null || option.ingredientQuantity === undefined
        ? ''
        : Number(option.ingredientQuantity),
    replacementIngredientId: option.replacementIngredientId ?? '',
  };
}

function availabilityDto(availability: any) {
  if (!availability) return null;

  return {
    available: Boolean(availability.available),
    reasons: availability.reasons ?? [],
    missingIngredients: availability.missingIngredients ?? [],
    diagnostics: availability.diagnostics ?? [],
  };
}

function parseStockImpactInput(body: any) {
  const requestedType = normalizeText(body.stockImpactType).toUpperCase();
  const stockImpactType = stockImpactTypes.includes(requestedType as any)
    ? requestedType
    : 'NO_STOCK_IMPACT';
  const ingredientId = normalizeText(body.ingredientId) || null;
  const ingredientQuantity = parseMoney(body.ingredientQuantity);
  const replacementIngredientId = normalizeText(body.replacementIngredientId) || null;

  if (stockImpactType === 'NO_STOCK_IMPACT') {
    return {
      stockImpactType,
      ingredientId: null,
      ingredientQuantity: null,
      replacementIngredientId: null,
    };
  }

  return {
    stockImpactType,
    ingredientId,
    ingredientQuantity:
      ingredientQuantity && Number(ingredientQuantity) > 0 ? ingredientQuantity : null,
    replacementIngredientId:
      stockImpactType === 'REPLACE_INGREDIENT' ? replacementIngredientId : null,
  };
}

async function validateStockImpactTenant(data: ReturnType<typeof parseStockImpactInput>) {
  const tenantId = getTenantId();
  const ids = [data.ingredientId, data.replacementIngredientId].filter((id): id is string =>
    Boolean(id),
  );

  if (data.stockImpactType !== 'NO_STOCK_IMPACT') {
    if (!data.ingredientId || !data.ingredientQuantity) {
      return 'Informe ingrediente e quantidade para o impacto de estoque.';
    }

    if (data.stockImpactType === 'REPLACE_INGREDIENT' && !data.replacementIngredientId) {
      return 'Informe o ingrediente substituto.';
    }
  }

  if (ids.length > 0) {
    const count = await prisma.ingredient.count({ where: { tenantId, id: { in: ids } } });
    if (count !== ids.length) {
      return 'Um dos ingredientes selecionados nao pertence a esta loja.';
    }
  }

  return null;
}

async function ensureDefaultCategories() {
  const tenantId = getTenantId();
  const count = await prisma.menuCategory.count({ where: { tenantId } });

  if (count > 0) {
    return;
  }

  for (const category of defaultCategories) {
    await prisma.menuCategory.create({
      data: {
        ...category,
        tenantId,
        isActive: true,
      } as any,
    });
  }
}

async function resolveCategory(input: { categoryId?: unknown; category?: unknown }) {
  await ensureDefaultCategories();

  const categoryId = normalizeText(input.categoryId);
  if (categoryId) {
    const category = await prisma.menuCategory.findFirst({
      where: { tenantId: getTenantId(), id: categoryId, isActive: true },
    });

    if (category) {
      return category;
    }
  }

  const requestedSlug = normalizeText(input.category) || defaultCategory;
  const normalizedSlug = requestedSlug === 'especiais' ? 'pizzas-especiais' : requestedSlug;

  return prisma.menuCategory.findFirst({
    where: { tenantId: getTenantId(), slug: normalizedSlug, isActive: true },
  });
}

async function getProductForAdmin(id: string) {
  const product = await prisma.product.findFirst({
    where: { tenantId: getTenantId(), id },
    include: {
      menuCategory: true,
      variants: { orderBy: { sortOrder: 'asc' } },
      optionGroups: {
        include: { options: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!product) return null;

  const availability = await ProductAvailabilityService.getProductAvailability(
    getTenantId(),
    product.id,
  );
  return { ...product, calculatedAvailability: availability };
}

function normalizeVariantInput(variant: any, fallbackPrice: unknown, index: number) {
  const code = normalizeText(variant.code).toUpperCase() || `VAR${index + 1}`;
  const name = normalizeText(variant.name) || code;
  const price = parseMoney(variant.price ?? fallbackPrice);
  const sortOrder = parseInteger(variant.sortOrder, (index + 1) * 10);
  const isAvailable = typeof variant.isAvailable === 'boolean' ? variant.isAvailable : true;

  return {
    id: normalizeText(variant.id),
    code,
    name,
    price,
    sortOrder,
    isAvailable,
  };
}

async function replaceProductVariants(
  productId: string,
  rawVariants: any[],
  fallbackPrice: unknown,
) {
  const tenantId = getTenantId();
  const normalizedVariants = rawVariants
    .map((variant, index) => normalizeVariantInput(variant, fallbackPrice, index))
    .filter((variant) => variant.price !== null && Number(variant.price) > 0);

  const existingVariants = await prisma.productVariant.findMany({
    where: { tenantId, productId },
  });

  const keptVariantIds: string[] = [];

  for (const variant of normalizedVariants) {
    const existing =
      (variant.id ? existingVariants.find((item) => item.id === variant.id) : null) ??
      existingVariants.find((item) => item.code === variant.code);

    if (existing) {
      const updated = await prisma.productVariant.update({
        where: { id: existing.id },
        data: {
          code: variant.code,
          name: variant.name,
          price: variant.price!,
          sortOrder: variant.sortOrder,
          isAvailable: variant.isAvailable,
        },
      });
      keptVariantIds.push(updated.id);
    } else {
      const created = await prisma.productVariant.create({
        data: {
          tenantId,
          productId,
          code: variant.code,
          name: variant.name,
          price: variant.price!,
          sortOrder: variant.sortOrder,
          isAvailable: variant.isAvailable,
        } as any,
      });
      keptVariantIds.push(created.id);
    }
  }

  for (const variant of existingVariants) {
    if (!keptVariantIds.includes(variant.id)) {
      await prisma.productVariant.update({
        where: { id: variant.id },
        data: { isAvailable: false },
      });
    }
  }
}

async function replaceProductOptionGroups(
  productId: string,
  tenantId: string,
  rawOptionGroups: any[],
) {
  // Para simplicidade de integridade, vamos excluir os grupos existentes (cascade excluirá os itens)
  // e recriar, já que eles não estão atrelados diretamente a pedidos.
  await prisma.productOptionGroup.deleteMany({
    where: { productId, tenantId },
  });

  if (!Array.isArray(rawOptionGroups)) return;

  for (const group of rawOptionGroups) {
    const minChoices = parseInteger(group.minChoices, 0);
    const maxChoices = parseInteger(group.maxChoices, 1);

    const createdGroup = await prisma.productOptionGroup.create({
      data: {
        tenantId,
        productId,
        name: normalizeText(group.name) || 'Grupo',
        description: normalizeText(group.description) || null,
        isRequired: typeof group.isRequired === 'boolean' ? group.isRequired : false,
        minChoices,
        maxChoices,
        sortOrder: parseInteger(group.sortOrder, 0),
      },
    });

    if (Array.isArray(group.options)) {
      const optionsData = [];

      for (const [index, opt] of group.options.entries()) {
        const stockImpact = parseStockImpactInput(opt);
        const stockImpactError = await validateStockImpactTenant(stockImpact);
        if (stockImpactError) {
          throw Object.assign(new Error(stockImpactError), { statusCode: 400 });
        }

        optionsData.push({
          groupId: createdGroup.id,
          name: normalizeText(opt.name) || `Opcao ${index + 1}`,
          price: parseMoney(opt.price) || 0,
          isAvailable: typeof opt.isAvailable === 'boolean' ? opt.isAvailable : true,
          sortOrder: parseInteger(opt.sortOrder, index * 10),
          ...stockImpact,
        });
      }

      if (optionsData.length > 0) {
        await prisma.productOptionItem.createMany({
          data: optionsData as any,
        });
      }
    }
  }
}

async function createDefaultVariants(productId: string, basePrice: number) {
  const tenantId = getTenantId();
  for (const variant of defaultPizzaVariants) {
    await prisma.productVariant.create({
      data: {
        tenantId,
        productId,
        code: variant.code,
        name: variant.name,
        price: (basePrice + variant.offset).toFixed(2),
        sortOrder: variant.sortOrder,
        isAvailable: true,
      } as any,
    });
  }
}

async function listProducts() {
  const tenantId = getTenantId();
  const products = await prisma.product.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      menuCategory: true,
      variants: { orderBy: { sortOrder: 'asc' } },
      optionGroups: {
        include: { options: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  const availabilityMap = await ProductAvailabilityService.getAvailabilityMap(
    tenantId,
    products.map((product) => product.id),
  );

  return products.map((product) =>
    productDto({ ...product, calculatedAvailability: availabilityMap.get(product.id) }),
  );
}

async function listOptions(type: ProductOptionType) {
  const options = await prisma.productOption.findMany({
    where: { tenantId: getTenantId(), type },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  return options.map(optionDto);
}

async function createOrUpdateOption(type: ProductOptionType, body: any, id?: string) {
  const tenantId = getTenantId();
  const name = normalizeText(body.name);
  const description = normalizeText(body.description) || null;
  const price = parseMoney(body.price);
  const sortOrder = parseInteger(body.sortOrder, 0);
  const isAvailable = typeof body.isAvailable === 'boolean' ? body.isAvailable : true;
  const stockImpact = parseStockImpactInput(body);
  const stockImpactError = await validateStockImpactTenant(stockImpact);

  const nameError = validateTextField(name, 'Nome', FIELD_LIMITS.NAME, true);
  if (nameError) {
    return { error: nameError.message };
  }

  if (price === null || Number(price) < 0) {
    return { error: 'Informe um preco valido.' };
  }

  if (stockImpactError) {
    return { error: stockImpactError };
  }

  if (description) {
    const descError = validateTextField(description, 'Descricao', FIELD_LIMITS.DESCRIPTION);
    if (descError) {
      return { error: descError.message };
    }
  }

  if (id) {
    const existing = await prisma.productOption.findFirst({ where: { tenantId, id, type } });
    if (!existing) {
      return { error: 'Item nao encontrado.', status: 404 };
    }

    const updated = await prisma.productOption.update({
      where: { id: existing.id },
      data: { name, description, price, sortOrder, isAvailable, ...stockImpact } as any,
    });

    return { data: optionDto(updated) };
  }

  const created = await prisma.productOption.create({
    data: {
      tenantId,
      type,
      name,
      description,
      price,
      sortOrder,
      isAvailable,
      ...stockImpact,
    } as any,
  });

  return { data: optionDto(created), status: 201 };
}

// Categorias
productRoutes.get(
  '/categorias',
  asyncHandler(async (req, res) => {
    await ensureDefaultCategories();

    const includeInactive = req.query.includeInactive === 'true';
    const categories = await prisma.menuCategory.findMany({
      where: {
        tenantId: getTenantId(),
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    res.json(categories.map(categoryDto));
  }),
);

productRoutes.post(
  '/categorias',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const name = normalizeText(req.body.name);
    const slug = toSlug(normalizeText(req.body.slug) || name);
    const description = normalizeText(req.body.description) || null;
    const icon = normalizeText(req.body.icon) || null;
    const imageUrl = normalizeText(req.body.imageUrl) || null;
    const sortOrder = parseInteger(req.body.sortOrder, 0);
    const isActive = typeof req.body.isActive === 'boolean' ? req.body.isActive : true;
    const allowSizes = typeof req.body.allowSizes === 'boolean' ? req.body.allowSizes : false;
    const allowHalfAndHalf =
      typeof req.body.allowHalfAndHalf === 'boolean' ? req.body.allowHalfAndHalf : false;
    const halfAndHalfGroup =
      normalizeText(req.body.halfAndHalfGroup) || (allowHalfAndHalf ? slug : null);

    const nameError = validateTextField(name, 'Nome', FIELD_LIMITS.NAME, true);
    if (nameError) {
      res.status(400).json({ message: nameError.message });
      return;
    }

    if (!slug) {
      res.status(400).json({ message: 'Informe um slug valido para a categoria.' });
      return;
    }

    const duplicate = await prisma.menuCategory.findFirst({
      where: { tenantId: getTenantId(), slug },
    });
    if (duplicate) {
      res.status(409).json({ message: 'Ja existe uma categoria com este slug.' });
      return;
    }

    const category = await prisma.menuCategory.create({
      data: {
        tenantId: getTenantId(),
        name,
        slug,
        description,
        icon,
        imageUrl,
        sortOrder,
        isActive,
        allowSizes,
        allowHalfAndHalf,
        halfAndHalfGroup,
        kdsStation: req.body.kdsStation || null,
        prepTimeMinutes: req.body.prepTimeMinutes ? Number(req.body.prepTimeMinutes) : null,
      } as any,
    });

    res.status(201).json(categoryDto(category));
  }),
);

productRoutes.put(
  '/categorias/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = getIdParam(req, res);
    if (!id) return;

    const category = await prisma.menuCategory.findFirst({
      where: { tenantId: getTenantId(), id },
    });
    if (!category) {
      res.status(404).json({ message: 'Categoria nao encontrada.' });
      return;
    }

    const data: any = {};

    if (req.body.name !== undefined) {
      const name = normalizeText(req.body.name);
      const nameError = validateTextField(name, 'Nome', FIELD_LIMITS.NAME, true);
      if (nameError) {
        res.status(400).json({ message: nameError.message });
        return;
      }
      data.name = name;
    }

    if (req.body.slug !== undefined) {
      const slug = toSlug(normalizeText(req.body.slug));
      if (!slug) {
        res.status(400).json({ message: 'Informe um slug valido para a categoria.' });
        return;
      }

      const duplicate = await prisma.menuCategory.findFirst({
        where: { tenantId: getTenantId(), slug },
      });
      if (duplicate && duplicate.id !== id) {
        res.status(409).json({ message: 'Ja existe uma categoria com este slug.' });
        return;
      }

      data.slug = slug;
    }

    if (req.body.description !== undefined) {
      data.description = normalizeText(req.body.description) || null;
    }
    if (req.body.icon !== undefined) {
      data.icon = normalizeText(req.body.icon) || null;
    }
    if (req.body.imageUrl !== undefined) {
      data.imageUrl = normalizeText(req.body.imageUrl) || null;
    }
    if (req.body.sortOrder !== undefined) {
      data.sortOrder = parseInteger(req.body.sortOrder, category.sortOrder);
    }
    if (typeof req.body.isActive === 'boolean') {
      data.isActive = req.body.isActive;
    }
    if (typeof req.body.allowSizes === 'boolean') {
      data.allowSizes = req.body.allowSizes;
    }
    if (typeof req.body.allowHalfAndHalf === 'boolean') {
      data.allowHalfAndHalf = req.body.allowHalfAndHalf;
    }
    if (req.body.halfAndHalfGroup !== undefined) {
      const nextSlug = data.slug ?? category.slug;
      data.halfAndHalfGroup =
        normalizeText(req.body.halfAndHalfGroup) ||
        ((data.allowHalfAndHalf ?? category.allowHalfAndHalf) ? nextSlug : null);
    } else if (data.allowHalfAndHalf === false) {
      data.halfAndHalfGroup = null;
    } else if (data.allowHalfAndHalf === true && !category.halfAndHalfGroup) {
      data.halfAndHalfGroup = data.slug ?? category.slug;
    }

    if (req.body.kdsStation !== undefined) {
      data.kdsStation = req.body.kdsStation || null;
    }
    if (req.body.prepTimeMinutes !== undefined) {
      data.prepTimeMinutes = req.body.prepTimeMinutes ? Number(req.body.prepTimeMinutes) : null;
    }

    const updated = await prisma.menuCategory.update({
      where: { id },
      data,
    });

    if (data.slug && data.slug !== category.slug) {
      await prisma.product.updateMany({
        where: { tenantId: getTenantId(), category: category.slug },
        data: { category: data.slug },
      });
    }

    res.json(categoryDto(updated));
  }),
);

productRoutes.delete(
  '/categorias/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = getIdParam(req, res);
    if (!id) return;

    const category = await prisma.menuCategory.findFirst({
      where: { tenantId: getTenantId(), id },
    });
    if (!category) {
      res.status(404).json({ message: 'Categoria nao encontrada.' });
      return;
    }

    await prisma.menuCategory.update({
      where: { id },
      data: { isActive: false },
    });

    res.status(204).send();
  }),
);

// Variacoes de produto
productRoutes.get(
  '/produtos/:id/variacoes',
  asyncHandler(async (req, res) => {
    const id = getIdParam(req, res);
    if (!id) return;

    const variants = await prisma.productVariant.findMany({
      where: { tenantId: getTenantId(), productId: id },
      orderBy: { sortOrder: 'asc' },
    });

    res.json(variants.map(variantDto));
  }),
);

productRoutes.post(
  '/produtos/:id/variacoes',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const productId = getIdParam(req, res);
    if (!productId) return;

    const product = await prisma.product.findFirst({
      where: { tenantId: getTenantId(), id: productId },
    });
    if (!product) {
      res.status(404).json({ message: 'Produto nao encontrado.' });
      return;
    }

    const variant = normalizeVariantInput(req.body, product.price, 0);
    if (!variant.price || Number(variant.price) <= 0) {
      res.status(400).json({ message: 'Informe um preco valido para a variacao.' });
      return;
    }

    const created = await prisma.productVariant.create({
      data: {
        tenantId: getTenantId(),
        productId,
        code: variant.code,
        name: variant.name,
        price: variant.price,
        sortOrder: variant.sortOrder,
        isAvailable: variant.isAvailable,
      } as any,
    });

    res.status(201).json(variantDto(created));
  }),
);

productRoutes.put(
  '/produtos/:id/variacoes/:variantId',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const productId = normalizeText(req.params.id);
    const variantId = normalizeText(req.params.variantId);

    const existing = await prisma.productVariant.findFirst({
      where: { tenantId: getTenantId(), id: variantId, productId },
    });
    if (!existing) {
      res.status(404).json({ message: 'Variacao nao encontrada.' });
      return;
    }

    const variant = normalizeVariantInput({ ...existing, ...req.body }, existing.price, 0);
    if (!variant.price || Number(variant.price) <= 0) {
      res.status(400).json({ message: 'Informe um preco valido para a variacao.' });
      return;
    }

    const updated = await prisma.productVariant.update({
      where: { id: existing.id },
      data: {
        code: variant.code,
        name: variant.name,
        price: variant.price,
        sortOrder: variant.sortOrder,
        isAvailable: variant.isAvailable,
      },
    });

    res.json(variantDto(updated));
  }),
);

productRoutes.delete(
  '/produtos/:id/variacoes/:variantId',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const productId = normalizeText(req.params.id);
    const variantId = normalizeText(req.params.variantId);
    const existing = await prisma.productVariant.findFirst({
      where: { tenantId: getTenantId(), id: variantId, productId },
    });

    if (!existing) {
      res.status(404).json({ message: 'Variacao nao encontrada.' });
      return;
    }

    await prisma.productVariant.update({
      where: { id: existing.id },
      data: { isAvailable: false },
    });

    res.status(204).send();
  }),
);

// Produtos e alias /pizzas
productRoutes.get(
  ['/produtos', '/pizzas', '/products'],
  asyncHandler(async (req, res) => {
    await ensureDefaultCategories();
    const search = normalizeText(req.query.search);
    const barcodeQuery = normalizeBarcode(req.query.barcode);
    let products = await listProducts();

    if (barcodeQuery) {
      const byBarcode = products.filter(
        (p: any) =>
          p.barcode === barcodeQuery ||
          p.variants?.some((v: any) => v.code === barcodeQuery || v.name === barcodeQuery),
      );
      res.json(byBarcode);
      return;
    }

    if (search) {
      const lower = search.toLowerCase();
      products = products.filter(
        (p: any) =>
          p.name.toLowerCase().includes(lower) ||
          p.description?.toLowerCase().includes(lower) ||
          p.barcode?.toLowerCase() === lower ||
          p.variants?.some(
            (v: any) => v.name?.toLowerCase().includes(lower) || v.code?.toLowerCase() === lower,
          ),
      );
    }

    res.json(products);
  }),
);

productRoutes.get(
  ['/produtos/:id', '/pizzas/:id', '/products/:id'],
  asyncHandler(async (req, res) => {
    const id = getIdParam(req, res);
    if (!id) return;

    const product = await getProductForAdmin(id);
    if (!product) {
      res.status(404).json({ message: 'Produto nao encontrado.' });
      return;
    }

    res.json(productDto(product));
  }),
);

productRoutes.post(
  ['/produtos', '/pizzas'],
  requireAdmin,
  asyncHandler(async (req, res) => {
    const name = normalizeText(req.body.name);
    const barcode = normalizeBarcode(req.body.barcode);
    const description = normalizeText(req.body.description) || null;
    const imageUrl = normalizeText(req.body.imageUrl) || null;
    const price = parseMoney(req.body.price);
    const isAvailable = typeof req.body.isAvailable === 'boolean' ? req.body.isAvailable : true;

    if (barcode) {
      const existingBarcode = await prisma.product.findFirst({
        where: { tenantId: getTenantId(), barcode },
      });
      if (existingBarcode) {
        res.status(409).json({ message: 'Ja existe um produto com este codigo de barras.' });
        return;
      }
    }

    const nameError = validateTextField(name, 'Nome', FIELD_LIMITS.NAME, true);
    if (nameError) {
      res.status(400).json({ message: nameError.message });
      return;
    }

    if (!price || Number(price) <= 0) {
      res.status(400).json({ message: 'Informe um preco maior que zero.' });
      return;
    }

    if (description) {
      const descError = validateTextField(description, 'Descricao', FIELD_LIMITS.DESCRIPTION);
      if (descError) {
        res.status(400).json({ message: descError.message });
        return;
      }
    }

    if (imageUrl) {
      const imgError = validateTextField(imageUrl, 'Imagem', FIELD_LIMITS.IMAGE_URL);
      if (imgError) {
        res.status(400).json({ message: imgError.message });
        return;
      }
    }

    const category = await resolveCategory(req.body);
    if (!category) {
      res.status(400).json({ message: 'Categoria nao encontrada ou inativa.' });
      return;
    }

    const product = await prisma.product.create({
      data: {
        tenantId: getTenantId(),
        categoryId: category.id,
        category: category.slug,
        name,
        barcode,
        description,
        imageUrl,
        price,
        isAvailable,
        kdsStation: req.body.kdsStation || null,
        prepTimeMinutes: req.body.prepTimeMinutes ? Number(req.body.prepTimeMinutes) : null,
      } as any,
    });

    if (Array.isArray(req.body.variants) && req.body.variants.length > 0) {
      await replaceProductVariants(product.id, req.body.variants, price);
    } else if (categoryAllowsSizes(category)) {
      await createDefaultVariants(product.id, Number(price));
    }

    if (Array.isArray(req.body.optionGroups)) {
      await replaceProductOptionGroups(product.id, getTenantId(), req.body.optionGroups);
    }

    const created = await getProductForAdmin(product.id);
    res.status(201).json(productDto(created));
  }),
);

productRoutes.put(
  ['/produtos/:id', '/pizzas/:id'],
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = getIdParam(req, res);
    if (!id) return;

    const product = await prisma.product.findFirst({ where: { tenantId: getTenantId(), id } });
    if (!product) {
      res.status(404).json({ message: 'Produto nao encontrado.' });
      return;
    }

    const data: any = {};

    if (req.body.name !== undefined) {
      const name = normalizeText(req.body.name);
      const nameError = validateTextField(name, 'Nome', FIELD_LIMITS.NAME, true);
      if (nameError) {
        res.status(400).json({ message: nameError.message });
        return;
      }
      data.name = name;
    }

    if (req.body.barcode !== undefined) {
      const barcode = normalizeBarcode(req.body.barcode);
      if (barcode && barcode !== product.barcode) {
        const existingBarcode = await prisma.product.findFirst({
          where: { tenantId: getTenantId(), barcode, NOT: { id: product.id } },
        });
        if (existingBarcode) {
          res.status(409).json({ message: 'Ja existe outro produto com este codigo de barras.' });
          return;
        }
      }
      data.barcode = barcode;
    }

    if (req.body.description !== undefined) {
      const description = normalizeText(req.body.description) || null;
      if (description) {
        const descError = validateTextField(description, 'Descricao', FIELD_LIMITS.DESCRIPTION);
        if (descError) {
          res.status(400).json({ message: descError.message });
          return;
        }
      }
      data.description = description;
    }

    if (req.body.imageUrl !== undefined) {
      const imageUrl = normalizeText(req.body.imageUrl) || null;
      if (imageUrl) {
        const imgError = validateTextField(imageUrl, 'Imagem', FIELD_LIMITS.IMAGE_URL);
        if (imgError) {
          res.status(400).json({ message: imgError.message });
          return;
        }
      }
      data.imageUrl = imageUrl;
    }

    if (req.body.price !== undefined) {
      const price = parseMoney(req.body.price);
      if (!price || Number(price) <= 0) {
        res.status(400).json({ message: 'Informe um preco maior que zero.' });
        return;
      }
      data.price = price;
    }

    if (req.body.category !== undefined || req.body.categoryId !== undefined) {
      const category = await resolveCategory(req.body);
      if (!category) {
        res.status(400).json({ message: 'Categoria nao encontrada ou inativa.' });
        return;
      }
      data.categoryId = category.id;
      data.category = category.slug;
    }

    if (typeof req.body.isAvailable === 'boolean') {
      data.isAvailable = req.body.isAvailable;
    }
    if (req.body.kdsStation !== undefined) {
      data.kdsStation = req.body.kdsStation || null;
    }
    if (req.body.prepTimeMinutes !== undefined) {
      data.prepTimeMinutes = req.body.prepTimeMinutes ? Number(req.body.prepTimeMinutes) : null;
    }

    await prisma.product.update({
      where: { id: product.id },
      data,
    });

    if (Array.isArray(req.body.variants)) {
      await replaceProductVariants(product.id, req.body.variants, data.price ?? product.price);
    }

    if (Array.isArray(req.body.optionGroups)) {
      await replaceProductOptionGroups(product.id, getTenantId(), req.body.optionGroups);
    }

    const updated = await getProductForAdmin(product.id);
    res.json(productDto(updated));
  }),
);

productRoutes.delete(
  ['/produtos/:id', '/pizzas/:id'],
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = getIdParam(req, res);
    if (!id) return;

    const product = await prisma.product.findFirst({ where: { tenantId: getTenantId(), id } });
    if (!product) {
      res.status(404).json({ message: 'Produto nao encontrado.' });
      return;
    }

    await prisma.product.update({
      where: { id: product.id },
      data: { isAvailable: false },
    });

    res.status(204).send();
  }),
);

// Adicionais e bordas
productRoutes.get(
  '/adicionais',
  asyncHandler(async (_req, res) => {
    res.json(await listOptions(ProductOptionType.ADDON));
  }),
);

productRoutes.post(
  '/adicionais',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const result = await createOrUpdateOption(ProductOptionType.ADDON, req.body);
    if (result.error) {
      res.status(result.status ?? 400).json({ message: result.error });
      return;
    }
    res.status(result.status ?? 200).json(result.data);
  }),
);

productRoutes.put(
  '/adicionais/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = getIdParam(req, res);
    if (!id) return;

    const result = await createOrUpdateOption(ProductOptionType.ADDON, req.body, id);
    if (result.error) {
      res.status(result.status ?? 400).json({ message: result.error });
      return;
    }
    res.json(result.data);
  }),
);

productRoutes.delete(
  '/adicionais/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = getIdParam(req, res);
    if (!id) return;

    const option = await prisma.productOption.findFirst({
      where: { tenantId: getTenantId(), id, type: ProductOptionType.ADDON },
    });
    if (!option) {
      res.status(404).json({ message: 'Adicional nao encontrado.' });
      return;
    }

    await prisma.productOption.update({
      where: { id: option.id },
      data: { isAvailable: false },
    });
    res.status(204).send();
  }),
);

productRoutes.get(
  '/bordas',
  asyncHandler(async (_req, res) => {
    res.json(await listOptions(ProductOptionType.CRUST));
  }),
);

productRoutes.post(
  '/bordas',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const result = await createOrUpdateOption(ProductOptionType.CRUST, req.body);
    if (result.error) {
      res.status(result.status ?? 400).json({ message: result.error });
      return;
    }
    res.status(result.status ?? 200).json(result.data);
  }),
);

productRoutes.put(
  '/bordas/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = getIdParam(req, res);
    if (!id) return;

    const result = await createOrUpdateOption(ProductOptionType.CRUST, req.body, id);
    if (result.error) {
      res.status(result.status ?? 400).json({ message: result.error });
      return;
    }
    res.json(result.data);
  }),
);

productRoutes.delete(
  '/bordas/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = getIdParam(req, res);
    if (!id) return;

    const option = await prisma.productOption.findFirst({
      where: { tenantId: getTenantId(), id, type: ProductOptionType.CRUST },
    });
    if (!option) {
      res.status(404).json({ message: 'Borda nao encontrada.' });
      return;
    }

    await prisma.productOption.update({
      where: { id: option.id },
      data: { isAvailable: false },
    });
    res.status(204).send();
  }),
);
