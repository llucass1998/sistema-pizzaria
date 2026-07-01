import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getTenantId } from '../core/context/TenantContext.js';

const quoteItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Informe o item do orcamento.'),
  quantity: z.coerce.number().min(1),
  unitPrice: z.coerce.number().min(0),
});

const createQuoteSchema = z.object({
  customerName: z.string().trim().min(1, 'Informe o nome do cliente.'),
  customerEmail: z.string().optional(),
  customerPhone: z.string().optional(),
  eventDate: z.string().nullable().optional(),
  validUntil: z.string().nullable().optional(),
  totalAmount: z.coerce.number().min(0),
  items: z.array(quoteItemSchema).min(1, 'Adicione pelo menos um item ao orcamento.'),
  notes: z.string().optional(),
  status: z
    .enum(['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'CONVERTED', 'CANCELED', 'CANCELLED', 'EXPIRED', 'PENDING'])
    .optional(),
});

const quoteStatusSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'CONVERTED', 'CANCELED', 'CANCELLED', 'EXPIRED', 'PENDING']),
});

const updateQuoteSchema = createQuoteSchema.partial().refine((payload) => Object.keys(payload).length > 0, {
  message: 'Informe ao menos um campo para atualizar.',
});

function canonicalQuoteStatus(status: string | null | undefined) {
  if (status === 'CANCELLED') return 'CANCELED';
  return status ?? 'PENDING';
}

function parseOptionalDate(value: string | null | undefined, field: string) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error(`${field} invalida.`), { statusCode: 400 });
  }

  return date;
}

function serializeQuote(quote: any) {
  return {
    ...quote,
    status: canonicalQuoteStatus(quote.status),
    totalAmount: Number(quote.totalAmount ?? 0),
  };
}

export const QuotesController = {
  async getQuotes(_req: Request, res: Response) {
    const tenantId = getTenantId();
    const quotes = await prisma.quote.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(quotes.map(serializeQuote));
  },

  async getQuoteById(req: Request, res: Response) {
    const tenantId = getTenantId();
    const id = req.params.id as string;

    const quote = await prisma.quote.findFirst({
      where: { id, tenantId },
    });

    if (!quote) {
      res.status(404).json({ message: 'Orcamento nao encontrado.' });
      return;
    }

    res.json(serializeQuote(quote));
  },

  async createQuote(req: Request, res: Response) {
    const tenantId = getTenantId();
    const payload = createQuoteSchema.parse(req.body);
    const eventDate = parseOptionalDate(payload.eventDate, 'Data do evento');
    const validUntil = parseOptionalDate(payload.validUntil, 'Validade');

    const quote = await prisma.quote.create({
      data: {
        tenantId,
        customerName: payload.customerName,
        customerEmail: payload.customerEmail,
        customerPhone: payload.customerPhone,
        eventDate: eventDate ?? undefined,
        validUntil: validUntil ?? undefined,
        status: payload.status ? canonicalQuoteStatus(payload.status) : undefined,
        totalAmount: payload.totalAmount,
        items: payload.items,
        notes: payload.notes,
      }
    });

    res.status(201).json(serializeQuote(quote));
  },

  async updateQuoteStatus(req: Request, res: Response) {
    const tenantId = getTenantId();
    const id = req.params.id as string;
    const { status: rawStatus } = quoteStatusSchema.parse(req.body);
    const status = canonicalQuoteStatus(rawStatus);

    const result = await prisma.quote.updateMany({
      where: { id, tenantId },
      data: { status }
    });

    if (result.count === 0) {
      res.status(404).json({ message: 'Orcamento nao encontrado.' });
      return;
    }

    const quote = await prisma.quote.findFirst({
      where: { id, tenantId },
    });

    if (!quote) {
      res.status(404).json({ message: 'Orcamento nao encontrado.' });
      return;
    }

    res.json(serializeQuote(quote));
  },

  async updateQuote(req: Request, res: Response) {
    const tenantId = getTenantId();
    const id = req.params.id as string;
    const payload = updateQuoteSchema.parse(req.body);

    const existing = await prisma.quote.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      res.status(404).json({ message: 'Orcamento nao encontrado.' });
      return;
    }

    const data: any = {};

    if (payload.customerName !== undefined) data.customerName = payload.customerName;
    if (payload.customerEmail !== undefined) data.customerEmail = payload.customerEmail || null;
    if (payload.customerPhone !== undefined) data.customerPhone = payload.customerPhone || null;
    if (payload.notes !== undefined) data.notes = payload.notes || null;
    if (payload.totalAmount !== undefined) data.totalAmount = payload.totalAmount;
    if (payload.items !== undefined) data.items = payload.items;
    if (payload.status !== undefined) data.status = canonicalQuoteStatus(payload.status);

    const eventDate = parseOptionalDate(payload.eventDate, 'Data do evento');
    if (eventDate !== undefined) data.eventDate = eventDate;

    const validUntil = parseOptionalDate(payload.validUntil, 'Validade');
    if (validUntil !== undefined) data.validUntil = validUntil;

    const quote = await prisma.quote.update({
      where: { id: existing.id },
      data,
    });

    res.json(serializeQuote(quote));
  },

  async deleteQuote(req: Request, res: Response) {
    const tenantId = getTenantId();
    const id = req.params.id as string;

    const quote = await prisma.quote.findFirst({
      where: { id, tenantId },
    });

    if (!quote) {
      res.status(404).json({ message: 'Orcamento nao encontrado.' });
      return;
    }

    if (canonicalQuoteStatus(quote.status) === 'CONVERTED') {
      res.status(422).json({
        message: 'Orcamentos convertidos nao podem ser excluidos. Cancele ou mantenha o historico financeiro.',
      });
      return;
    }

    await prisma.quote.delete({
      where: { id: quote.id },
    });

    res.status(204).send();
  }
};
