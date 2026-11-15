const http = require('http');
const config = require('./config');
const { createApp } = require('./app');
const realtime = require('./realtime');
const { migrate } = require('./migrate');
const db = require('./db');
const { redis } = require('./redis');

async function main() {
  if (process.env.RUN_MIGRATIONS !== 'false') {
    // Varios nodos pueden arrancar a la vez: un cerrojo en Postgres evita
    // que dos apliquen el esquema al mismo tiempo.
    await db.query('SELECT pg_advisory_lock(424242)');
    try { await migrate(); } finally { await db.query('SELECT pg_advisory_unlock(424242)'); }
  }

  const server = http.createServer(createApp());
  realtime.attach(server);
  server.listen(config.port, () => {
    console.log(`[${config.nodeName}] Pulso escuchando en el puerto ${config.port}${config.demoMode ? ' (modo demo)' : ''}`);
  });

  // Apagado ordenado: el balanceador deja de enviar tráfico y las
  // peticiones en curso terminan antes de cerrar.
  const shutdown = async (signal) => {
    console.log(`[${config.nodeName}] ${signal} recibido, cerrando...`);
    server.close();
    await realtime.close();
    await db.close().catch(() => {});
    redis.disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('No se pudo arrancar:', err);
  process.exit(1);
});
