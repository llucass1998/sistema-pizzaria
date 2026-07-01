import { Router } from 'express';
import { QuotesController } from '../controllers/quotes.controller.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { requireRole } from '../middlewares/requireRole.js';

export const quotesRouter = Router();

quotesRouter.use(requireRole(['OWNER', 'ADMIN', 'MANAGER']));

quotesRouter.get('/', asyncHandler(QuotesController.getQuotes));
quotesRouter.get('/:id', asyncHandler(QuotesController.getQuoteById));
quotesRouter.post('/', asyncHandler(QuotesController.createQuote));
quotesRouter.patch('/:id/status', asyncHandler(QuotesController.updateQuoteStatus));
quotesRouter.put('/:id', asyncHandler(QuotesController.updateQuote));
quotesRouter.patch('/:id', asyncHandler(QuotesController.updateQuote));
quotesRouter.delete('/:id', asyncHandler(QuotesController.deleteQuote));
