import { Router } from 'express';
import { SuppliersController } from '../controllers/suppliers.controller.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { requireRole } from '../middlewares/requireRole.js';

export const suppliersRouter = Router();

// Apenas OWNER, ADMIN e MANAGER podem gerenciar fornecedores
suppliersRouter.use(requireRole(['OWNER', 'ADMIN', 'MANAGER']));

suppliersRouter.get('/', asyncHandler(SuppliersController.getSuppliers));
suppliersRouter.post('/', asyncHandler(SuppliersController.createSupplier));
suppliersRouter.get('/:id', asyncHandler(SuppliersController.getSupplierById));
suppliersRouter.put('/:id', asyncHandler(SuppliersController.updateSupplier));
suppliersRouter.patch('/:id/status', asyncHandler(SuppliersController.updateSupplierStatus));
