const fs = require('fs');
const path = require('path');
const os = require('os');

process.env.NODE_ENV = 'test';

const portFile = path.join(os.tmpdir(), 'georisco-test-port.json');
if (fs.existsSync(portFile)) {
  const { port } = JSON.parse(fs.readFileSync(portFile, 'utf8'));
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${port}/georisco_test`;
}
