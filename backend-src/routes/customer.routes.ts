/**
 * Rotas de clientes — regras ERP profissional.
 *
 * Correcoes de seguranca:
 *  - Login sem senha bloqueado para clientes com passwordHash cadastrado
 *  - Validacao de comprimento de campos
 *  - Validacao de formato de email
 */

import { Router } from 'express';

import { getTenantId } from '../core/context/TenantContext.js';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { createToken, setAuthCookie } from '../utils/auth.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { normalizeEmail, normalizeText } from '../utils/normalize.js';
import { FIELD_LIMITS, validateEmail, validateLength } from '../utils/validate.js';

export const customerRoutes = Router();

const customerSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  cpf: true,
  street: true,
  neighborhood: true,
  city: true,
  cep: true,
  createdAt: true,
  updatedAt: true,
  orders: {
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true,
      status: true,
      total: true,
      fulfillmentType: true,
      createdAt: true,
      items: {
        select: { quantity: true },
      },
    },
  },
} as const;

function getCustomerInput(body: Record<string, unknown>) {
  const address = (body.address ?? {}) as Record<string, unknown>;

  return {
    name: normalizeText(body.name),
    email: normalizeEmail(body.email),
    password: normalizeText(body.password),
    phone: normalizeText(body.phone) || null,
    cpf: normalizeText(body.cpf) || null,
    street: normalizeText(address.street ?? body.street) || null,
    neighborhood: normalizeText(address.neighborhood ?? body.neighborhood) || null,
    city: normalizeText(address.city ?? body.city) || null,
    cep: normalizeText(address.cep ?? body.cep) || null,
  };
}

// ─── POST /register ────────────────────────────────────────────────────────────
// Cadastro de cliente com senha.
customerRoutes.post(
  '/register',
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const input = getCustomerInput(req.body ?? {});

    // Validacoes obrigatorias.
    if (!input.name || !input.email || !input.password) {
      res.status(400).json({ message: 'Informe nome, email e senha.' });
      return;
    }

    // Validacoes de formato e comprimento (ERP-grade).
    const emailError = validateEmail(input.email);
    if (emailError) {
      res.status(400).json({ message: emailError.message });
      return;
    }

    const nameError = validateLength(input.name, 'Nome', FIELD_LIMITS.NAME, true);
    if (nameError) {
      res.status(400).json({ message: nameError.message });
      return;
    }

    if (input.password.length < 6) {
      res.status(400).json({ message: 'A senha precisa ter pelo menos 6 caracteres.' });
      return;
    }

    if (input.password.length > 128) {
      res.status(400).json({ message: 'A senha pode ter no maximo 128 caracteres.' });
      return;
    }

    // Validacoes opcionais de comprimento.
    if (input.phone) {
      const err = validateLength(input.phone, 'Telefone', FIELD_LIMITS.PHONE);
      if (err) {
        res.status(400).json({ message: err.message });
        return;
      }
    }

    if (input.cpf) {
      const err = validateLength(input.cpf, 'CPF', FIELD_LIMITS.CPF);
      if (err) {
        res.status(400).json({ message: err.message });
        return;
      }
    }

    const existingCustomer = await prisma.customer.findFirst({
      where: { tenantId, email: input.email },
      select: { id: true },
    });

    if (existingCustomer) {
      res.status(409).json({ message: 'Este email ja esta cadastrado.' });
      return;
    }

    const passwordHash = await hashPassword(input.password);

    const customer = await prisma.customer.create({
      data: {
        tenantId,
        name: input.name,
        email: input.email,
        passwordHash,
        phone: input.phone,
        cpf: input.cpf,
        street: input.street,
        neighborhood: input.neighborhood,
        city: input.city,
        cep: input.cep,
      },
      select: customerSelect,
    });

    const token = createToken({ id: customer.id, email: customer.email, role: 'CUSTOMER' });
    setAuthCookie(res, token);

    res.status(201).json({ ...customer, token, role: 'CUSTOMER' });
  }),
);

// ─── POST /login ───────────────────────────────────────────────────────────────
// Login do cliente.
//
// Regra de seguranca ERP:
//  - Se o cliente tem passwordHash no banco, SEMPRE exige senha.
//  - O fluxo sem senha (nome+email) so funciona para clientes sem cadastro.
//  - Isso impede que um ator malicioso "logue" como outro cliente sem senha.
customerRoutes.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const password = normalizeText(req.body.password);
    const name = normalizeText(req.body.name);
    const tenantId = getTenantId();

    if (!email) {
      res.status(400).json({ message: 'Informe o email.' });
      return;
    }

    // Fluxo com senha: autenticacao completa.
    if (password) {
      // 1. Tentar logar como Admin primeiro
      const admin = await prisma.admin.findFirst({
        where: { tenantId, email },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          passwordHash: true,
        },
      });

      if (admin && (await verifyPassword(password, admin.passwordHash))) {
        const { passwordHash: _hash, ...safeAdmin } = admin;
        const token = createToken({ id: safeAdmin.id, email: safeAdmin.email, role: safeAdmin.role });
        setAuthCookie(res, token);
        res.status(200).json({ admin: safeAdmin, token, role: safeAdmin.role });
        return;
      }

      // 2. Se nao for admin, tentar logar como Customer
      const customer = await prisma.customer.findFirst({
        where: { tenantId, email },
        select: { ...customerSelect, passwordHash: true },
      });

      if (!customer || !(await verifyPassword(password, customer.passwordHash))) {
        res.status(401).json({ message: 'Email ou senha invalidos.' });
        return;
      }

      const { passwordHash: _hash, ...safeCustomer } = customer;
      const token = createToken({
        id: safeCustomer.id,
        email: safeCustomer.email,
        role: 'CUSTOMER',
      });
      setAuthCookie(res, token);
      res.status(200).json({ ...safeCustomer, token, role: 'CUSTOMER' });
      return;
    }

    // Fluxo sem senha: apenas para clientes sem cadastro (convidado).
    if (name && email) {
      // Verificar se o cliente tem senha cadastrada — se sim, negar acesso.
      const existingCustomer = await prisma.customer.findFirst({
        where: { tenantId, email },
        select: { id: true, passwordHash: true },
      });

      if (existingCustomer?.passwordHash) {
        res.status(401).json({
          message: 'Este email possui cadastro com senha. Informe sua senha para entrar.',
        });
        return;
      }

      // Cliente convidado: cria ou atualiza sem senha.
      const customer = await prisma.customer.upsert({
        where: { tenantId_email: { tenantId, email } } as any,
        update: { name },
        create: { name, email, tenantId } as any,
        select: customerSelect,
      });

      const token = createToken({ id: customer.id, email: customer.email, role: 'CUSTOMER' });
      setAuthCookie(res, token);

      res.status(200).json({ ...customer, token, role: 'CUSTOMER' });
      return;
    }

    res.status(400).json({ message: 'Informe email e senha para entrar.' });
  }),
);

// ─── GET /account/me ──────────────────────────────────────────────────────────
// Retorna os dados do cliente autenticado.
// Requer token de cliente (requireCustomer).
import { requireCustomer } from '../middlewares/requireCustomer.js';

customerRoutes.get(
  '/account/me',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const customerId = (req as any).customerId;
    const tenantId = getTenantId();

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      select: customerSelect,
    });

    if (!customer) {
      res.status(404).json({ message: 'Cliente não encontrado.' });
      return;
    }

    res.json(customer);
  }),
);

// ─── PUT /account/me ──────────────────────────────────────────────────────────
// Atualiza dados do cliente autenticado (nome, telefone, cpf, endereço).
customerRoutes.put(
  '/account/me',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const customerId = (req as any).customerId;
    const tenantId = getTenantId();

    // Verificar que o cliente existe neste tenant
    const existing = await prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      select: { id: true },
    });

    if (!existing) {
      res.status(404).json({ message: 'Cliente não encontrado.' });
      return;
    }

    const input = getCustomerInput(req.body ?? {});

    // Validações opcionais de campos enviados
    if (input.name) {
      const nameError = validateLength(input.name, 'Nome', FIELD_LIMITS.NAME, true);
      if (nameError) {
        res.status(400).json({ message: nameError.message });
        return;
      }
    }

    if (input.phone) {
      const err = validateLength(input.phone, 'Telefone', FIELD_LIMITS.PHONE);
      if (err) {
        res.status(400).json({ message: err.message });
        return;
      }
    }

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.cpf !== undefined ? { cpf: input.cpf } : {}),
        ...(input.street !== undefined ? { street: input.street } : {}),
        ...(input.neighborhood !== undefined ? { neighborhood: input.neighborhood } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.cep !== undefined ? { cep: input.cep } : {}),
      },
      select: customerSelect,
    });

    res.json(updated);
  }),
);

// ─── GET /account/orders ──────────────────────────────────────────────────────
// Lista pedidos paginados do cliente autenticado.
customerRoutes.get(
  '/account/orders',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const customerId = (req as any).customerId;
    const tenantId = getTenantId();

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 10));
    const status = (req.query.status as string) || '';

    const where: any = { customerId, tenantId };
    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          status: true,
          total: true,
          fulfillmentType: true,
          paymentMethod: true,
          createdAt: true,
          street: true,
          neighborhood: true,
          notes: true,
          items: {
            select: {
              id: true,
              quantity: true,
              total: true,
              displayName: true,
              product: { select: { name: true } },
            },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      orders,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  }),
);
