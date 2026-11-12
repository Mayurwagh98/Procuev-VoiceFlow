require('dotenv').config();
const http = require('http');
const { createApp } = require('./app');
const { initDb, checkHealth } = require('./db/pool');
const { attachSttWebSocketServer } = require('./services/sttService');

const PORT = Number(process.env.PORT) || 5000;

async function start() {
  try {
    await initDb();
    console.log('PostgreSQL schema initialized.');
  } catch (err) {
    console.error('Warning: Database initialization failed:', err.message);
    console.error('Ensure DATABASE_URL is configured and PostgreSQL is running.');
  }

  const app = createApp({ healthCheck: checkHealth });
  const server = http.createServer(app);
  attachSttWebSocketServer(server);

  server.listen(PORT, () => {
    console.log(`Procucev Real-Time STT Server running on http://localhost:${PORT}`);
  });
}

start();
