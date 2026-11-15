const test = require('node:test');
const assert = require('node:assert');
const { venueSummary, ageFrom, distanceMeters } = require('../src/privacy');

const opts = { k: 10, minGroup: 3 };

test('con menos de K personas no se enseña ningún desglose', () => {
  const s = venueSummary({ total: 9, capacity: 300, orientations: [{ key: 'gay', n: 9 }], genders: [], avgAge: 24 }, opts);
  assert.equal(s.enough, false);
  assert.deepEqual(s.orientation, []);
  assert.equal(s.avgAge, null);
});

test('los grupos pequeños se agrupan en "otras" y nunca salen recuentos exactos', () => {
  const s = venueSummary({
    total: 40,
    capacity: 300,
    orientations: [{ key: 'hetero', n: 30 }, { key: 'gay', n: 6 }, { key: 'lesbiana', n: 2 }, { key: 'otra', n: 2 }],
    genders: [{ key: 'mujer', n: 20 }, { key: 'hombre', n: 20 }],
    avgAge: 24.4,
  }, opts);
  assert.equal(s.enough, true);
  const keys = s.orientation.map((g) => g.key);
  assert.ok(!keys.includes('lesbiana'), 'un grupo de 2 no debe aparecer con su nombre');
  assert.ok(keys.includes('otras'));
  for (const g of s.orientation) assert.equal(g.pct % 5, 0, 'los porcentajes van de 5 en 5');
  assert.equal(s.people, 40);
});

test('"prefiero no decir" cuenta en el total pero no aparece', () => {
  const s = venueSummary({
    total: 20, capacity: 100,
    orientations: [{ key: 'hetero', n: 15 }, { key: 'prefiero_no_decir', n: 5 }],
    genders: [], avgAge: null,
  }, opts);
  assert.ok(!s.orientation.some((g) => g.key === 'prefiero_no_decir'));
  assert.equal(s.orientation[0].pct, 75);
});

test('edad calculada correctamente el día antes y el día del cumpleaños', () => {
  assert.equal(ageFrom('2008-11-16', new Date('2026-11-15')), 17);
  assert.equal(ageFrom('2008-11-15', new Date('2026-11-15')), 18);
});

test('distancia aproximada entre dos puntos de Madrid', () => {
  const d = distanceMeters(40.4168, -3.7038, 40.4200, -3.7050); // Sol → Gran Vía
  assert.ok(d > 300 && d < 450, `distancia inesperada: ${d}`);
});
