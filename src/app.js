const path = require('path');
const express = require('express');
const cors = require('cors');
const { createTranscriptionsRouter } = require('./routes/transcriptions');
const { getProviderCapabilities } = require('./services/sttService');

function createApp({ repo, healthCheck } = {}) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/api/health', async (req, res) => {
    let dbStatus = 'connected';
    let dbTime = null;
    try {
      if (healthCheck) {
        const info = await healthCheck();
        dbTime = info?.server_time || new Date().toISOString();
      }
    } catch (err) {
      dbStatus = `error: ${err.message}`;
    }

    res.json({
      status: 'ok',
      database: dbStatus,
      serverTime: dbTime,
      sttCapabilities: getProviderCapabilities(),
    });
  });

  app.use('/api/transcriptions', createTranscriptionsRouter(repo));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  app.use((err, req, res, next) => {
    const status = err.statusCode || 500;
    res.status(status).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  });

  return app;
}

module.exports = {
  createApp,
};
