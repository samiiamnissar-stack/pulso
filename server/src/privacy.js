// Reglas de privacidad del "ambiente" de cada local.
//
// La idea es que cualquiera pueda saber qué tipo de público hay en un local
// sin que se pueda deducir quién es cada persona:
//   1. Si hay menos de K personas (k-anonimato), no se enseña ningún desglose.
//   2. Los grupos con menos de MIN_GROUP personas se suman a "otras".
//   3. Los porcentajes se redondean a múltiplos de 5.
//   4. La gente que marca "prefiero no decir" cuenta en el total, pero no
//      aparece como categoría propia.

const LABELS = {
  orientation: {
    hetero: 'Hetero',
    gay: 'Gay',
    lesbiana: 'Lesbiana',
    bisexual: 'Bisexual',
    otra: 'Otras',
  },
  gender: {
    mujer: 'Mujeres',
    hombre: 'Hombres',
    no_binario: 'No binarias',
    otro: 'Otras',
  },
};

const round5 = (n) => Math.round(n / 5) * 5;

// rows: [{ key, n }]  →  [{ key, label, pct }]
function breakdown(rows, total, kind, minGroup) {
  const labels = LABELS[kind];
  const groups = {};
  let others = 0;
  for (const { key, n } of rows) {
    if (key === 'prefiero_no_decir') continue;
    const count = Number(n);
    if (count < minGroup || key === 'otra' || key === 'otro') others += count;
    else groups[key] = count;
  }
  if (others > 0 && others < minGroup) {
    // ni siquiera "otras" puede quedar con muy poca gente: se omite
    others = 0;
  }
  const out = Object.entries(groups)
    .map(([key, count]) => ({ key, label: labels[key], pct: round5((count / total) * 100) }))
    .sort((a, b) => b.pct - a.pct);
  if (others > 0) out.push({ key: 'otras', label: 'Otras', pct: round5((others / total) * 100) });
  return out.filter((g) => g.pct > 0);
}

// Etiqueta corta para filtrar locales por ambiente
function vibe(orientationBreakdown) {
  const pct = (k) => orientationBreakdown.find((g) => g.key === k)?.pct ?? 0;
  const lgtbi = pct('gay') + pct('lesbiana') + pct('bisexual') + pct('otras');
  const hetero = pct('hetero');
  if (lgtbi >= 60) return 'lgtbi';
  if (hetero >= 70) return 'hetero';
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
function venueSummary({ total, capacity, orientations, genders, avgAge }, { k, minGroup }) {
  total = Number(total);
  if (total < k) {
    return {
      enough: false,
      people: `menos de ${k}`,
      crowd: 'tranquilo',
      vibe: null,
      orientation: [],
      gender: [],
      avgAge: null,
    };
  }
  const orientation = breakdown(orientations, total, 'orientation', minGroup);
  return {
    enough: true,
    // el total se redondea a la decena para no delatar entradas/salidas concretas
    people: Math.floor(total / 10) * 10,
    crowd: crowdLevel(total, capacity),
    vibe: vibe(orientation),
    orientation,
    gender: breakdown(genders, total, 'gender', minGroup),
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
