const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const config = require('./config');

// Express 4 no captura los errores de las funciones async: este parche hace
// que cualquier excepción llegue al manejador de errores en vez de colgar
// la petición.
const Layer = require('express/lib/router/layer');
const originalHandle = Layer.prototype.handle_request;
Layer.prototype.handle_request = function handle(req, res, next) {
  const ret = originalHandle.call(this, req, res, next);
  if (ret && typeof ret.catch === 'function') ret.catch(next);
  return ret;
};

const db = require('./db');
const cache = require('./redis');
const { router: authRoutes } = require('./routes/auth');
const meRoutes = require('./routes/me');
const venueRoutes = require('./routes/venues');
const socialRoutes = require('./routes/social');

const stats = { started: Date.now(), requests: 0, errors: 0 };

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        imgSrc: ["'self'", 'data:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
      },
    },
  }));
  app.use(compression());
  app.use(express.json({ limit: '20kb' }));

  // Cabecera para ver qué nodo ha respondido (útil para enseñar el balanceo)
  app.use((req, res, next) => {
    stats.requests += 1;
    res.setHeader('X-Pulso-Node', config.nodeName);
    next();
  });

  // Límite general por IP para que un cliente no tumbe la API
  app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: Number(process.env.RATE_LIMIT || 300), standardHeaders: 'draft-7', legacyHeaders: false }));

  app.get('/health', async (req, res) => {
    const [database, redis] = await Promise.all([db.health(), cache.health()]);
    const ok = database.primary && redis;
    res.status(ok ? 200 : 503).json({ ok, node: config.nodeName, database, redis });
  });

  app.get('/metrics', (req, res) => {
    const mem = process.memoryUsage();
    res.type('text/plain').send([
      `pulso_up{node="${config.nodeName}"} 1`,
      `pulso_uptime_seconds{node="${config.nodeName}"} ${Math.round((Date.now() - stats.started) / 1000)}`,
      `pulso_requests_total{node="${config.nodeName}"} ${stats.requests}`,
      `pulso_errors_total{node="${config.nodeName}"} ${stats.errors}`,
      `pulso_memory_rss_bytes{node="${config.nodeName}"} ${mem.rss}`,
    ].join('\n') + '\n');
  });

  app.get('/api/config', (req, res) => res.json({
    minAge: config.minAge, k: config.kAnonymity, checkinHours: config.checkinHours, demoMode: config.demoMode,
  }));
  app.use('/api/auth', authRoutes);
  app.use('/api/me', meRoutes);
  app.use('/api/venues', venueRoutes);
  app.use('/api', socialRoutes);

  app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

  // La PWA se sirve desde el mismo servidor
  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h', index: 'index.html' }));
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    stats.errors += 1;
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON mal formado' });
    console.error(`[${config.nodeName}]`, err);
    return res.status(500).json({ error: 'Algo ha fallado en el servidor' });
  });

  return app;
}

module.exports = { createApp };
