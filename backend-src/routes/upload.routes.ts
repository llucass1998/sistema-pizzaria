import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

export const uploadRoutes = Router();

const uploadRootDir = path.join(process.cwd(), 'public', 'uploads');
const productUploadDir = path.join(uploadRootDir, 'products');
const identityPurposeDirs: Record<string, string> = {
  logo: 'identity/logos',
  favicon: 'identity/favicons',
  appleTouchIcon: 'identity/apple-touch-icons',
  openGraph: 'identity/open-graph',
};

const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
];

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getPurposeParam(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] ?? '');
  }

  return String(value ?? '');
}

ensureDir(productUploadDir);
for (const dir of Object.values(identityPurposeDirs)) {
  ensureDir(path.join(uploadRootDir, dir));
}

function getSafeExtension(file: Express.Multer.File) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext) {
    return ext;
  }

  if (file.mimetype === 'image/png') return '.png';
  if (file.mimetype === 'image/webp') return '.webp';
  if (file.mimetype === 'image/jpeg') return '.jpg';
  if (file.mimetype === 'image/x-icon' || file.mimetype === 'image/vnd.microsoft.icon') {
    return '.ico';
  }

  return '';
}

const productStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, productUploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `product-${uniqueSuffix}${getSafeExtension(file)}`);
  },
});

const identityStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const purpose = getPurposeParam(req.params.purpose);
    const targetDir = identityPurposeDirs[purpose];
    if (!targetDir) {
      cb(new Error('Tipo de identidade visual invalido.'), uploadRootDir);
      return;
    }

    const fullDir = path.join(uploadRootDir, targetDir);
    ensureDir(fullDir);
    cb(null, fullDir);
  },
  filename: (req, file, cb) => {
    const purpose = getPurposeParam(req.params.purpose);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${purpose}-${uniqueSuffix}${getSafeExtension(file)}`);
  },
});

const imageFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
    return;
  }

  cb(new Error('Tipo de arquivo nao permitido. Use JPG, PNG, WebP ou ICO.'));
};

const productUpload = multer({
  storage: productStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: imageFilter,
});

const identityUpload = multer({
  storage: identityStorage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: imageFilter,
});

uploadRoutes.post(
  '/upload',
  requireAdmin,
  productUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ message: 'Nenhum arquivo enviado.' });
      return;
    }

    const imageUrl = `/uploads/products/${req.file.filename}`;
    res.status(201).json({ imageUrl });
  }),
);

uploadRoutes.post(
  '/upload/identity/:purpose',
  requireAdmin,
  identityUpload.single('file'),
  asyncHandler(async (req, res) => {
    const purpose = getPurposeParam(req.params.purpose);
    const targetDir = identityPurposeDirs[purpose];
    if (!targetDir) {
      res.status(400).json({ message: 'Tipo de identidade visual invalido.' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: 'Nenhum arquivo enviado.' });
      return;
    }

    const imageUrl = `/uploads/${targetDir}/${req.file.filename}`;
    res.status(201).json({ imageUrl });
  }),
);
