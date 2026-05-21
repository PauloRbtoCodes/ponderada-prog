import express from 'express';
import { cadastroRoutes } from './routes/cadastroRoutes';
import { errorHandler } from './middlewares/errorHandler';

export const app = express();

app.use(express.json());
app.use('/cadastros', cadastroRoutes);
app.use(errorHandler);
