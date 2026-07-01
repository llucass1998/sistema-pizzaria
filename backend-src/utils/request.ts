import type { Response } from 'express';

export function getIdParam(req: { params: { id?: string } }, res: Response) {
  const id = req.params.id?.trim();

  if (!id) {
    res.status(400).json({ message: 'Informe um id valido.' });
    return null;
  }

  return id;
}
