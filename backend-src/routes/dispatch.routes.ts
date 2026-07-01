import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getTenantId } from '../core/context/TenantContext.js';

const router = Router();

// 1. GET /api/admin/dispatch/drivers
router.get('/drivers', async (_req: Request, res: Response) => {
  try {
    const tenantId = getTenantId();
    const drivers = await prisma.driver.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
    res.json(drivers);
  } catch (error) {
    console.error('Erro ao buscar motoristas:', error);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// 2. POST /api/admin/dispatch/drivers
router.post('/drivers', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId();
    const { name, phone, vehicle, isActive } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome é obrigatório.' });
    }

    const driver = await prisma.driver.create({
      data: {
        tenantId,
        name,
        phone,
        vehicle,
        isActive: isActive !== undefined ? isActive : true,
      },
    });
    res.status(201).json(driver);
  } catch (error: any) {
    console.error('Erro ao criar motorista:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Telefone já cadastrado.' });
    }
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// 3. PUT /api/admin/dispatch/drivers/:id
router.put('/drivers/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId();
    const id = String(req.params.id ?? '');
    const { name, phone, vehicle, isActive } = req.body;

    const driver = await prisma.driver.updateMany({
      where: { id, tenantId },
      data: { name, phone, vehicle, isActive },
    });

    res.json({ success: true, count: driver.count });
  } catch (error) {
    console.error('Erro ao atualizar motorista:', error);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// 4. GET /api/admin/dispatch/ready-orders
router.get('/ready-orders', async (_req: Request, res: Response) => {
  try {
    const tenantId = getTenantId();
    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        status: { in: ['READY', 'PREPARING', 'OUT_FOR_DELIVERY'] }, // Include preparing to allow early assign
        fulfillmentType: 'DELIVERY'
      },
      include: {
        customer: true,
        driver: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (error) {
    console.error('Erro ao buscar pedidos para despacho:', error);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// 5. POST /api/admin/dispatch/assign
router.post('/assign', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId();
    const { orderId, driverId } = req.body;

    if (!orderId || !driverId) {
      return res.status(400).json({ error: 'orderId e driverId são obrigatórios.' });
    }

    const order = await prisma.order.updateMany({
      where: { id: orderId, tenantId },
      data: {
        driverId,
        status: 'OUT_FOR_DELIVERY',
      },
    });

    res.json({ success: true, count: order.count });
  } catch (error) {
    console.error('Erro ao despachar pedido:', error);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

export default router;
