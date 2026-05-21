import { app } from './app';

const port = process.env.PORT ?? 3000;
app.listen(port, () => {
  console.log(`GeoRisco API rodando em http://localhost:${port}`);
});
