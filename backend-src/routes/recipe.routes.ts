import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { getTenantId } from '../core/context/TenantContext.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { normalizeText } from '../utils/normalize.js';
import { requireRole } from '../middlewares/requireRole.js';

export const recipeRouter = Router();

recipeRouter.use(requireAdmin);
recipeRouter.use(requireRole(['OWNER', 'ADMIN', 'MANAGER']));

// Retorna a ficha técnica de um produto
recipeRouter.get(
  '/product/:productId',
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const productId = normalizeText(req.params.productId);

    if (!productId) {
      res.status(400).json({ message: 'Informe o produto.' });
      return;
    }

    // Verifica se produto pertence ao tenant
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId },
    });

    if (!product) {
      res.status(404).json({ message: 'Produto não encontrado.' });
      return;
    }

    const recipes = await prisma.recipe.findMany({
      where: { productId },
      include: {
        ingredient: true,
      },
    });

    const serialized = recipes.map((r) => ({
      ...r,
      quantity: Number(r.quantity),
      ingredient: {
        ...r.ingredient,
        stock: Number(r.ingredient.stock),
        cost: Number(r.ingredient.cost),
      },
    }));

    res.json(serialized);
  }),
);

// Atualiza a ficha técnica (Substituição integral)
recipeRouter.post(
  '/product/:productId',
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const productId = normalizeText(req.params.productId);
    const items = Array.isArray(req.body.items) ? req.body.items : [];

    if (!productId) {
      res.status(400).json({ message: 'Informe o produto.' });
      return;
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId },
    });

    if (!product) {
      res.status(404).json({ message: 'Produto não encontrado.' });
      return;
    }

    // Validação básica dos itens
    for (const item of items) {
      if (!item.ingredientId || typeof item.quantity !== 'number' || item.quantity <= 0) {
        res.status(400).json({ message: 'Item de receita inválido.' });
        return;
      }
    }

    const ingredientIds = items.map((i: any) => i.ingredientId);

    // Validar se ingredientes existem no tenant
    const validIngredients = await prisma.ingredient.findMany({
      where: {
        tenantId,
        id: { in: ingredientIds },
      },
    });

    if (validIngredients.length !== ingredientIds.length) {
      res.status(400).json({ message: 'Um ou mais ingredientes inválidos.' });
      return;
    }

    // Deletar anteriores e inserir novas (Transação)
    await prisma.$transaction(async (tx) => {
      await tx.recipe.deleteMany({
        where: { productId },
      });

      if (items.length > 0) {
        await tx.recipe.createMany({
          data: items.map((item: any) => ({
            productId,
            ingredientId: item.ingredientId,
            quantity: Number(item.quantity).toFixed(4),
          })),
        });
      }
    });

    res.status(200).json({ message: 'Ficha técnica atualizada com sucesso.' });
  }),
);
