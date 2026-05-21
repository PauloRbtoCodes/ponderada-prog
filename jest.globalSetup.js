const EmbeddedPostgres = require('embedded-postgres').default;
const fs = require('fs');

const DB_DIR = '/tmp/georisco-test-pgdata';
const DB_PORT = 54321;

module.exports = async function globalSetup() {
  // Limpa dados de execuções anteriores interrompidas
  if (fs.existsSync(DB_DIR)) {
    fs.rmSync(DB_DIR, { recursive: true, force: true });
  }

  const ep = new EmbeddedPostgres({
    databaseDir: DB_DIR,
    port: DB_PORT,
    user: 'postgres',
    password: 'postgres',
    persistent: false,
  });

  await ep.initialise();
  await ep.start();
  await ep.createDatabase('georisco_test');

  // Mantém referência para o teardown
  global.__EP__ = ep;
};
