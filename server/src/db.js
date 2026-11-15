// Dos pools: uno contra el primario (escrituras y lecturas que deben ser
// consistentes) y otro contra la réplica de lectura. Si la réplica falla,
// las lecturas vuelven al primario para que el servicio no se caiga.
const { Pool } = require('pg');
const config = require('./config');

const primary = new Pool({ connectionString: config.databaseUrl, max: 20 });
const replica = config.databaseReadUrl
  ? new Pool({ connectionString: config.databaseReadUrl, max: 20 })
  : null;

primary.on('error', (err) => console.error('[db] error en primario:', err.message));
if (replica) replica.on('error', (err) => console.error('[db] error en réplica:', err.message));

let replicaHealthy = Boolean(replica);

async function query(text, params) {
  return primary.query(text, params);
}

async function read(text, params) {
  if (replica && replicaHealthy) {
    try {
      return await replica.query(text, params);
    } catch (err) {
      console.warn('[db] réplica no disponible, leo del primario:', err.message);
      replicaHealthy = false;
      setTimeout(() => { replicaHealthy = true; }, 10_000);
    }
  }
  return primary.query(text, params);
}

async function tx(fn) {
  const client = await primary.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function health() {
  const out = { primary: false, replica: replica ? false : 'no configurada' };
  try { await primary.query('SELECT 1'); out.primary = true; } catch { /* sin conexión */ }
  if (replica) {
    try { await replica.query('SELECT 1'); out.replica = true; } catch { /* sin conexión */ }
  }
  return out;
}

async function close() {
  await primary.end();
  if (replica) await replica.end();
}

module.exports = { query, read, tx, health, close, primary };
