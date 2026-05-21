import type { Request, Response, NextFunction } from 'express';
import * as svc from '../services/cadastroService';

export async function criar(req: Request, res: Response, next: NextFunction) {
  try {
    const cadastro = await svc.criar(req.body);
    res.status(201).json(cadastro);
  } catch (e) {
    next(e);
  }
}
