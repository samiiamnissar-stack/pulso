const http = require('http');
const config = require('./config');
const { createApp } = require('./app');
const realtime = require('./realtime');
const { migrate } = require('./migrate');
const db = require('./db');
const { redis } = require('./redis');

async function main() {
  // Varios nodos pueden arrancar a la vez: un cerrojo en Postgres hace que
  // solo uno aplique el esquema (y cargue los datos de demo) cada vez.
  const lock = await db.primary.connect();
  await lock.query('SELECT pg_advisory_lock(424242)');
  try {
    if (process.env.RUN_MIGRATIONS !== 'false') await migrate();
    // En modo demo (por ejemplo, la demo pública) se cargan datos de ejemplo
    // si la base de datos está vacía y se mantienen vivos los check-ins.
    if (config.demoMode && process.env.AUTO_SEED !== 'false') {
      const { ensureDemoData } = require('./seed');
      await ensureDemoData();
    }
  } finally {
    await lock.query('SELECT pg_advisory_unlock(424242)');
    lock.release();
  }
  if (config.demoMode && process.env.AUTO_SEED !== 'false') {
    const { refreshDemo } = require('./seed');
    setInterval(() => refreshDemo().catch((err) => console.error('[demo]', err.message)), 15 * 60 * 1000).unref();
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
