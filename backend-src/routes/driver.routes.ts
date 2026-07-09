import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

import { getTenantId } from '../core/context/TenantContext.js';
import { requireRole } from '../middlewares/requireRole.js';
import {
  DriverDeliveryError,
  confirmDriverDelivery,
  getActiveDriverProfile,
  getDriverOrder,
  listDriverOrders,
  recordDeliveryFailure,
  recordDeliveryProof,
  reportDriverLocation,
} from '../services/driverDelivery.service.js';

const router = Router();

const proofUploadDir = path.join(process.cwd(), 'public', 'uploads', 'delivery-proofs');
const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getAdminId(req: Request) {
  return String((req as any).adminId ?? '');
}

function getSafeExtension(file: Express.Multer.File) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return ext;
  if (file.mimetype === 'image/png') return '.png';
  if (file.mimetype === 'image/webp') return '.webp';
  return '.jpg';
}

function handleDriverError(error: unknown, res: Response) {
  if (error instanceof DriverDeliveryError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  console.error('Erro nas rotas do entregador:', error);
  res.status(500).json({ error: 'Erro interno.' });
}

async function loadDriver(req: Request, res: Response, next: NextFunction) {
  try {
    const driver = await getActiveDriverProfile(getTenantId(), getAdminId(req));
    (req as any).driverProfile = driver;
    next();
  } catch (error) {
    handleDriverError(error, res);
  }
}

async function validateDriverOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = getTenantId();
    const driver =
      (req as any).driverProfile ?? (await getActiveDriverProfile(tenantId, getAdminId(req)));
    await getDriverOrder(tenantId, driver.id, String(req.params.orderId ?? ''));
    (req as any).driverProfile = driver;
    next();
  } catch (error) {
    handleDriverError(error, res);
  }
}

ensureDir(proofUploadDir);

const proofStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, proofUploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `delivery-proof-${uniqueSuffix}${getSafeExtension(file)}`);
  },
});

const proofUpload = multer({
  storage: proofStorage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new Error('Tipo de arquivo nao permitido. Use JPG, PNG ou WebP.'));
  },
});

router.use(requireRole(['DRIVER']));
router.use(loadDriver);

router.get('/me', async (req: Request, res: Response) => {
  const driver = (req as any).driverProfile;
  res.json({
    admin: driver.admin,
    driver: {
      id: driver.id,
      name: driver.name,
      phone: driver.phone,
      vehicle: driver.vehicle,
      isActive: driver.isActive,
    },
  });
});

router.get('/orders', async (req: Request, res: Response) => {
  try {
    const orders = await listDriverOrders(getTenantId(), (req as any).driverProfile.id);
    res.json(orders);
  } catch (error) {
    handleDriverError(error, res);
  }
});

router.get('/orders/:orderId', async (req: Request, res: Response) => {
  try {
    const order = await getDriverOrder(
      getTenantId(),
      (req as any).driverProfile.id,
      String(req.params.orderId ?? ''),
    );
    res.json(order);
  } catch (error) {
    handleDriverError(error, res);
  }
});

router.post('/orders/:orderId/location', async (req: Request, res: Response) => {
  try {
    const event = await reportDriverLocation(
      getTenantId(),
      (req as any).driverProfile.id,
      getAdminId(req),
      String(req.params.orderId ?? ''),
      req.body ?? {},
    );
    res.status(201).json(event);
  } catch (error) {
    handleDriverError(error, res);
  }
});

router.post(
  '/orders/:orderId/proof',
  validateDriverOrder,
  proofUpload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ message: 'Nenhum comprovante enviado.' });
        return;
      }

      const event = await recordDeliveryProof(
        getTenantId(),
        (req as any).driverProfile.id,
        getAdminId(req),
        String(req.params.orderId ?? ''),
        `/uploads/delivery-proofs/${req.file.filename}`,
      );
      res.status(201).json(event);
    } catch (error) {
      handleDriverError(error, res);
    }
  },
);

router.post('/orders/:orderId/confirm-delivery', async (req: Request, res: Response) => {
  try {
    const order = await confirmDriverDelivery(
      getTenantId(),
      (req as any).driverProfile.id,
      getAdminId(req),
      String(req.params.orderId ?? ''),
      req.body ?? {},
    );
    res.json(order);
  } catch (error) {
    handleDriverError(error, res);
  }
});

router.post('/orders/:orderId/delivery-failed', async (req: Request, res: Response) => {
  try {
    const event = await recordDeliveryFailure(
      getTenantId(),
      (req as any).driverProfile.id,
      getAdminId(req),
      String(req.params.orderId ?? ''),
      req.body ?? {},
    );
    res.status(201).json(event);
  } catch (error) {
    handleDriverError(error, res);
  }
});

export default router;
