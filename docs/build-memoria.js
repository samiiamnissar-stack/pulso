// Genera docs/Memoria_Dimensionado_Pulso.docx
// Uso: REPO_URL=https://github.com/usuario/pulso node docs/build-memoria.js
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
  AlignmentType, HeadingLevel, ImageRun, PageBreak, Footer, Header, PageNumber, LevelFormat,
  TableOfContents, BorderStyle,
} = require('docx');

const REPO = process.env.REPO_URL || 'https://github.com/';
const img = (f) => fs.readFileSync(path.join(__dirname, 'img', f));
const W = 9026; // ancho útil A4 con márgenes de 2,54 cm
const C = { primary: '1E3A5F', accent: 'C2185B', soft: 'E8EEF5', line: 'B8C4D2', grey: '555555' };

// Texto con **negritas**
function runs(text, base = {}) {
  return String(text).split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((t) => (t.startsWith('**')
    ? new TextRun({ text: t.slice(2, -2), bold: true, ...base })
    : new TextRun({ text: t, ...base })));
}
const P = (text, opts = {}) => new Paragraph({ children: runs(text, opts.run), spacing: { after: 120 }, ...opts.p });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const H3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] });
const B = (t) => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: runs(t), spacing: { after: 60 } });
const NOTE = (t) => new Paragraph({ children: runs(t, { italics: true, color: C.grey, size: 19 }), spacing: { after: 160 } });
const PB = () => new Paragraph({ children: [new PageBreak()] });
const FORMULA = (t) => new Paragraph({
  children: runs(t, { font: 'Consolas', size: 20 }),
  shading: { type: ShadingType.CLEAR, fill: 'F3F5F8', color: 'auto' },
  spacing: { before: 60, after: 120 }, indent: { left: 200 },
});

function table(head, rows, widths, opts = {}) {
  const sum = widths.reduce((a, b) => a + b, 0);
  const w = widths.map((x) => Math.round((x / sum) * W));
  w[w.length - 1] += W - w.reduce((a, b) => a + b, 0);
  const border = { style: BorderStyle.SINGLE, size: 4, color: C.line };
  const borders = { top: border, bottom: border, left: border, right: border };
  const cell = (text, i, header, zebra, bold) => new TableCell({
    width: { size: w[i], type: WidthType.DXA },
    borders,
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: header ? C.primary : zebra ? 'F6F8FB' : 'FFFFFF' },
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: [new Paragraph({ children: runs(text, { size: 18, color: header ? 'FFFFFF' : '222222', bold: header || bold }) })],
  });
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: w,
    rows: [
      new TableRow({ tableHeader: true, children: head.map((h, i) => cell(h, i, true)) }),
      ...rows.map((r, ri) => new TableRow({
        children: r.map((c, i) => cell(c, i, false, ri % 2 === 1, opts.boldLast && ri === rows.length - 1)),
      })),
    ],
  });
}
const gap = () => new Paragraph({ spacing: { after: 80 }, children: [] });

function image(file, wPx, hPx, caption) {
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 }, children: [new ImageRun({ type: 'png', data: img(file), transformation: { width: wPx, height: hPx } })] }),
    caption ? new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: runs(caption, { italics: true, size: 18, color: C.grey }) }) : null,
  ].filter(Boolean);
}

const n = (x) => Math.round(x).toLocaleString('es-ES');
const D = JSON.parse(process.env.CALC_JSON);

// ---------------------------------------------------------------------------
const portada = [
  new Paragraph({ spacing: { before: 1800, after: 120 }, children: [new TextRun({ text: 'EJERCICIO PRÁCTICO · 2.º ASIR', color: C.accent, bold: true, size: 22 })] }),
  new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: 'Dimensionado de servidores y red para Pulso', bold: true, size: 52, color: C.primary })] }),
  new Paragraph({ spacing: { after: 600 }, children: [new TextRun({ text: 'Una red social de ambiente nocturno de ámbito nacional: de la app al centro de datos', size: 28, color: '333333' })] }),
  table(['Dato', ''], [
    ['Alumna', 'Samia El Yahyaoui Mnissar'],
    ['Curso', '2.º ASIR'],
    ['Módulo', ''],
    ['Grupo', ''],
    ['Fecha de entrega', ''],
    ['Repositorio', REPO],
  ], [1, 3]),
  PB(),
];

const indice = [
  new Paragraph({ children: [new TextRun({ text: 'Índice', bold: true, size: 32, color: C.primary })], spacing: { after: 200 } }),
  new TableOfContents('Índice', { hyperlink: true, headingStyleRange: '1-2' }),
  NOTE('Si el índice aparece vacío, en Word: clic derecho sobre él → «Actualizar campos».'),
  PB(),
];

const intro = [
  H1('1. Punto de partida'),
  P('El enunciado plantea una red social de contactos para España dirigida a personas de 17 a 30 años, con un objetivo de penetración del 30 % entre quienes usan Internet en ese tramo de edad. En lugar de dimensionar una app imaginaria, he desarrollado una app real, **Pulso**, y he usado su comportamiento para justificar las hipótesis y comprobar en laboratorio algunos de los valores orientativos del enunciado.'),
  P('El documento sigue el orden de las tareas T1 a T7. Antes de los cálculos explico qué hace la app, porque varias decisiones de infraestructura (la caché de 30 segundos, la capa de tiempo real o la región secundaria) salen directamente de cómo funciona.'),
  H2('1.1. Qué es Pulso'),
  P('Pulso responde a una pregunta muy concreta: **«¿qué ambiente hay esta noche en cada local?»**. Antes de salir, la persona ve una lista de discotecas cercanas con la afluencia, la edad media y el reparto aproximado del público por orientación sexual y por género. Con eso puede decidir a dónde ir según lo que busca: un sitio LGTBI+, uno mixto o uno mayoritariamente hetero.'),
  P('Además cubre todo lo que pide el contexto del enunciado: perfiles, búsqueda por cercanía, «me gusta», emparejamientos y chat.'),
  table(['Función', 'Cómo funciona en Pulso'], [
    ['Ambiente de cada local', 'Porcentajes anónimos calculados con las personas que han hecho check-in. Filtro por ambiente: LGTBI+, mixto o hetero.'],
    ['Búsqueda por cercanía', 'La lista se ordena por distancia usando la ubicación del móvil. La ubicación no se guarda.'],
    ['Check-in', 'Solo se puede hacer estando a menos de 300 m del local. Caduca solo a las 4 horas.'],
    ['Perfiles visibles (opcional)', 'Quien lo active aparece, con su alias, ante las personas que han hecho check-in en el mismo local.'],
    ['«Me gusta» y match', 'Si dos personas visibles en el mismo local se dan «me gusta», se crea un emparejamiento.'],
    ['Chat', 'Mensajes en tiempo real entre personas emparejadas (WebSocket).'],
    ['Seguridad', 'Bloqueo, denuncia, exportación de datos y borrado de cuenta.'],
  ], [1, 2.6]),
  gap(),
  H2('1.2. Decisiones de privacidad'),
  P('La orientación sexual es un dato de categoría especial según el artículo 9 del RGPD. Una app que dijera «en esta discoteca están estas personas, y son gais» podría usarse para señalar o agredir a alguien en un lugar físico concreto. Por eso el diseño parte de cuatro reglas:'),
  B('**Ambiente agregado y anónimo.** Si en un local hay menos de 10 personas con Pulso (k-anonimato, k = 10), no se enseña ningún desglose. Los grupos de menos de 3 personas se suman en «Otras» y los porcentajes se redondean de 5 en 5.'),
  B('**Visibilidad opcional.** Por defecto nadie es visible. Quien activa «visible en el local» solo es visto por quien también está en ese local, y su orientación sigue oculta salvo que active «mostrar orientación».'),
  B('**Sin coordenadas guardadas.** La ubicación solo se usa en el momento del check-in para comprobar que la persona está en el local. En la base de datos solo queda el identificador del local, y el check-in caduca.'),
  B('**Mayoría de edad y consentimiento expreso.** El registro exige 18 años y una casilla de consentimiento explícito para tratar la orientación (art. 9.2.a RGPD).'),
  P('El enunciado habla de 17 a 30 años. Para una app de discotecas he subido la edad mínima a 18, porque en la práctica es la edad de acceso a estos locales y además evita tratar datos sensibles de menores. En T1 calculo el tramo de 18 a 30 años y explico la diferencia.'),
  H2('1.3. Cómo está hecha'),
  table(['Capa', 'Tecnología', 'Por qué'], [
    ['App', 'PWA (HTML, CSS y JavaScript sin frameworks)', 'Se instala desde un enlace en Android e iOS, sin pasar por las tiendas. Pesa muy poco y abre al instante gracias al service worker.'],
    ['API', 'Node.js 22 + Express', 'Sin estado: cualquier nodo puede atender cualquier petición, así que se puede escalar en horizontal detrás de un balanceador.'],
    ['Tiempo real', 'Socket.IO con adaptador de Redis', 'Un mensaje que entra por un nodo llega a un usuario conectado a otro nodo.'],
    ['Base de datos', 'PostgreSQL 16, primario + réplica en streaming', 'Las escrituras van al primario y las lecturas a la réplica. Si la réplica cae, se lee del primario.'],
    ['Caché', 'Redis 7', 'El cálculo del ambiente se guarda 30 s: aunque miles de personas abran la lista a la vez, la base de datos lo calcula dos veces por minuto.'],
    ['Laboratorio', 'Docker Compose: nginx + 3 nodos API + Postgres primario/réplica + Redis', 'Reproduce a pequeña escala la arquitectura de esta memoria.'],
  ], [0.8, 1.4, 2.6]),
  gap(),
  ...image('02-home.png', 190, 412, null),
  new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 200 },
    children: [
      new ImageRun({ type: 'png', data: img('04-local.png'), transformation: { width: 150, height: 325 } }),
      new TextRun('   '),
      new ImageRun({ type: 'png', data: img('05-personas.png'), transformation: { width: 150, height: 325 } }),
      new TextRun('   '),
      new ImageRun({ type: 'png', data: img('06-chat.png'), transformation: { width: 150, height: 325 } }),
    ],
  }),
  NOTE('Capturas de la app: lista de locales con su ambiente, detalle de un local, personas visibles tras el check-in y chat después de un match. Los locales y usuarios son datos de prueba inventados.'),
  PB(),
];

const plan = [
  H1('2. Planificación'),
  P('He seguido el calendario de diez días lectivos del enunciado. El desarrollo de la app fue previo y en paralelo a T1–T3, porque las pruebas de carga de T4 necesitaban tenerla funcionando.'),
  table(['Tarea', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10'], [
    ['App Pulso y laboratorio', 'X', 'X', 'X', 'X', '', '', '', '', '', ''],
    ['T1 · Población objetivo', 'X', '', '', '', '', '', '', '', '', ''],
    ['T2 · Recurrencia', '', 'X', '', '', '', '', '', '', '', ''],
    ['T3 · Concurrencia', '', '', 'X', '', '', '', '', '', '', ''],
    ['T4 · Carga y pruebas', '', '', '', 'X', 'X', '', '', '', '', ''],
    ['T5 · Dimensionado', '', '', '', '', 'X', 'X', '', '', '', ''],
    ['T6 · Trazado de la red', '', '', '', '', '', 'X', 'X', '', '', ''],
    ['T7 · Preparar exposición', '', '', '', '', '', '', '', 'X', 'X', ''],
    ['Hito · Exposición', '', '', '', '', '', '', '', '', '', '◆'],
  ], [3.2, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6]),
  gap(),
  P('Camino crítico: T1 → T2 → T3 → T4 → T5 → T6 → T7. Cada tarea usa el resultado de la anterior, así que si cambia una hipótesis de T2 hay que rehacer todo lo que viene después. Para que eso sea rápido, todos los cálculos están en un script (docs/calculos.py del repositorio) que vuelve a generar las cifras.'),
  PB(),
];

const t1 = [
  H1('3. T1 · Población objetivo'),
  P('He tomado la población residente por edad simple de la Estadística Continua de Población del INE (tabla 56934, datos a 1 de enero de 2025) y he sumado las edades de 18 a 30 años.'),
  table(['Edad', 'Personas', 'Edad', 'Personas'], [
    ['18', '541.048', '25', '538.328'],
    ['19', '539.336', '26', '530.132'],
    ['20', '542.720', '27', '542.646'],
    ['21', '541.011', '28', '540.956'],
    ['22', '530.297', '29', '545.909'],
    ['23', '534.266', '30', '554.625'],
    ['24', '545.337', '**Total 18–30**', `**${n(D.pob_18_30)}**`],
  ], [1, 1.5, 1, 1.5]),
  gap(),
  P(`Si se usara el tramo del enunciado (17 a 30), habría que sumar ${n(D.pob_17)} personas de 17 años, un 7,6 % más. Las dejo fuera por la edad mínima de la app.`),
  P('Para el uso de Internet, la Encuesta TIC en los Hogares 2025 del INE da un 99,5 % de uso entre los hombres de 16 a 24 años y un 99,8 % entre las mujeres. Para el grupo de 25 a 34 años, el 98,7 % hizo alguna actividad de comunicación por Internet, así que su uso es como mínimo ese. Tomo un **99 %** para todo el tramo.'),
  table(['Paso', 'Hipótesis o fuente', 'Cálculo', 'Resultado'], [
    ['Población de 18 a 30 años', 'INE, ECP 1/1/2025', 'Suma por edad simple', n(D.pob_18_30)],
    ['Usuarios de Internet', 'INE, TIC 2025: 99 %', `${n(D.pob_18_30)} × 0,99`, n(D.usuarios_internet)],
    ['Usuarios activos al mes (MAU)', 'Penetración objetivo 30 %', `${n(D.usuarios_internet)} × 0,30`, `**${n(D.mau)}**`],
    ['Cuentas registradas', 'El 60 % de las cuentas está activa en el mes', `${n(D.mau)} ÷ 0,60`, n(D.cuentas)],
  ], [1.6, 1.6, 1.5, 1]),
  gap(),
  P(`Sigo la fórmula del enunciado (MAU = público objetivo × penetración), así que la app tendrá unos **${n(D.mau)} usuarios activos al mes**. Las cuentas registradas son más, porque siempre hay gente que se da de alta y deja de usarla; ese dato solo lo uso para el almacenamiento.`),
  PB(),
];

const t2 = [
  H1('4. T2 · Recurrencia'),
  P('La recurrencia mide cuántas veces vuelve la gente. Pulso no es una app de uso continuo como una red social de fotos: se usa sobre todo las tardes y noches de jueves a sábado. Por eso elijo valores en la parte media-baja de los rangos del enunciado.'),
  table(['Indicador', 'Valor', 'Justificación'], [
    ['DAU/MAU', '35 %', 'Dentro del rango 30–50 %. No todo el mundo sale todos los días; el fin de semana se trata aparte en los escenarios.'],
    ['DAU (activos al día)', `${n(D.mau)} × 0,35 = **${n(D.dau)}**`, 'Fórmula del enunciado.'],
    ['Sesiones por día', '4', 'Mirar el ambiente por la tarde, decidir a dónde ir, hacer check-in y revisar matches o el chat.'],
    ['Duración de la sesión', '6 min', 'Consultas cortas: abrir la lista, mirar un par de locales y salir.'],
    ['Minutos al día', `4 × 6 = **${D.min_dia} min**`, ''],
  ], [1.2, 1.5, 3]),
  gap(),
  P('Estas cifras son hipótesis y deberían revisarse con datos reales del piloto: retención a 7 y 30 días, sesiones por persona y duración. La app ya registra los check-ins y la actividad necesarios para medirlo.'),
];

const t3 = [
  H1('5. T3 · Concurrencia'),
  H2('5.1. Concurrencia media'),
  FORMULA(`Concurrencia media = DAU × minutos al día ÷ 1.440 = ${n(D.dau)} × ${D.min_dia} ÷ 1.440 = ${n(D.conc_media)} usuarios`),
  H2('5.2. Concurrencia en hora punta'),
  P('El enunciado indica que la hora punta concentra entre el 10 % y el 20 % de las sesiones del día. Para Pulso tomo un **15 %**: la actividad está muy concentrada por la noche, pero se reparte entre la hora en la que se decide a dónde ir (23:00 a 00:00) y la siguiente, cuando la gente cambia de local.'),
  FORMULA(`Sesiones al día = ${n(D.dau)} × 4 = ${n(D.sesiones_dia_total)}`),
  FORMULA(`Sesiones en hora punta = ${n(D.sesiones_dia_total)} × 0,15 = ${n(D.sesiones_punta)}`),
  FORMULA(`Concurrencia pico = ${n(D.sesiones_punta)} × 6 ÷ 60 = ${n(D.conc_pico)} usuarios`),
  H2('5.3. Cuándo se produce el pico y por qué'),
  P(`El pico está entre las **23:00 y las 00:00**, sobre todo de jueves a sábado. Es el momento en el que la gente ya ha quedado y está decidiendo a qué local ir, que es justo para lo que sirve Pulso. A partir de las 00:00 la actividad sigue alta (check-ins y chat dentro de los locales) y cae de madrugada. Durante el día casi no hay uso. El pico es unas ${(D.conc_pico / D.conc_media).toFixed(1).replace('.', ',')} veces la media, así que dimensionar con la media dejaría la app caída justo cuando más se usa.`),
  ...image('curva-horaria.png', 600, 240, 'Curva horaria estimada. La forma es una hipótesis; la monitorización real permitirá corregirla.'),
  PB(),
];

const lab = [
  H1('6. T4 · Carga'),
  H2('6.1. Peticiones por segundo'),
  P('El enunciado da un rango de 0,2 a 0,5 peticiones por segundo por usuario conectado. Tomo **0,3**: la lista de locales no se refresca sola cada pocos segundos, porque los cambios llegan por WebSocket, que no cuenta como petición HTTP.'),
  FORMULA(`Peticiones por segundo = ${n(D.conc_pico)} × 0,3 = ${n(D.rps)} pet/s`),
  P(`De esas peticiones, aproximadamente un 10 % son escrituras (check-in, «me gusta», mensajes): unas **${n(D.escrituras)} escrituras por segundo** que tiene que absorber la base de datos principal.`),
  H2('6.2. Ancho de banda'),
  P('En el laboratorio, la respuesta media de la API midió 4,5 kB con 12 locales. En producción, una ciudad grande puede tener unos 50 locales en la lista, así que estimo **15 kB por respuesta**. Las fotos y los ficheros de la app no pasan por los servidores: se sirven desde la CDN.'),
  FORMULA(`Ancho de banda = ${n(D.rps)} × 15 kB × 8 ÷ 1.000 = ${n(D.mbps)} Mbps ≈ ${(D.mbps / 1000).toFixed(2).replace('.', ',')} Gbps`),
  FORMULA(`Con un 30 % de margen (cabeceras, TLS, picos): ${n(D.mbps_margen)} Mbps ≈ ${(D.mbps_margen / 1000).toFixed(2).replace('.', ',')} Gbps`),
  H2('6.3. Escenarios'),
  P('Como las hipótesis pueden fallar, calculo tres escenarios. El esperado es el que se usa para el dimensionado base, y el de sábado por la noche sirve para comprobar que la arquitectura puede crecer sin rehacer la red.'),
  table(['Escenario', 'DAU/MAU', 'Hora punta', 'pet/s por usuario', 'DAU', 'Concurrencia pico', 'pet/s', 'Mbps', 'Nodos API'], [
    ['Prudente', '30 %', '10 %', '0,2', n(D.escenarios[0].dau), n(D.escenarios[0].conc_pico), n(D.escenarios[0].rps), n(D.escenarios[0].mbps), String(D.escenarios[0].nodos_api)],
    ['**Esperado**', '35 %', '15 %', '0,3', n(D.escenarios[1].dau), n(D.escenarios[1].conc_pico), n(D.escenarios[1].rps), n(D.escenarios[1].mbps), `**${D.escenarios[1].nodos_api}**`],
    ['Sábado noche', '35 % × 1,5', '20 %', '0,4', n(D.escenarios[2].dau), n(D.escenarios[2].conc_pico), n(D.escenarios[2].rps), n(D.escenarios[2].mbps), String(D.escenarios[2].nodos_api)],
  ], [1.3, 0.9, 0.8, 0.9, 0.9, 1, 0.8, 0.7, 0.8]),
  NOTE('En «Sábado noche» el DAU se multiplica por 1,5, porque ese día usa la app mucha más gente que la media de la semana. Los nodos API salen de la fórmula de T5.'),
  H2('6.4. Almacenamiento a tres años'),
  table(['Dato', 'Hipótesis', 'Volumen'], [
    ['Cuentas', `${n(D.cuentas)} cuentas × 1 kB`, `${D.almacenamiento_gb['usuarios (1 kB/cuenta)'].toString().replace('.', ',')} GB`],
    ['Check-ins recientes', 'DAU × 1 al día × 200 B, solo 30 días (luego se anonimizan)', `${D.almacenamiento_gb['check-ins (DAU × 1/día × 200 B × 30 días; luego se anonimizan)'].toString().replace('.', ',')} GB`],
    ['Ambiente agregado', '20.000 locales × 24 h × 365 días × 3 años × 300 B', `${D.almacenamiento_gb['agregados anónimos de ambiente (por local y hora, 3 años)'].toString().replace('.', ',')} GB`],
    ['«Me gusta»', 'DAU × 5 al día × 60 B × 3 años', `${D.almacenamiento_gb['likes (DAU × 5/día × 60 B × 365 × 3)'].toString().replace('.', ',')} GB`],
    ['Mensajes', 'DAU × 10 al día × 250 B × 3 años', `${n(D.almacenamiento_gb['mensajes (DAU × 10/día × 250 B × 365 × 3)'])} GB`],
    ['Fotos de perfil (opcionales)', '40 % de cuentas × 2 fotos × 400 kB', `${n(D.almacenamiento_gb['fotos de perfil opcionales (40 % cuentas × 2 × 400 kB)'])} GB`],
    ['**Total de datos originales**', '', `**≈ ${(D.almacenamiento_total_gb / 1000).toFixed(1).replace('.', ',')} TB**`],
  ], [1.3, 2.6, 0.9]),
  gap(),
  P('Las fotos van al almacenamiento de objetos y el resto (unos 2,4 TB) a PostgreSQL. A eso hay que sumar índices (aprox. un 30 %), el standby, las réplicas y las copias, que multiplican el espacio contratado. Por eso cada servidor de base de datos lleva 4 TB NVMe.'),
  P('La versión actual de la app no tiene fotos de perfil: el avatar es la inicial del alias, también por privacidad. Las incluyo en el cálculo porque el enunciado las menciona y porque es la primera mejora prevista.'),
  H2('6.5. Comprobación en laboratorio'),
  P('Para no quedarme solo con valores teóricos, he medido la app real con una prueba de carga (autocannon) que reproduce el reparto de peticiones de la hora punta: un 60 % de consultas a la lista de locales, un 20 % al detalle de un local y un 20 % al perfil y los matches. La máquina de pruebas tenía solo 2 vCPU para todo: generador de carga, nodos, PostgreSQL, Redis y balanceador.'),
  table(['Prueba', 'pet/s media', 'Latencia p50', 'Latencia p99', 'Errores'], [
    ['1 nodo (un proceso Node.js ≈ 1 vCPU)', '2.792', '15 ms', '50 ms', '0'],
    ['3 nodos detrás del balanceador', '2.348', '37 ms', '138 ms', '0'],
    ['3 nodos y se mata uno a mitad de la prueba', '2.338', '17 ms', '73 ms', '**0**'],
  ], [2.6, 1, 1, 1, 0.7]),
  gap(),
  P('**Qué conclusiones saco:**'),
  B('Un solo proceso, con la caché de Redis, sirvió casi 2.800 pet/s usando un núcleo. El valor del enunciado (1.000–2.000 pet/s para un nodo de 16 vCPU) es por tanto **conservador** para esta app. Aun así uso 1.500 pet/s en T5, porque en producción hay TLS, más escrituras y una base de datos mucho más grande.'),
  B('Con 3 nodos el rendimiento no subió porque las 2 vCPU ya estaban saturadas: los tres nodos competían con el resto de servicios. Esto demuestra que **el cuello de botella era la CPU de la máquina, no la app**. Es lo que se espera de una API sin estado.'),
  B('Al matar un nodo a mitad de la prueba, el balanceador lo detectó, reintentó las peticiones en los otros dos y **no hubo ni un error**. Al volver a arrancarlo, se reincorporó solo en unos segundos. Es la redundancia N+1 funcionando.'),
  B('Envié tres mensajes de chat, cada uno a través de un nodo distinto (api-2, api-3 y api-1), y los tres llegaron en tiempo real al otro usuario, conectado a un único nodo. El adaptador de Redis comparte los eventos entre nodos.'),
  PB(),
];

const t5 = [
  H1('7. T5 · Dimensionado de servidores'),
  P('Cada tipo de servidor sale de un dato calculado. Para la capa API aplico la regla del enunciado con una utilización objetivo del 70 %, para tener margen ante picos cortos sin llegar a saturar:'),
  FORMULA(`Nodos API = techo(${n(D.rps)} ÷ (1.500 × 0,70)) + 1 = ${D.nodos_api} + 1 = ${D.nodos_api_total}`),
  FORMULA(`Nodos de tiempo real = techo(${n(D.conc_pico)} conexiones ÷ 10.000) + 1 = ${D.nodos_rt - 1} + 1 = ${D.nodos_rt}`),
  table(['Capa', 'N.º', 'Recursos por nodo', 'Disco', 'Red', 'Dato que lo justifica'], [
    ['Balanceadores L7', '2', '8 vCPU · 16 GB', '40 GB', '10 Gbps', 'Terminan TLS y reparten las pet/s. Dos para no tener un punto único de fallo.'],
    ['API (web + lógica)', `${D.nodos_api_total} (${D.nodos_api}+1)`, '16 vCPU · 32 GB', '80 GB SSD', '10 Gbps', `${n(D.rps)} pet/s a 1.500 pet/s por nodo y 70 % de uso. Autoescalado hasta ${D.escenarios[2].nodos_api} el sábado.`],
    ['Tiempo real (WebSocket)', `${D.nodos_rt} (${D.nodos_rt - 1}+1)`, '8 vCPU · 16 GB', '40 GB SSD', '10 Gbps', `${n(D.conc_pico)} conexiones a 10.000 por nodo. Hasta 10 nodos el sábado.`],
    ['PostgreSQL primario + standby síncrono', '2', '16 vCPU · 64 GB', '4 TB NVMe', '10 Gbps', `≈ ${n(D.escrituras)} escrituras/s. El standby en otra zona toma el relevo si cae el primario.`],
    ['Réplicas de lectura', '2', '16 vCPU · 64 GB', '4 TB NVMe', '10 Gbps', 'Listas de locales y perfiles visibles. Dos para que una pueda fallar.'],
    ['Redis', '3', '8 vCPU · 32 GB', '100 GB SSD', '10 Gbps', 'Caché del ambiente y pub/sub del tiempo real. Tres nodos para que Sentinel elija un nuevo principal.'],
    ['Procesos en segundo plano', '3 (2+1)', '8 vCPU · 16 GB', '100 GB SSD', '1 Gbps', 'Agregados horarios del ambiente, anonimizar check-ins de más de 30 días, notificaciones y moderación.'],
    ['Monitorización y registros', '2', '8 vCPU · 16 GB', '2 TB SSD', '1 Gbps', 'Métricas (/metrics de cada nodo), alertas y logs centralizados.'],
    ['Bastión VPN', '2', '2 vCPU · 4 GB', '20 GB', '1 Gbps', 'Única entrada de administración, con MFA.'],
    ['Almacenamiento de objetos', 'Servicio', 'Según consumo', '1,5 TB al inicio', 'Privado + CDN', 'Fotos opcionales y copias. Crece unos 0,4 TB al año.'],
  ], [1.4, 0.8, 1.1, 0.8, 0.8, 2.6]),
  gap(),
  H2('7.1. Dónde se aloja y cómo crece'),
  P('Propongo una **nube pública con región en la Unión Europea** y tres zonas de disponibilidad. Hay tres motivos. El primero es que la carga es muy irregular: el sábado por la noche hacen falta unos 35 nodos API y un martes por la mañana bastaría con 3. Con servidores propios habría que comprar para el sábado y tenerlos parados el resto de la semana. El segundo es que los datos personales se quedan en la UE, como exige el RGPD. El tercero es que no hace falta invertir de golpe en un CPD propio.'),
  P('La API y el tiempo real crecen en **horizontal** con autoescalado (por CPU y por número de conexiones), con un mínimo de 14 y 6 nodos. La base de datos crece en vertical y con más réplicas de lectura. Si dentro de unos años no fuera suficiente, se podría repartir por ciudades, porque cada local pertenece a una sola ciudad.'),
  table(['Objetivo', 'Valor', 'Cómo se consigue'], [
    ['Disponibilidad', '99,9 % mensual (≈ 43 min de caída al mes como máximo)', 'N+1 en todas las capas y reparto en 3 zonas.'],
    ['RPO (datos que se pueden perder)', '0 dentro de la región · ≤ 5 min ante pérdida de región', 'Standby síncrono en la región; réplica asíncrona a la secundaria.'],
    ['RTO (tiempo para recuperar)', '≤ 60 min ante pérdida de región', 'Infraestructura como código para levantar la región secundaria.'],
    ['Copias', 'Completa diaria + WAL continuo, cifradas', 'Restauración de prueba cada trimestre: una copia que nunca se ha restaurado no garantiza nada.'],
  ], [1.3, 1.8, 2.4]),
  gap(),
  H2('7.2. Coste estimado'),
  P('Sin elegir proveedor no se puede dar un precio exacto, así que doy un orden de magnitud mensual para comparar opciones.'),
  table(['Concepto', 'Estimación mensual'], [
    ['API y tiempo real (con autoescalado de fin de semana)', '9.000 – 14.000 €'],
    ['PostgreSQL (4 nodos), Redis (3) y procesos de fondo', '5.000 – 8.000 €'],
    ['Balanceadores, WAF, anti-DDoS y bastión', '1.500 – 3.000 €'],
    ['CDN y transferencia de salida', '3.000 – 7.000 €'],
    ['Almacenamiento de objetos, copias y región secundaria', '1.000 – 2.500 €'],
    ['Monitorización y soporte', '700 – 2.000 €'],
    ['**Total aproximado**', '**20.200 – 36.500 €/mes**'],
  ], [3, 1.4]),
  gap(),
  P('A eso hay que sumar una inversión inicial de 15.000 a 30.000 € para automatizar el despliegue, hacer pruebas de carga reales, una auditoría de seguridad y la revisión legal de protección de datos, que en esta app es imprescindible.'),
  PB(),
];

const t6 = [
  H1('8. T6 · Trazado de la red'),
  ...image('esquema-red.png', 600, 397, 'Esquema de red desde el usuario hasta los datos. La leyenda indica enlaces, replicación y zonas.'),
  H2('8.1. Recorrido de una petición'),
  P('Cuando alguien abre Pulso, el DNS resuelve el nombre del servicio. La app (HTML, CSS, JS e iconos) llega desde la CDN y casi nunca toca nuestros servidores. Las peticiones a la API entran por uno de los dos operadores, pasan por los routers de borde, por el filtro anti-DDoS y el WAF y por los cortafuegos, y llegan a la IP virtual de los balanceadores. Estos reparten entre los nodos API, que consultan Redis y, si no está en caché, PostgreSQL. El chat va por WebSocket a la capa de tiempo real.'),
  H2('8.2. VLAN y direccionamiento'),
  table(['VLAN', 'Uso', 'Subred', 'Puerta de enlace'], [
    ['10', 'Gestión (bastión, administración)', '10.10.10.0/24', '10.10.10.1'],
    ['20', 'Web/API', '10.10.20.0/24', '10.10.20.1'],
    ['30', 'Tiempo real (WebSocket)', '10.10.30.0/24', '10.10.30.1'],
    ['40', 'Bases de datos y réplicas', '10.10.40.0/24', '10.10.40.1'],
    ['50', 'Caché y colas (Redis)', '10.10.50.0/24', '10.10.50.1'],
    ['60', 'Copias de seguridad', '10.10.60.0/24', '10.10.60.1'],
    ['70', 'DMZ (balanceadores)', '10.10.70.0/24', '10.10.70.1'],
    ['80', 'Monitorización y registros', '10.10.80.0/24', '10.10.80.1'],
    ['90', 'Servicios internos (DNS, NTP)', '10.10.90.0/24', '10.10.90.1'],
  ], [0.6, 2.4, 1.3, 1.2]),
  NOTE('Direccionamiento privado RFC 1918. Una /24 da 254 hosts por VLAN: de sobra para el autoescalado de la API (hasta 35 nodos) y deja margen para crecer. La .1 es la IP virtual (VRRP) del router de capa 3. En el laboratorio, las redes de Docker «dmz», «app» y «datos» reproducen esta separación, y la de datos está marcada como interna.'),
  H2('8.3. Flujos permitidos'),
  table(['Origen', 'Destino', 'Puerto', 'Motivo'], [
    ['Internet', 'Balanceadores (VLAN 70)', 'TCP 443', 'HTTPS y WebSocket seguro. El 80 solo redirige a 443.'],
    ['Balanceadores', 'API (VLAN 20)', 'TCP 3000', 'Peticiones a la API.'],
    ['Balanceadores', 'Tiempo real (VLAN 30)', 'TCP 3000', 'Conexiones WebSocket.'],
    ['API y tiempo real', 'PostgreSQL (VLAN 40)', 'TCP 5432 (TLS)', 'Lecturas y escrituras.'],
    ['API y tiempo real', 'Redis (VLAN 50)', 'TCP 6379 (TLS)', 'Caché y pub/sub.'],
    ['PostgreSQL primario', 'Región secundaria', 'TCP 5432 por VPN IPsec', 'Réplica asíncrona.'],
    ['Todos los servidores', 'Monitorización (VLAN 80)', 'Puertos de agentes', 'Métricas y logs.'],
    ['Administradores', 'Bastión (VLAN 10)', 'VPN + SSH', 'Con MFA y registro de sesiones.'],
  ], [1.3, 1.5, 1.2, 2.2]),
  gap(),
  P('Todo lo demás está denegado. La base de datos no es accesible ni desde Internet ni desde los balanceadores: solo desde las capas que la necesitan.'),
  H2('8.4. Capacidad de los enlaces'),
  P(`Los enlaces de salida salen del cálculo de T4. En el escenario esperado hacen falta ${(D.mbps_margen / 1000).toFixed(2).replace('.', ',')} Gbps con margen, y en el de sábado noche ${(D.escenarios[2].mbps * 1.3 / 1000).toFixed(1).replace('.', ',')} Gbps. Por eso propongo **dos operadores distintos con 10 Gbps cada uno**. La clave es que incluso en el peor escenario **un solo enlace puede con todo el tráfico**: si se cae un operador el sábado a medianoche, el otro aguanta. Dentro del CPD, el núcleo va a 25 Gbps entre los dos switches, para que la replicación de la base de datos y el tráfico entre capas no compitan con el de los usuarios.`),
  PB(),
];

const t7 = [
  H1('9. T7 · Exposición argumentada'),
  P('Para cada elemento indico qué problema resuelve, de qué cálculo sale y qué pasaría si faltara.'),
  table(['Elemento', 'Qué resuelve', 'Dato que lo dimensiona', 'Si faltara…'], [
    ['CDN', 'Sirve la PWA y las fotos cerca del usuario', 'La app y las fotos no cuentan en los 15 kB por petición', 'Todo el tráfico estático llegaría al CPD y harían falta más enlaces y servidores.'],
    ['Dos operadores', 'Conectividad a Internet', `${(D.mbps_margen / 1000).toFixed(2).replace('.', ',')} Gbps esperados; un enlace de 10 Gbps basta incluso el sábado`, 'Un corte del operador dejaría Pulso inaccesible justo en su hora punta.'],
    ['Anti-DDoS y WAF', 'Filtra ataques antes de que lleguen', 'Servicio público y de alcance nacional', 'Un ataque podría tumbar la app o explotar fallos de la web.'],
    ['Cortafuegos ×2', 'Aplica los flujos permitidos', 'Matriz de flujos de T6', 'La base de datos quedaría expuesta; con uno solo, sería un punto único de fallo.'],
    ['Balanceadores ×2', 'Reparten y detectan nodos caídos', `${n(D.rps)} pet/s entre ${D.nodos_api_total} nodos`, 'Sin ellos no se puede escalar en horizontal. Con uno, si cae, cae todo.'],
    [`${D.nodos_api_total} nodos API`, 'Atienden la app', `${n(D.rps)} pet/s ÷ (1.500 × 0,7) + 1`, 'Latencias altas y errores en hora punta. En el laboratorio, al quitar uno no hubo errores gracias al +1.'],
    [`${D.nodos_rt} nodos de tiempo real`, 'Chat, matches y avisos del ambiente', `${n(D.conc_pico)} conexiones simultáneas`, 'Los mensajes no llegarían al momento y la app tendría que preguntar continuamente, multiplicando las pet/s.'],
    ['Redis ×3', 'Caché del ambiente y reparto de eventos', 'El ambiente se consulta en el 80 % de las peticiones', 'Cada consulta recalcularía el ambiente en la base de datos, que no aguantaría el pico.'],
    ['PostgreSQL primario + standby', 'Guarda cuentas, check-ins, matches y mensajes', `≈ ${n(D.escrituras)} escrituras/s y 2,4 TB a 3 años`, 'Si el primario cae sin standby, se pierde el servicio y quizá datos.'],
    ['Réplicas de lectura ×2', 'Descargan las consultas del primario', 'Las lecturas son el 90 % de la carga', 'El primario tendría que hacer lecturas y escrituras a la vez y se saturaría antes.'],
    ['Almacenamiento de objetos', 'Fotos y copias', '≈ 1,1 TB de fotos a 3 años', 'Las fotos ocuparían la base de datos, mucho más cara y lenta para eso.'],
    ['VLAN separadas', 'Aíslan cada capa', 'Mínimo privilegio', 'Un fallo en un servidor web daría acceso directo a los datos.'],
    ['Monitorización', 'Mide carga real, errores y latencias', 'Hipótesis de T2–T4 pendientes de confirmar', 'No sabríamos si las hipótesis eran correctas ni detectaríamos fallos a tiempo.'],
    ['Región secundaria y copias', 'Recuperar ante un desastre', 'RTO 60 min · RPO 5 min', 'Un incendio o una caída regional podría suponer días sin servicio o perder datos.'],
  ], [1.3, 1.5, 1.6, 2.2]),
  gap(),
  H2('9.1. Guion para la exposición'),
  B(`**La app.** Pulso enseña el ambiente de cada local de forma anónima. Demostración en directo con la cuenta de prueba.`),
  B(`**Los números.** ${n(D.pob_18_30)} personas de 18 a 30 años → ${n(D.mau)} MAU → ${n(D.dau)} DAU → ${n(D.conc_pico)} conectadas a la vez a las 23:00 → ${n(D.rps)} pet/s.`),
  B(`**Los servidores.** ${D.nodos_api_total} nodos API, ${D.nodos_rt} de tiempo real, PostgreSQL con standby y 2 réplicas, Redis ×3, todo con N+1.`),
  B('**La red.** Dos operadores de 10 Gbps (uno solo aguanta el peor caso), cortafuegos y balanceadores en pareja, VLAN por función y región secundaria.'),
  B('**La prueba.** En el laboratorio se mata un nodo durante una prueba de carga y no hay errores.'),
  B('**Privacidad.** k-anonimato, visibilidad opcional, sin coordenadas guardadas y mayores de 18.'),
  PB(),
];

const riesgos = [
  H1('10. Riesgos y aspectos pendientes'),
  table(['Riesgo', 'Efecto', 'Medida'], [
    ['La recurrencia y la hora punta son hipótesis', 'La carga real puede ser mayor o menor', 'Medir DAU, sesiones y curva horaria en un piloto en Madrid y recalcular con docs/calculos.py.'],
    ['Capacidad por nodo medida en una máquina pequeña', 'Podrían hacer falta más o menos nodos', 'Repetir la prueba en el tipo de servidor elegido, con TLS y una base de datos de tamaño real.'],
    ['Reidentificación por diferencias (entrar y salir para ver cómo cambian los porcentajes)', 'Se podría deducir la orientación de alguien', 'Caché de 30 s, redondeo de 5 en 5, k = 10 y grupos mínimos de 3. Se puede subir k en locales pequeños.'],
    ['Check-in falso con ubicación simulada', 'Ambiente manipulado', 'Límite de check-ins por cuenta y por hora, y detección de patrones raros.'],
    ['Uso indebido de los perfiles visibles', 'Acoso dentro del local', 'Visibilidad opcional, bloqueo y denuncia con un clic y moderación.'],
    ['Coste de la nube mayor del previsto', 'Presupuesto superado', 'Alertas de gasto, instancias reservadas para el mínimo y autoescalado para el resto.'],
    ['Fallo de región o de réplica', 'Interrupción o pérdida de datos recientes', 'Simulacro de recuperación cada trimestre.'],
  ], [1.8, 1.4, 2.6]),
  gap(),
  H1('11. Conclusión'),
  P(`Para una red social de ámbito nacional no vale un servidor grande al que se le añade memoria cuando va lento. Con datos reales del INE y unas hipótesis razonables, Pulso tendría unos ${n(D.mau)} usuarios activos al mes y ${n(D.conc_pico)} personas conectadas a la vez a las 23:00, lo que se traduce en ${n(D.rps)} peticiones por segundo y cerca de ${(D.mbps / 1000).toFixed(1).replace('.', ',')} Gbps.`),
  P(`De ahí sale una arquitectura por capas que crece en horizontal: ${D.nodos_api_total} nodos API, ${D.nodos_rt} de tiempo real, una base de datos con standby y réplicas, caché, CDN y una red con todo duplicado, separada por VLAN y con una región de respaldo. El laboratorio muestra que el diseño funciona: los nodos se pueden añadir o quitar y el servicio sigue respondiendo.`),
  P('Lo que más me ha hecho pensar no ha sido la parte técnica, sino la privacidad. La idea original era ver quién hay en cada discoteca, pero con un dato tan delicado como la orientación sexual eso podía poner a gente en peligro. Cambiar a un ambiente agregado y anónimo mantiene la utilidad de la app y protege a las personas. También tiene consecuencias en la infraestructura: el agregado se puede cachear, y eso reduce mucho la carga sobre la base de datos.'),
  H1('12. Fuentes'),
  B('INE. Estadística Continua de Población, población residente por fecha, sexo y edad (tabla 56934), datos a 1 de enero de 2025. https://www.ine.es'),
  B('INE. Encuesta sobre Equipamiento y Uso de TIC en los Hogares 2025 (nota de prensa de 20/11/2025 y tabla 76441). https://www.ine.es/dyngs/Prensa/TICH2025.htm'),
  B('INE. Mujeres y hombres en España: uso de Internet por edad y sexo, 2025. https://www.ine.es/uc/ekfL67UW'),
  B('Reglamento (UE) 2016/679 (RGPD), artículos 9, 15 y 17. https://eur-lex.europa.eu/eli/reg/2016/679/oj'),
  B('Ley Orgánica 3/2018 (LOPDGDD). https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673'),
  B(`Código fuente, pruebas de carga y laboratorio de Pulso: ${REPO}`),
  new Paragraph({ spacing: { before: 300 }, children: [] }),
  H2('Anexo · Cómo probar el laboratorio'),
  P('Con Docker instalado, desde la carpeta infra del repositorio:'),
  FORMULA('docker compose up -d --build'),
  FORMULA('docker compose exec api-1 node src/seed.js'),
  P('La app queda en http://localhost:8080 (cuenta de prueba: demo@pulso.app / pulso1234). Para la prueba de carga y la de caída de un nodo, el README del repositorio explica los comandos.'),
];

const doc = new Document({
  creator: 'Samia El Yahyaoui Mnissar',
  title: 'Dimensionado de servidores y red para Pulso',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 21 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Calibri', size: 32, bold: true, color: C.primary }, paragraph: { spacing: { before: 360, after: 160 }, keepNext: true, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Calibri', size: 26, bold: true, color: C.accent }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Calibri', size: 22, bold: true, color: C.primary }, paragraph: { spacing: { before: 200, after: 80 }, keepNext: true, outlineLevel: 2 } },
    ],
  },
  numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 500, hanging: 260 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1300, left: 1440, right: 1440 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Samia El Yahyaoui Mnissar · 2.º ASIR', size: 16, color: '888888' })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Dimensionado de servidores y red · Pulso · Página ', size: 16, color: '888888' }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '888888' })] })] }) },
    children: [...portada, ...indice, ...intro, ...plan, ...t1, ...t2, ...t3, ...lab, ...t5, ...t6, ...t7, ...riesgos],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  const out = path.join(__dirname, 'Memoria_Dimensionado_Pulso.docx');
  fs.writeFileSync(out, buf);
  console.log('Generado', out);
});
