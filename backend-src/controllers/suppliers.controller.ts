import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getTenantId } from '../core/context/TenantContext.js';

function createBusinessError(message: string, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

const createSupplierSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do fornecedor.'),
  cnpj: z.string().optional(),
  email: z.string().email('Email com formato inválido.').optional().or(z.literal('')),
  phone: z.string().optional(),
  isActive: z.boolean().optional().default(true),
});

const updateSupplierSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do fornecedor.').optional(),
  cnpj: z.string().optional(),
  email: z.string().email('Email com formato inválido.').optional().or(z.literal('')),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
});

const updateStatusSchema = z.object({
  isActive: z.boolean({ message: 'Informe o novo status ativo/inativo.' }),
});

export const SuppliersController = {
  async getSuppliers(req: Request, res: Response) {
    const tenantId = getTenantId();
    const { search, active } = req.query as Record<string, string | undefined>;

    const where: any = { tenantId };
    if (active !== undefined) {
      where.isActive = active === 'true';
    }
    if (search && search.trim() !== '') {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { cnpj: { contains: search.trim() } },
        { email: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        _count: {
          select: {
            purchaseOrders: true,
            inboundInvoices: true,
          },
        },
        purchaseOrders: {
          select: { totalAmount: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        inboundInvoices: {
          select: { totalAmount: true, issueDate: true },
          orderBy: { issueDate: 'desc' },
          take: 5,
        },
      },
      orderBy: { name: 'asc' },
    });

    // Enriquecer com métricas calculadas
    const enriched = suppliers.map((sup) => {
      const totalPurchasedOrders = sup.purchaseOrders.reduce((sum, po) => sum + Number(po.totalAmount || 0), 0);
      const totalInvoiced = sup.inboundInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
      
      const lastOrderDate = sup.purchaseOrders[0]?.createdAt;
      const lastInvoiceDate = sup.inboundInvoices[0]?.issueDate;
      const lastPurchaseDate = lastOrderDate && lastInvoiceDate
        ? (new Date(lastOrderDate) > new Date(lastInvoiceDate) ? lastOrderDate : lastInvoiceDate)
        : (lastOrderDate || lastInvoiceDate || null);

      return {
        id: sup.id,
        name: sup.name,
        cnpj: sup.cnpj,
        email: sup.email,
        phone: sup.phone,
        isActive: sup.isActive,
        createdAt: sup.createdAt,
        updatedAt: sup.updatedAt,
        metrics: {
          ordersCount: sup._count.purchaseOrders,
          invoicesCount: sup._count.inboundInvoices,
          totalPurchased: Math.max(totalPurchasedOrders, totalInvoiced),
          lastPurchaseDate,
        },
      };
    });

    res.json(enriched);
  },

  async getSupplierById(req: Request, res: Response) {
    const tenantId = getTenantId();
    const id = String(req.params['id']);

    const supplier = await prisma.supplier.findFirst({
      where: { id, tenantId },
      include: {
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { items: { include: { ingredient: { select: { name: true, unit: true } } } } },
        },
        inboundInvoices: {
          orderBy: { issueDate: 'desc' },
          take: 20,
        },
        accountPayables: {
          orderBy: { dueDate: 'asc' },
          take: 20,
        },
      },
    });

    if (!supplier) {
      throw createBusinessError('Fornecedor não encontrado para esta loja.', 404);
    }

    res.json(supplier);
  },

  async createSupplier(req: Request, res: Response) {
    const tenantId = getTenantId();
    const payload = createSupplierSchema.parse(req.body);

    const supplier = await prisma.supplier.create({
      data: {
        tenantId,
        name: payload.name,
        cnpj: payload.cnpj ?? null,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        isActive: payload.isActive,
      },
    });

    res.status(201).json(supplier);
  },

  async updateSupplier(req: Request, res: Response) {
    const tenantId = getTenantId();
    const id = String(req.params['id']);
    const payload = updateSupplierSchema.parse(req.body);

    const existing = await prisma.supplier.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!existing) {
      throw createBusinessError('Fornecedor não encontrado para esta loja.', 404);
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.cnpj !== undefined ? { cnpj: payload.cnpj || null } : {}),
        ...(payload.email !== undefined ? { email: payload.email || null } : {}),
        ...(payload.phone !== undefined ? { phone: payload.phone || null } : {}),
        ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
      },
    });

    res.json(updated);
  },

  async updateSupplierStatus(req: Request, res: Response) {
    const tenantId = getTenantId();
    const id = String(req.params['id']);
    const payload = updateStatusSchema.parse(req.body);

    const existing = await prisma.supplier.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!existing) {
      throw createBusinessError('Fornecedor não encontrado para esta loja.', 404);
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: { isActive: payload.isActive },
    });

    res.json(updated);
  },
};
