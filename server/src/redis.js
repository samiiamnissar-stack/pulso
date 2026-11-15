// Redis se usa para tres cosas: caché de las estadísticas de cada local,
// límites de peticiones y el canal pub/sub que comparte los eventos de
// tiempo real entre todos los nodos de la API.
const Redis = require('ioredis');
const config = require('./config');

const opts = { maxRetriesPerRequest: 2, lazyConnect: false };

const redis = new Redis(config.redisUrl, opts);
redis.on('error', (err) => console.error('[redis]', err.message));

async function cached(key, seconds, producer) {
  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit);
  } catch { /* si Redis falla, seguimos sin caché */ }
  const value = await producer();
  try { await redis.set(key, JSON.stringify(value), 'EX', seconds); } catch { /* idem */ }
  return value;
}

async function invalidate(...keys) {
  try { if (keys.length) await redis.del(...keys); } catch { /* idem */ }
}

async function health() {
  try { return (await redis.ping()) === 'PONG'; } catch { return false; }
}

module.exports = { redis, cached, invalidate, health, newClient: () => new Redis(config.redisUrl, opts) };
