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
  children: runs(t, { font: 'Calibri', size: 21 }),
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

const PT_CAPTURE = fs.existsSync(path.join(__dirname, 'img', 'packet-tracer.png'));
const ptImage = () => {
  if (!PT_CAPTURE) {
    return [P('**[Aquí va la captura de la topología de Packet Tracer]**', { p: { alignment: AlignmentType.CENTER } })];
  }
  const meta = JSON.parse(fs.readFileSync(path.join(__dirname, 'img', 'packet-tracer.json'), 'utf8'));
  const w = 600;
  const h = Math.round((meta.height / meta.width) * w);
  return image('packet-tracer.png', w, h, 'Topología de Pulso montada en Packet Tracer (fichero docs/packet-tracer/pulso.pkt del repositorio).');
};
const PT_RESULTS = process.env.PT_RESULTS ? JSON.parse(process.env.PT_RESULTS) : null;

// ---------------------------------------------------------------------------
const portada = [
  new Paragraph({ spacing: { before: 1800, after: 120 }, children: [new TextRun({ text: 'EJERCICIO PRÁCTICO · 2.º ASIR', color: C.accent, bold: true, size: 22 })] }),
  new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: 'Dimensionado de servidores y red para Pulso', bold: true, size: 52, color: C.primary })] }),
  new Paragraph({ spacing: { after: 600 }, children: [new TextRun({ text: 'Una red social de ambiente nocturno de ámbito nacional: de la app al centro de datos', size: 28, color: '333333' })] }),
  table(['Dato', ''], [
    ['Alumna', 'Samia El Yahyaoui Mnissar'],
    ['Curso', '2.º ASIR'],
    ['Módulo', 'Administración de sistemas informáticos y redes'],
    ['Grupo', 'Sin grupo'],
    ['Fecha de entrega', 'Pendiente'],
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
  P('El documento sigue el orden de las tareas T1 a T7. Antes de los cálculos explico qué hace la app, porque varias decisiones (por ejemplo, guardar un resultado durante 30 segundos para no repetir el cálculo, o tener una segunda ubicación de respaldo) salen directamente de cómo funciona.'),
  H2('1.1. Qué es Pulso'),
  P('Pulso responde a una pregunta muy concreta: **«¿qué ambiente hay esta noche en cada local?»**. Antes de salir, la persona ve una lista de discotecas cercanas con la afluencia, la edad media y el reparto aproximado del público por género: mujeres, hombres y personas no binarias. Con eso puede decidir a dónde ir según el ambiente que busca: un sitio con más mujeres, uno mixto o uno con más hombres.'),
  P('Además cubre todo lo que pide el contexto del enunciado: perfiles, búsqueda por cercanía, «me gusta», emparejamientos y chat.'),
  table(['Función', 'Cómo funciona en Pulso'], [
    ['Ambiente de cada local', 'Porcentajes anónimos calculados con las personas que han hecho check-in. Muestran el reparto por género (mujeres, hombres y personas no binarias). Filtro por ambiente: más mujeres, mixto o más hombres.'],
    ['Búsqueda por cercanía', 'La lista se ordena por distancia usando la ubicación del móvil. La ubicación no se guarda.'],
    ['Check-in', 'Solo se puede hacer estando a menos de 300 m del local. Caduca solo a las 4 horas.'],
    ['Perfiles visibles (opcional)', 'Quien lo active aparece, con su alias, ante las personas que han hecho check-in en el mismo local.'],
    ['Me gusta y match', 'Si dos personas visibles en el mismo local se dan «me gusta», se crea un emparejamiento.'],
    ['Chat', 'Mensajes que llegan al momento, sin tener que recargar, entre personas emparejadas.'],
    ['Seguridad', 'Bloqueo, denuncia, descarga de tus datos y borrado de la cuenta.'],
  ], [1, 2.6]),
  gap(),
  H2('1.2. Decisiones de privacidad'),
  P('En la primera versión el ambiente se calculaba también con la orientación sexual. La descarté: es un dato especialmente protegido por el artículo 9 del RGPD, y una app que la relacionara con un lugar físico concreto podía usarse para señalar o agredir a alguien. Ahora el ambiente se describe solo por **género**, que es lo que la mayoría de la gente mira al decidir a dónde salir, y la app no pide ni guarda la orientación de nadie. Aun así, el diseño sigue cuatro reglas:'),
  B('**Ambiente anónimo.** Si en un local hay menos de 10 personas con Pulso, no se enseña ningún desglose, porque con tan poca gente se podría adivinar quién es quién. Los grupos de menos de 3 personas se suman en «Otras» y los porcentajes se redondean de 5 en 5.'),
  B('**Visibilidad opcional.** Por defecto nadie es visible. Quien activa «visible en el local» solo es visto por quien también está en ese local, y lo único que se ve es su alias, su edad, su género y su bio.'),
  B('**Sin ubicación guardada.** La ubicación solo se usa en el momento del check-in para comprobar que la persona está en el local. En la base de datos solo queda qué local es, y el check-in caduca.'),
  B('**Mayoría de edad y datos mínimos.** El registro exige 18 años y aceptar la política de privacidad. Solo se pide lo necesario: alias, fecha de nacimiento y género.'),
  P('El enunciado habla de 17 a 30 años. Para una app de discotecas he subido la edad mínima a 18, porque en la práctica es la edad de acceso a estos locales y además evita tratar datos de menores en una app de ocio nocturno. En T1 calculo el tramo de 18 a 30 años y explico la diferencia.'),
  H2('1.3. Cómo está hecha'),
  table(['Parte', 'Qué uso', 'Para qué'], [
    ['App', 'Web instalable en el móvil (PWA)', 'Se instala desde un enlace en Android e iPhone, sin pasar por las tiendas de apps.'],
    ['Servidor (API)', 'Node.js', 'Recibe las peticiones de la app. No guarda nada en memoria propia, así que se pueden poner tantos servidores iguales como haga falta detrás de un balanceador.'],
    ['Chat y avisos', 'Socket.IO + Redis', 'Mantiene una conexión abierta con cada móvil para que los mensajes lleguen al momento, aunque cada persona esté conectada a un servidor distinto.'],
    ['Base de datos', 'PostgreSQL (principal + réplica)', 'Las escrituras van a la principal y las lecturas a la réplica, que es una copia actualizada. Si la réplica falla, se lee de la principal.'],
    ['Caché', 'Redis', 'Guarda el ambiente de cada local durante 30 segundos. Aunque miles de personas abran la lista a la vez, la base de datos solo lo calcula dos veces por minuto.'],
    ['Laboratorio', 'Docker', 'Reproduce a pequeña escala la arquitectura de esta memoria: un balanceador, 3 servidores, base de datos con réplica y Redis.'],
  ], [0.9, 1.3, 2.8]),
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
  P('El desarrollo de la app fue llevado a cabo en casa, ya que al realizarse de manera solitaria requería de más tiempo.'),
  table(['Tarea', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10'], [
    ['App Pulso y laboratorio', 'X', 'X', 'X', 'X', '', '', '', '', '', ''],
    ['T1 · Población objetivo', 'X', '', '', '', '', '', '', '', '', ''],
    ['T2 · Recurrencia', '', 'X', '', '', '', '', '', '', '', ''],
    ['T3 · Concurrencia', '', '', 'X', '', '', '', '', '', '', ''],
    ['T4 · Carga y pruebas', '', '', '', 'X', 'X', '', '', '', '', ''],
    ['T5 · Dimensionado', '', '', '', '', 'X', 'X', '', '', '', ''],
    ['T6 · Red en Packet Tracer', '', '', '', '', '', 'X', 'X', '', '', ''],
    ['T7 · Preparar exposición', '', '', '', '', '', '', '', 'X', 'X', ''],
    ['Hito · Exposición', '', '', '', '', '', '', '', '', '', '◆'],
  ], [3.2, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6]),
  gap(),
  P('Cada tarea usa el resultado de la anterior, así que si tenía que modificar algo, había que rehacer todo lo que venía después. Para que eso sea rápido, todos los cálculos están en un script (docs/calculos.py del repositorio) que vuelve a generar las cifras y lo termina verificando la IA.'),
  PB(),
];

const t1 = [
  H1('3. T1 · Población objetivo'),
  P('He tenido en cuenta la población residente por edad de la Estadística Continua de Población del INE (tabla 56934, datos a 1 de enero de 2025) y he sumado las edades de 18 a 30 años.'),
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
  P('No he usado el tramo del enunciado (17 a 30), ya que la app está dirigida al ocio nocturno y no podía tener en cuenta a los menores de edad.'),
  P('Para el uso de Internet, la Encuesta TIC en los Hogares 2025 del INE da un 99,5 % de uso entre los hombres de 16 a 24 años y un 99,8 % entre las mujeres. Para el grupo de 25 a 34 años, el 98,7 % hizo alguna actividad de comunicación por Internet, así que su uso es como mínimo ese. He tomado un **99 %** para todo el tramo.'),
  table(['Paso', 'Hipótesis o fuente', 'Cálculo', 'Resultado'], [
    ['Población de 18 a 30 años', 'INE, 1/1/2025', 'Suma por edad', n(D.pob_18_30)],
    ['Usuarios de Internet', 'INE, Encuesta TIC 2025: 99 %', `${n(D.pob_18_30)} × 0,99`, n(D.usuarios_internet)],
    ['Usuarios activos al mes (MAU)', 'Penetración objetivo 30 %', `${n(D.usuarios_internet)} × 0,30`, `**${n(D.mau)}**`],
    ['Cuentas registradas', 'El 60 % de las cuentas se usa cada mes', `${n(D.mau)} ÷ 0,60`, n(D.cuentas)],
  ], [1.6, 1.6, 1.5, 1]),
  gap(),
  P(`Sigo la fórmula del enunciado (MAU = público objetivo × penetración), así que la app tendrá unos **${n(D.mau)} usuarios activos al mes**. Las cuentas registradas son más, porque siempre hay gente que se da de alta y luego deja de usarla. Ese dato solo lo uso para el almacenamiento.`),
  PB(),
];

const t2 = [
  H1('4. T2 · Recurrencia'),
  P('La recurrencia mide cuántas veces vuelve la gente. Como Pulso no es una red social de uso continuo, como por ejemplo TikTok, elijo valores en la parte media a baja de los rangos del enunciado. Pulso se usa sobre todo las tardes y noches de jueves a sábado.'),
  table(['Indicador', 'Valor', 'Justificación'], [
    ['DAU/MAU (de los usuarios del mes, cuántos entran cada día)', '35 %', 'Dentro del rango 30–50 %. No todo el mundo sale todos los días y el fin de semana se trata aparte en los escenarios.'],
    ['DAU (activos al día)', `${n(D.mau)} × 0,35 = **${n(D.dau)}**`, 'La fórmula del enunciado.'],
    ['Sesiones por día', '4', 'Se mira el ambiente por la tarde, luego se decide a dónde ir y por último se hace check-in y se revisan los matches o el chat.'],
    ['Duración de la sesión', '6 min', 'Son consultas cortas: abrir la lista, mirar unos locales y salir.'],
    ['Minutos al día', `4 × 6 = **${D.min_dia} min**`, 'Es un valor aproximado.'],
  ], [1.4, 1.5, 3]),
  gap(),
  P('Las cifras son hipótesis y habría que revisarlas con datos reales durante un periodo de prueba (por ejemplo, de 7 a 30 días): cuánta gente vuelve, cuántas sesiones hace cada persona y cuánto duran. La app ya registra los inicios de sesión y la actividad necesarios para medirlo.'),
];

const t3 = [
  H1('5. T3 · Concurrencia'),
  P('La concurrencia es cuánta gente está usando la app **a la vez**. Es el dato que de verdad decide cuántos servidores hacen falta.'),
  H2('5.1. Concurrencia media'),
  FORMULA(`Concurrencia media = DAU × minutos al día ÷ 1.440 = ${n(D.dau)} × ${D.min_dia} ÷ 1.440 = ${n(D.conc_media)} usuarios`),
  H2('5.2. Concurrencia en hora punta'),
  P('El enunciado indica que la hora punta concentra entre el 10 % y el 20 % de las sesiones del día. Para Pulso tomo un **15 %**: el pico es por la noche, pero se reparte entre la hora en la que se decide a dónde ir y la siguiente, cuando hay gente que cambia de local.'),
  FORMULA(`Sesiones al día = ${n(D.dau)} × 4 = ${n(D.sesiones_dia_total)}`),
  FORMULA(`Sesiones en hora punta = ${n(D.sesiones_dia_total)} × 0,15 = ${n(D.sesiones_punta)}`),
  FORMULA(`Concurrencia pico = ${n(D.sesiones_punta)} × 6 ÷ 60 = ${n(D.conc_pico)} usuarios`),
  H2('5.3. Cuándo se produce el pico y por qué'),
  P('El pico está entre las **23:00 y las 00:00**, sobre todo de jueves a sábado. Es el momento en el que la gente ya ha quedado y está decidiendo dónde salir, que es justo para lo que sirve Pulso.'),
  P(`A partir de las 00:00 la actividad sigue alta (check-ins y chat dentro de los locales) y cae de madrugada. Durante el día casi no hay uso. El pico es unas ${(D.conc_pico / D.conc_media).toFixed(1).replace('.', ',')} veces la media, así que dimensionar con la media dejaría la app caída justo cuando más se usa.`),
  ...image('curva-horaria.png', 600, 240, 'Curva horaria hipotética.'),
  PB(),
];

const t4 = [
  H1('6. T4 · Carga'),
  H2('6.1. Peticiones por segundo'),
  P('Cada vez que la app pide algo al servidor (la lista de locales, un perfil, enviar un mensaje) es una petición. El enunciado da un rango de 0,2 a 0,5 peticiones por segundo por usuario conectado. Tomo **0,3**, porque la lista de locales no se recarga sola cada pocos segundos: los cambios llegan por la conexión del chat, que no cuenta como petición.'),
  FORMULA(`Peticiones por segundo = ${n(D.conc_pico)} × 0,3 = ${n(D.rps)} pet/s`),
  P(`De esas peticiones, aproximadamente un 10 % son escrituras (check-in, me gusta, mensajes): unas **${n(D.escrituras)} escrituras por segundo** que tiene que aguantar la base de datos principal.`),
  H2('6.2. Ancho de banda'),
  P('En el laboratorio, cada respuesta de la app ocupó de media 4,5 kB con 12 locales. Una ciudad grande puede tener unos 50 locales en la lista, así que calculo **15 kB por respuesta**. Las fotos y los ficheros de la app no pasan por los servidores: se sirven desde la CDN (una red de servidores repartidos que guardan copias de los ficheros cerca de los usuarios).'),
  FORMULA(`Ancho de banda = ${n(D.rps)} × 15 kB × 8 ÷ 1.000 = ${n(D.mbps)} Mbps ≈ ${(D.mbps / 1000).toFixed(2).replace('.', ',')} Gbps`),
  FORMULA(`Con un 30 % de margen para imprevistos: ${n(D.mbps_margen)} Mbps ≈ ${(D.mbps_margen / 1000).toFixed(2).replace('.', ',')} Gbps`),
  H2('6.3. Escenarios'),
  P('Como las hipótesis pueden fallar, calculo tres escenarios. El esperado es el que se usa para el dimensionado base, y el de sábado por la noche sirve para comprobar que la arquitectura puede crecer sin rehacer la red.'),
  table(['Escenario', 'DAU/MAU', 'Hora punta', 'pet/s por usuario', 'DAU', 'A la vez en el pico', 'pet/s', 'Mbps', 'Servidores API'], [
    ['Prudente', '30 %', '10 %', '0,2', n(D.escenarios[0].dau), n(D.escenarios[0].conc_pico), n(D.escenarios[0].rps), n(D.escenarios[0].mbps), String(D.escenarios[0].nodos_api)],
    ['**Esperado**', '35 %', '15 %', '0,3', n(D.escenarios[1].dau), n(D.escenarios[1].conc_pico), n(D.escenarios[1].rps), n(D.escenarios[1].mbps), `**${D.escenarios[1].nodos_api}**`],
    ['Sábado noche', '35 % × 1,5', '20 %', '0,4', n(D.escenarios[2].dau), n(D.escenarios[2].conc_pico), n(D.escenarios[2].rps), n(D.escenarios[2].mbps), String(D.escenarios[2].nodos_api)],
  ], [1.3, 0.9, 0.8, 0.9, 0.9, 1, 0.8, 0.7, 0.9]),
  P('El sábado por la noche el DAU se multiplica por 1,5, porque es el día que más se usa la app. Los servidores API salen de la fórmula de T5.'),
  H2('6.4. Almacenamiento a tres años'),
  table(['Dato', 'Hipótesis', 'Volumen'], [
    ['Cuentas', `${n(D.cuentas)} cuentas × 1 kB`, `${D.almacenamiento_gb['usuarios (1 kB/cuenta)'].toString().replace('.', ',')} GB`],
    ['Check-ins recientes', 'DAU × 1 al día × 200 B, solo 30 días (luego se anonimizan)', `${D.almacenamiento_gb['check-ins (DAU × 1/día × 200 B × 30 días; luego se anonimizan)'].toString().replace('.', ',')} GB`],
    ['Ambiente por local y hora', '20.000 locales × 24 h × 365 días × 3 años × 300 B', `${D.almacenamiento_gb['agregados anónimos de ambiente (por local y hora, 3 años)'].toString().replace('.', ',')} GB`],
    ['«Me gusta»', 'DAU × 5 al día × 60 B × 3 años', `${D.almacenamiento_gb['likes (DAU × 5/día × 60 B × 365 × 3)'].toString().replace('.', ',')} GB`],
    ['Mensajes', 'DAU × 10 al día × 250 B × 3 años', `${n(D.almacenamiento_gb['mensajes (DAU × 10/día × 250 B × 365 × 3)'])} GB`],
    ['Fotos de perfil (opcionales)', '40 % de cuentas × 2 fotos × 400 kB', `${n(D.almacenamiento_gb['fotos de perfil opcionales (40 % cuentas × 2 × 400 kB)'])} GB`],
    ['**Total de datos**', '', `**≈ ${(D.almacenamiento_total_gb / 1000).toFixed(1).replace('.', ',')} TB**`],
  ], [1.3, 2.6, 0.9]),
  gap(),
  P('Las fotos van a un almacenamiento aparte para ficheros y el resto (unos 2,4 TB) a la base de datos. A eso hay que sumar las copias de seguridad y las réplicas, que multiplican el espacio. Por eso cada servidor de base de datos lleva 4 TB de disco SSD.'),
  P('La versión actual de la app no tiene fotos de perfil por privacidad. Las incluyo en el cálculo porque el enunciado las menciona y porque es la primera mejora que tengo prevista.'),
  H2('6.5. Comprobación en laboratorio'),
  P('Para no quedarme solo con valores hipotéticos, le pedí a la IA que lanzara una prueba de carga contra la app real con autocannon, una herramienta de Node.js que envía muchas peticiones a la vez para ver cuánto aguanta. Este es el resultado:'),
  table(['Prueba', 'pet/s media', 'Tiempo de respuesta normal', 'Tiempo de respuesta en el peor 1 %', 'Errores'], [
    ['1 servidor (usando un solo núcleo)', '2.792', '15 ms', '50 ms', '0'],
    ['3 servidores detrás del balanceador', '2.348', '37 ms', '138 ms', '0'],
    ['3 servidores y se apaga uno a mitad de la prueba', '2.338', '17 ms', '73 ms', '**0**'],
  ], [2.4, 0.9, 1.1, 1.3, 0.7]),
  gap(),
  P('**Conclusión:**'),
  B('Un solo servidor, con la caché de Redis, aguantó casi 2.800 pet/s usando un único núcleo. Por lo tanto, el valor del enunciado (1.000–2.000 pet/s para un servidor de 16 núcleos) es prudente para esta app. Aun así uso 1.500 pet/s en T5, porque en producción hay cifrado, más escrituras y una base de datos mucho más grande.'),
  B('Con 3 servidores el rendimiento no subió porque el ordenador de pruebas solo tenía 2 núcleos y ya estaban al máximo: los tres servidores competían con el resto de programas. Esto demuestra que el límite era el ordenador, no la app.'),
  B('Al apagar un servidor a mitad de la prueba, el balanceador lo detectó, mandó las peticiones a los otros dos y no hubo ni un error. Al volver a encenderlo, se reincorporó solo en unos segundos. Es la redundancia funcionando.'),
  B('Envié tres mensajes de chat, cada uno a través de un servidor distinto, y los tres llegaron al momento al otro usuario, que estaba conectado a un único servidor. Redis se encarga de pasar los mensajes entre servidores.'),
  PB(),
];

const t5 = [
  H1('7. T5 · Dimensionado de servidores'),
  P('Cada tipo de servidor sale de un dato calculado. Para los servidores API aplico la regla del enunciado sin pasar del 70 % de uso, para tener margen ante picos cortos. El «+1» es un servidor de reserva: si uno falla, los demás siguen pudiendo con todo (esto se llama redundancia N+1).'),
  FORMULA(`Servidores API = redondeo hacia arriba de ${n(D.rps)} ÷ (1.500 × 0,70) + 1 = ${D.nodos_api} + 1 = ${D.nodos_api_total}`),
  FORMULA(`Servidores de chat y avisos = redondeo hacia arriba de ${n(D.conc_pico)} conexiones ÷ 10.000 + 1 = ${D.nodos_rt - 1} + 1 = ${D.nodos_rt}`),
  table(['Servidor', 'N.º', 'Núcleos y memoria', 'Disco', 'Red', 'Por qué'], [
    ['Balanceadores', '2', '8 núcleos · 16 GB', '40 GB', '10 Gbps', 'Reparten las peticiones entre los servidores API. Dos para que, si uno falla, el otro siga.'],
    ['API', `${D.nodos_api_total} (${D.nodos_api}+1)`, '16 núcleos · 32 GB', '80 GB SSD', '10 Gbps', `${n(D.rps)} pet/s a 1.500 por servidor y 70 % de uso. El sábado se añaden más automáticamente, hasta ${D.escenarios[2].nodos_api}.`],
    ['Chat y avisos', `${D.nodos_rt} (${D.nodos_rt - 1}+1)`, '8 núcleos · 16 GB', '40 GB SSD', '10 Gbps', `${n(D.conc_pico)} conexiones a 10.000 por servidor. Hasta 10 el sábado.`],
    ['Base de datos principal + copia en espera', '2', '16 núcleos · 64 GB', '4 TB SSD', '10 Gbps', `≈ ${n(D.escrituras)} escrituras/s. La copia en espera está siempre al día y toma el relevo si cae la principal.`],
    ['Réplicas de lectura', '2', '16 núcleos · 64 GB', '4 TB SSD', '10 Gbps', 'Atienden las consultas (listas de locales y perfiles). Dos para que una pueda fallar.'],
    ['Redis (caché)', '3', '8 núcleos · 32 GB', '100 GB SSD', '10 Gbps', 'Guarda el ambiente de cada local y reparte los mensajes del chat. Tres para que, si cae uno, los otros sigan.'],
    ['Tareas programadas', '3 (2+1)', '8 núcleos · 16 GB', '100 GB SSD', '1 Gbps', 'Calcular el ambiente por horas, anonimizar check-ins antiguos, enviar notificaciones y moderar.'],
    ['Monitorización', '2', '8 núcleos · 16 GB', '2 TB SSD', '1 Gbps', 'Vigila que todo funcione y avisa si algo falla.'],
    ['Acceso de administración', '2', '2 núcleos · 4 GB', '20 GB', '1 Gbps', 'Única puerta para administrar los servidores, con VPN y doble factor.'],
    ['Almacenamiento de ficheros', 'Servicio', 'Según uso', '1,5 TB al inicio', 'Privado + CDN', 'Fotos opcionales y copias. Crece unos 0,4 TB al año.'],
  ], [1.4, 0.8, 1.1, 0.8, 0.8, 2.6]),
  gap(),
  H2('7.1. Dónde se aloja y cómo crece'),
  P('Propongo una **nube pública con centros de datos en la Unión Europea**, repartiendo los servidores en tres edificios distintos de la misma zona. Hay tres motivos. El primero es que la carga es muy irregular: el sábado por la noche hacen falta unos 35 servidores API y un martes por la mañana bastaría con 3. Con servidores propios habría que comprar para el sábado y tenerlos parados el resto de la semana. El segundo es que los datos personales se quedan en la UE, como exige el RGPD. El tercero es que no hace falta invertir de golpe en un centro de datos propio.'),
  P('Los servidores API y los del chat crecen **añadiendo más servidores** de forma automática cuando sube la carga, con un mínimo de 14 y 6. La base de datos crece con servidores más potentes y más réplicas. Si dentro de unos años no fuera suficiente, se podría repartir por ciudades, porque cada local pertenece a una sola ciudad.'),
  table(['Objetivo', 'Valor', 'Cómo se consigue'], [
    ['Disponibilidad', '99,9 % al mes (como mucho unos 43 minutos caída al mes)', 'Todo duplicado y repartido en tres edificios.'],
    ['Datos que se pueden perder (RPO)', 'Ninguno si falla un edificio · como mucho 5 minutos si falla toda la zona', 'Copia en espera siempre al día y otra copia en una segunda zona.'],
    ['Tiempo para recuperar (RTO)', 'Como mucho 60 minutos si falla toda la zona', 'Scripts que crean de nuevo toda la infraestructura en la segunda zona.'],
    ['Copias de seguridad', 'Una completa al día y los cambios en continuo, cifradas', 'Se prueba a restaurarlas cada trimestre: una copia que nunca se ha restaurado no garantiza nada.'],
  ], [1.4, 1.8, 2.3]),
  gap(),
  H2('7.2. Coste estimado'),
  P('Sin elegir proveedor no se puede dar un precio exacto, así que doy un orden de magnitud mensual para comparar opciones.'),
  table(['Concepto', 'Estimación mensual'], [
    ['Servidores API y de chat (con los extra del fin de semana)', '9.000 – 14.000 €'],
    ['Bases de datos, Redis y tareas programadas', '5.000 – 8.000 €'],
    ['Balanceadores, protección contra ataques y acceso de administración', '1.500 – 3.000 €'],
    ['CDN y tráfico de salida', '3.000 – 7.000 €'],
    ['Almacenamiento de ficheros, copias y segunda zona', '1.000 – 2.500 €'],
    ['Monitorización y soporte', '700 – 2.000 €'],
    ['**Total aproximado**', '**20.200 – 36.500 €/mes**'],
  ], [3, 1.4]),
  gap(),
  P('A eso hay que sumar una inversión inicial de 15.000 a 30.000 € para automatizar la puesta en marcha, hacer pruebas de carga reales, una auditoría de seguridad y la revisión legal de protección de datos, que en esta app es imprescindible.'),
  PB(),
];

const ptResultRows = PT_RESULTS || [
  ['Abrir http://pulso.app en el navegador de PC-USUARIO', 'Se abre la página servida por LB-1', 'Correcto: el DNS público traduce pulso.app a 10.10.70.11 y la página carga.'],
  ['ping 10.10.70.11 (balanceador) desde PC-USUARIO', 'Responde', 'Correcto: 4 de 4 respuestas. En el primer intento se pierden 2 mientras los equipos se presentan entre sí (ARP), es normal.'],
  ['ping 10.10.40.11 (base de datos) desde PC-USUARIO', 'No responde: el cortafuegos lo bloquea', 'Correcto: 0 de 4. Contestan FW-1 (10.0.1.2) y FW-2 (10.0.2.2) diciendo que no dejan pasar.'],
  ['Apagar el enlace ISP-A ↔ R-BORDE-1 y hacer ping a pulso.app', 'Sigue funcionando por ISP-B', 'Correcto: 4 de 4. El TTL baja de 123 a 122 porque ahora el camino tiene un salto más.'],
  ['show standby brief en CORE-1', 'CORE-1 activo y CORE-2 en reserva en cada VLAN', 'Correcto: CORE-1 activo en las 9 VLAN y CORE-2 (10.10.X.3) en reserva.'],
];

function pngSize(file) {
  const b = fs.readFileSync(path.join(__dirname, 'img', file));
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
const shot = (file, w, caption) => {
  if (!fs.existsSync(path.join(__dirname, 'img', file))) return [];
  const s = pngSize(file);
  return image(file, w, Math.round((s.h / s.w) * w), caption);
};

const t6 = [
  H1('8. T6 · Trazado de la red en Packet Tracer'),
  P('He montado la red en **Cisco Packet Tracer** para comprobar que el diseño funciona de verdad. Packet Tracer no puede simular 14 servidores de 16 núcleos ni enlaces de 10 Gbps, así que la topología es una versión **a escala**: tiene todas las piezas del diseño y todas duplicadas, pero con menos servidores de cada tipo. Las configuraciones de cada equipo están en la carpeta docs/packet-tracer del repositorio.'),
  ...ptImage(),
  P('La captura se lee de izquierda a derecha, igual que viaja una petición:'),
  B('**Internet (izquierda).** PC-USUARIO, PORTATIL-USUARIO y DNS-PUBLICO hacen de usuarios. Están en el switch SW-USUARIOS y salen por R-INTERNET, que tiene un cable hacia cada operador.'),
  B('**Operadores y borde (centro).** ISP-A e ISP-B son los dos operadores. Cada uno llega a su router de borde (R-BORDE-1 y R-BORDE-2), y los dos routers de borde están unidos por un cable vertical para poder pasarse el tráfico si uno pierde su operador.'),
  B('**Cortafuegos.** FW-1 y FW-2 filtran todo lo que entra. También están unidos entre sí.'),
  B('**Núcleo.** CORE-1 y CORE-2 son los switches de capa 3 que enrutan entre VLAN. La línea doble discontinua entre ellos es el enlace doble (EtherChannel).'),
  B('**Acceso y servidores (derecha).** Cada switch de acceso (SW-DMZ, SW-APP, SW-DATOS y SW-GESTION) tiene un cable a CORE-1 y otro a CORE-2, por eso se ven líneas cruzadas. De cada uno cuelgan sus servidores.'),
  P('Los triángulos verdes de cada cable indican que el enlace está activo. El punto naranja en algunos cables de los switches de acceso es normal: es el cable que el protocolo Spanning Tree deja en reserva para que no se formen bucles. Si el otro cable falla, ese se activa solo.'),
  table(['En el diseño real', 'En Packet Tracer'], [
    ['2 operadores de Internet de 10 Gbps', 'ISP-A e ISP-B (routers 2911), enlaces de 1 Gbps'],
    ['2 routers de borde', 'R-BORDE-1 y R-BORDE-2 (2911), unidos entre sí'],
    ['2 cortafuegos', 'FW-1 y FW-2 (2911 con listas de acceso que hacen de cortafuegos)'],
    ['2 switches de núcleo', 'CORE-1 y CORE-2 (switches de capa 3 3560), unidos por un enlace doble'],
    ['Zonas separadas por VLAN', '4 switches de acceso 2960: DMZ, aplicación, datos y gestión'],
    ['2 balanceadores', 'LB-1 y LB-2 (servidores web)'],
    [`${D.nodos_api_total} servidores API y ${D.nodos_rt} de chat`, 'API-1, API-2 y RT-1'],
    ['Base de datos principal, copia en espera y 2 réplicas', 'PG-PRIMARIO, PG-STANDBY y PG-REPLICA'],
    ['Redis ×3', 'REDIS'],
    ['Usuarios en Internet', 'PC-USUARIO, PORTATIL-USUARIO y un servidor DNS público'],
  ], [1.8, 2.6]),
  gap(),
  H2('8.1. Cómo viaja una petición'),
  P('Cuando alguien abre Pulso, primero pregunta al **DNS** qué dirección tiene pulso.app. Después la petición sale por su operador (ISP-A o ISP-B), llega a nuestro **router de borde**, pasa por el **cortafuegos**, que solo deja entrar el tráfico web hacia los balanceadores, y llega al **switch de núcleo**. Este la envía a la VLAN de los **balanceadores** (DMZ), que la reparten entre los **servidores API**. Si hace falta, estos consultan **Redis** o la **base de datos**, que están en su propia VLAN y no se pueden alcanzar desde fuera.'),
  H2('8.2. VLAN y direcciones'),
  P('Cada tipo de servidor va en su propia **VLAN**, es decir, en su propia red separada aunque comparta los mismos switches. Así, si alguien entra en un servidor web, no tiene acceso directo a la base de datos. Cada VLAN usa la red 10.10.X.0/24, donde X es el número de la VLAN, y su puerta de enlace es siempre la .1.'),
  table(['VLAN', 'Uso', 'Red', 'Puerta de enlace'], [
    ['10', 'Gestión (administración)', '10.10.10.0/24', '10.10.10.1'],
    ['20', 'Servidores API', '10.10.20.0/24', '10.10.20.1'],
    ['30', 'Chat y avisos', '10.10.30.0/24', '10.10.30.1'],
    ['40', 'Bases de datos', '10.10.40.0/24', '10.10.40.1'],
    ['50', 'Caché (Redis)', '10.10.50.0/24', '10.10.50.1'],
    ['60', 'Copias de seguridad', '10.10.60.0/24', '10.10.60.1'],
    ['70', 'DMZ (balanceadores, lo único visible desde fuera)', '10.10.70.0/24', '10.10.70.1'],
    ['80', 'Monitorización', '10.10.80.0/24', '10.10.80.1'],
    ['90', 'Servicios internos (DNS y hora)', '10.10.90.0/24', '10.10.90.1'],
  ], [0.6, 2.6, 1.3, 1.2]),
  NOTE('Una red /24 admite 254 equipos: de sobra para los 35 servidores API del sábado y con margen para crecer. Las conexiones entre routers usan redes /30, que solo tienen dos direcciones, una para cada extremo.'),
  H2('8.3. Qué tráfico se permite'),
  P('Los cortafuegos tienen una lista de acceso llamada DESDE-INTERNET que se aplica a todo lo que entra desde fuera. Solo deja pasar:'),
  B('El tráfico web (puertos 80 y 443) y el ping hacia la VLAN 70 de los balanceadores.'),
  B('Las respuestas a conexiones que han salido desde dentro.'),
  B('Los mensajes entre routers para saber por dónde enviar el tráfico.'),
  P('**Todo lo demás se bloquea.** Por eso, desde Internet se puede abrir la web, pero un ping a la base de datos no llega.'),
  table(['Desde', 'Hacia', 'Puerto', 'Para qué'], [
    ['Internet', 'Balanceadores (VLAN 70)', '443 (y 80)', 'Usar la app.'],
    ['Balanceadores', 'Servidores API y de chat (VLAN 20 y 30)', '3000', 'Repartir las peticiones.'],
    ['API y chat', 'Base de datos (VLAN 40)', '5432', 'Leer y guardar datos.'],
    ['API y chat', 'Redis (VLAN 50)', '6379', 'Caché y mensajes del chat.'],
    ['Base de datos principal', 'Segunda zona', '5432 por VPN', 'Copia de seguridad en otro lugar.'],
    ['Administradores', 'Gestión (VLAN 10)', 'VPN + SSH', 'Administrar, con doble factor.'],
  ], [1.3, 1.7, 1, 2]),
  H2('8.4. Qué pasa si algo falla'),
  P('Toda la red está duplicada y se recupera sola:'),
  B('**Si cae un operador o un router de borde**, los routers se avisan entre ellos (con el protocolo OSPF) y en unos segundos el tráfico va por el otro camino.'),
  B('**Si cae un switch de núcleo**, el otro toma su puesto. Los dos comparten la dirección .1 de cada VLAN (con HSRP): normalmente responde CORE-1 y, si falla, responde CORE-2 sin que los servidores tengan que cambiar nada.'),
  B('**Si se corta un cable entre los dos núcleos**, sigue el otro, porque están unidos por un enlace doble (EtherChannel).'),
  B('**Si cae un switch de acceso o uno de sus cables**, cada switch de acceso está conectado a los dos núcleos.'),
  H2('8.5. Capacidad de los enlaces'),
  P(`Los enlaces salen del cálculo de T4. En el escenario esperado hacen falta ${(D.mbps_margen / 1000).toFixed(2).replace('.', ',')} Gbps con margen, y en el de sábado noche ${(D.escenarios[2].mbps * 1.3 / 1000).toFixed(1).replace('.', ',')} Gbps. Por eso propongo **dos operadores distintos con 10 Gbps cada uno**. Lo importante es que, incluso en el peor caso, **un solo enlace puede con todo el tráfico**: si se cae un operador el sábado a medianoche, el otro aguanta. Entre los dos switches de núcleo pongo 25 Gbps, para que las copias de la base de datos no compitan con el tráfico de los usuarios.`),
  H2('8.6. Pruebas en Packet Tracer'),
  P('Con la red ya configurada hice cinco pruebas desde el ordenador de un usuario (PC-USUARIO) y desde el switch de núcleo. Todas salieron como se esperaba.'),
  table(['Prueba', 'Resultado esperado', 'Resultado'], ptResultRows, [2, 1.8, 2.4]),
  gap(),
  ...shot('pt-web.png', 520, 'Prueba 1: el navegador de PC-USUARIO abre http://pulso.app, que el DNS público dirige al balanceador LB-1.'),
  ...shot('pt-pruebas.png', 470, 'Pruebas 2, 3 y 4: el balanceador responde, la base de datos queda bloqueada por los cortafuegos y, con el enlace de ISP-A apagado, pulso.app sigue respondiendo por ISP-B.'),
  ...shot('pt-hsrp.png', 520, 'Prueba 5: CORE-1 es el activo en todas las VLAN y CORE-2 (10.10.X.3) está en reserva.'),
  PB(),
];

const t7 = [
  H1('9. T7 · Exposición argumentada'),
  P('Para cada elemento indico qué problema resuelve, de qué cálculo sale y qué pasaría si faltara.'),
  table(['Elemento', 'Qué resuelve', 'De dónde sale', 'Si faltara…'], [
    ['CDN', 'Sirve la app y las fotos desde cerca del usuario', 'La app y las fotos no cuentan en los 15 kB por petición', 'Todo ese tráfico llegaría a nuestros servidores y harían falta más enlaces y más servidores.'],
    ['Dos operadores', 'Conexión a Internet', `${(D.mbps_margen / 1000).toFixed(2).replace('.', ',')} Gbps esperados; un enlace de 10 Gbps basta incluso el sábado`, 'Un corte del operador dejaría Pulso sin servicio justo en su hora punta.'],
    ['Protección contra ataques', 'Frena ataques antes de que lleguen', 'Servicio público y de alcance nacional', 'Un ataque podría tumbar la app.'],
    ['Cortafuegos ×2', 'Solo deja entrar lo permitido', 'Tabla de tráfico permitido de T6', 'La base de datos quedaría expuesta; con uno solo, si falla, cae todo.'],
    ['Balanceadores ×2', 'Reparten y detectan servidores caídos', `${n(D.rps)} pet/s entre ${D.nodos_api_total} servidores`, 'No se podrían añadir servidores. Con uno solo, si cae, cae todo.'],
    [`${D.nodos_api_total} servidores API`, 'Atienden la app', `${n(D.rps)} pet/s ÷ (1.500 × 0,7) + 1`, 'Lentitud y errores en hora punta. En el laboratorio, al quitar uno no hubo errores gracias al +1.'],
    [`${D.nodos_rt} servidores de chat`, 'Chat, matches y avisos al momento', `${n(D.conc_pico)} conexiones a la vez`, 'Los mensajes no llegarían al momento y la app tendría que preguntar continuamente, multiplicando las peticiones.'],
    ['Redis ×3', 'Guarda el ambiente y reparte los mensajes', 'El ambiente se consulta en el 80 % de las peticiones', 'Cada consulta recalcularía el ambiente en la base de datos, que no aguantaría el pico.'],
    ['Base de datos principal + copia en espera', 'Guarda cuentas, check-ins, matches y mensajes', `≈ ${n(D.escrituras)} escrituras/s y 2,4 TB a 3 años`, 'Si la principal cae sin copia, se pierde el servicio y quizá datos.'],
    ['Réplicas de lectura ×2', 'Atienden las consultas', 'Las lecturas son el 90 % de la carga', 'La principal tendría que leer y escribir a la vez y se saturaría antes.'],
    ['Almacenamiento de ficheros', 'Fotos y copias', '≈ 1,1 TB de fotos a 3 años', 'Las fotos ocuparían la base de datos, que es más cara y más lenta para eso.'],
    ['VLAN separadas', 'Separan cada tipo de servidor', 'Cada uno solo ve lo que necesita', 'Un fallo en un servidor web daría acceso directo a los datos.'],
    ['Monitorización', 'Mide la carga real y avisa de fallos', 'Las hipótesis de T2–T4 hay que confirmarlas', 'No sabríamos si las hipótesis eran correctas ni veríamos los fallos a tiempo.'],
    ['Segunda zona y copias', 'Recuperarse de un desastre', 'Recuperar en 60 min y perder como mucho 5 min de datos', 'Un incendio o una caída general podría suponer días sin servicio o perder datos.'],
  ], [1.3, 1.5, 1.6, 2.2]),
  gap(),
  H2('9.1. Guion para la exposición'),
  B('**La app.** Pulso enseña el ambiente de cada local (mujeres, hombres y personas no binarias) de forma anónima. Demostración en directo con la cuenta de prueba.'),
  B(`**Los números.** ${n(D.pob_18_30)} personas de 18 a 30 años → ${n(D.mau)} usuarios al mes → ${n(D.dau)} al día → ${n(D.conc_pico)} a la vez a las 23:00 → ${n(D.rps)} peticiones por segundo.`),
  B(`**Los servidores.** ${D.nodos_api_total} servidores API, ${D.nodos_rt} de chat, base de datos con copia en espera y 2 réplicas, Redis ×3, todo con uno de reserva.`),
  B('**La red en Packet Tracer.** Se lee de izquierda a derecha, como viaja una petición: los usuarios salen a Internet por dos operadores, entran por dos routers de borde y dos cortafuegos, y llegan a los dos switches de núcleo. De ahí se reparten a cuatro zonas separadas por VLAN (balanceadores, aplicación, datos y gestión), cada una conectada a los dos núcleos. Todo está duplicado, así que si cae una pieza el tráfico sigue por la otra.'),
  B('**La prueba de carga.** Se apaga un servidor durante la prueba y no hay errores.'),
  B('**Privacidad.** Ambiente solo por género, sin desglose con menos de 10 personas, visibilidad opcional, sin ubicación guardada y solo mayores de 18.'),
  PB(),
];

const riesgos = [
  H1('10. Riesgos y aspectos pendientes'),
  table(['Riesgo', 'Efecto', 'Medida'], [
    ['La recurrencia y la hora punta son hipótesis', 'La carga real puede ser mayor o menor', 'Medir el uso real en una prueba piloto en Madrid y recalcular con docs/calculos.py.'],
    ['La capacidad por servidor se midió en un ordenador pequeño', 'Podrían hacer falta más o menos servidores', 'Repetir la prueba en el tipo de servidor elegido, con cifrado y una base de datos de tamaño real.'],
    ['Adivinar quién está en un local pequeño mirando cómo cambian los porcentajes', 'Se podría identificar a alguien', 'Los datos se actualizan cada 30 s, se redondean de 5 en 5 y no se muestran con menos de 10 personas.'],
    ['Check-in falso con ubicación simulada', 'Ambiente manipulado', 'Límite de check-ins por cuenta y por hora, y detección de comportamientos raros.'],
    ['Mal uso de los perfiles visibles', 'Acoso dentro del local', 'Visibilidad opcional, bloqueo y denuncia con un clic, y moderación.'],
    ['Que la nube cueste más de lo previsto', 'Presupuesto superado', 'Avisos de gasto, contratar por adelantado el mínimo y añadir servidores solo cuando hagan falta.'],
    ['Fallo de una zona o de una réplica', 'Interrupción o pérdida de datos recientes', 'Simulacro de recuperación cada trimestre.'],
  ], [1.8, 1.4, 2.6]),
  gap(),
  H1('11. Conclusión'),
  P(`Para una red social de ámbito nacional no vale un servidor grande al que se le añade memoria cuando va lento. Con datos reales del INE y unas hipótesis razonables, Pulso tendría unos ${n(D.mau)} usuarios activos al mes y ${n(D.conc_pico)} personas conectadas a la vez a las 23:00, lo que se traduce en ${n(D.rps)} peticiones por segundo y cerca de ${(D.mbps / 1000).toFixed(1).replace('.', ',')} Gbps.`),
  P(`De ahí sale una arquitectura por capas que crece añadiendo servidores: ${D.nodos_api_total} servidores API, ${D.nodos_rt} de chat, una base de datos con copia y réplicas, caché, CDN y una red con todo duplicado, separada por VLAN y con una zona de respaldo. El laboratorio y Packet Tracer muestran que el diseño funciona: se pueden quitar piezas y el servicio sigue respondiendo.`),
  P('Lo que más me ha hecho pensar no ha sido la parte técnica, sino la privacidad. La idea original era ver quién hay en cada discoteca y con qué orientación sexual, pero un dato tan delicado ligado a un lugar físico podía poner a gente en peligro. Cambiarlo por un ambiente anónimo y basado solo en el género mantiene la utilidad de la app y protege a las personas. Además ayuda a la infraestructura: como el ambiente es un resumen, se puede guardar unos segundos y eso reduce mucho la carga sobre la base de datos.'),
  H1('12. Fuentes'),
  B('INE. Estadística Continua de Población, población residente por fecha, sexo y edad (tabla 56934), datos a 1 de enero de 2025. https://www.ine.es'),
  B('INE. Encuesta sobre Equipamiento y Uso de TIC en los Hogares 2025 (nota de prensa de 20/11/2025 y tabla 76441). https://www.ine.es/dyngs/Prensa/TICH2025.htm'),
  B('INE. Mujeres y hombres en España: uso de Internet por edad y sexo, 2025. https://www.ine.es/uc/ekfL67UW'),
  B('Reglamento (UE) 2016/679 (RGPD), artículos 9, 15 y 17. https://eur-lex.europa.eu/eli/reg/2016/679/oj'),
  B('Ley Orgánica 3/2018 (LOPDGDD). https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673'),
  B(`Código fuente, pruebas de carga, laboratorio y topología de Packet Tracer de Pulso: ${REPO}`),
  PB(),
  H1('Anexos'),
  H2('A. Esquema completo de la red real'),
  P('Este es el diseño completo que la topología de Packet Tracer representa a escala.'),
  ...image('esquema-red.png', 600, 397, 'Esquema de la red real, desde el usuario hasta los datos.'),
  H2('B. Cómo probar el laboratorio'),
  P('Con Docker instalado, desde la carpeta infra del repositorio:'),
  FORMULA('docker compose up -d --build'),
  P('La app queda en http://localhost:8080 (cuenta de prueba: demo@pulso.app / pulso1234) y los datos de ejemplo se cargan solos. Para enseñar qué pasa al apagar un servidor: .\\demo-caida-nodo.ps1 desde la misma carpeta.'),
  H2('C. Configuración del cortafuegos en Packet Tracer'),
  P('La lista de acceso que se aplica en FW-1 y FW-2 a todo lo que entra desde Internet:'),
  FORMULA('ip access-list extended DESDE-INTERNET'),
  FORMULA(' permit ospf any any'),
  FORMULA(' permit tcp any 10.10.70.0 0.0.0.255 eq 80'),
  FORMULA(' permit tcp any 10.10.70.0 0.0.0.255 eq 443'),
  FORMULA(' permit icmp any 10.10.70.0 0.0.0.255 echo'),
  FORMULA(' permit tcp any any established'),
  FORMULA(' permit icmp any any echo-reply'),
  FORMULA(' deny ip any any'),
  P('La configuración completa de los 14 equipos de red está en docs/packet-tracer del repositorio, un fichero por equipo.'),
];

const doc = new Document({
  creator: 'Samia El Yahyaoui Mnissar',
  title: 'Dimensionado de servidores y red para Pulso',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Calibri', size: 32, bold: true, color: C.primary }, paragraph: { spacing: { before: 360, after: 160 }, keepNext: true, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Calibri', size: 26, bold: true, color: C.accent }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Calibri', size: 22, bold: true, color: C.primary }, paragraph: { spacing: { before: 200, after: 80 }, keepNext: true, outlineLevel: 2 } },
    ],
  },
  numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 500, hanging: 260 } }, run: { font: 'Calibri' } } }] }] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1300, left: 1440, right: 1440 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Samia El Yahyaoui Mnissar · 2.º ASIR', size: 16, color: '888888', font: 'Calibri' })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Dimensionado de servidores y red · Pulso · Página ', size: 16, color: '888888', font: 'Calibri' }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '888888', font: 'Calibri' })] })] }) },
    children: [...portada, ...indice, ...intro, ...plan, ...t1, ...t2, ...t3, ...t4, ...t5, ...t6, ...t7, ...riesgos],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  const out = path.join(__dirname, 'Memoria_Dimensionado_Pulso.docx');
  fs.writeFileSync(out, buf);
  console.log('Generado', out, PT_CAPTURE ? '(con captura de Packet Tracer)' : '(sin captura de Packet Tracer)');
});
