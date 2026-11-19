/* VerollyTemp - lógica de la herramienta (versión de prueba: guarda en este navegador)
   Vencimientos de IVA por RUC, timbrados, honorarios mensuales, avisos por WhatsApp y correo,
   ficha del cliente e historial de cambios. */
'use strict';

const CLAVE = 'verollytemp_v1';
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MES_C = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

/* ---------------- fechas ---------------- */
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseD = s => { if (!s) return null; const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const hoy = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const addDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const diasEntre = (a, b) => Math.round((b - a) / 864e5); // b - a, en días
const fmtD = d => { if (typeof d === 'string') d = parseD(d); return d ? pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() : '—'; };
const fmtTs = ts => { const d = new Date(ts); return fmtD(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const mesKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1);
const mesNombre = k => { const [y, m] = k.split('-').map(Number); return MESES[m - 1] + ' ' + y; };
const sigMes = (k, n = 1) => { const [y, m] = k.split('-').map(Number); return mesKey(new Date(y, m - 1 + n, 1)); };
const gs = n => 'Gs. ' + new Intl.NumberFormat('es-PY').format(Math.round(Number(n) || 0));
const cuantoFalta = n => n === 0 ? 'hoy' : n === 1 ? 'mañana' : n === -1 ? 'ayer' : n > 0 ? 'en ' + n + ' días' : 'hace ' + (-n) + ' días';

/* feriados de Paraguay (fijos + Jueves y Viernes Santo). Los feriados trasladados por ley se cargan en Ajustes. */
function pascua(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mes - 1, dia);
}
function esFeriado(d) {
  const y = d.getFullYear(), s = ymd(d);
  if (['01-01','03-01','05-01','05-14','05-15','06-12','08-15','09-29','12-08','12-25'].some(x => s === y + '-' + x)) return true;
  const p = pascua(y);
  if (s === ymd(addDias(p, -3)) || s === ymd(addDias(p, -2))) return true;
  return (db.ajustes.feriadosExtra || '').split(/[\s,;]+/).some(x => x && toISO(x) === s);
}
function habil(d) { let x = new Date(d); while (x.getDay() === 0 || x.getDay() === 6 || esFeriado(x)) x = addDias(x, 1); return x; }
function toISO(t) { // acepta 2026-12-31 o 31/12/2026
  t = String(t).trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); if (m) return m[1] + '-' + pad(m[2]) + '-' + pad(m[3]);
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) return m[3] + '-' + pad(m[2]) + '-' + pad(m[1]);
  return '';
}

/* ---------------- datos ---------------- */
const PLANTILLAS = {
  wa5: 'Hola {nombre}, te saluda {contadora} de {consultoria}. Te recordamos que el {vence} vence el pago de honorarios de {mes} por {monto}. {datos_pago}¡Muchas gracias!',
  waVenc: 'Hola {nombre}, te saluda {contadora} de {consultoria}. El pago de honorarios de {mes} por {monto} venció el {vence}. Cuando lo realices, por favor avisanos por aquí. {datos_pago}¡Muchas gracias!',
  mailAsunto: 'Recordatorio de pago de honorarios - {mes}',
  mailCuerpo: 'Estimado/a {nombre}:\n\nLe recordamos que el pago de honorarios correspondiente a {mes}, por {monto}, venció el {vence}.\n\n{datos_pago}\n\nSi ya realizó el pago, por favor desestime este mensaje.\n\nSaludos cordiales,\n{contadora}\n{consultoria}'
};
function dbNueva() {
  return {
    version: 1, creado: Date.now(),
    ajustes: {
      consultoria: '', contadora: '', correo: '', whatsapp: '', datosPago: '',
      inicioControl: mesKey(hoy()), diasAviso: 5, diasTimbrado: 30, diaPagoDefecto: 10, feriadosExtra: '',
      plantillas: { ...PLANTILLAS }
    },
    clientes: [], historial: [], correos: []
  };
}
function cargar() {
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE));
    if (d && d.clientes) { d.ajustes = { ...dbNueva().ajustes, ...d.ajustes }; d.ajustes.plantillas = { ...PLANTILLAS, ...d.ajustes.plantillas }; d.correos = d.correos || []; return d; }
  } catch (e) {}
  return dbNueva();
}
let db = cargar();
function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(db)); } catch (e) { toast('No se pudo guardar en este navegador'); } }
const cli = id => db.clientes.find(c => c.id === id);
const nuevoId = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const quien = () => db.ajustes.contadora || 'Usuario';

function registrar(c, accion, detalle, cambios) {
  db.historial.unshift({ ts: Date.now(), quien: quien(), cid: c ? c.id : '', cnom: c ? c.nombre : '', accion, detalle: detalle || '', cambios: cambios || null });
  if (db.historial.length > 3000) db.historial.length = 3000;
}

/* ---------------- reglas ---------------- */
// IVA mensual (DNIT): vence en el mes siguiente según el último dígito del RUC (sin el dígito verificador)
// 0→7, 1→9, 2→11, 3→13, 4→15, 5→17, 6→19, 7→21, 8→23, 9→25. Si cae sábado, domingo o feriado, pasa al siguiente día hábil.
function digitoRuc(ruc) { const base = String(ruc || '').split('-')[0].replace(/\D/g, ''); return base ? Number(base.slice(-1)) : null; }
function venceIVA(c, periodo) {
  const dg = digitoRuc(c.ruc); if (dg === null) return null;
  const [y, m] = sigMes(periodo).split('-').map(Number);
  return habil(new Date(y, m - 1, 7 + 2 * dg));
}
const periodoIVAActual = () => sigMes(mesKey(hoy()), -1);
function estadoIVA(c, periodo) {
  if (c.iva !== 'si') return { cod: 'na', txt: 'No presenta' };
  const v = venceIVA(c, periodo);
  if (!v) return { cod: 'sinruc', txt: 'Falta RUC' };
  const p = (c.ivaPresentado || {})[periodo];
  if (p) return { cod: 'ok', txt: 'Presentado', v, p };
  const n = diasEntre(hoy(), v);
  if (n < 0) return { cod: 'venc', txt: 'Vencido', v, n };
  if (n <= 5) return { cod: 'pronto', txt: 'Vence ' + cuantoFalta(n), v, n };
  return { cod: 'pend', txt: 'Pendiente', v, n };
}

function estadoTimbrado(c) {
  if (!c.timbradoVence) return { cod: 'sin', txt: 'Sin cargar' };
  const n = diasEntre(hoy(), parseD(c.timbradoVence));
  if (n < 0) return { cod: 'venc', txt: 'Vencido', n };
  if (n <= Number(db.ajustes.diasTimbrado || 30)) return { cod: 'pronto', txt: 'Vence ' + cuantoFalta(n), n };
  return { cod: 'ok', txt: 'Vigente', n };
}

// honorarios: se cobran desde el mes en que empezó el control (o desde que es cliente, si es después)
function inicioCobro(c) {
  const desde = (c.clienteDesde || '').slice(0, 7), ini = db.ajustes.inicioControl;
  return desde && desde > ini ? desde : ini;
}
function finCobro(c) { return c.estado === 'baja' && c.fechaBaja ? c.fechaBaja.slice(0, 7) : null; }
function vencePago(c, k) {
  const [y, m] = k.split('-').map(Number), ult = new Date(y, m, 0).getDate();
  return new Date(y, m - 1, Math.min(Number(c.diaPago) || Number(db.ajustes.diaPagoDefecto) || 10, ult));
}
function montoMes(c, k) { const p = (c.pagos || {})[k]; return p ? Number(p.monto) : Number(c.honorario) || 0; }
function seCobra(c, k) { const f = finCobro(c); return k >= inicioCobro(c) && (!f || k <= f); }
function mesesHasta(c, hasta) { const out = []; let k = inicioCobro(c); const f = finCobro(c); while (k <= hasta && (!f || k <= f)) { out.push(k); k = sigMes(k); } return out; }

function estadoPago(c) {
  if (c.estado === 'baja') return { cod: 'baja', txt: 'De baja', clase: 'b-gris' };
  const h = hoy(), actual = mesKey(h);
  const venc = mesesHasta(c, actual).filter(k => !c.pagos[k] && vencePago(c, k) < h);
  if (venc.length) {
    const deuda = venc.reduce((s, k) => s + montoMes(c, k), 0);
    return { cod: 'venc', txt: 'En vencimiento', clase: 'b-mal', meses: venc, deuda, mes: venc[0], vence: vencePago(c, venc[0]), dias: diasEntre(vencePago(c, venc[0]), h) };
  }
  let k = inicioCobro(c) > actual ? inicioCobro(c) : actual;
  // si el mes actual ya se pagó, mirar el siguiente
  for (let i = 0; i < 24 && c.pagos[k]; i++) k = sigMes(k);
  const v = vencePago(c, k), n = diasEntre(h, v);
  if (n <= Number(db.ajustes.diasAviso || 5)) return { cod: 'pronto', txt: n === 0 ? 'Vence hoy' : 'Vence en ' + n + (n === 1 ? ' día' : ' días'), clase: 'b-aviso', mes: k, vence: v, dias: n, deuda: montoMes(c, k) };
  return { cod: 'activo', txt: 'Activo', clase: 'b-ok', mes: k, vence: v, dias: n, deuda: montoMes(c, k) };
}
const activos = () => db.clientes.filter(c => c.estado !== 'baja');
const ordenNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es');

/* ---------------- mensajes ---------------- */
function rellenar(txt, c, k) {
  const a = db.ajustes;
  const datos = a.datosPago ? 'Datos para el pago: ' + a.datosPago + '. ' : '';
  return String(txt)
    .replace(/{nombre}/g, c.contacto || c.nombre)
    .replace(/{cliente}/g, c.nombre)
    .replace(/{mes}/g, mesNombre(k))
    .replace(/{monto}/g, gs(montoMes(c, k)))
    .replace(/{vence}/g, fmtD(vencePago(c, k)))
    .replace(/{consultoria}/g, a.consultoria || 'la consultoría')
    .replace(/{contadora}/g, a.contadora || '')
    .replace(/{datos_pago}/g, datos)
    .replace(/ {2,}/g, ' ');
}
function telWa(t) {
  let n = String(t || '').replace(/\D/g, '');
  if (!n) return '';
  if (n.startsWith('0')) n = '595' + n.slice(1);
  else if (n.length === 9 && n.startsWith('9')) n = '595' + n;
  return n;
}
function abrirWhatsApp(cid, k, tipo) {
  const c = cli(cid); if (!c) return;
  const n = telWa(c.celular);
  if (!n) { toast('Este cliente no tiene celular cargado'); return; }
  const txt = rellenar(tipo === 'venc' ? db.ajustes.plantillas.waVenc : db.ajustes.plantillas.wa5, c, k);
  window.open('https://wa.me/' + n + '?text=' + encodeURIComponent(txt), '_blank', 'noopener');
  marcarAviso(c, k, tipo === 'venc' ? 'waVenc' : 'wa5');
  registrar(c, 'WhatsApp enviado', (tipo === 'venc' ? 'Aviso de vencimiento' : 'Recordatorio de pago') + ' de ' + mesNombre(k));
  guardar(); pintar();
}
function abrirCorreo(cid, k) {
  const c = cli(cid); if (!c) return;
  if (!c.correo) { toast('Este cliente no tiene correo cargado'); return; }
  const p = db.ajustes.plantillas;
  location.href = 'mailto:' + encodeURIComponent(c.correo) + '?subject=' + encodeURIComponent(rellenar(p.mailAsunto, c, k)) + '&body=' + encodeURIComponent(rellenar(p.mailCuerpo, c, k));
  marcarAviso(c, k, 'mail');
  const al = db.correos.find(x => x.cid === c.id && x.mes === k && x.estado !== 'enviado');
  if (al) { al.estado = 'enviado'; al.enviado = Date.now(); al.manual = true; }
  registrar(c, 'Correo enviado', 'Aviso de vencimiento de ' + mesNombre(k) + ' a ' + c.correo);
  guardar(); pintar();
}
function marcarAviso(c, k, tipo) { c.avisos = c.avisos || {}; c.avisos[k] = c.avisos[k] || {}; c.avisos[k][tipo] = Date.now(); }
const aviso = (c, k, tipo) => ((c.avisos || {})[k] || {})[tipo];

/* Alerta automática: en cuanto un pago vence sin cobrarse, se genera el correo al cliente.
   En esta versión queda en la "cola de correos"; con el servidor (Apps Script) sale solo. */
function generarAlertas() {
  const h = hoy(); let nuevas = 0;
  activos().forEach(c => {
    mesesHasta(c, mesKey(h)).forEach(k => {
      if (c.pagos[k] || vencePago(c, k) >= h) return;
      if (db.correos.some(x => x.cid === c.id && x.mes === k)) return;
      db.correos.unshift({ id: nuevoId(), ts: Date.now(), cid: c.id, mes: k, para: c.correo || '', estado: c.correo ? 'pendiente' : 'sin correo' });
      registrar(c, 'Alerta automática', 'Venció el pago de ' + mesNombre(k) + ' (' + gs(montoMes(c, k)) + '). ' + (c.correo ? 'Correo a ' + c.correo + ' en cola.' : 'El cliente no tiene correo cargado.'));
      nuevas++;
    });
  });
  // si se pagó, la alerta pendiente ya no corresponde
  db.correos.forEach(x => { const c = cli(x.cid); if (x.estado !== 'enviado' && c && c.pagos[x.mes]) x.estado = 'pagado'; });
  if (nuevas) guardar();
  return nuevas;
}

/* ---------------- interfaz general ---------------- */
let vista = 'inicio';
const filtros = { q: '', est: 'activos', anio: new Date().getFullYear(), ivaPer: periodoIVAActual(), hq: '' };

function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2600); }

function reloj() {
  const d = new Date();
  $('#reloj').innerHTML = '<b>' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '</b>' + DIAS[d.getDay()] + ' ' + fmtD(d);
}
let ultimoDia = ymd(hoy());
setInterval(() => {
  reloj();
  if (ymd(hoy()) !== ultimoDia) { ultimoDia = ymd(hoy()); generarAlertas(); pintar(); } // cambió el día: recalcular
}, 15000);

function tema() {
  const r = document.documentElement;
  const oscuro = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  r.dataset.theme = oscuro ? 'light' : 'dark';
  try { localStorage.setItem('verollytemp_tema', r.dataset.theme); } catch (e) {}
}

function irA() {
  vista = (location.hash || '#inicio').slice(1) || 'inicio';
  if (!VISTAS[vista]) vista = 'inicio';
  document.querySelectorAll('.menu a').forEach(a => a.classList.toggle('on', a.dataset.vista === vista));
  pintar(); window.scrollTo(0, 0);
}
function pintar() { $('#app').innerHTML = VISTAS[vista](); }

const badgePago = (c, e) => '<button class="badge ' + e.clase + '" data-act="ficha" data-id="' + c.id + '" title="Ver ficha">' + esc(e.txt) + '</button>';
const badge = (cls, t) => '<span class="badge ' + cls + '">' + esc(t) + '</span>';
const claseIVA = { ok: 'b-ok', venc: 'b-mal', pronto: 'b-aviso', pend: 'b-gris', na: 'b-gris', sinruc: 'b-gris' };
const claseTim = { ok: 'b-ok', venc: 'b-mal', pronto: 'b-aviso', sin: 'b-gris' };
const nombreLink = c => '<a data-act="ficha" data-id="' + c.id + '">' + esc(c.nombre) + '</a>';

/* ---------------- vistas ---------------- */
const VISTAS = {};

VISTAS.inicio = () => {
  if (!db.clientes.length) return `
    <div class="panel bienvenida">
      <img src="img/verolly-temp-logo.webp" alt="VerollyTemp">
      <h1>Bienvenida a VerollyTemp</h1>
      <p>Acá vas a ver los vencimientos de IVA de cada cliente, sus timbrados y el cobro de tus honorarios, con avisos por WhatsApp y correo.</p>
      <div class="acciones">
        <button class="btn pri" data-act="nuevo">+ Nuevo cliente</button>
        <button class="btn" data-act="ejemplo">Ver con datos de ejemplo</button>
        <a class="btn" href="#ajustes">Datos de la consultoría</a>
      </div>
    </div>`;

  const h = hoy(), act = activos(), mesAct = mesKey(h);
  const est = act.map(c => ({ c, e: estadoPago(c) }));
  const venc = est.filter(x => x.e.cod === 'venc').sort((a, b) => b.e.dias - a.e.dias);
  const pronto = est.filter(x => x.e.cod === 'pronto').sort((a, b) => a.e.dias - b.e.dias);
  const esperado = act.filter(c => seCobra(c, mesAct)).reduce((s, c) => s + montoMes(c, mesAct), 0);
  const cobrado = db.clientes.filter(c => c.pagos[mesAct]).reduce((s, c) => s + Number(c.pagos[mesAct].monto), 0);
  const per = periodoIVAActual();
  const iva = act.map(c => ({ c, e: estadoIVA(c, per) })).filter(x => ['venc', 'pronto', 'pend'].includes(x.e.cod) && x.e.n <= 10).sort((a, b) => a.e.v - b.e.v);
  const tim = act.map(c => ({ c, e: estadoTimbrado(c) })).filter(x => x.e.cod === 'venc' || x.e.cod === 'pronto').sort((a, b) => a.e.n - b.e.n);
  const cola = db.correos.filter(x => x.estado === 'pendiente' || x.estado === 'sin correo');
  const nom = db.ajustes.contadora ? ', ' + esc(db.ajustes.contadora.split(' ')[0]) : '';

  return `
  <div class="titulo"><div><h1>Hola${nom}</h1><p>Hoy es ${DIAS[h.getDay()]} ${fmtD(h)}. Esto es lo que necesita atención.</p></div>
    <button class="btn pri" data-act="nuevo">+ Nuevo cliente</button></div>
  <div class="tiles">
    <div class="tile"><div class="k">Clientes activos</div><div class="v">${act.length}</div><div class="s">${db.clientes.length - act.length} de baja</div></div>
    <div class="tile ok"><div class="k">Cobrado en ${MESES[h.getMonth()].toLowerCase()}</div><div class="v">${gs(cobrado)}</div><div class="s">de ${gs(esperado)}</div></div>
    <div class="tile ${venc.length ? 'mal' : ''}"><div class="k">En vencimiento</div><div class="v">${venc.length}</div><div class="s">${gs(venc.reduce((s, x) => s + x.e.deuda, 0))} sin cobrar</div></div>
    <div class="tile ${pronto.length ? 'aviso' : ''}"><div class="k">Recordar (próximos ${db.ajustes.diasAviso} días)</div><div class="v">${pronto.length}</div><div class="s">por WhatsApp</div></div>
    <div class="tile ${iva.some(x => x.e.cod === 'venc') ? 'mal' : ''}"><div class="k">IVA de ${MESES[Number(per.slice(5)) - 1].toLowerCase()} por presentar</div><div class="v">${act.filter(c => ['venc', 'pronto', 'pend'].includes(estadoIVA(c, per).cod)).length}</div><div class="s">${iva.length} en los próximos 10 días</div></div>
  </div>
  <div class="grilla g2">
    <section class="panel"><div class="panel-cab"><h2>En vencimiento</h2>${badge('b-mal', venc.length + ' clientes')}</div>
      ${venc.length ? '<ul class="lista">' + venc.map(({ c, e }) => `<li>
        <div class="quien">${nombreLink(c)}<div class="det">${e.meses.length > 1 ? e.meses.length + ' meses' : mesNombre(e.mes)} · ${gs(e.deuda)} · venció ${cuantoFalta(-e.dias)}
        ${aviso(c, e.mes, 'waVenc') ? '<br>WhatsApp enviado ' + fmtTs(aviso(c, e.mes, 'waVenc')) : ''}</div></div>
        <div class="acciones"><button class="btn sm wa" data-act="wa" data-id="${c.id}" data-mes="${e.mes}" data-tipo="venc">WhatsApp</button>
        <button class="btn sm" data-act="mail" data-id="${c.id}" data-mes="${e.mes}">Correo</button>
        <button class="btn sm pri" data-act="pago" data-id="${c.id}" data-mes="${e.mes}">Pago generado</button></div></li>`).join('') + '</ul>'
        : '<p class="vacio">Nadie debe honorarios. ✓</p>'}
    </section>
    <section class="panel"><div class="panel-cab"><h2>Recordar pago</h2>${badge('b-aviso', 'vence en ' + db.ajustes.diasAviso + ' días o menos')}</div>
      ${pronto.length ? '<ul class="lista">' + pronto.map(({ c, e }) => `<li>
        <div class="quien">${nombreLink(c)}<div class="det">${mesNombre(e.mes)} · ${gs(e.deuda)} · vence ${cuantoFalta(e.dias)} (${fmtD(e.vence)})
        ${aviso(c, e.mes, 'wa5') ? '<br>Recordatorio enviado ' + fmtTs(aviso(c, e.mes, 'wa5')) : ''}</div></div>
        <div class="acciones"><button class="btn sm wa" data-act="wa" data-id="${c.id}" data-mes="${e.mes}" data-tipo="pronto">${aviso(c, e.mes, 'wa5') ? 'Reenviar' : 'Recordar'}</button>
        <button class="btn sm pri" data-act="pago" data-id="${c.id}" data-mes="${e.mes}">Pago generado</button></div></li>`).join('') + '</ul>'
        : '<p class="vacio">No hay pagos por vencer en los próximos días.</p>'}
    </section>
    <section class="panel"><div class="panel-cab"><h2>IVA de ${mesNombre(per)}</h2><a class="btn sm" href="#vencimientos">Ver todos</a></div>
      ${iva.length ? '<ul class="lista">' + iva.map(({ c, e }) => `<li>
        <div class="quien">${nombreLink(c)}<div class="det">RUC ${esc(c.ruc)} · vence ${fmtD(e.v)} (${cuantoFalta(e.n)})</div></div>
        ${badge(claseIVA[e.cod], e.txt)}<button class="btn sm" data-act="iva" data-id="${c.id}" data-per="${per}">Presentado</button></li>`).join('') + '</ul>'
        : '<p class="vacio">Nada por presentar en los próximos 10 días.</p>'}
    </section>
    <section class="panel"><div class="panel-cab"><h2>Timbrados</h2>${badge('b-aviso', 'vencen en ' + db.ajustes.diasTimbrado + ' días o menos')}</div>
      ${tim.length ? '<ul class="lista">' + tim.map(({ c, e }) => `<li>
        <div class="quien">${nombreLink(c)}<div class="det">Timbrado ${esc(c.timbrado || '—')} · vence ${fmtD(c.timbradoVence)}</div></div>
        ${badge(claseTim[e.cod], e.txt)}</li>`).join('') + '</ul>'
        : '<p class="vacio">Ningún timbrado vence pronto.</p>'}
    </section>
  </div>
  ${cola.length ? `<section class="panel" style="margin-top:16px"><div class="panel-cab"><h2>Alertas automáticas de correo</h2>${badge('b-info', cola.length + ' en cola')}</div>
    <p class="muted chico" style="margin-top:0">Se generan solas apenas vence un pago. Cuando conectemos el correo de la consultoría se van a enviar automáticamente; mientras tanto podés enviarlas con un toque.</p>
    <ul class="lista">${cola.slice(0, 20).map(x => { const c = cli(x.cid); return c ? `<li><div class="quien">${nombreLink(c)}<div class="det">Generada ${fmtTs(x.ts)} · ${mesNombre(x.mes)} · ${x.para ? esc(x.para) : 'sin correo cargado'}</div></div>
      ${x.para ? `<button class="btn sm" data-act="mail" data-id="${c.id}" data-mes="${x.mes}">Enviar ahora</button>` : `<button class="btn sm" data-act="editar" data-id="${c.id}">Cargar correo</button>`}</li>` : ''; }).join('')}</ul></section>` : ''}`;
};

VISTAS.clientes = () => {
  const q = filtros.q.toLowerCase();
  let lista = db.clientes.slice().sort(ordenNombre).filter(c => {
    if (filtros.est === 'activos' && c.estado === 'baja') return false;
    if (filtros.est === 'baja' && c.estado !== 'baja') return false;
    if (['venc', 'pronto', 'activo'].includes(filtros.est) && (c.estado === 'baja' || estadoPago(c).cod !== filtros.est)) return false;
    return !q || [c.nombre, c.ruc, c.cedula, c.celular, c.correo, c.contacto].join(' ').toLowerCase().includes(q);
  });
  return `
  <div class="titulo"><div><h1>Clientes</h1><p>${activos().length} activos · tocá el estado o el nombre para abrir la ficha.</p></div>
    <button class="btn pri" data-act="nuevo">+ Nuevo cliente</button></div>
  <div class="filtros">
    <input type="search" id="fq" placeholder="Buscar nombre, RUC, cédula, celular…" value="${esc(filtros.q)}">
    <select id="fest">
      ${[['activos', 'Activos'], ['venc', 'En vencimiento'], ['pronto', 'Por vencer'], ['activo', 'Al día'], ['baja', 'De baja'], ['todos', 'Todos']].map(([v, t]) => `<option value="${v}" ${filtros.est === v ? 'selected' : ''}>${t}</option>`).join('')}
    </select>
  </div>
  <div class="tabla-wrap"><table>
    <thead><tr><th>Cliente</th><th>RUC</th><th>Celular</th><th class="der">Honorario</th><th>Pago</th><th>IVA ${MES_C[Number(periodoIVAActual().slice(5)) - 1]}</th><th>Timbrado</th><th></th></tr></thead>
    <tbody>${lista.length ? lista.map(c => {
      const e = estadoPago(c), iv = estadoIVA(c, periodoIVAActual()), t = estadoTimbrado(c);
      return `<tr class="${c.estado === 'baja' ? 'baja' : ''}">
        <td><button class="link-nombre" data-act="ficha" data-id="${c.id}">${esc(c.nombre)}</button><div class="muted chico">Cliente desde ${fmtD(c.clienteDesde)}</div></td>
        <td class="num">${esc(c.ruc || '—')}</td><td class="num">${esc(c.celular || '—')}</td>
        <td class="der num">${gs(c.honorario)}<div class="muted chico">día ${esc(c.diaPago || db.ajustes.diaPagoDefecto)}</div></td>
        <td>${badgePago(c, e)}</td>
        <td>${badge(claseIVA[iv.cod], iv.cod === 'pend' || iv.cod === 'pronto' || iv.cod === 'venc' ? iv.txt + ' · ' + fmtD(iv.v).slice(0, 5) : iv.txt)}</td>
        <td>${badge(claseTim[t.cod], t.txt)}</td>
        <td><div class="acciones"><button class="btn sm" data-act="ficha" data-id="${c.id}">Ficha</button><button class="btn sm" data-act="editar" data-id="${c.id}">Editar</button></div></td></tr>`;
    }).join('') : `<tr><td colspan="8" class="vacio" style="text-align:center;padding:28px">${db.clientes.length ? 'Ningún cliente coincide con la búsqueda.' : 'Todavía no hay clientes. Tocá "+ Nuevo cliente".'}</td></tr>`}</tbody>
  </table></div>`;
};

VISTAS.cobros = () => {
  const y = filtros.anio, h = hoy();
  const anios = new Set([y, h.getFullYear(), h.getFullYear() - 1, h.getFullYear() + 1]);
  const lista = db.clientes.slice().sort(ordenNombre).filter(c => Array.from({ length: 12 }, (_, i) => y + '-' + pad(i + 1)).some(k => seCobra(c, k)));
  const tot = Array.from({ length: 12 }, () => ({ cob: 0, esp: 0 }));
  const filas = lista.map(c => {
    let fila = '<td><button class="link-nombre" data-act="ficha" data-id="' + c.id + '">' + esc(c.nombre) + '</button><div class="muted chico">' + gs(c.honorario) + ' · día ' + esc(c.diaPago || db.ajustes.diaPagoDefecto) + '</div></td>';
    let pagadoAnio = 0;
    for (let i = 0; i < 12; i++) {
      const k = y + '-' + pad(i + 1);
      if (!seCobra(c, k)) { fila += '<td><span class="celda na">·</span></td>'; continue; }
      const p = c.pagos[k];
      tot[i].esp += montoMes(c, k);
      if (p) { tot[i].cob += Number(p.monto); pagadoAnio += Number(p.monto); fila += `<td><button class="celda pagado" data-act="ficha" data-id="${c.id}" title="Pagado el ${fmtD(p.fecha)}">✓ ${new Intl.NumberFormat('es-PY').format(p.monto)}</button></td>`; }
      else if (vencePago(c, k) < h) fila += `<td><button class="celda debe" data-act="pago" data-id="${c.id}" data-mes="${k}" title="Venció el ${fmtD(vencePago(c, k))}">Debe</button></td>`;
      else fila += `<td><button class="celda pend" data-act="pago" data-id="${c.id}" data-mes="${k}" title="Vence el ${fmtD(vencePago(c, k))}">${new Intl.NumberFormat('es-PY').format(montoMes(c, k))}</button></td>`;
    }
    return '<tr>' + fila + '<td class="der num">' + gs(pagadoAnio) + '</td></tr>';
  }).join('');
  const totAnio = tot.reduce((s, t) => s + t.cob, 0);
  return `
  <div class="titulo"><div><h1>Cobros por mes</h1><p>Tocá un mes pendiente para registrar el pago. Verde: pagado · rojo: vencido · gris: todavía no vence.</p></div>
    <select id="fanio" style="width:auto">${[...anios].sort().map(a => `<option ${a === y ? 'selected' : ''}>${a}</option>`).join('')}</select></div>
  <div class="tabla-wrap"><table class="cobros">
    <thead><tr><th>Cliente</th>${MES_C.map(m => '<th>' + m + '</th>').join('')}<th class="der">Total</th></tr></thead>
    <tbody>${filas || '<tr><td colspan="14" class="vacio" style="text-align:center;padding:28px">No hay cobros para ' + y + '.</td></tr>'}</tbody>
    ${filas ? `<tfoot><tr><td>Cobrado</td>${tot.map(t => '<td>' + (t.cob ? new Intl.NumberFormat('es-PY').format(t.cob) : '—') + '</td>').join('')}<td class="der">${gs(totAnio)}</td></tr>
    <tr><td>Esperado</td>${tot.map(t => '<td>' + (t.esp ? new Intl.NumberFormat('es-PY').format(t.esp) : '—') + '</td>').join('')}<td class="der">${gs(tot.reduce((s, t) => s + t.esp, 0))}</td></tr></tfoot>` : ''}
  </table></div>
  <p class="muted chico">Los meses se cuentan desde ${mesNombre(db.ajustes.inicioControl)} (inicio del control, se cambia en Ajustes) o desde que la persona es cliente.</p>`;
};

VISTAS.vencimientos = () => {
  const per = filtros.ivaPer, act = activos().slice().sort(ordenNombre);
  const opciones = Array.from({ length: 14 }, (_, i) => sigMes(periodoIVAActual(), 1 - i));
  const ivaFilas = act.map(c => ({ c, e: estadoIVA(c, per) })).sort((a, b) => (a.e.v || 9e15) - (b.e.v || 9e15));
  const timFilas = act.map(c => ({ c, e: estadoTimbrado(c) })).sort((a, b) => (a.e.n ?? 9e9) - (b.e.n ?? 9e9));
  return `
  <div class="titulo"><div><h1>IVA y timbrados</h1><p>El IVA mensual vence en el mes siguiente, según el último dígito del RUC. Si cae fin de semana o feriado, pasa al siguiente día hábil.</p></div></div>
  <section class="panel">
    <div class="panel-cab"><h2>IVA del período</h2>
      <select id="fper" style="width:auto">${opciones.map(k => `<option value="${k}" ${k === per ? 'selected' : ''}>${mesNombre(k)}</option>`).join('')}</select></div>
    <div class="tabla-wrap"><table>
      <thead><tr><th>Cliente</th><th>RUC</th><th>Dígito</th><th>Vence</th><th>Estado</th><th></th></tr></thead>
      <tbody>${ivaFilas.map(({ c, e }) => `<tr>
        <td><button class="link-nombre" data-act="ficha" data-id="${c.id}">${esc(c.nombre)}</button></td>
        <td class="num">${esc(c.ruc || '—')}</td><td class="num">${digitoRuc(c.ruc) ?? '—'}</td>
        <td class="num">${e.v ? DIAS[e.v.getDay()].slice(0, 3) + ' ' + fmtD(e.v) : '—'}</td>
        <td>${badge(claseIVA[e.cod], e.txt)}${e.p ? '<div class="muted chico">' + fmtTs(e.p.ts) + '</div>' : ''}</td>
        <td>${e.cod === 'ok' ? `<button class="btn sm" data-act="ivaQuitar" data-id="${c.id}" data-per="${per}">Deshacer</button>` : e.v ? `<button class="btn sm pri" data-act="iva" data-id="${c.id}" data-per="${per}">Marcar presentado</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="vacio" style="text-align:center">Sin clientes activos.</td></tr>'}</tbody>
    </table></div>
    <p class="muted chico">Calendario DNIT: dígito 0 → día 7, 1 → 9, 2 → 11, 3 → 13, 4 → 15, 5 → 17, 6 → 19, 7 → 21, 8 → 23, 9 → 25. Conviene confirmarlo cada año con el calendario oficial.</p>
  </section>
  <section class="panel">
    <div class="panel-cab"><h2>Timbrados</h2>${badge('b-aviso', 'aviso ' + db.ajustes.diasTimbrado + ' días antes')}</div>
    <div class="tabla-wrap"><table>
      <thead><tr><th>Cliente</th><th>Timbrado</th><th>Vigencia</th><th>Estado</th><th></th></tr></thead>
      <tbody>${timFilas.map(({ c, e }) => `<tr>
        <td><button class="link-nombre" data-act="ficha" data-id="${c.id}">${esc(c.nombre)}</button></td>
        <td class="num">${esc(c.timbrado || '—')}</td>
        <td class="num">${c.timbradoInicio ? fmtD(c.timbradoInicio) + ' al ' : ''}${fmtD(c.timbradoVence)}</td>
        <td>${badge(claseTim[e.cod], e.txt)}</td>
        <td><button class="btn sm" data-act="editar" data-id="${c.id}">${e.cod === 'sin' ? 'Cargar' : 'Renovar'}</button></td></tr>`).join('') || '<tr><td colspan="5" class="vacio" style="text-align:center">Sin clientes activos.</td></tr>'}</tbody>
    </table></div>
  </section>`;
};

VISTAS.historial = () => {
  const q = filtros.hq.toLowerCase();
  const lista = db.historial.filter(x => !q || [x.cnom, x.accion, x.detalle, x.quien].join(' ').toLowerCase().includes(q)).slice(0, 400);
  return `
  <div class="titulo"><div><h1>Historial de cambios</h1><p>Todo lo que se hace queda registrado con fecha, hora y quién lo hizo.</p></div></div>
  <div class="filtros"><input type="search" id="fhq" placeholder="Buscar cliente o acción…" value="${esc(filtros.hq)}"></div>
  <section class="panel">${histLista(lista)}</section>`;
};
function histLista(lista) {
  if (!lista.length) return '<p class="vacio">Todavía no hay movimientos.</p>';
  return '<ul class="lista hist">' + lista.map(x => `<li>
    <div class="cuando">${fmtTs(x.ts)}<br>${esc(x.quien)}</div>
    <div class="que"><b>${esc(x.accion)}</b>${x.cnom ? ' · ' + esc(x.cnom) : ''}${x.detalle ? '<div class="cambio">' + esc(x.detalle) + '</div>' : ''}
    ${x.cambios ? x.cambios.map(ch => `<div class="cambio">${esc(ch.campo)}: <s>${esc(ch.antes || 'vacío')}</s> → <ins>${esc(ch.despues || 'vacío')}</ins></div>`).join('') : ''}</div></li>`).join('') + '</ul>';
}

VISTAS.ajustes = () => {
  const a = db.ajustes, p = a.plantillas;
  return `
  <div class="titulo"><div><h1>Ajustes</h1><p>Datos de la consultoría, avisos y copias de seguridad.</p></div></div>
  <form id="fAjustes" class="panel">
    <div class="campos">
      <div class="seccion">La consultoría</div>
      <div class="campo"><label for="a_consultoria">Nombre de la consultoría</label><input id="a_consultoria" name="consultoria" value="${esc(a.consultoria)}"></div>
      <div class="campo"><label for="a_contadora">Nombre de la contadora</label><input id="a_contadora" name="contadora" value="${esc(a.contadora)}"><div class="ayuda">Firma los mensajes y aparece en el historial.</div></div>
      <div class="campo"><label for="a_correo">Correo de la consultoría</label><input id="a_correo" name="correo" type="email" value="${esc(a.correo)}"><div class="ayuda">Desde acá saldrán los avisos automáticos.</div></div>
      <div class="campo"><label for="a_whatsapp">WhatsApp de la consultoría</label><input id="a_whatsapp" name="whatsapp" value="${esc(a.whatsapp)}" placeholder="0981 123 456"></div>
      <div class="campo full"><label for="a_datosPago">Datos para el pago (opcional)</label><input id="a_datosPago" name="datosPago" value="${esc(a.datosPago)}" placeholder="Ej.: transferencia a Banco X, cuenta 123, CI 1.234.567, o alias"><div class="ayuda">Se agrega a los mensajes de cobro.</div></div>
      <div class="seccion">Avisos</div>
      <div class="campo"><label for="a_inicio">Controlar cobros desde</label><input id="a_inicio" name="inicioControl" type="month" value="${esc(a.inicioControl)}"><div class="ayuda">Los meses anteriores no se cuentan como deuda.</div></div>
      <div class="campo"><label for="a_dia">Día de pago por defecto</label><input id="a_dia" name="diaPagoDefecto" type="number" min="1" max="31" value="${esc(a.diaPagoDefecto)}"></div>
      <div class="campo"><label for="a_dias">Recordar el pago (días antes)</label><input id="a_dias" name="diasAviso" type="number" min="1" max="20" value="${esc(a.diasAviso)}"></div>
      <div class="campo"><label for="a_tim">Avisar timbrado (días antes)</label><input id="a_tim" name="diasTimbrado" type="number" min="1" max="120" value="${esc(a.diasTimbrado)}"></div>
      <div class="campo full"><label for="a_fer">Feriados trasladados o extra (opcional)</label><input id="a_fer" name="feriadosExtra" value="${esc(a.feriadosExtra)}" placeholder="Ej.: 02/03/2026, 16/06/2026"><div class="ayuda">Los feriados fijos y la Semana Santa ya están incluidos.</div></div>
      <div class="seccion">Mensajes</div>
      <div class="campo full"><label for="p1">WhatsApp: recordatorio (antes de vencer)</label><textarea id="p1" name="p_wa5">${esc(p.wa5)}</textarea></div>
      <div class="campo full"><label for="p2">WhatsApp: pago vencido</label><textarea id="p2" name="p_waVenc">${esc(p.waVenc)}</textarea></div>
      <div class="campo full"><label for="p3">Correo: asunto</label><input id="p3" name="p_mailAsunto" value="${esc(p.mailAsunto)}"></div>
      <div class="campo full"><label for="p4">Correo: texto</label><textarea id="p4" name="p_mailCuerpo" style="min-height:180px">${esc(p.mailCuerpo)}</textarea>
        <div class="ayuda">Palabras que se reemplazan solas: {nombre} {cliente} {mes} {monto} {vence} {contadora} {consultoria} {datos_pago}</div></div>
    </div>
    <div class="acciones" style="margin-top:16px"><button class="btn pri" type="submit">Guardar ajustes</button><button class="btn" type="button" data-act="plantillasOrig">Volver a los mensajes originales</button></div>
  </form>
  <section class="panel">
    <h2>Datos</h2>
    <p class="muted chico">Mientras sea versión de prueba, los datos viven en este navegador. Descargá una copia de seguridad de vez en cuando.</p>
    <div class="acciones">
      <button class="btn" data-act="exportar">Descargar copia de seguridad</button>
      <label class="btn" style="margin:0">Restaurar copia<input type="file" id="impJson" accept=".json,application/json" hidden></label>
      <label class="btn" style="margin:0">Importar clientes (planilla CSV)<input type="file" id="impCsv" accept=".csv,text/csv" hidden></label>
      <button class="btn" data-act="plantillaCsv">Descargar planilla vacía</button>
      <button class="btn" data-act="ejemplo">Cargar datos de ejemplo</button>
      <button class="btn peligro" data-act="borrarTodo">Borrar todo</button>
    </div>
  </section>`;
};

/* ---------------- diálogos ---------------- */
const dlg = $('#dlg');
function abrirDlg(html) { $('#dlgIn').innerHTML = html; if (!dlg.open) dlg.showModal(); dlg.scrollTop = 0; }
function cerrarDlg() { if (dlg.open) dlg.close(); }
dlg.addEventListener('click', e => { if (e.target === dlg) cerrarDlg(); });

let fichaAbierta = null;
function ficha(id) {
  const c = cli(id); if (!c) return;
  fichaAbierta = id;
  const e = estadoPago(c), h = hoy(), t = estadoTimbrado(c), per = periodoIVAActual(), iv = estadoIVA(c, per);
  const desde = parseD(c.clienteDesde);
  let antig = '—';
  if (desde) { const m = (h.getFullYear() - desde.getFullYear()) * 12 + h.getMonth() - desde.getMonth() - (h.getDate() < desde.getDate() ? 1 : 0); antig = m >= 12 ? Math.floor(m / 12) + (Math.floor(m / 12) === 1 ? ' año' : ' años') + (m % 12 ? ' y ' + (m % 12) + (m % 12 === 1 ? ' mes' : ' meses') : '') : m + (m === 1 ? ' mes' : ' meses'); }
  const meses = mesesHasta(c, sigMes(mesKey(h), 1)).reverse();
  let alerta = '';
  if (e.cod === 'venc') alerta = `<div class="alerta mal"><b>En vencimiento:</b> debe ${e.meses.length > 1 ? e.meses.length + ' meses (' + e.meses.map(mesNombre).join(', ') + ')' : mesNombre(e.mes)}, total ${gs(e.deuda)}. Venció el ${fmtD(e.vence)} (${cuantoFalta(-e.dias)}).</div>`;
  else if (e.cod === 'pronto') alerta = `<div class="alerta aviso"><b>${esc(e.txt)}:</b> el pago de ${mesNombre(e.mes)} (${gs(e.deuda)}) vence el ${fmtD(e.vence)}.</div>`;
  else if (e.cod === 'activo') alerta = `<div class="alerta ok"><b>Al día.</b> Próximo pago: ${mesNombre(e.mes)}, vence el ${fmtD(e.vence)}.</div>`;
  else alerta = `<div class="alerta aviso"><b>Dado de baja</b> el ${fmtD(c.fechaBaja)}${c.motivoBaja ? ': ' + esc(c.motivoBaja) : ''}.</div>`;
  const dato = (k, v) => `<div><span>${k}</span><b>${v || '—'}</b></div>`;
  abrirDlg(`
  <div class="dlg-cab"><div><div class="muted chico">Ficha del cliente</div><h2>${esc(c.nombre)}</h2>
    <div style="margin-top:6px">${badge(e.clase, e.txt)}</div></div><button class="cerrar" data-act="cerrar" aria-label="Cerrar">×</button></div>
  <div class="dlg-cuerpo">
    ${alerta}
    <div class="caja"><div class="panel-cab" style="margin-bottom:8px"><h3>Datos</h3></div>
      <div class="ficha-datos">
        ${dato('Nombre o razón social', esc(c.nombre))}${dato('Persona de contacto', esc(c.contacto))}
        ${dato('Cédula', esc(c.cedula))}${dato('RUC', esc(c.ruc))}
        ${dato('Celular / WhatsApp', esc(c.celular))}${dato('Correo', esc(c.correo))}
        ${dato('Dirección', esc(c.direccion))}${dato('Actividad', esc(c.actividad))}
      </div>${c.notas ? '<p class="chico" style="margin:10px 0 0;white-space:pre-wrap">' + esc(c.notas) + '</p>' : ''}</div>
    <div class="caja"><h3 style="margin-bottom:8px">Vigencia y honorarios</h3>
      <div class="ficha-datos">
        ${dato('Cliente desde', fmtD(c.clienteDesde))}${dato('Antigüedad', antig)}
        ${dato('Honorario mensual', gs(c.honorario))}${dato('Vence cada mes el día', esc(c.diaPago || db.ajustes.diaPagoDefecto))}
        ${dato('IVA de ' + mesNombre(per), c.iva === 'si' ? (iv.v ? esc(iv.txt) + ' · ' + fmtD(iv.v) : esc(iv.txt)) : 'No presenta')}
        ${dato('Timbrado', c.timbrado ? esc(c.timbrado) + ' · ' + esc(t.txt) + ' (' + fmtD(c.timbradoVence) + ')' : 'Sin cargar')}
      </div></div>
    <div class="caja"><div class="panel-cab" style="margin-bottom:8px"><h3>Fechas de pago</h3>${c.estado !== 'baja' ? `<button class="btn sm pri" data-act="pago" data-id="${c.id}" data-mes="${e.mes}">Pago generado</button>` : ''}</div>
      <div class="tabla-wrap"><table>
        <thead><tr><th>Mes</th><th>Vence</th><th class="der">Monto</th><th>Estado</th><th></th></tr></thead>
        <tbody>${meses.map(k => {
          const p = c.pagos[k], v = vencePago(c, k);
          const st = p ? badge('b-ok', 'Pagado ' + fmtD(p.fecha)) : v < h ? badge('b-mal', 'Vencido') : diasEntre(h, v) <= db.ajustes.diasAviso ? badge('b-aviso', 'Vence ' + cuantoFalta(diasEntre(h, v))) : badge('b-gris', 'Pendiente');
          const extra = p ? (p.metodo ? '<div class="muted chico">' + esc(p.metodo) + (p.nota ? ' · ' + esc(p.nota) : '') + '</div>' : '') : '';
          const btn = p ? `<button class="btn sm" data-act="anular" data-id="${c.id}" data-mes="${k}">Anular</button>`
            : `<div class="acciones"><button class="btn sm pri" data-act="pago" data-id="${c.id}" data-mes="${k}">Pagó</button><button class="btn sm wa" data-act="wa" data-id="${c.id}" data-mes="${k}" data-tipo="${v < h ? 'venc' : 'pronto'}">WhatsApp</button>${v < h ? `<button class="btn sm" data-act="mail" data-id="${c.id}" data-mes="${k}">Correo</button>` : ''}</div>`;
          return `<tr><td>${mesNombre(k)}</td><td class="num">${fmtD(v)}</td><td class="der num">${gs(montoMes(c, k))}</td><td>${st}${extra}</td><td>${btn}</td></tr>`;
        }).join('') || '<tr><td colspan="5" class="vacio">Sin meses para cobrar todavía.</td></tr>'}</tbody>
      </table></div></div>
    <div class="caja"><h3 style="margin-bottom:4px">Historial del cliente</h3>${histLista(db.historial.filter(x => x.cid === c.id).slice(0, 60))}</div>
  </div>
  <div class="dlg-pie">
    ${c.estado === 'baja' ? `<button class="btn" data-act="reactivar" data-id="${c.id}">Reactivar cliente</button>` : `<button class="btn peligro" data-act="baja" data-id="${c.id}">Dar de baja</button>`}
    <button class="btn" data-act="editar" data-id="${c.id}">Editar cliente</button>
    <button class="btn pri" data-act="cerrar">Listo</button>
  </div>`);
}

const CAMPOS = [
  ['nombre', 'Nombre completo o razón social'], ['contacto', 'Persona de contacto'], ['cedula', 'Cédula'], ['ruc', 'RUC'],
  ['celular', 'Celular / WhatsApp'], ['correo', 'Correo'], ['direccion', 'Dirección'], ['actividad', 'Actividad'],
  ['clienteDesde', 'Cliente desde'], ['honorario', 'Honorario mensual'], ['diaPago', 'Día de pago'], ['iva', 'Presenta IVA'],
  ['timbrado', 'Nº de timbrado'], ['timbradoInicio', 'Inicio de vigencia del timbrado'], ['timbradoVence', 'Vencimiento del timbrado'], ['notas', 'Notas']
];
function formCliente(id) {
  const c = id ? cli(id) : { iva: 'si', clienteDesde: ymd(hoy()), diaPago: db.ajustes.diaPagoDefecto };
  const v = k => esc(c[k] == null ? '' : c[k]);
  abrirDlg(`
  <form id="fCliente" data-id="${id || ''}" novalidate>
  <div class="dlg-cab"><div><div class="muted chico">${id ? 'Editar' : 'Alta de'} cliente</div><h2>${id ? esc(c.nombre) : 'Nuevo cliente'}</h2></div><button class="cerrar" type="button" data-act="cerrar" aria-label="Cerrar">×</button></div>
  <div class="dlg-cuerpo"><div class="campos">
    <div class="seccion">Datos personales</div>
    <div class="campo full"><label for="c_nombre">Nombre completo o razón social *</label><input id="c_nombre" name="nombre" required value="${v('nombre')}"></div>
    <div class="campo"><label for="c_cedula">Cédula</label><input id="c_cedula" name="cedula" inputmode="numeric" value="${v('cedula')}" placeholder="1234567"></div>
    <div class="campo"><label for="c_ruc">RUC</label><input id="c_ruc" name="ruc" value="${v('ruc')}" placeholder="1234567-8"><div class="ayuda" id="rucAyuda"></div></div>
    <div class="campo"><label for="c_celular">Celular / WhatsApp</label><input id="c_celular" name="celular" inputmode="tel" value="${v('celular')}" placeholder="0981 123 456"></div>
    <div class="campo"><label for="c_correo">Correo electrónico</label><input id="c_correo" name="correo" type="email" value="${v('correo')}" placeholder="cliente@correo.com"></div>
    <div class="campo"><label for="c_contacto">Persona de contacto</label><input id="c_contacto" name="contacto" value="${v('contacto')}"><div class="ayuda">Si es empresa: a quién le escribimos.</div></div>
    <div class="campo"><label for="c_actividad">Actividad</label><input id="c_actividad" name="actividad" value="${v('actividad')}" placeholder="Comercio, servicios…"></div>
    <div class="campo full"><label for="c_direccion">Dirección</label><input id="c_direccion" name="direccion" value="${v('direccion')}"></div>
    <div class="seccion">Honorarios</div>
    <div class="campo"><label for="c_desde">Cliente desde</label><input id="c_desde" name="clienteDesde" type="date" value="${v('clienteDesde')}"></div>
    <div class="campo"><label for="c_hon">Honorario mensual (Gs.)</label><input id="c_hon" name="honorario" inputmode="numeric" value="${c.honorario ? new Intl.NumberFormat('es-PY').format(c.honorario) : ''}" placeholder="500.000"></div>
    <div class="campo"><label for="c_dia">Vence cada mes el día</label><input id="c_dia" name="diaPago" type="number" min="1" max="31" value="${v('diaPago')}"></div>
    <div class="seccion">IVA y timbrado</div>
    <div class="campo"><label for="c_iva">¿Presenta IVA mensual?</label><select id="c_iva" name="iva"><option value="si" ${c.iva === 'si' ? 'selected' : ''}>Sí</option><option value="no" ${c.iva === 'no' ? 'selected' : ''}>No</option></select></div>
    <div class="campo"><label for="c_tim">Nº de timbrado</label><input id="c_tim" name="timbrado" inputmode="numeric" value="${v('timbrado')}"></div>
    <div class="campo"><label for="c_timi">Vigencia desde</label><input id="c_timi" name="timbradoInicio" type="date" value="${v('timbradoInicio')}"></div>
    <div class="campo"><label for="c_timv">Vigencia hasta (vencimiento)</label><input id="c_timv" name="timbradoVence" type="date" value="${v('timbradoVence')}"></div>
    <div class="campo full"><label for="c_notas">Notas</label><textarea id="c_notas" name="notas">${v('notas')}</textarea></div>
  </div></div>
  <div class="dlg-pie"><button class="btn" type="button" data-act="cerrar">Cancelar</button><button class="btn pri" type="submit">${id ? 'Guardar cambios' : 'Crear cliente'}</button></div>
  </form>`);
  ayudaRuc();
  $('#c_ruc').addEventListener('input', ayudaRuc);
  $('#c_nombre').focus();
}
function ayudaRuc() {
  const r = $('#c_ruc'), a = $('#rucAyuda'); if (!r) return;
  const dg = digitoRuc(r.value);
  if (dg === null) { a.textContent = 'Con el RUC se calcula el vencimiento del IVA.'; return; }
  const per = periodoIVAActual(), v = venceIVA({ ruc: r.value }, per);
  a.textContent = 'Termina en ' + dg + ': el IVA vence el día ' + (7 + 2 * dg) + ' (' + mesNombre(per) + ' → ' + fmtD(v) + ').';
}
function guardarCliente(form) {
  const f = Object.fromEntries(new FormData(form));
  Object.keys(f).forEach(k => f[k] = String(f[k]).trim());
  if (!f.nombre) { toast('Falta el nombre'); $('#c_nombre').focus(); return; }
  if (f.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.correo)) { toast('Revisá el correo'); $('#c_correo').focus(); return; }
  if (f.ruc && !/^\d{3,9}(-\d)?$/.test(f.ruc.replace(/[.\s]/g, ''))) { toast('El RUC va así: 1234567-8'); $('#c_ruc').focus(); return; }
  f.ruc = f.ruc.replace(/[.\s]/g, '');
  f.cedula = f.cedula.replace(/[.\s]/g, '');
  f.honorario = Number(f.honorario.replace(/\D/g, '')) || 0;
  f.diaPago = Math.min(31, Math.max(1, Number(f.diaPago) || db.ajustes.diaPagoDefecto));
  const id = form.dataset.id;
  if (id) {
    const c = cli(id), cambios = [];
    CAMPOS.forEach(([k, et]) => {
      const a = c[k] == null ? '' : String(c[k]), b = f[k] == null ? '' : String(f[k]);
      if (a !== b) cambios.push({ campo: et, antes: k === 'honorario' ? gs(a) : a, despues: k === 'honorario' ? gs(b) : b });
    });
    if (!cambios.length) { cerrarDlg(); ficha(id); return; }
    Object.assign(c, f, { modificado: Date.now() });
    registrar(c, 'Cliente editado', '', cambios);
    guardar(); toast('Cambios guardados'); ficha(id);
  } else {
    if (f.ruc && db.clientes.some(c => c.ruc === f.ruc)) { if (!confirm('Ya hay un cliente con el RUC ' + f.ruc + '. ¿Crear igual?')) return; }
    const c = { id: nuevoId(), ...f, estado: 'activo', creado: Date.now(), pagos: {}, ivaPresentado: {}, avisos: {} };
    db.clientes.push(c);
    registrar(c, 'Cliente nuevo', 'Alta con honorario de ' + gs(c.honorario) + ', vence el día ' + c.diaPago);
    guardar(); toast('Cliente creado'); ficha(c.id);
  }
  generarAlertas(); pintar();
}

function formPago(id, mes) {
  const c = cli(id); if (!c) return;
  const h = mesKey(hoy());
  const opciones = mesesHasta(c, sigMes(h, 3)).filter(k => !c.pagos[k]);
  if (!opciones.length) { toast('No hay meses pendientes'); return; }
  if (!opciones.includes(mes)) mes = opciones[0];
  abrirDlg(`
  <form id="fPago" data-id="${id}">
  <div class="dlg-cab"><div><div class="muted chico">Pago generado</div><h2>${esc(c.nombre)}</h2></div><button class="cerrar" type="button" data-act="cerrar" aria-label="Cerrar">×</button></div>
  <div class="dlg-cuerpo"><div class="campos">
    <div class="campo"><label for="p_mes">Mes que paga</label><select id="p_mes" name="mes">${opciones.map(k => `<option value="${k}" ${k === mes ? 'selected' : ''}>${mesNombre(k)} (vence ${fmtD(vencePago(c, k))})</option>`).join('')}</select></div>
    <div class="campo"><label for="p_monto">Monto (Gs.)</label><input id="p_monto" name="monto" inputmode="numeric" value="${new Intl.NumberFormat('es-PY').format(c.honorario || 0)}"></div>
    <div class="campo"><label for="p_fecha">Fecha del pago</label><input id="p_fecha" name="fecha" type="date" value="${ymd(hoy())}"></div>
    <div class="campo"><label for="p_met">Forma de pago</label><select id="p_met" name="metodo">${['Transferencia', 'Efectivo', 'Giro', 'Depósito', 'Otro'].map(m => '<option>' + m + '</option>').join('')}</select></div>
    <div class="campo full"><label for="p_nota">Nota (opcional)</label><input id="p_nota" name="nota" placeholder="Nº de comprobante, banco…"></div>
  </div></div>
  <div class="dlg-pie"><button class="btn" type="button" data-act="cerrar">Cancelar</button><button class="btn pri" type="submit">Guardar pago</button></div>
  </form>`);
}
function guardarPago(form) {
  const c = cli(form.dataset.id), f = Object.fromEntries(new FormData(form));
  const monto = Number(String(f.monto).replace(/\D/g, ''));
  if (!monto) { toast('Falta el monto'); return; }
  c.pagos[f.mes] = { monto, fecha: f.fecha || ymd(hoy()), metodo: f.metodo, nota: String(f.nota || '').trim(), ts: Date.now() };
  registrar(c, 'Pago generado', mesNombre(f.mes) + ': ' + gs(monto) + ' (' + f.metodo + ', ' + fmtD(f.fecha) + ')' + (f.nota ? ' · ' + f.nota : ''));
  generarAlertas(); guardar(); toast('Pago registrado'); ficha(c.id); pintar();
}

/* ---------------- acciones ---------------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const { act, id, mes } = b.dataset;
  const c = id ? cli(id) : null;
  switch (act) {
    case 'cerrar': cerrarDlg(); break;
    case 'nuevo': formCliente(); break;
    case 'ficha': ficha(id); break;
    case 'editar': formCliente(id); break;
    case 'pago': formPago(id, mes); break;
    case 'wa': abrirWhatsApp(id, mes, b.dataset.tipo); if (dlg.open && fichaAbierta === id) ficha(id); break;
    case 'mail': abrirCorreo(id, mes); if (dlg.open && fichaAbierta === id) ficha(id); break;
    case 'anular':
      if (!confirm('¿Anular el pago de ' + mesNombre(mes) + '? Queda registrado en el historial.')) return;
      registrar(c, 'Pago anulado', mesNombre(mes) + ': ' + gs(c.pagos[mes].monto));
      delete c.pagos[mes]; generarAlertas(); guardar(); ficha(id); pintar(); break;
    case 'iva':
      c.ivaPresentado = c.ivaPresentado || {}; c.ivaPresentado[b.dataset.per] = { ts: Date.now() };
      registrar(c, 'IVA presentado', 'Período ' + mesNombre(b.dataset.per)); guardar(); toast('IVA marcado como presentado'); pintar(); break;
    case 'ivaQuitar':
      delete c.ivaPresentado[b.dataset.per];
      registrar(c, 'IVA desmarcado', 'Período ' + mesNombre(b.dataset.per)); guardar(); pintar(); break;
    case 'baja': {
      const motivo = prompt('Dar de baja a ' + c.nombre + '.\nNo se borra nada: queda en el historial y se puede reactivar.\n\nMotivo (opcional):');
      if (motivo === null) return;
      c.estado = 'baja'; c.fechaBaja = ymd(hoy()); c.motivoBaja = motivo.trim();
      registrar(c, 'Cliente dado de baja', motivo.trim()); guardar(); toast('Cliente dado de baja'); ficha(id); pintar(); break;
    }
    case 'reactivar':
      c.estado = 'activo'; registrar(c, 'Cliente reactivado', 'Estaba de baja desde ' + fmtD(c.fechaBaja));
      c.fechaBaja = ''; c.motivoBaja = ''; generarAlertas(); guardar(); toast('Cliente reactivado'); ficha(id); pintar(); break;
    case 'ejemplo':
      if (db.clientes.length && !confirm('Esto reemplaza los datos actuales por 13 clientes de ejemplo. ¿Seguir?')) return;
      cargarEjemplo(); break;
    case 'borrarTodo':
      if (!confirm('¿Borrar TODOS los clientes, pagos e historial de este navegador? No se puede deshacer.')) return;
      if (prompt('Para confirmar escribí BORRAR') !== 'BORRAR') return;
      db = dbNueva(); guardar(); toast('Datos borrados'); location.hash = '#inicio'; pintar(); break;
    case 'exportar': descargar('verollytemp-copia-' + ymd(hoy()) + '.json', JSON.stringify(db, null, 1), 'application/json'); registrar(null, 'Copia de seguridad descargada'); guardar(); break;
    case 'plantillaCsv': descargar('clientes-plantilla.csv', '﻿' + CSV_COLS.join(';') + '\n', 'text/csv'); break;
    case 'plantillasOrig': db.ajustes.plantillas = { ...PLANTILLAS }; guardar(); toast('Mensajes originales restaurados'); pintar(); break;
  }
});
document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'fCliente') guardarCliente(e.target);
  else if (e.target.id === 'fPago') guardarPago(e.target);
  else if (e.target.id === 'fAjustes') {
    const f = Object.fromEntries(new FormData(e.target)), a = db.ajustes, antes = JSON.stringify(a);
    ['consultoria', 'contadora', 'correo', 'whatsapp', 'datosPago', 'feriadosExtra'].forEach(k => a[k] = String(f[k] || '').trim());
    if (f.inicioControl) a.inicioControl = f.inicioControl;
    a.diaPagoDefecto = Number(f.diaPagoDefecto) || 10; a.diasAviso = Number(f.diasAviso) || 5; a.diasTimbrado = Number(f.diasTimbrado) || 30;
    ['wa5', 'waVenc', 'mailAsunto', 'mailCuerpo'].forEach(k => a.plantillas[k] = f['p_' + k] || PLANTILLAS[k]);
    if (JSON.stringify(a) !== antes) registrar(null, 'Ajustes modificados');
    generarAlertas(); guardar(); toast('Ajustes guardados');
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'fq') { filtros.q = e.target.value; refrescarConFoco('fq'); }
  if (e.target.id === 'fhq') { filtros.hq = e.target.value; refrescarConFoco('fhq'); }
  if (e.target.id === 'c_hon' || e.target.id === 'p_monto') { const n = e.target.value.replace(/\D/g, ''); e.target.value = n ? new Intl.NumberFormat('es-PY').format(n) : ''; }
});
document.addEventListener('change', e => {
  if (e.target.id === 'fest') { filtros.est = e.target.value; pintar(); }
  if (e.target.id === 'fanio') { filtros.anio = Number(e.target.value); pintar(); }
  if (e.target.id === 'fper') { filtros.ivaPer = e.target.value; pintar(); }
  if (e.target.id === 'impJson') importarJson(e.target.files[0]);
  if (e.target.id === 'impCsv') importarCsv(e.target.files[0]);
});
function refrescarConFoco(id) { const el = $('#' + id), pos = el.selectionStart; pintar(); const n = $('#' + id); n.focus(); n.setSelectionRange(pos, pos); }

function descargar(nombre, texto, tipo) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([texto], { type: tipo }));
  a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function importarJson(file) {
  if (!file) return;
  file.text().then(t => {
    const d = JSON.parse(t);
    if (!d || !Array.isArray(d.clientes)) throw new Error();
    if (!confirm('Restaurar la copia del ' + fmtTs(d.creado || Date.now()) + ' con ' + d.clientes.length + ' clientes. Reemplaza los datos actuales. ¿Seguir?')) return;
    localStorage.setItem(CLAVE, t); db = cargar(); registrar(null, 'Copia de seguridad restaurada', file.name); guardar(); toast('Copia restaurada'); pintar();
  }).catch(() => toast('Ese archivo no es una copia de VerollyTemp'));
}

const CSV_COLS = ['nombre', 'contacto', 'cedula', 'ruc', 'celular', 'correo', 'direccion', 'actividad', 'cliente_desde', 'honorario', 'dia_pago', 'presenta_iva', 'timbrado', 'timbrado_desde', 'timbrado_vence', 'notas'];
function parseCsv(t) {
  t = t.replace(/^﻿/, '');
  const sep = (t.split('\n')[0].match(/;/g) || []).length >= (t.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const filas = []; let fila = [], campo = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else q = false; } else campo += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { fila.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; fila.push(campo); campo = ''; if (fila.some(x => x.trim())) filas.push(fila); fila = []; }
    else campo += ch;
  }
  fila.push(campo); if (fila.some(x => x.trim())) filas.push(fila);
  return filas;
}
function importarCsv(file) {
  if (!file) return;
  file.text().then(t => {
    const filas = parseCsv(t); if (filas.length < 2) { toast('La planilla está vacía'); return; }
    const cab = filas[0].map(x => x.trim().toLowerCase());
    const col = k => cab.indexOf(k);
    if (col('nombre') < 0) { toast('Falta la columna "nombre"'); return; }
    let n = 0;
    filas.slice(1).forEach(f => {
      const g = k => col(k) >= 0 ? String(f[col(k)] || '').trim() : '';
      if (!g('nombre')) return;
      const c = {
        id: nuevoId(), nombre: g('nombre'), contacto: g('contacto'), cedula: g('cedula').replace(/[.\s]/g, ''), ruc: g('ruc').replace(/[.\s]/g, ''),
        celular: g('celular'), correo: g('correo'), direccion: g('direccion'), actividad: g('actividad'),
        clienteDesde: toISO(g('cliente_desde')) || ymd(hoy()), honorario: Number(g('honorario').replace(/\D/g, '')) || 0,
        diaPago: Number(g('dia_pago')) || db.ajustes.diaPagoDefecto, iva: /^n/i.test(g('presenta_iva')) ? 'no' : 'si',
        timbrado: g('timbrado'), timbradoInicio: toISO(g('timbrado_desde')), timbradoVence: toISO(g('timbrado_vence')), notas: g('notas'),
        estado: 'activo', creado: Date.now(), pagos: {}, ivaPresentado: {}, avisos: {}
      };
      db.clientes.push(c); registrar(c, 'Cliente nuevo', 'Importado desde ' + file.name); n++;
    });
    generarAlertas(); guardar(); toast(n + ' clientes importados'); location.hash = '#clientes'; pintar();
  });
}

/* ---------------- datos de ejemplo (ficticios) ---------------- */
function cargarEjemplo() {
  db = dbNueva();
  const h = hoy(), act = mesKey(h), ant = sigMes(act, -1);
  Object.assign(db.ajustes, { consultoria: 'Consultoría de ejemplo', contadora: 'Contadora de prueba', correo: 'consultoria@ejemplo.com', inicioControl: ant });
  const base = [
    ['Ferretería El Tornillo', '80012340-1', 650000, 5], ['Juan Pérez (ejemplo)', '1234561-7', 350000, 10], ['Panadería Doña Rosa', '4567892-0', 400000, 10],
    ['Distribuidora Norte S.A.', '80054323-5', 1500000, 15], ['María González (ejemplo)', '3456784-2', 300000, 20], ['Taller Mecánico Rápido', '2345675-9', 450000, h.getDate() + 3 > 28 ? 28 : h.getDate() + 3],
    ['Farmacia Central', '80098766-3', 900000, 10], ['Estudio Jurídico Ruiz', '5678907-4', 700000, 25], ['Carlos Benítez (ejemplo)', '4321098-6', 350000, h.getDate() + 1 > 28 ? 28 : h.getDate() + 1],
    ['Librería Escolar Sur', '80076549-8', 550000, 5], ['Constructora Horizonte', '80033332-2', 1200000, 30], ['Ana Martínez (ejemplo)', '6789013-1', 300000, 12], ['Veterinaria Patitas', '3210984-0', 480000, 8]
  ];
  base.forEach(([nombre, ruc, hon, dia], i) => {
    const c = {
      id: nuevoId() + i, nombre, contacto: '', cedula: ruc.startsWith('800') ? '' : ruc.split('-')[0], ruc,
      celular: '0981' + String(100000 + i * 7919).slice(0, 6), correo: 'cliente' + (i + 1) + '@ejemplo.com', direccion: 'Asunción', actividad: '',
      clienteDesde: ymd(new Date(h.getFullYear() - (i % 4), (i * 5) % 12, 1 + i)), honorario: hon, diaPago: dia, iva: i === 4 ? 'no' : 'si',
      timbrado: String(17000000 + i * 3571), timbradoInicio: '', timbradoVence: ymd(addDias(h, [12, 200, 25, -3, 340, 150, 60, 8, 280, 400, 90, 31, 180][i])),
      notas: '', estado: 'activo', creado: Date.now(), pagos: {}, ivaPresentado: {}, avisos: {}
    };
    if (i !== 3 && i !== 7) c.pagos[ant] = { monto: hon, fecha: ymd(vencePago(c, ant)), metodo: 'Transferencia', nota: '', ts: Date.now() };
    if (vencePago(c, act) < h && ![0, 9].includes(i)) c.pagos[act] = { monto: hon, fecha: ymd(vencePago(c, act)), metodo: 'Transferencia', nota: '', ts: Date.now() };
    if (i % 3 === 0) c.ivaPresentado[periodoIVAActual()] = { ts: Date.now() };
    db.clientes.push(c);
    registrar(c, 'Cliente nuevo', 'Dato de ejemplo');
  });
  generarAlertas(); guardar(); toast('Datos de ejemplo cargados'); location.hash = '#inicio'; pintar();
}

/* ---------------- arranque ---------------- */
$('#btnTema').addEventListener('click', tema);
window.addEventListener('hashchange', irA);
dlg.addEventListener('close', () => { fichaAbierta = null; });
reloj();
generarAlertas();
irA();
