const EmbeddedPostgres = require('embedded-postgres').default;
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const { execSync } = require('child_process');

const DB_DIR = path.join(os.tmpdir(), 'georisco-test-pgdata');
const PORT_FILE = path.join(os.tmpdir(), 'georisco-test-port.json');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

function killExistingPostgres() {
  const pidFile = path.join(DB_DIR, 'postmaster.pid');
  if (!fs.existsSync(pidFile)) return;
  try {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8').split('\n')[0].trim(), 10);
    if (!isNaN(pid)) {
      if (process.platform === 'win32') {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
      } else {
        process.kill(pid, 'SIGKILL');
      }
    }
  } catch {}
  try { fs.unlinkSync(pidFile); } catch {}
}

// Mata todos os processos postgres para garantir que shared memory seja liberada
function killAllPostgresProcesses() {
  if (process.platform === 'win32') {
    try { execSync('taskkill /IM postgres.exe /F', { stdio: 'ignore' }); } catch {}
  } else {
    try { execSync('pkill -9 -x postgres', { stdio: 'ignore' }); } catch {}
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeEp(port) {
  return new EmbeddedPostgres({
    databaseDir: DB_DIR,
    port,
    user: 'postgres',
    password: 'postgres',
    persistent: true,
  });
}

async function ensureDatabase(ep) {
  try {
    await ep.createDatabase('georisco_test');
  } catch (err) {
    if (!err.message?.includes('already exists')) throw err;
  }
}

module.exports = async function globalSetup() {
  let port;
  try { port = await getFreePort(); } catch (e) { throw new Error(`getFreePort falhou: ${e}`); }
  const alreadyInitialised =
    fs.existsSync(DB_DIR) && fs.existsSync(path.join(DB_DIR, 'PG_VERSION'));

  // Mata processo anterior pelo PID e, em seguida, qualquer postgres restante
  // para garantir que o bloco de shared memory seja liberado antes de iniciar.
  killExistingPostgres();
  killAllPostgresProcesses();
  await sleep(500);

  let ep = makeEp(port);

  if (!alreadyInitialised) {
    try {
      await ep.initialise();
    } catch (initErr) {
      throw new Error(`ep.initialise() falhou: ${initErr}`);
    }
  }

  try {
    await ep.start();
  } catch (startErr) {
    console.error('[globalSetup] ep.start() falhou:', startErr);
    // pgdata incompatível ou shared memory presa — reinicializa do zero
    killAllPostgresProcesses();
    await sleep(500);
    fs.rmSync(DB_DIR, { recursive: true, force: true });
    ep = makeEp(port);
    await ep.initialise();
    await ep.start();
  }

  try {
    await ensureDatabase(ep);
  } catch (dbErr) {
    throw new Error(`ensureDatabase falhou: ${dbErr}`);
  }

  fs.writeFileSync(PORT_FILE, JSON.stringify({ port }));
  global.__EP__ = ep;
};
