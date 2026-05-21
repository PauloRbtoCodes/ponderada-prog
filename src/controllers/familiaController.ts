import type { RequestHandler } from 'express';
import * as service from '../services/familiaService';

export const criarFamilia: RequestHandler = async (req, res, next) => {
  try {
    const familia = await service.criar(req.body);
    res.status(201).json(familia);
  } catch (err) {
    next(err);
  }
};
