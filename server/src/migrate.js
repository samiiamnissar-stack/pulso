const fs = require('fs');
const path = require('path');
const db = require('./db');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await db.query(sql);
}

if (require.main === module) {
  migrate()
    .then(() => { console.log('Esquema aplicado'); return db.close(); })
    .catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { migrate };
