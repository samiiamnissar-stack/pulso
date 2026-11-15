// Pulso · cliente PWA sin frameworks.
// Todo el texto que viene del servidor se pinta con textContent para evitar XSS.

const $view = document.getElementById('view');
const $tabs = document.getElementById('tabs');
const $toast = document.getElementById('toast');
const $badge = document.getElementById('badge');

const state = {
  token: localStorage.getItem('pulso.token'),
  me: null,
  checkin: null,
  config: { k: 10, minAge: 18, checkinHours: 4, demoMode: false },
  pos: null,
  filter: 'todos',
  socket: null,
  unread: 0,
};

const LABEL = {
  hetero: 'Hetero', gay: 'Gay', lesbiana: 'Lesbiana', bisexual: 'Bisexual', otra: 'Otra', prefiero_no_decir: 'Prefiero no decirlo',
  mujer: 'Mujer', hombre: 'Hombre', no_binario: 'No binaria', otro: 'Otro',
};
const VIBE = { lgtbi: 'LGTBI+', mixto: 'Mixto', hetero: 'Hetero' };
const CROWD = { tranquilo: 1, animado: 2, lleno: 3, 'a tope': 4 };
const AVATAR = ['#ff3d8b', '#2de2e6', '#ffb547', '#8b5cf6', '#3ddc97'];

/* ---------- utilidades ---------- */

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

function render(...nodes) {
  $view.replaceChildren(...nodes.filter((n) => n != null && n !== false));
  window.scrollTo(0, 0);
}

let toastTimer;
function toast(msg) {
  $toast.textContent = msg;
  $toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $toast.hidden = true; }, 2800);
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json', ...(state.token ? { authorization: `Bearer ${state.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && state.token) { logout(); throw new Error('La sesión ha caducado'); }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se ha podido completar');
  return data;
}

function getPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  });
}

const fmtDistance = (m) => (m == null ? '' : m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`);
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
const initial = (s) => (s || '?').trim().charAt(0).toUpperCase();
const colorFor = (s) => AVATAR[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR.length];

function avatar(name) {
  return h('div', { class: 'avatar', style: `background:${colorFor(name)}`, 'aria-hidden': 'true' }, initial(name));
}

function stackBar(groups, title) {
  if (!groups.length) return null;
  return h('div', {},
    h('div', { class: 'stack', role: 'img', 'aria-label': `${title}: ${groups.map((g) => `${g.label} ${g.pct}%`).join(', ')}` },
      groups.map((g) => h('span', { class: `c-${g.key}`, style: `width:${g.pct}%` }))),
    h('div', { class: 'legend' }, groups.map((g) => h('span', {}, h('b', { class: `c-${g.key}` }), `${g.label} ${g.pct}%`))));
}

function crowdMeter(level) {
  const n = CROWD[level] || 0;
  return h('span', { class: 'crowd' }, [1, 2, 3, 4].map((i) => h('i', { class: i <= n ? 'on' : '' })), level);
}

function vibeTag(summary) {
  if (!summary.enough) return h('span', { class: 'vibe vibe-none' }, 'Poca gente aún');
  return h('span', { class: `vibe vibe-${summary.vibe}` }, VIBE[summary.vibe]);
}

/* ---------- sesión y tiempo real ---------- */

function logout() {
  state.token = null;
  state.me = null;
  localStorage.removeItem('pulso.token');
  if (state.socket) state.socket.disconnect();
  state.socket = null;
  location.hash = '#/entrar';
}

function connectSocket() {
  if (!window.io || state.socket || !state.token) return;
  state.socket = window.io({ auth: { token: state.token }, transports: ['websocket'] });
  state.socket.on('match:new', () => {
    toast('¡Tienes un match nuevo! ♥');
    bump();
  });
  state.socket.on('message:new', (msg) => {
    const open = location.hash === `#/chat/${msg.matchId}`;
    if (open) appendMessage(msg);
    else if (msg.sender_id !== state.me?.id) { toast('Mensaje nuevo'); bump(); }
  });
  state.socket.on('venue:update', ({ venueId }) => {
    if (location.hash === '#/' || location.hash === '') scheduleRefresh();
    if (location.hash === `#/local/${venueId}`) scheduleRefresh();
  });
}

function bump() {
  state.unread += 1;
  $badge.textContent = state.unread;
  $badge.hidden = false;
}

let refreshTimer;
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(route, 1500);
}

async function loadMe() {
  const data = await api('/api/me');
  state.me = data.user;
  state.checkin = data.checkin;
}

/* ---------- pantallas ---------- */

function viewAuth() {
  $tabs.hidden = true;
  let mode = 'login';
  const err = h('p', { class: 'error', role: 'alert' });
  const holder = h('div');

  const loginForm = () => h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      err.textContent = '';
      try {
        const data = await api('/api/auth/login', { method: 'POST', body: { email: f.get('email'), password: f.get('password') } });
        onLogged(data);
      } catch (ex) { err.textContent = ex.message; }
    },
  },
  h('label', {}, 'Correo', h('input', { name: 'email', type: 'email', autocomplete: 'email', required: true })),
  h('label', {}, 'Contraseña', h('input', { name: 'password', type: 'password', autocomplete: 'current-password', required: true })),
  err,
  h('button', { class: 'btn', type: 'submit' }, 'Entrar'),
  h('p', { class: 'note' }, 'Para probar: demo@pulso.app · pulso1234'));

  const max = new Date();
  max.setFullYear(max.getFullYear() - state.config.minAge);
  const option = (v) => h('option', { value: v }, LABEL[v]);

  const registerForm = () => h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      err.textContent = '';
      try {
        const data = await api('/api/auth/register', {
          method: 'POST',
          body: {
            email: f.get('email'), password: f.get('password'), alias: f.get('alias'), birthdate: f.get('birthdate'),
            gender: f.get('gender'), orientation: f.get('orientation'), consent: f.get('consent') === 'on',
          },
        });
        onLogged(data);
      } catch (ex) { err.textContent = ex.message; }
    },
  },
  h('label', {}, 'Alias (es lo único que verán los demás)', h('input', { name: 'alias', maxlength: 30, required: true })),
  h('label', {}, 'Correo', h('input', { name: 'email', type: 'email', autocomplete: 'email', required: true })),
  h('label', {}, 'Contraseña (mínimo 8 caracteres)', h('input', { name: 'password', type: 'password', minlength: 8, autocomplete: 'new-password', required: true })),
  h('label', {}, 'Fecha de nacimiento', h('input', { name: 'birthdate', type: 'date', max: max.toISOString().slice(0, 10), required: true })),
  h('label', {}, 'Género', h('select', { name: 'gender', required: true }, ['mujer', 'hombre', 'no_binario', 'otro'].map(option))),
  h('label', {}, 'Orientación', h('select', { name: 'orientation', required: true }, ['hetero', 'gay', 'lesbiana', 'bisexual', 'otra', 'prefiero_no_decir'].map(option))),
  h('label', { class: 'check' },
    h('input', { type: 'checkbox', name: 'consent', required: true }),
    h('span', {}, 'Consiento que Pulso use mi orientación sexual solo para calcular el ambiente de cada local de forma anónima. Nadie la verá a menos que yo active «mostrar orientación». Puedo retirar este consentimiento borrando mi cuenta.')),
  err,
  h('button', { class: 'btn', type: 'submit' }, 'Crear cuenta'),
  h('p', { class: 'note' }, `Solo para mayores de ${state.config.minAge} años.`));

  const seg = h('div', { class: 'segmented', role: 'tablist' });
  const paint = () => {
    seg.replaceChildren(
      h('button', { type: 'button', role: 'tab', 'aria-selected': String(mode === 'login'), onclick: () => { mode = 'login'; paint(); } }, 'Entrar'),
      h('button', { type: 'button', role: 'tab', 'aria-selected': String(mode === 'registro'), onclick: () => { mode = 'registro'; paint(); } }, 'Crear cuenta'),
    );
    err.textContent = '';
    holder.replaceChildren(mode === 'login' ? loginForm() : registerForm());
  };
  paint();

  render(
    h('div', { class: 'top' }, h('div', { class: 'brand' }, h('span', { class: 'brand-dot' }), 'Pulso')),
    h('p', { class: 'subtitle' }, 'Antes de salir, mira qué ambiente hay en cada local. Sin exponer a nadie.'),
    state.config.demoMode ? h('div', { class: 'banner' }, 'Versión de demostración con locales y personas inventados. No pongas aquí datos reales: entra con la cuenta de prueba.') : null,
    seg, holder,
  );
}

async function onLogged(data) {
  state.token = data.token;
  localStorage.setItem('pulso.token', data.token);
  state.me = data.user;
  connectSocket();
  location.hash = '#/';
}

async function viewHome() {
  const list = h('div', { class: 'list' }, [1, 2, 3, 4].map(() => h('div', { class: 'skeleton' })));
  const filters = [['todos', 'Todos'], ['lgtbi', 'LGTBI+'], ['mixto', 'Mixto'], ['hetero', 'Hetero']];
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filtrar por ambiente' },
    filters.map(([k, label]) => h('button', {
      class: 'chip', 'aria-pressed': String(state.filter === k),
      onclick: () => { state.filter = k; route(); },
    }, label)));

  const here = state.checkin
    ? h('a', { class: 'here', href: `#/local/${state.checkin.venue_id}` }, h('span', {}, `Estás en ${state.checkin.name}`), h('b', {}, 'Ver →'))
    : null;

  render(
    h('div', { class: 'top' },
      h('div', { class: 'brand' }, h('span', { class: 'brand-dot' }), 'Pulso'),
      h('button', { class: 'btn ghost small', onclick: async () => { state.pos = await getPosition(); if (!state.pos) toast('No tengo tu ubicación; ordeno por nombre'); route(); } }, state.pos ? '📍 Cerca de ti' : '📍 Usar ubicación')),
    h('p', { class: 'subtitle' }, 'Esta noche en Madrid'),
    state.config.demoMode ? h('div', { class: 'banner' }, 'Modo demostración: puedes hacer check-in sin estar en el local.') : null,
    here, chips, list,
  );

  try {
    const q = new URLSearchParams();
    if (state.pos) { q.set('lat', state.pos.lat); q.set('lng', state.pos.lng); }
    if (state.filter !== 'todos') q.set('vibe', state.filter);
    const { venues } = await api(`/api/venues?${q}`);
    if (!venues.length) {
      list.replaceChildren(h('p', { class: 'empty' }, 'Ahora mismo ningún local tiene ese ambiente. Prueba con otro filtro.'));
      return;
    }
    list.replaceChildren(...venues.map((v) => h('a', { class: 'venue', href: `#/local/${v.id}` },
      h('div', { class: 'venue-head' },
        h('span', { class: 'venue-name' }, v.name),
        h('span', { class: 'venue-meta' }, fmtDistance(v.distance))),
      h('div', { class: 'venue-meta' }, `${v.barrio} · ${v.music}`),
      h('div', { class: 'venue-row' }, vibeTag(v.summary), crowdMeter(v.summary.crowd)),
      stackBar(v.summary.orientation, 'Ambiente'))));
  } catch (ex) {
    list.replaceChildren(h('p', { class: 'empty' }, ex.message));
  }
}

async function viewVenue(id) {
  render(h('button', { class: 'back', onclick: () => history.back() }, '← Volver'), h('div', { class: 'skeleton' }));
  let venue;
  try {
    venue = (await api(`/api/venues/${id}`)).venue;
    await loadMe();
  } catch (ex) { render(h('p', { class: 'empty' }, ex.message)); return; }

  const s = venue.summary;
  const here = state.checkin?.venue_id === venue.id;
  const peopleBox = h('div');

  const checkinBtn = h('button', {
    class: here ? 'btn ghost' : 'btn',
    onclick: async (e) => {
      e.target.disabled = true;
      try {
        if (here) {
          await api('/api/venues/checkin/current', { method: 'DELETE' });
          toast('Has salido del local');
        } else {
          const pos = state.config.demoMode ? (await getPosition()) || { lat: venue.lat, lng: venue.lng } : await getPosition();
          if (!pos) throw new Error('Activa la ubicación para confirmar que estás en el local');
          await api(`/api/venues/${venue.id}/checkin`, { method: 'POST', body: pos });
          toast(`Check-in hecho. Caduca en ${state.config.checkinHours} h`);
        }
        route();
      } catch (ex) { toast(ex.message); e.target.disabled = false; }
    },
  }, here ? 'Salir del local' : 'Estoy aquí · hacer check-in');

  render(
    h('button', { class: 'back', onclick: () => history.back() }, '← Volver'),
    h('section', { class: 'hero' },
      h('h1', {}, venue.name),
      h('div', { class: 'venue-meta' }, `${venue.barrio} · ${venue.address} · ${venue.music}`),
      h('div', { class: 'venue-row' }, vibeTag(s), crowdMeter(s.crowd)),
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('strong', {}, String(s.people)), h('span', {}, 'con Pulso')),
        h('div', { class: 'stat' }, h('strong', {}, s.avgAge ? `${s.avgAge}` : '—'), h('span', {}, 'edad media')),
        h('div', { class: 'stat' }, h('strong', {}, `${venue.opens}–${venue.closes}`), h('span', {}, 'horario')))),
    s.enough
      ? h('div', { class: 'panel' },
        h('h2', { style: 'margin-top:0' }, 'Ambiente'), stackBar(s.orientation, 'Orientación'),
        h('h2', {}, 'Público'), stackBar(s.gender, 'Género'),
        h('p', { class: 'note' }, 'Porcentajes redondeados de 5 en 5. Los grupos muy pequeños se suman en «Otras» para que nadie sea identificable.'))
      : h('div', { class: 'panel' }, h('p', { class: 'note', style: 'margin:0' }, `Hay menos de ${state.config.k} personas con Pulso aquí. Para proteger su privacidad no enseñamos el desglose hasta que haya más gente.`)),
    h('div', { class: 'row' }, checkinBtn),
    peopleBox,
  );

  if (!here) {
    peopleBox.append(h('p', { class: 'note', style: 'margin-top:14px' }, 'Cuando hagas check-in podrás ver a la gente que ha decidido dejarse ver en este local.'));
    return;
  }

  try {
    const { people } = await api(`/api/venues/${venue.id}/people`);
    const intro = state.me.visibleInVenue
      ? 'Personas que se dejan ver aquí ahora mismo:'
      : 'Tú no eres visible. Puedes activarlo en tu perfil si quieres que te vean.';
    peopleBox.append(h('h2', {}, `Se dejan ver (${people.length})`), h('p', { class: 'note' }, intro));
    if (!people.length) { peopleBox.append(h('p', { class: 'empty' }, 'Nadie visible todavía.')); return; }
    peopleBox.append(h('div', { class: 'people' }, people.map((p) => {
      const btn = h('button', {
        class: 'btn small like', 'aria-pressed': String(p.liked), disabled: p.liked,
        onclick: async () => {
          btn.disabled = true;
          try {
            const r = await api(`/api/likes/${p.id}`, { method: 'POST' });
            btn.setAttribute('aria-pressed', 'true');
            btn.textContent = '♥ Enviado';
            if (r.match) { toast(`¡Match con ${p.alias}!`); location.hash = `#/chat/${r.match}`; }
          } catch (ex) { toast(ex.message); btn.disabled = false; }
        },
      }, p.liked ? '♥ Enviado' : '♥ Me gusta');
      return h('article', { class: 'person' },
        avatar(p.alias),
        h('span', { class: 'name' }, `${p.alias}, ${p.age}`),
        h('span', { class: 'tag' }, [LABEL[p.gender], p.orientation ? LABEL[p.orientation] : null].filter(Boolean).join(' · ')),
        h('span', { class: 'bio' }, p.bio || ''),
        btn,
        h('button', {
          class: 'back', style: 'font-size:.8rem;text-align:left',
          onclick: async () => {
            const reason = prompt(`¿Qué ha pasado con ${p.alias}? (también dejarás de verle)`);
            if (!reason) return;
            await api('/api/reports', { method: 'POST', body: { userId: p.id, reason } });
            toast('Gracias. Lo revisaremos');
            route();
          },
        }, 'Denunciar o bloquear'));
    })));
  } catch (ex) { peopleBox.append(h('p', { class: 'empty' }, ex.message)); }
}

async function viewMatches() {
  state.unread = 0;
  $badge.hidden = true;
  const list = h('div', { class: 'list' }, h('div', { class: 'skeleton' }));
  render(h('h1', {}, 'Matches'), h('p', { class: 'subtitle' }, 'Gente con la que ha habido «me gusta» mutuo.'), list);
  try {
    const { matches } = await api('/api/matches');
    if (!matches.length) {
      list.replaceChildren(h('p', { class: 'empty' }, 'Todavía no tienes matches. Haz check-in en un local y descubre quién se deja ver.'));
      return;
    }
    list.replaceChildren(...matches.map((m) => h('a', { class: 'match', href: `#/chat/${m.id}` },
      avatar(m.other_alias),
      h('div', {},
        h('div', { class: 'name', style: 'font-weight:700' }, m.other_alias),
        h('div', { class: 'last' }, m.last_message || `Match en ${m.venue || 'Pulso'} · ¡salúdale!`)))));
  } catch (ex) { list.replaceChildren(h('p', { class: 'empty' }, ex.message)); }
}

let chatBox = null;
function appendMessage(m) {
  if (!chatBox || chatBox.querySelector(`[data-id="${m.id}"]`)) return;
  chatBox.querySelector('.empty')?.remove();
  const mine = m.sender_id === state.me?.id;
  chatBox.append(h('div', { class: `bubble ${mine ? 'mine' : 'theirs'}`, 'data-id': m.id }, m.body, h('time', {}, fmtTime(m.created_at))));
  window.scrollTo(0, document.body.scrollHeight);
}

async function viewChat(id) {
  if (!state.me) await loadMe();
  chatBox = h('div', { class: 'chat' });
  const input = h('input', { placeholder: 'Escribe un mensaje', maxlength: 1000, 'aria-label': 'Mensaje' });
  const send = async (e) => {
    e.preventDefault();
    const body = input.value.trim();
    if (!body) return;
    input.value = '';
    try {
      const { message } = await api(`/api/matches/${id}/messages`, { method: 'POST', body: { body } });
      appendMessage(message);
    } catch (ex) { toast(ex.message); input.value = body; }
  };
  const { matches } = await api('/api/matches').catch(() => ({ matches: [] }));
  const match = matches.find((m) => String(m.id) === String(id));
  render(
    h('button', { class: 'back', onclick: () => { location.hash = '#/matches'; } }, '← Matches'),
    h('h1', {}, match ? match.other_alias : 'Chat'),
    h('p', { class: 'note' }, match?.venue ? `Os conocisteis en ${match.venue}` : ''),
    chatBox,
    h('form', { class: 'composer', onsubmit: send }, input, h('button', { class: 'btn small', type: 'submit' }, 'Enviar')),
  );
  try {
    const { messages } = await api(`/api/matches/${id}/messages`);
    messages.forEach(appendMessage);
    if (!messages.length) chatBox.append(h('p', { class: 'empty' }, 'Rompe el hielo 👋'));
  } catch (ex) { chatBox.append(h('p', { class: 'empty' }, ex.message)); }
}

async function viewProfile() {
  await loadMe();
  const me = state.me;
  const option = (v, cur) => h('option', { value: v, selected: v === cur }, LABEL[v]);

  const toggle = (key, title, help) => h('label', { class: 'switch' },
    h('span', {}, title, h('small', {}, help)),
    h('input', {
      type: 'checkbox', checked: me[key],
      onchange: async (e) => {
        try { await api('/api/me', { method: 'PATCH', body: { [key]: e.target.checked } }); toast('Guardado'); } catch (ex) { toast(ex.message); e.target.checked = !e.target.checked; }
      },
    }));

  render(
    h('div', { class: 'top' }, h('div', { style: 'display:flex;gap:12px;align-items:center' }, avatar(me.alias), h('div', {}, h('h1', { style: 'margin:0' }, me.alias), h('span', { class: 'note' }, `${me.age} años`)))),
    h('div', { class: 'panel' },
      h('h2', { style: 'margin-top:0' }, 'Privacidad'),
      toggle('visibleInVenue', 'Visible en el local', 'Quien haya hecho check-in en el mismo local verá tu alias, edad y bio.'),
      toggle('showOrientation', 'Mostrar mi orientación', 'Si está desactivado, solo cuenta de forma anónima en las estadísticas.')),
    h('div', { class: 'panel' },
      h('h2', { style: 'margin-top:0' }, 'Tu perfil'),
      h('form', {
        onsubmit: async (e) => {
          e.preventDefault();
          const f = new FormData(e.target);
          try {
            await api('/api/me', { method: 'PATCH', body: { alias: f.get('alias'), bio: f.get('bio'), gender: f.get('gender'), orientation: f.get('orientation') } });
            toast('Perfil actualizado');
          } catch (ex) { toast(ex.message); }
        },
      },
      h('label', {}, 'Alias', h('input', { name: 'alias', value: me.alias, maxlength: 30 })),
      h('label', {}, 'Bio', h('textarea', { name: 'bio', maxlength: 160, rows: 2 }, me.bio)),
      h('label', {}, 'Género', h('select', { name: 'gender' }, ['mujer', 'hombre', 'no_binario', 'otro'].map((v) => option(v, me.gender)))),
      h('label', {}, 'Orientación', h('select', { name: 'orientation' }, ['hetero', 'gay', 'lesbiana', 'bisexual', 'otra', 'prefiero_no_decir'].map((v) => option(v, me.orientation)))),
      h('button', { class: 'btn', type: 'submit' }, 'Guardar'))),
    h('div', { class: 'panel' },
      h('h2', { style: 'margin-top:0' }, 'Tus datos'),
      h('p', { class: 'note' }, 'Nunca guardamos tus coordenadas: solo en qué local has hecho check-in, y eso caduca solo.'),
      h('div', { class: 'row' },
        h('button', {
          class: 'btn ghost',
          onclick: async () => {
            const data = await api('/api/me/export');
            const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
            h('a', { href: url, download: 'mis-datos-pulso.json' }).click();
          },
        }, 'Descargar mis datos')),
      h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: logout }, 'Cerrar sesión')),
      h('div', { class: 'row' }, h('button', {
        class: 'btn danger',
        onclick: async () => {
          if (!confirm('Se borrará tu cuenta, tus matches y tus mensajes. No se puede deshacer. ¿Seguro?')) return;
          await api('/api/me', { method: 'DELETE' });
          logout();
          toast('Cuenta borrada');
        },
      }, 'Borrar mi cuenta'))),
  );
}

/* ---------- router ---------- */

async function route() {
  const hash = location.hash || '#/';
  if (!state.token) { if (hash !== '#/entrar') location.hash = '#/entrar'; viewAuth(); return; }
  if (hash === '#/entrar') { location.hash = '#/'; return; }
  $tabs.hidden = false;
  const tab = hash.startsWith('#/matches') || hash.startsWith('#/chat') ? 'matches' : hash.startsWith('#/perfil') ? 'perfil' : 'home';
  $tabs.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));

  try {
    let m;
    if ((m = hash.match(/^#\/local\/(\d+)/))) return await viewVenue(m[1]);
    if ((m = hash.match(/^#\/chat\/(\d+)/))) return await viewChat(m[1]);
    if (hash.startsWith('#/matches')) return await viewMatches();
    if (hash.startsWith('#/perfil')) return await viewProfile();
    if (!state.me) await loadMe();
    return await viewHome();
  } catch (ex) {
    toast(ex.message);
    return null;
  }
}

async function start() {
  try { state.config = await api('/api/config'); } catch { /* valores por defecto */ }
  if (state.token) connectSocket();
  window.addEventListener('hashchange', route);
  route();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}

start();
