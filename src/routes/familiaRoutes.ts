import { Router } from 'express';
import { criarFamilia } from '../controllers/familiaController';

export const familiaRoutes = Router();

familiaRoutes.post('/', criarFamilia);
