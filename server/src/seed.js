// Datos de ejemplo para probar la app: locales inventados en barrios de
// Madrid y unos cientos de usuarios ficticios con check-in activo.
// Uso: npm run seed   (borra los datos anteriores)
const bcrypt = require('bcryptjs');
const db = require('./db');
const { migrate } = require('./migrate');
const { invalidate, redis } = require('./redis');

// Los nombres de los locales son inventados.
// Pesos de orientación: [hetero, gay, lesbiana, bisexual, otra, prefiero_no_decir]
const VENUES = [
  { slug: 'sala-neon', name: 'Sala Neón', barrio: 'Malasaña', address: 'C/ del Espíritu Santo (zona)', lat: 40.4258, lng: -3.7046, capacity: 450, music: 'Indie y pop', w: [55, 12, 8, 18, 4, 3], fill: 0.55 },
  { slug: 'club-marea', name: 'Club Marea', barrio: 'Chueca', address: 'C/ de Pelayo (zona)', lat: 40.4234, lng: -3.6979, capacity: 600, music: 'Pop y electrónica', w: [10, 52, 12, 18, 5, 3], fill: 0.7 },
  { slug: 'plumas', name: 'Plumas', barrio: 'Chueca', address: 'C/ de la Libertad (zona)', lat: 40.4214, lng: -3.6965, capacity: 300, music: 'Divas pop y drag', w: [8, 45, 20, 18, 6, 3], fill: 0.6 },
  { slug: 'boveda', name: 'Bóveda', barrio: 'La Latina', address: 'Cava Baja (zona)', lat: 40.4118, lng: -3.7086, capacity: 350, music: 'Reguetón y latino', w: [78, 5, 3, 9, 2, 3], fill: 0.5 },
  { slug: 'fabrica-de-luz', name: 'La Fábrica de Luz', barrio: 'Lavapiés', address: 'C/ de Argumosa (zona)', lat: 40.4085, lng: -3.6995, capacity: 800, music: 'Techno', w: [40, 18, 12, 22, 5, 3], fill: 0.45 },
  { slug: 'ambar', name: 'Ámbar', barrio: 'Huertas', address: 'C/ de las Huertas (zona)', lat: 40.4140, lng: -3.6990, capacity: 250, music: 'Funk y soul', w: [62, 10, 6, 16, 3, 3], fill: 0.35 },
  { slug: 'terraza-orion', name: 'Terraza Orión', barrio: 'Salamanca', address: 'C/ de Serrano (zona)', lat: 40.4300, lng: -3.6865, capacity: 500, music: 'Comercial', w: [82, 5, 2, 7, 1, 3], fill: 0.4 },
  { slug: 'sotano-23', name: 'Sótano 23', barrio: 'Argüelles', address: 'C/ de la Princesa (zona)', lat: 40.4300, lng: -3.7160, capacity: 400, music: 'Universitaria', w: [70, 8, 5, 12, 2, 3], fill: 0.65 },
  { slug: 'nave-9', name: 'Nave 9', barrio: 'Usera', address: 'C/ de Marcelo Usera (zona)', lat: 40.3890, lng: -3.7075, capacity: 900, music: 'Electrónica', w: [45, 16, 10, 22, 4, 3], fill: 0.3 },
  { slug: 'cupula', name: 'Cúpula', barrio: 'Chamberí', address: 'C/ de Fuencarral (zona)', lat: 40.4330, lng: -3.7020, capacity: 350, music: 'Hits 2000', w: [65, 9, 6, 15, 2, 3], fill: 0.25 },
  { slug: 'electra', name: 'Electra', barrio: 'Gran Vía', address: 'Gran Vía (zona)', lat: 40.4200, lng: -3.7050, capacity: 700, music: 'House', w: [35, 30, 8, 20, 4, 3], fill: 0.5 },
  { slug: 'faro', name: 'Faro', barrio: 'Villaverde', address: 'Av. de Andalucía (zona)', lat: 40.3500, lng: -3.6960, capacity: 300, music: 'Flamenco fusión y rumba', w: [80, 5, 3, 8, 1, 3], fill: 0.015 },
];

const ORIENTATIONS = ['hetero', 'gay', 'lesbiana', 'bisexual', 'otra', 'prefiero_no_decir'];
const ALIASES = ['Lucía', 'Hugo', 'Martina', 'Mateo', 'Sofía', 'Leo', 'Valeria', 'Pablo', 'Paula', 'Daniel', 'Alba', 'Álvaro',
  'Julia', 'Adrián', 'Emma', 'Mario', 'Noa', 'Diego', 'Carla', 'Marcos', 'Irene', 'Bruno', 'Sara', 'Iker', 'Lola', 'Nico',
  'Vega', 'Gael', 'Aitana', 'Unai', 'Inés', 'Rubén', 'Nerea', 'Samir', 'Yasmin', 'Omar', 'Nadia', 'Andrea', 'Eric', 'Claudia'];
const BIOS = ['Vengo a bailar, no a hablar de trabajo', 'Fan del vermut y de cerrar la pista', 'Recién llegada a Madrid',
  'Busco gente para ir a conciertos', 'Si suena Rosalía, me vengo arriba', '', '', 'Techno los viernes, siesta los sábados'];

// Generador pseudoaleatorio con semilla para que los datos salgan siempre iguales
let seed = 20261115;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const weighted = (weights) => {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  for (let i = 0; i < weights.length; i += 1) { r -= weights[i]; if (r <= 0) return i; }
  return weights.length - 1;
};

function genderFor(orientation) {
  if (orientation === 'gay') return rnd() < 0.92 ? 'hombre' : 'no_binario';
  if (orientation === 'lesbiana') return rnd() < 0.92 ? 'mujer' : 'no_binario';
  const r = rnd();
  if (r < 0.48) return 'mujer';
  if (r < 0.95) return 'hombre';
  return r < 0.98 ? 'no_binario' : 'otro';
}

function birthdate() {
  const age = 18 + Math.floor(rnd() * 13); // 18 a 30
  const y = new Date().getFullYear() - age - 1;
  const m = 1 + Math.floor(rnd() * 12);
  const d = 1 + Math.floor(rnd() * 28);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

async function seedAll() {
  await migrate();
  await db.query('TRUNCATE reports, blocks, messages, matches, likes, checkins, users, venues RESTART IDENTITY CASCADE');

  for (const v of VENUES) {
    await db.query(
      `INSERT INTO venues (slug, name, barrio, address, lat, lng, capacity, music, opens, closes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'00:00','06:00')`,
      [v.slug, v.name, v.barrio, v.address, v.lat, v.lng, v.capacity, v.music],
    );
  }
  const { rows: venueRows } = await db.query('SELECT id, slug FROM venues');
  const venueId = Object.fromEntries(venueRows.map((r) => [r.slug, r.id]));

  const hash = await bcrypt.hash('pulso1234', 10);

  // Cuenta de demostración
  const { rows: demo } = await db.query(
    `INSERT INTO users (email, password_hash, alias, birthdate, gender, orientation, bio, visible_in_venue, show_orientation, consent_at)
     VALUES ('demo@pulso.app', $1, 'Demo', '2001-05-20', 'mujer', 'bisexual', 'Cuenta de prueba', true, true, now()) RETURNING id`,
    [hash],
  );
  const demoId = demo[0].id;

  let n = 0;
  for (const v of VENUES) {
    const people = Math.round(v.capacity * v.fill * 0.35); // no todo el mundo usa la app
    const values = [];
    const params = [];
    for (let i = 0; i < people; i += 1) {
      const orientation = ORIENTATIONS[weighted(v.w)];
      const visible = rnd() < 0.4;
      params.push(
        `user${n}@ejemplo.pulso`, hash, `${pick(ALIASES)}${rnd() < 0.3 ? ` ${Math.floor(rnd() * 90 + 10)}` : ''}`,
        birthdate(), genderFor(orientation), orientation, pick(BIOS), visible, visible && rnd() < 0.6,
      );
      const b = values.length * 9;
      values.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9}, now())`);
      n += 1;
    }
    if (!values.length) continue;
    const { rows: users } = await db.query(
      `INSERT INTO users (email, password_hash, alias, birthdate, gender, orientation, bio, visible_in_venue, show_orientation, consent_at)
       VALUES ${values.join(',')} RETURNING id, visible_in_venue`,
      params,
    );
    const ck = users.map((u, i) => `('${u.id}', ${venueId[v.slug]}, now() - interval '${Math.floor(rnd() * 90)} minutes', now() + interval '${60 + (i % 180)} minutes')`);
    await db.query(`INSERT INTO checkins (user_id, venue_id, created_at, expires_at) VALUES ${ck.join(',')}`);

    // En dos locales, algunas personas visibles ya le han dado "me gusta" a la cuenta demo,
    // para poder probar el emparejamiento al momento
    if (['club-marea', 'sala-neon'].includes(v.slug)) {
      const fans = users.filter((u) => u.visible_in_venue).slice(0, 3);
      for (const f of fans) {
        await db.query('INSERT INTO likes (from_user, to_user) VALUES ($1,$2)', [f.id, demoId]);
      }
    }
  }

  await invalidate('stats:all');
  return { venues: VENUES.length, users: n + 1 };
}

if (require.main === module) {
  seedAll()
    .then((r) => { console.log(`Datos de ejemplo cargados: ${r.venues} locales y ${r.users} usuarios`); })
    .catch((err) => { console.error(err); process.exitCode = 1; })
    .finally(async () => { await db.close(); redis.disconnect(); });
}

module.exports = { seedAll, VENUES };
