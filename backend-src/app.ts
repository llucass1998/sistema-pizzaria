import cors from 'cors';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';

import { globalErrorHandler } from './middlewares/errorHandler.js';
import { adminRoutes } from './routes/admin.routes.js';
import { customerRoutes } from './routes/customer.routes.js';
import { healthRoutes } from './routes/health.routes.js';
import { orderRoutes } from './routes/order.routes.js';
import { productRoutes } from './routes/product.routes.js';
import { settingsRoutes } from './routes/settings.routes.js';
import { deliveryRoutes } from './routes/delivery.routes.js';
import { statusRoutes } from './routes/status.routes.js';
import { cartRoutes } from './routes/cart.routes.js';
import { inventoryRouter } from './routes/inventory.routes.js';
import { posRouter } from './routes/pos.routes.js';
import { billingRoutes } from './routes/billing.routes.js';
import { webhookRoutes } from './routes/webhook.routes.js';
import { integrationRoutes } from './routes/integration.routes.js';
import { purchasesRouter } from './routes/purchases.routes.js';
import { quotesRouter } from './routes/quotes.routes.js';
import { receivablesRouter } from './routes/receivables.routes.js';
import { couponRoutes } from './routes/coupon.routes.js';
import { recipeRouter } from './routes/recipe.routes.js';
import { tenantRoutes } from './routes/tenant.routes.js';
import { uploadRoutes } from './routes/upload.routes.js';
import { fiscalRoutes } from './routes/fiscal.routes.js';
import dispatchRoutes from './routes/dispatch.routes.js';
import saasRoutes from './routes/saas.routes.js';
import { kdsRouter } from './routes/kds.routes.js';
import { manufacturingRouter } from './routes/manufacturing.routes.js';
import { wasteRouter } from './routes/waste.routes.js';

// Cria a aplicacao Express, que sera a API.
export const app = express();

import { tenantGuard } from './core/middlewares/tenantGuard.js';
import { requireAdmin as requireAuth } from './middlewares/requireAdmin.js';
import { requireRole } from './middlewares/requireRole.js';
import { getTenantId } from './core/context/TenantContext.js';
import { addOrderEventClient } from './services/orderEvents.service.js';

// Libera o acesso da API para o front-end.
app.use(cors());

// Permite receber JSON no corpo das requisicoes, incluindo imagens compactadas dos produtos.
app.use(express.json({ limit: '6mb' }));
app.use(express.urlencoded({ extended: true, limit: '6mb' }));
app.use(cookieParser());

// Serve arquivos de uploads (imagens de produtos, etc.)
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

// Rota publica para resolver tenant (antes do guard)
app.use('/api', tenantRoutes);

// SaaS Pública
app.use('/api/public/saas', saasRoutes);

// Webhooks de pagamento sao chamados por terceiros e validam assinatura no controller.
app.use('/api/webhooks', webhookRoutes);

app.use(tenantGuard);

app.get(
  '/api/admin/orders/events',
  requireAuth,
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'KITCHEN']),
  (req, res) => {
    const removeClient = addOrderEventClient(getTenantId(), res);
    req.on('close', removeClient);
  },
);

app.get(
  '/api/orders/events',
  requireAuth,
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'KITCHEN']),
  (req, res) => {
    const removeClient = addOrderEventClient(getTenantId(), res);
    req.on('close', removeClient);
  },
);

// Todas essas rotas comecam com /api.
app.use(
  '/api',
  statusRoutes,
  healthRoutes,
  productRoutes,
  customerRoutes,
  adminRoutes,
  uploadRoutes,
  settingsRoutes,
  orderRoutes,
  cartRoutes,
  integrationRoutes,
);
app.use('/api/inventory', inventoryRouter);
app.use('/api', deliveryRoutes);
app.use('/api/pos', posRouter);
app.use('/api/billing', billingRoutes);
app.use('/api/purchases', purchasesRouter);
app.use('/api/quotes', quotesRouter);
app.use('/api/receivables', receivablesRouter);
app.use('/api/coupons', couponRoutes);
app.use('/api/recipes', recipeRouter);
app.use('/api/admin/pos', posRouter);
app.use('/api/admin/inventory', requireAuth, inventoryRouter);
app.use('/api/admin/inventory/waste', requireAuth, wasteRouter);
app.use('/api/admin/recipes', recipeRouter);
app.use('/api/admin/fiscal', fiscalRoutes);
app.use('/api/admin/dispatch', requireAuth, dispatchRoutes);
app.use('/api/admin/kds', kdsRouter);
app.use('/api/admin/manufacturing', requireAuth, manufacturingRouter);
app.use('/api/manufacturing', manufacturingRouter);

// Handler global de erros — deve ser o ULTIMO middleware registrado.
// Captura qualquer erro nao tratado pelas rotas e retorna resposta JSON limpa.
app.use(globalErrorHandler);
