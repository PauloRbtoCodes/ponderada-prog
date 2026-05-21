import { Router } from 'express';
import { criar } from '../controllers/cadastroController';

export const cadastroRoutes = Router();

cadastroRoutes.post('/', criar);
