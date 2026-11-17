// Reglas de privacidad del "ambiente" de cada local.
//
// El ambiente se describe por el género del público (mujeres, hombres y
// personas no binarias). La idea es que se pueda saber qué tipo de público
// hay en un local sin poder deducir quién es cada persona:
//   1. Si hay menos de K personas (k-anonimato), no se enseña ningún desglose.
//   2. Los grupos con menos de MIN_GROUP personas se suman a "otras" (y si
//      "otras" sigue siendo muy pequeño, no se muestra).
//   3. Los porcentajes se redondean a múltiplos de 5.

const LABELS = {
  mujer: 'Mujeres',
  hombre: 'Hombres',
  no_binario: 'No binarias',
  otro: 'Otras',
};

const round5 = (n) => Math.round(n / 5) * 5;

// rows: [{ key, n }]  →  [{ key, label, pct }]
function breakdown(rows, total, minGroup) {
  const groups = {};
  let others = 0;
  for (const { key, n } of rows) {
    const count = Number(n);
    if (count < minGroup || key === 'otro') others += count;
    else groups[key] = count;
  }
  if (others > 0 && others < minGroup) {
    // ni siquiera "otras" puede quedar con muy poca gente: se omite
    others = 0;
  }
  const out = Object.entries(groups)
    .map(([key, count]) => ({ key, label: LABELS[key], pct: round5((count / total) * 100) }))
    .sort((a, b) => b.pct - a.pct);
  if (others > 0) out.push({ key: 'otras', label: 'Otras', pct: round5((others / total) * 100) });
  return out.filter((g) => g.pct > 0);
}

// Etiqueta corta para filtrar locales por ambiente
function vibe(genderBreakdown) {
  const pct = (k) => genderBreakdown.find((g) => g.key === k)?.pct ?? 0;
  if (pct('mujer') >= 60) return 'mujeres';
  if (pct('hombre') >= 60) return 'hombres';
  return 'mixto';
}

function crowdLevel(total, capacity) {
  const ratio = total / capacity;
  if (ratio < 0.15) return 'tranquilo';
  if (ratio < 0.45) return 'animado';
  if (ratio < 0.8) return 'lleno';
  return 'a tope';
}

/**
 * Construye el resumen público de un local a partir de los recuentos crudos.
 * Nunca devuelve recuentos exactos por categoría, solo porcentajes redondeados.
 */
function venueSummary({ total, capacity, genders, avgAge }, { k, minGroup }) {
  total = Number(total);
  if (total < k) {
    return {
      enough: false,
      people: `menos de ${k}`,
      crowd: 'tranquilo',
      vibe: null,
      gender: [],
      avgAge: null,
    };
  }
  const gender = breakdown(genders, total, minGroup);
  return {
    enough: true,
    // el total se redondea a la decena para no delatar entradas/salidas concretas
    people: Math.floor(total / 10) * 10,
    crowd: crowdLevel(total, capacity),
    vibe: vibe(gender),
    gender,
    avgAge: avgAge ? Math.round(Number(avgAge)) : null,
  };
}

function ageFrom(birthdate, now = new Date()) {
  const b = new Date(birthdate);
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  return age;
}

// Distancia en metros entre dos coordenadas (fórmula del haversino)
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

module.exports = { venueSummary, breakdown, vibe, crowdLevel, ageFrom, distanceMeters, LABELS };
