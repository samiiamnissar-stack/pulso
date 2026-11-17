const test = require('node:test');
const assert = require('node:assert');
const { venueSummary, vibe, ageFrom, distanceMeters } = require('../src/privacy');

const opts = { k: 10, minGroup: 3 };

test('con menos de K personas no se enseña ningún desglose', () => {
  const s = venueSummary({ total: 9, capacity: 300, genders: [{ key: 'mujer', n: 9 }], avgAge: 24 }, opts);
  assert.equal(s.enough, false);
  assert.deepEqual(s.gender, []);
  assert.equal(s.avgAge, null);
});

test('los grupos pequeños no aparecen con su nombre y nunca salen recuentos exactos', () => {
  const s = venueSummary({
    total: 40,
    capacity: 300,
    genders: [{ key: 'mujer', n: 22 }, { key: 'hombre', n: 16 }, { key: 'no_binario', n: 2 }],
    avgAge: 24.4,
  }, opts);
  assert.equal(s.enough, true);
  const keys = s.gender.map((g) => g.key);
  assert.ok(!keys.includes('no_binario'), 'un grupo de 2 personas no debe aparecer');
  assert.ok(!keys.includes('otras'), '"otras" con menos de 3 personas tampoco');
  for (const g of s.gender) assert.equal(g.pct % 5, 0, 'los porcentajes van de 5 en 5');
  assert.equal(s.people, 40);
});

test('las personas no binarias aparecen cuando son un grupo suficiente', () => {
  const s = venueSummary({
    total: 50, capacity: 300,
    genders: [{ key: 'mujer', n: 25 }, { key: 'hombre', n: 20 }, { key: 'no_binario', n: 5 }],
    avgAge: 25,
  }, opts);
  assert.deepEqual(s.gender.map((g) => [g.key, g.pct]), [['mujer', 50], ['hombre', 40], ['no_binario', 10]]);
});

test('etiqueta del ambiente según el género mayoritario', () => {
  assert.equal(vibe([{ key: 'mujer', pct: 65 }, { key: 'hombre', pct: 35 }]), 'mujeres');
  assert.equal(vibe([{ key: 'mujer', pct: 30 }, { key: 'hombre', pct: 70 }]), 'hombres');
  assert.equal(vibe([{ key: 'mujer', pct: 50 }, { key: 'hombre', pct: 45 }, { key: 'no_binario', pct: 5 }]), 'mixto');
});

test('edad calculada correctamente el día antes y el día del cumpleaños', () => {
  assert.equal(ageFrom('2008-11-16', new Date('2026-11-15')), 17);
  assert.equal(ageFrom('2008-11-15', new Date('2026-11-15')), 18);
});

test('distancia aproximada entre dos puntos de Madrid', () => {
  const d = distanceMeters(40.4168, -3.7038, 40.4200, -3.7050); // Sol → Gran Vía
  assert.ok(d > 300 && d < 450, `distancia inesperada: ${d}`);
});
