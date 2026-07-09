/**
 * Health check profissional — padrao ERP/SRE.
 *
 * GET /api/health         — publico, retorna status rapido
 * GET /api/health/detailed — admin, retorna diagnostico completo
 */

import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';

export const publicHealthRoutes = Router();
export const detailedHealthRoutes = Router();

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

interface ComponentHealth {
  status: HealthStatus;
  latencyMs?: number;
  message?: string;
}

interface HealthReport {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  version: string;
  components: {
    database: ComponentHealth;
    [key: string]: ComponentHealth;
  };
}

async function checkDatabase(): Promise<ComponentHealth> {
  const start = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - start;

    return {
      status: latencyMs > 2000 ? 'degraded' : 'healthy',
      latencyMs,
      message: latencyMs > 2000 ? 'Banco respondendo com latencia alta.' : undefined,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: 'Nao foi possivel conectar ao banco de dados.',
    };
  }
}

function computeOverallStatus(components: Record<string, ComponentHealth>): HealthStatus {
  const statuses = Object.values(components).map((c) => c.status);

  if (statuses.includes('unhealthy')) return 'unhealthy';
  if (statuses.includes('degraded')) return 'degraded';
  return 'healthy';
}

// ─── GET /health ───────────────────────────────────────────────────────────────
// Verificacao rapida de saude — ideal para load balancers e uptime monitors.
// Retorna 200 se saudavel, 503 se critico.
publicHealthRoutes.get('/health', async (_req, res) => {
  const db = await checkDatabase();
  const overall = computeOverallStatus({ database: db });

  const report: HealthReport = {
    status: overall,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: process.env.npm_package_version ?? '1.0.0',
    components: { database: db },
  };

  const httpStatus = overall === 'unhealthy' ? 503 : 200;
  res.status(httpStatus).json(report);
});

// ─── GET /health/detailed ─────────────────────────────────────────────────────
// Diagnostico completo com contagens do banco. Requer admin.
detailedHealthRoutes.get('/health/detailed', requireAdmin, async (_req, res) => {
  const db = await checkDatabase();

  let counts: Record<string, number> = {};
  let countsError: string | undefined;

  try {
    const [products, customers, orders, admins] = await Promise.all([
      prisma.product.count(),
      prisma.customer.count(),
      prisma.order.count(),
      prisma.admin.count(),
    ]);

    const [pendingOrders, activeOrders] = await Promise.all([
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.count({
        where: {
          status: { in: ['PREPARING', 'READY', 'OUT_FOR_DELIVERY'] },
        },
      }),
    ]);

    counts = {
      products,
      customers,
      orders,
      admins,
      pendingOrders,
      activeOrders,
    };
  } catch {
    countsError = 'Erro ao consultar contagens do banco.';
  }

  const overall = computeOverallStatus({ database: db });

  res.status(overall === 'unhealthy' ? 503 : 200).json({
    status: overall,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: process.env.npm_package_version ?? '1.0.0',
    node: process.version,
    memory: process.memoryUsage(),
    components: { database: db },
    ...(countsError ? { countsError } : { counts }),
  });
});
