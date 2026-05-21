import express from 'express';
import { cadastroRoutes } from './routes/cadastroRoutes';
import { familiaRoutes } from './routes/familiaRoutes';
import { errorHandler } from './middlewares/errorHandler';

export const app = express();

app.use(express.json());
app.use('/cadastros', cadastroRoutes);
app.use('/familias', familiaRoutes);
app.use(errorHandler);
