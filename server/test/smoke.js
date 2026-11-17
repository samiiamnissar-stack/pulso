// Prueba de extremo a extremo contra un servidor en marcha.
// Uso: API_URL=http://localhost:8080 node test/smoke.js
const assert = require('node:assert');

const API = process.env.API_URL || 'http://localhost:3000';

async function call(method, path, body, token) {
  const res = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, node: res.headers.get('x-pulso-node'), data: text ? JSON.parse(text) : null };
}

async function main() {
  const stamp = Date.now();
  const steps = [];
  const ok = (msg) => { steps.push(msg); console.log('  ✔', msg); };

  // Menores fuera
  const teen = await call('POST', '/api/auth/register', {
    email: `teen${stamp}@prueba.es`, password: '12345678', alias: 'Peque', birthdate: '2010-01-01', gender: 'mujer', consent: true,
  });
  assert.equal(teen.status, 403); ok('un menor de 18 no puede registrarse');

  // Sin aceptar la política de privacidad, no
  const noConsent = await call('POST', '/api/auth/register', {
    email: `nc${stamp}@prueba.es`, password: '12345678', alias: 'Sin', birthdate: '2000-01-01', gender: 'hombre',
  });
  assert.equal(noConsent.status, 400); ok('sin aceptar la privacidad no hay registro');

  const reg = await call('POST', '/api/auth/register', {
    email: `alex${stamp}@prueba.es`, password: '12345678', alias: 'Alex', birthdate: '2000-03-10', gender: 'hombre', consent: true,
  });
  assert.equal(reg.status, 201); ok('registro de un adulto');
  const alex = reg.data.token;

  const demoLogin = await call('POST', '/api/auth/login', { email: 'demo@pulso.app', password: 'pulso1234' });
  assert.equal(demoLogin.status, 200); ok('login de la cuenta demo');
  const demo = demoLogin.data.token;
  const demoId = demoLogin.data.user.id;

  const venues = await call('GET', '/api/venues?lat=40.4234&lng=-3.6979', null, alex);
  assert.ok(venues.data.venues.length >= 10); ok(`lista de ${venues.data.venues.length} locales (respondió ${venues.node})`);
  const marea = venues.data.venues.find((v) => v.slug === 'club-marea');
  assert.equal(marea.summary.enough, true);
  assert.equal(marea.summary.vibe, 'hombres'); ok('Club Marea aparece con ambiente de mayoría de hombres');
  assert.ok(marea.summary.gender.length > 0 && !('orientation' in marea.summary)); ok('el ambiente se describe solo por género');
  const plumas = venues.data.venues.find((v) => v.slug === 'plumas');
  assert.equal(plumas.summary.vibe, 'mujeres'); ok('Plumas aparece con ambiente de mayoría de mujeres');
  const faro = venues.data.venues.find((v) => v.slug === 'faro');
  assert.equal(faro.summary.enough, false); ok('un local con pocas personas no muestra desglose (k-anonimato)');

  const mujeres = await call('GET', '/api/venues?vibe=mujeres', null, alex);
  assert.ok(mujeres.data.venues.length > 0 && mujeres.data.venues.every((v) => v.summary.vibe === 'mujeres')); ok('filtro por ambiente');

  const peopleBefore = await call('GET', `/api/venues/${marea.id}/people`, null, alex);
  assert.equal(peopleBefore.status, 403); ok('sin check-in no se ve a nadie');

  await call('PATCH', '/api/me', { visibleInVenue: true }, alex);
  const ck = await call('POST', `/api/venues/${marea.id}/checkin`, { lat: marea.lat, lng: marea.lng }, alex);
  assert.equal(ck.status, 201); ok('check-in en Club Marea');
  await call('POST', `/api/venues/${marea.id}/checkin`, { lat: marea.lat, lng: marea.lng }, demo);

  const people = await call('GET', `/api/venues/${marea.id}/people`, null, alex);
  assert.equal(people.status, 200);
  assert.ok(people.data.people.length > 0);
  assert.ok(people.data.people.every((p) => !('email' in p) && !('birthdate' in p))); ok(`se ven ${people.data.people.length} perfiles visibles, sin correo ni fecha de nacimiento`);

  const l1 = await call('POST', `/api/likes/${demoId}`, null, alex);
  assert.equal(l1.data.match, null); ok('primer "me gusta" sin emparejamiento');
  const alexId = reg.data.user.id;
  const l2 = await call('POST', `/api/likes/${alexId}`, null, demo);
  assert.ok(l2.data.match); ok('"me gusta" mutuo → emparejamiento');

  const msg = await call('POST', `/api/matches/${l2.data.match}/messages`, { body: '¡Hola! ¿Estás en la pista?' }, demo);
  assert.equal(msg.status, 201);
  const thread = await call('GET', `/api/matches/${l2.data.match}/messages`, null, alex);
  assert.equal(thread.data.messages.at(-1).body, '¡Hola! ¿Estás en la pista?'); ok('chat entre emparejados');

  const exp = await call('GET', '/api/me/export', null, alex);
  assert.equal(exp.data.user.alias, 'Alex'); ok('exportación de datos (art. 15 RGPD)');

  await call('POST', `/api/blocks/${demoId}`, null, alex);
  const afterBlock = await call('GET', `/api/venues/${marea.id}/people`, null, alex);
  assert.ok(!afterBlock.data.people.some((p) => p.id === demoId)); ok('el bloqueo oculta a la persona');

  await call('DELETE', '/api/venues/checkin/current', null, demo);
  const del = await call('DELETE', '/api/me', null, alex);
  assert.equal(del.status, 204);
  const gone = await call('GET', '/api/me', null, alex);
  assert.equal(gone.status, 404); ok('borrado de cuenta (art. 17 RGPD)');

  console.log(`\n${steps.length} comprobaciones superadas`);
}

main().catch((err) => { console.error('✘', err.message); process.exit(1); });
