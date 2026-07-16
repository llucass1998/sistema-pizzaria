import { PrismaPg } from '@prisma/adapter-pg';
import { AsyncLocalStorage } from 'async_hooks';
import { PrismaClient } from '../../generated/prisma/index.js';
import { getTenantId } from '../core/context/TenantContext.js';

export const rlsContext = new AsyncLocalStorage<{ customerId?: string; role?: string }>();

import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

export const basePrisma = new PrismaClient({ adapter });

// Modelos filhos sem coluna tenantId propria. Eles devem ser isolados pela
// relacao pai nas queries de dominio (por exemplo, group.tenantId).
export const MODELS_WITHOUT_DIRECT_TENANT_ID = new Set([
  'Tenant',
  'OrderItem',
  'Recipe',
  'Payment',
  'InboundInvoiceItem',
  'IntegrationEventLog',
  'ProductOptionItem',
  'PurchaseRequestItem',
  'PurchaseOrderItem',
  'PurchaseReceiptLine',
]);

// Arquitetura Enterprise: TenantRepository Pattern interceptado no Client Base
export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        // Modelos que nao possuem tenantId e devem passar direto
        if (MODELS_WITHOUT_DIRECT_TENANT_ID.has(model)) {
          return query(args);
        }

        const tenantId = getTenantId(); // Dispara erro se nao houver tenant no contexto

        // Injeta tenantId implicitamente na clausula where para operacoes apropriadas
        const a = args as any;
        if (
          [
            'findUnique',
            'findFirst',
            'findMany',
            'update',
            'updateMany',
            'delete',
            'deleteMany',
          ].includes(operation)
        ) {
          a.where = { ...a.where, tenantId };
        } else if (['create', 'createMany'].includes(operation)) {
          a.data = { ...a.data, tenantId };
        }

        const ctx = rlsContext.getStore();
        if ((model === 'Order' || model === 'OrderItem') && ctx && (ctx.role || ctx.customerId)) {
          return basePrisma.$transaction(async (tx) => {
            if (ctx.role === 'ADMIN') {
              await tx.$executeRaw`SELECT set_config('app.current_role', 'ADMIN', TRUE)`;
            } else if (ctx.customerId) {
              await tx.$executeRaw`SELECT set_config('app.current_role', 'CUSTOMER', TRUE)`;
              await tx.$executeRaw`SELECT set_config('app.current_customer_id', ${ctx.customerId}, TRUE)`;
            }
            return (tx as any)[model][operation](a);
          });
        }

        return query(a);
      },
    },
  },
});
