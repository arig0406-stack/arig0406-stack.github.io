// VerollyAgender - funciones compartidas por la página de reservas, el panel y soporte.
// © VerollyAgender. Developed by ArigService.
(function () {
  const TZ = 'America/Asuncion';
  const API = (window.VEROLLY_API_URL || '').trim();
  const N = (new URLSearchParams(location.search).get('n') || '').trim().toLowerCase(); // negocio del link
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
    'septiembre', 'octubre', 'noviembre', 'diciembre'];

  /* ---------- Paletas de color (el negocio elige una en Ajustes) ---------- */
  const PALETAS = {
    indigo:    { nombre: 'Índigo',    marca: '#533afd', navy: '#1c1e54', acento: '#ea2261' },
    lavanda:   { nombre: 'Lavanda',   marca: '#7b5cc4', navy: '#3f2551', acento: '#f29fc5' },
    rosa:      { nombre: 'Rosa',      marca: '#c2255c', navy: '#43142c', acento: '#ff9f7a' },
    coral:     { nombre: 'Coral',     marca: '#c2410c', navy: '#3a1c0f', acento: '#fcc419' },
    esmeralda: { nombre: 'Esmeralda', marca: '#0b7d5d', navy: '#0b3530', acento: '#94d82d' },
    oceano:    { nombre: 'Océano',    marca: '#1864ab', navy: '#0b2847', acento: '#22b8cf' },
    dorado:    { nombre: 'Dorado',    marca: '#946200', navy: '#2d2310', acento: '#f2c94c' },
    grafito:   { nombre: 'Grafito',   marca: '#3b4252', navy: '#111418', acento: '#8f9bb3' },
    propia:    { nombre: 'Mi color' }
  };

  /* ---------- Fechas y horas (siempre hora de Paraguay) ---------- */
  function ahora() {
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date());
    const g = t => p.find(x => x.type === t).value;
    return { fecha: g('year') + '-' + g('month') + '-' + g('day'), min: Number(g('hour')) * 60 + Number(g('minute')) };
  }
  function partes(f) { return f.split('-').map(Number); }
  function sumarDias(f, n) {
    const [y, m, d] = partes(f);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  }
  function diaSemana(f) { const [y, m, d] = partes(f); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
  function diasEntre(a, b) {
    const x = partes(a), y = partes(b);
    return Math.round((Date.UTC(y[0], y[1] - 1, y[2]) - Date.UTC(x[0], x[1] - 1, x[2])) / 86400000);
  }
  function lunes(f) { return sumarDias(f, -((diaSemana(f) + 6) % 7)); }
  function diasDelMes(f) { const [y, m] = partes(f); return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function sumarMeses(f, n) {
    const [y, m] = partes(f);
    return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
  }
  function mesAnio(f) { const [y, m] = partes(f); return MESES[m - 1].charAt(0).toUpperCase() + MESES[m - 1].slice(1) + ' ' + y; }
  function min(s) {
    const m = String(s || '').match(/^(\d{1,2})[:.](\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  }
  function hhmm(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  function fechaLarga(f) { const [, m, d] = partes(f); return DIAS[diaSemana(f)] + ' ' + d + ' de ' + MESES[m - 1]; }
  function cuando(f) {
    const dif = diasEntre(ahora().fecha, f);
    if (dif === 0) return 'hoy';
    if (dif === 1) return 'mañana';
    return 'el ' + fechaLarga(f);
  }
  function etiquetaDia(f) {
    const dif = diasEntre(ahora().fecha, f);
    if (dif === 0) return 'Hoy';
    if (dif === 1) return 'Mañana';
    return DIAS_CORTO[diaSemana(f)];
  }
  function saludo() {
    const h = Math.floor(ahora().min / 60);
    if (h >= 5 && h < 12) return 'Buenos días';
    if (h >= 12 && h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  /* ---------- Formatos ---------- */
  function gs(n) { return 'Gs. ' + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function duracion(m) {
    if (m < 60) return m + ' min';
    const h = Math.floor(m / 60), r = m % 60;
    return h + ' h' + (r ? ' ' + r + ' min' : '');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function primerNombre(n) { return String(n || '').trim().split(/\s+/)[0]; }

  // Celulares de Paraguay: 0981 123 456 / 981123456 / +595 981 123456 -> 595981123456
  function celular(v) {
    let d = String(v || '').replace(/\D/g, '');
    if (d.indexOf('595') === 0) d = d.slice(3);
    if (d.charAt(0) === '0') d = d.slice(1);
    return /^9\d{8}$/.test(d) ? '595' + d : '';
  }
  function celularLindo(c) { // 595981123456 -> 0981 123 456
    const d = String(c || '').replace(/^595/, '0');
    return d.length === 10 ? d.slice(0, 4) + ' ' + d.slice(4, 7) + ' ' + d.slice(7) : d;
  }
  function wa(numero, texto) { return 'https://wa.me/' + numero + '?text=' + encodeURIComponent(texto); }
  function urlReservas(slug) { return new URL('index.html' + (slug ? '?n=' + encodeURIComponent(slug) : ''), location.href).href; }
  function urlPanel() { return new URL('panel.html', location.href).href; }

  /* ---------- Horarios libres (misma lógica que el Apps Script) ---------- */
  function libres(fecha, dur, info, ah) {
    ah = ah || ahora();
    const r = info.reglas;
    const h = info.horarios[diaSemana(fecha)];
    if (!h) return [];
    const dif = diasEntre(ah.fecha, fecha);
    if (dif < 0 || dif > r.diasAdelante) return [];
    const limite = ah.min + r.anticipacionMin;
    const res = [];
    for (let t = h.abre; t + dur <= h.cierra; t += r.intervalo) {
      const f = t + dur;
      if (dif * 1440 + t < limite) continue;
      if (h.dIni != null && h.dFin != null && t < h.dFin && f > h.dIni) continue;
      if (info.bloqueos.some(b => b.fecha === fecha && t < b.fin && f > b.ini)) continue;
      const n = info.ocupados.filter(o => o.fecha === fecha && t < o.fin && f > o.ini).length;
      if (n >= r.simultaneos) continue;
      res.push(t);
    }
    return res;
  }

  /* ---------- Conexión con el Apps Script ---------- */
  async function leer(r) {
    let j;
    try { j = await r.json(); } catch (e) { throw new Error('No pudimos conectar. Revisá tu internet y probá de nuevo.'); }
    if (!j.ok) throw new Error(j.error || 'Ocurrió un error');
    return j;
  }
  async function get(params) {
    return leer(await fetch(API + '?' + new URLSearchParams(params)));
  }
  async function post(body) {
    // text/plain evita el "preflight" CORS que Apps Script no soporta
    return leer(await fetch(API, { method: 'POST', body: JSON.stringify(body) }));
  }

  /* ---------- Modo demostración (sin Apps Script) ---------- */
  const Demo = (function () {
    const CLAVE = 'verollyAgenderDemo_v3';
    const SEM = { abre: 480, cierra: 1080, dIni: 720, dFin: 780 };
    const COMERCIO = { 1: SEM, 2: SEM, 3: SEM, 4: SEM, 5: SEM, 6: { abre: 480, cierra: 780, dIni: null, dFin: null } };
    const BARB = { abre: 540, cierra: 1200, dIni: 780, dFin: 840 };
    const CONS = { abre: 480, cierra: 1140, dIni: 720, dFin: 900 };
    const MODELOS = {
      unas: { nombre: 'Uñas / manicuría', paleta: 'rosa', pregunta: '¿Qué te hacés?', horarios: COMERCIO, servicios: [
        ['Esmaltado común', 35000, 45, 'Manos'], ['Semipermanente', 80000, 60, 'Dura hasta 3 semanas'],
        ['Kapping', 120000, 90, 'Refuerzo sobre uña natural'], ['Uñas esculpidas', 180000, 120, 'Acrílico o gel'],
        ['Pedicura', 70000, 60, 'Pies'], ['Retiro de semipermanente', 30000, 30, '']] },
      peluqueria: { nombre: 'Peluquería', paleta: 'lavanda', pregunta: '¿Qué te hacés?', horarios: COMERCIO, servicios: [
        ['Corte de dama', 60000, 45, 'Incluye lavado'], ['Corte de caballero', 40000, 30, ''], ['Brushing', 50000, 45, ''],
        ['Tintura', 200000, 120, 'Precio desde'], ['Mechas o balayage', 350000, 180, 'Precio desde'],
        ['Tratamiento capilar', 120000, 60, 'Hidratación profunda']] },
      barberia: { nombre: 'Barbería', paleta: 'grafito', pregunta: '¿Qué te hacés?',
        horarios: { 1: BARB, 2: BARB, 3: BARB, 4: BARB, 5: BARB, 6: { abre: 480, cierra: 1080, dIni: null, dFin: null } }, servicios: [
        ['Corte', 40000, 30, ''], ['Corte y barba', 60000, 45, ''], ['Barba', 30000, 30, 'Perfilado y toalla caliente'],
        ['Corte de niño', 35000, 30, 'Hasta 12 años'], ['Cejas', 15000, 15, '']] },
      estetica: { nombre: 'Estética / spa', paleta: 'esmeralda', pregunta: '¿Qué te hacés?', horarios: COMERCIO, servicios: [
        ['Limpieza facial', 150000, 60, ''], ['Depilación de piernas', 90000, 45, 'Cera'], ['Depilación de cejas', 25000, 15, ''],
        ['Masaje relajante', 180000, 60, ''], ['Lifting de pestañas', 150000, 60, '']] },
      odontologia: { nombre: 'Consultorio odontológico', paleta: 'oceano', pregunta: '¿Qué necesitás?',
        horarios: { 1: CONS, 2: CONS, 3: CONS, 4: CONS, 5: CONS, 6: { abre: 480, cierra: 720, dIni: null, dFin: null } }, servicios: [
        ['Consulta', 100000, 30, 'Primera visita o control'], ['Limpieza dental', 200000, 45, ''],
        ['Arreglo (empaste)', 250000, 45, 'Precio desde'], ['Blanqueamiento', 900000, 60, ''], ['Control de ortodoncia', 150000, 30, '']] },
      general: { nombre: 'Otro rubro', paleta: 'indigo', pregunta: '¿Qué necesitás?', horarios: COMERCIO, servicios: [
        ['Consulta', 0, 30, ''], ['Servicio completo', 0, 60, '']] }
    };

    function negocioNuevo(slug, nombre, idModelo, extra, origen) {
      const m = MODELOS[idModelo] || MODELOS.general;
      const n = {
        slug, activo: true, rubro: origen ? 'copia de ' + origen.slug : idModelo, creado: ahora().fecha,
        cfg: Object.assign({ Negocio: nombre, Descripcion: '', Pregunta: m.pregunta, WhatsApp: '', Direccion: '', Logo: '',
          Paleta: m.paleta, Color: '#533afd', VistaReservas: 'tira', VistaPanel: 'dia', EmailCalendario: '',
          IntervaloMinutos: '30', AnticipacionHoras: '2', DiasAdelante: '21', Simultaneos: '1' }, extra || {}),
        servicios: m.servicios.map(s => ({ nombre: s[0], precio: s[1], duracion: s[2], detalle: s[3], activo: true })),
        horarios: JSON.parse(JSON.stringify(m.horarios)),
        bloqueos: [], turnos: []
      };
      if (origen) {
        ['Pregunta', 'Paleta', 'Color', 'VistaReservas', 'VistaPanel', 'IntervaloMinutos', 'AnticipacionHoras', 'DiasAdelante', 'Simultaneos']
          .forEach(k => { n.cfg[k] = origen.cfg[k]; });
        n.servicios = JSON.parse(JSON.stringify(origen.servicios));
        n.horarios = JSON.parse(JSON.stringify(origen.horarios));
      }
      return n;
    }

    function semilla(neg) {
      // los ejemplos caen en los próximos días que el negocio abre
      const abiertos = [];
      for (let i = 0; abiertos.length < 4 && i < 14; i++) {
        const f = sumarDias(ahora().fecha, i);
        if (neg.horarios[diaSemana(f)]) abiertos.push(f);
      }
      const [hoy, man, d2, d3] = abiertos;
      const t = (fecha, hora, s, nombre, cel, estado) => {
        const sv = neg.servicios.find(x => x.nombre === s);
        return { id: 'D' + fecha.replace(/-/g, '') + hora.replace(':', ''), fecha, hora,
          fin: hhmm(min(hora) + sv.duracion), servicio: s, precio: sv.precio, nombre, celular: cel, estado };
      };
      return [
        t(hoy, '08:00', 'Semipermanente', 'Ana Benítez', '595981111222', 'Atendido'),
        t(hoy, '09:00', 'Kapping', 'Lucía Giménez', '595982333444', 'Confirmado'),
        t(hoy, '10:30', 'Esmaltado común', 'Rosa Martínez', '595971555666', 'Pendiente'),
        t(hoy, '11:30', 'Pedicura', 'Carla Ortiz', '595991777888', 'Pendiente'),
        t(man, '09:00', 'Uñas esculpidas', 'María Fernández', '595983999000', 'Pendiente'),
        t(man, '11:00', 'Semipermanente', 'Gloria Duarte', '595985343434', 'Confirmado'),
        t(d2, '09:00', 'Kapping', 'Patricia Rolón', '595981565656', 'Pendiente'),
        t(d3, '08:00', 'Kapping', 'Natalia Vera', '595982787878', 'Pendiente'),
        t(d3, '10:00', 'Pedicura', 'Mirta Cáceres', '595983909090', 'Pendiente')
      ];
    }

    function inicial() {
      const neg = negocioNuevo('demo', 'Estudio Bella Uñas', 'unas',
        { Paleta: 'indigo', WhatsApp: '595981000000', Direccion: 'Asunción, Paraguay', Descripcion: 'Manicuría y nail art' });
      neg.turnos = semilla(neg);
      return {
        negocios: { demo: neg },
        usuarios: [
          { usuario: 'demo', clave: 'demo', nombre: 'Monse', negocio: 'demo', rol: 'dueno', activo: true, codigo: '' },
          { usuario: 'equipo', clave: 'demo', nombre: 'Alicia', negocio: 'demo', rol: 'equipo', activo: true, codigo: '' },
          { usuario: 'soporte', clave: 'demo', nombre: 'Alejandro', negocio: '', rol: 'soporte', activo: true, codigo: '' }
        ]
      };
    }
    function cargar() {
      try { const d = JSON.parse(localStorage.getItem(CLAVE)); if (d && d.negocios) return d; } catch (e) { /* nada */ }
      const d = inicial();
      guardar(d);
      return d;
    }
    function guardar(d) { localStorage.setItem(CLAVE, JSON.stringify(d)); }
    const espera = () => new Promise(r => setTimeout(r, 300));

    const num = v => Number(String(v == null ? '' : v).replace(/[^\d]/g, '')) || 0;
    const texto = (v, max) => String(v || '').replace(/[<>"]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
    function reglas(cfg) {
      return { intervalo: Math.max(5, num(cfg.IntervaloMinutos) || 30), anticipacionMin: num(cfg.AnticipacionHoras) * 60,
        diasAdelante: num(cfg.DiasAdelante) || 21, simultaneos: Math.max(1, num(cfg.Simultaneos) || 1) };
    }
    function publico(neg) {
      const c = neg.cfg;
      return { slug: neg.slug, nombre: c.Negocio, descripcion: c.Descripcion, pregunta: c.Pregunta || '¿Qué te hacés?',
        whatsapp: c.WhatsApp, direccion: c.Direccion, logo: c.Logo, color: c.Color, paleta: c.Paleta,
        vistaReservas: c.VistaReservas, vistaPanel: c.VistaPanel };
    }
    const bloqueosInfo = neg => neg.bloqueos.map(b => ({ fecha: b.fecha, ini: min(b.desde) == null ? 0 : min(b.desde), fin: min(b.hasta) == null ? 1440 : min(b.hasta) }));
    function negocioPublico(d, slug) {
      const lista = Object.values(d.negocios);
      const neg = slug ? d.negocios[slug] : lista.find(n => n.activo);
      if (!neg) throw new Error('No encontramos este negocio. Revisá el link.');
      if (!neg.activo) throw new Error('Este negocio no está tomando turnos por ahora.');
      return neg;
    }
    function usuarioDe(d, token) {
      const u = d.usuarios.find(x => 'demo:' + x.usuario === token);
      if (!u || !u.activo || !u.clave) throw new Error('SESION: Tu sesión terminó. Entrá de nuevo.');
      return u;
    }
    function sesion(d, b, editar) {
      const u = usuarioDe(d, b.token);
      let neg;
      if (u.rol === 'soporte') {
        if (!b.n) throw new Error('SOPORTE: Elegí un negocio desde la página de soporte.');
        neg = d.negocios[b.n];
      } else neg = d.negocios[u.negocio];
      if (!neg) throw new Error('No encontramos este negocio.');
      if (editar && u.rol === 'equipo') throw new Error('Tu usuario solo puede ver la agenda. Este cambio lo hace la dueña o soporte.');
      return { u, neg };
    }
    function paquete(neg, u) {
      return { ok: true, negocio: publico(neg), usuario: { usuario: u.usuario, nombre: u.nombre, rol: u.rol },
        horarios: neg.horarios, reglas: reglas(neg.cfg), ajustes: { emailCalendario: neg.cfg.EmailCalendario || '' },
        servicios: neg.servicios, bloqueos: neg.bloqueos };
    }
    function soloSoporte(d, b) {
      const u = usuarioDe(d, b.token);
      if (u.rol !== 'soporte') throw new Error('Esta parte es solo para soporte.');
      return u;
    }
    function usuarioValido(v) {
      const u = String(v || '').trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,30}$/.test(u)) throw new Error('El usuario va en minúsculas, sin espacios ni acentos (3 a 30 letras o números).');
      return u;
    }
    function correos(v) {
      const c = String(v || '').split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(Boolean);
      if (c.length > 5) throw new Error('Podés poner hasta 5 correos.');
      const malo = c.find(x => !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(x));
      if (malo) throw new Error('Revisá este correo: ' + malo);
      return c.join(', ');
    }
    const codigo = () => String(Math.floor(100000 + Math.random() * 900000));

    const acciones = {
      info(b) {
        const d = cargar(), neg = negocioPublico(d, b.n), hoy = ahora().fecha;
        const ocupados = neg.turnos.filter(t => t.estado !== 'Cancelado' && t.fecha >= hoy)
          .map(t => ({ fecha: t.fecha, ini: min(t.hora), fin: min(t.fin) }));
        return { ok: true, negocio: publico(neg), reglas: reglas(neg.cfg),
          servicios: neg.servicios.filter(s => s.activo).map(s => ({ nombre: s.nombre, precio: s.precio, duracion: s.duracion, detalle: s.detalle })),
          horarios: neg.horarios, bloqueos: bloqueosInfo(neg), ocupados };
      },
      reservar(b) {
        const cel = celular(b.celular);
        if (!b.nombre || b.nombre.trim().length < 2) throw new Error('Escribí tu nombre');
        if (!cel) throw new Error('Revisá el número de celular (ej: 0981 123 456)');
        const d = cargar(), neg = negocioPublico(d, b.n);
        const sv = neg.servicios.find(s => s.nombre === b.servicio && s.activo);
        if (!sv) throw new Error('Ese servicio ya no está disponible');
        const info = acciones.info(b);
        if (libres(b.fecha, sv.duracion, info).indexOf(min(b.hora)) === -1)
          throw new Error('Ese horario se acaba de ocupar. Elegí otro, por favor.');
        const turno = { id: 'D' + Date.now(), fecha: b.fecha, hora: b.hora, fin: hhmm(min(b.hora) + sv.duracion),
          servicio: sv.nombre, precio: sv.precio, nombre: b.nombre.trim(), celular: cel, estado: 'Pendiente' };
        neg.turnos.push(turno);
        guardar(d);
        return { ok: true, turno };
      },
      login(b) {
        const d = cargar(), u = d.usuarios.find(x => x.usuario === String(b.usuario).trim().toLowerCase());
        if (u && u.activo && !u.clave && u.codigo) throw new Error('ACTIVAR: Es tu primera vez. Tocá "Activar mi cuenta" y usá el código que te dimos.');
        if (!u || !u.activo || u.clave !== b.clave) throw new Error('Usuario o contraseña incorrectos');
        return { ok: true, token: 'demo:' + u.usuario, nombre: u.nombre, rol: u.rol, negocio: u.negocio };
      },
      activar(b) {
        const d = cargar(), u = d.usuarios.find(x => x.usuario === String(b.usuario).trim().toLowerCase());
        if (!u || !u.activo || !u.codigo || String(b.codigo).trim() !== u.codigo) throw new Error('Usuario o código de activación incorrectos');
        if (String(b.clave || '').length < 6) throw new Error('La contraseña tiene que tener al menos 6 caracteres.');
        u.clave = b.clave; u.codigo = '';
        if (texto(b.nombre, 40)) u.nombre = texto(b.nombre, 40);
        guardar(d);
        return { ok: true, token: 'demo:' + u.usuario, nombre: u.nombre, rol: u.rol, negocio: u.negocio };
      },
      clave(b) {
        const d = cargar(), u = usuarioDe(d, b.token);
        if (u.clave !== b.actual) throw new Error('La contraseña actual no es correcta.');
        if (String(b.nueva || '').length < 6) throw new Error('La contraseña nueva tiene que tener al menos 6 caracteres.');
        u.clave = b.nueva; guardar(d);
        return { ok: true, token: b.token };
      },
      panel(b) {
        const d = cargar(), { u, neg } = sesion(d, b);
        const turnos = neg.turnos.filter(t => t.fecha >= b.desde && t.fecha <= b.hasta)
          .sort((x, y) => (x.fecha + x.hora).localeCompare(y.fecha + y.hora));
        return Object.assign(paquete(neg, u), { turnos });
      },
      estado(b) {
        const d = cargar(), { neg } = sesion(d, b);
        const t = neg.turnos.find(x => x.id === b.id);
        if (!t) throw new Error('No encontré ese turno');
        t.estado = b.estado; guardar(d);
        return { ok: true, id: b.id, estado: b.estado };
      },
      ajustes(b) {
        const edita = b.config || b.servicios || b.horarios || b.bloqueos || b.emailCalendario !== undefined;
        const d = cargar(), { u, neg } = sesion(d, b, !!edita);
        if (b.nombre !== undefined) {
          const n = texto(b.nombre, 40);
          if (!n) throw new Error('Escribí tu nombre para el saludo.');
          u.nombre = n;
        }
        const c = Object.assign({}, b.config || {});
        if (b.emailCalendario !== undefined) c.EmailCalendario = b.emailCalendario;
        if (c.Negocio !== undefined && texto(c.Negocio, 60).length < 2) throw new Error('Escribí el nombre del negocio.');
        if (c.WhatsApp) { const w = celular(c.WhatsApp); if (!w) throw new Error('Revisá el WhatsApp del negocio (ej: 0981 123 456).'); c.WhatsApp = w; }
        if (c.EmailCalendario !== undefined) c.EmailCalendario = correos(c.EmailCalendario);
        if (c.Logo && !/^https:\/\/\S+$/.test(c.Logo)) throw new Error('El logo tiene que ser un link que empiece con https://');
        if (b.servicios) {
          const vistos = {};
          b.servicios.forEach(s => {
            const nom = texto(s.nombre, 60);
            if (nom.length < 2) throw new Error('A un servicio le falta el nombre.');
            if (vistos[nom.toLowerCase()]) throw new Error('El servicio "' + nom + '" está repetido.');
            vistos[nom.toLowerCase()] = 1;
            if (num(s.duracion) < 5) throw new Error('Revisá la duración de ' + nom + '.');
          });
        }
        if (b.horarios) Object.keys(b.horarios).forEach(k => {
          const x = b.horarios[k];
          if (min(x.cierra) <= min(x.abre)) throw new Error('Revisá el horario: tiene que cerrar después de abrir.');
        });
        Object.keys(c).forEach(k => { neg.cfg[k] = typeof c[k] === 'string' ? c[k].trim() : String(c[k]); });
        if (b.servicios) neg.servicios = b.servicios.map(s => ({ nombre: texto(s.nombre, 60), precio: num(s.precio), duracion: num(s.duracion),
          detalle: texto(s.detalle, 80), activo: s.activo !== false }));
        if (b.horarios) {
          neg.horarios = {};
          Object.keys(b.horarios).forEach(k => {
            const x = b.horarios[k];
            neg.horarios[k] = { abre: min(x.abre), cierra: min(x.cierra), dIni: min(x.dIni), dFin: min(x.dFin) };
            if (neg.horarios[k].dIni == null || neg.horarios[k].dFin == null) neg.horarios[k].dIni = neg.horarios[k].dFin = null;
          });
        }
        if (b.bloqueos) neg.bloqueos = b.bloqueos.filter(x => x.fecha).map(x => ({ fecha: x.fecha, desde: x.desde || '', hasta: x.hasta || '', motivo: texto(x.motivo, 60) }));
        guardar(d);
        return paquete(neg, u);
      },
      soporte(b) {
        const d = cargar(), u = soloSoporte(d, b);
        return { ok: true, usuario: { usuario: u.usuario, nombre: u.nombre, rol: u.rol },
          negocios: Object.values(d.negocios).map(n => ({ slug: n.slug, nombre: n.cfg.Negocio, activo: n.activo, rubro: n.rubro, creado: n.creado, planilla: '' })),
          usuarios: d.usuarios.map(x => ({ usuario: x.usuario, nombre: x.nombre, negocio: x.negocio, rol: x.rol, activo: x.activo,
            pendiente: !x.clave, codigo: x.clave ? '' : x.codigo })),
          modelos: Object.keys(MODELOS).map(k => ({ id: k, nombre: MODELOS[k].nombre })) };
      },
      crearNegocio(b) {
        const d = cargar(); soloSoporte(d, b);
        const nombre = texto(b.nombre, 60);
        if (nombre.length < 2) throw new Error('Escribí el nombre del negocio.');
        const usuario = usuarioValido(b.usuario);
        if (d.usuarios.find(x => x.usuario === usuario)) throw new Error('El usuario "' + usuario + '" ya existe. Elegí otro.');
        const wa = b.whatsapp ? celular(b.whatsapp) : '';
        if (b.whatsapp && !wa) throw new Error('Revisá el WhatsApp del negocio (ej: 0981 123 456).');
        const base = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'negocio';
        let slug = base, i = 2;
        while (d.negocios[slug]) slug = base + '-' + (i++);
        const origen = b.desde ? d.negocios[b.desde] : null;
        d.negocios[slug] = negocioNuevo(slug, nombre, b.modelo, { WhatsApp: wa, EmailCalendario: b.email ? correos(b.email) : '', Direccion: texto(b.direccion, 120) }, origen);
        const cod = codigo();
        d.usuarios.push({ usuario, clave: '', nombre: texto(b.nombreDueno, 40), negocio: slug, rol: 'dueno', activo: true, codigo: cod });
        guardar(d);
        return { ok: true, negocio: { slug, nombre, planilla: '' }, usuario, codigo: cod };
      },
      crearUsuario(b) {
        const d = cargar(); soloSoporte(d, b);
        const usuario = usuarioValido(b.usuario);
        if (d.usuarios.find(x => x.usuario === usuario)) throw new Error('El usuario "' + usuario + '" ya existe. Elegí otro.');
        const rol = ['dueno', 'equipo', 'soporte'].indexOf(b.rol) === -1 ? 'dueno' : b.rol;
        if (rol !== 'soporte' && !d.negocios[b.negocio]) throw new Error('Elegí a qué negocio pertenece.');
        const cod = codigo();
        d.usuarios.push({ usuario, clave: '', nombre: texto(b.nombre, 40), negocio: rol === 'soporte' ? '' : b.negocio, rol, activo: true, codigo: cod });
        guardar(d);
        return { ok: true, usuario, codigo: cod, negocio: b.negocio, rol };
      },
      resetUsuario(b) {
        const d = cargar(); soloSoporte(d, b);
        const u = d.usuarios.find(x => x.usuario === b.usuario);
        if (!u) throw new Error('No encontré ese usuario.');
        u.clave = ''; u.codigo = codigo(); u.activo = true; guardar(d);
        return { ok: true, usuario: u.usuario, codigo: u.codigo };
      },
      estadoUsuario(b) {
        const d = cargar(), yo = soloSoporte(d, b);
        const u = d.usuarios.find(x => x.usuario === b.usuario);
        if (!u) throw new Error('No encontré ese usuario.');
        if (u.usuario === yo.usuario) throw new Error('No podés bloquear tu propio usuario.');
        u.activo = !!b.activo; guardar(d);
        return { ok: true, usuario: u.usuario, activo: u.activo };
      },
      estadoNegocio(b) {
        const d = cargar(); soloSoporte(d, b);
        const n = d.negocios[b.slug];
        if (!n) throw new Error('No encontré ese negocio.');
        n.activo = !!b.activo; guardar(d);
        return { ok: true, slug: b.slug, activo: n.activo };
      }
    };

    return {
      async llamar(accion, b) {
        await espera();
        if (!acciones[accion]) throw new Error('Acción desconocida');
        return acciones[accion](b);
      },
      reiniciar() { localStorage.removeItem(CLAVE); }
    };
  })();

  const demo = !API;
  const llamar = (accion, body) => {
    const b = Object.assign({ n: N }, body);
    return demo ? Demo.llamar(accion, b) : post(Object.assign({ accion }, b));
  };
  const api = {
    info: () => demo ? Demo.llamar('info', { n: N }) : get({ accion: 'info', n: N }),
    reservar: d => llamar('reservar', d),
    login: (usuario, clave) => llamar('login', { usuario, clave }),
    activar: (usuario, codigo, clave, nombre) => llamar('activar', { usuario, codigo, clave, nombre }),
    clave: (token, actual, nueva) => llamar('clave', { token, actual, nueva }),
    panel: (token, desde, hasta) => llamar('panel', { token, desde, hasta }),
    estado: (token, id, estado) => llamar('estado', { token, id, estado }),
    ajustes: (token, cambios) => llamar('ajustes', Object.assign({ token }, cambios)),
    soporte: token => llamar('soporte', { token }),
    crearNegocio: (token, d) => llamar('crearNegocio', Object.assign({ token }, d)),
    crearUsuario: (token, d) => llamar('crearUsuario', Object.assign({ token }, d)),
    resetUsuario: (token, usuario) => llamar('resetUsuario', { token, usuario }),
    estadoUsuario: (token, usuario, activo) => llamar('estadoUsuario', { token, usuario, activo }),
    estadoNegocio: (token, slug, activo) => llamar('estadoNegocio', { token, slug, activo })
  };

  /* ---------- Marca del negocio: colores, nombre y logo ---------- */
  function coloresDe(n) {
    const p = PALETAS[n.paleta];
    if (p && p.marca) return p;
    const marca = /^#[0-9a-f]{6}$/i.test(n.color || '') ? n.color : '#533afd';
    return { marca, navy: 'color-mix(in srgb, ' + marca + ' 32%, #0b0d1f)', acento: 'color-mix(in srgb, ' + marca + ' 45%, #ff8fab)' };
  }
  function aplicarColores(n) {
    const c = coloresDe(n), r = document.documentElement.style;
    r.setProperty('--marca', c.marca);
    r.setProperty('--navy', c.navy);
    r.setProperty('--acento', c.acento);
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta && /^#/.test(c.marca)) meta.content = c.marca;
  }
  function aplicarMarca(n) {
    aplicarColores(n);
    document.querySelectorAll('[data-negocio]').forEach(e => { e.textContent = n.nombre; });
    document.querySelectorAll('[data-logo]').forEach(e => {
      e.innerHTML = n.logo
        ? '<img src="' + esc(n.logo) + '" alt="">'
        : '<span>' + esc((n.nombre || '?').trim().charAt(0).toUpperCase()) + '</span>';
    });
    if (demo) document.body.classList.add('modo-demo');
  }

  /* ---------- Pie de derechos ---------- */
  function pie() {
    document.querySelectorAll('[data-copy]').forEach(e => {
      e.innerHTML = '© ' + new Date().getFullYear() + ' VerollyAgender. All rights reserved. Developed by <b>ArigService</b>.';
    });
  }
  pie();
  if (demo) document.body.classList.add('modo-demo');

  window.V = { demo, api, Demo, N, PALETAS, ahora, sumarDias, diaSemana, diasEntre, lunes, diasDelMes, sumarMeses, mesAnio,
    min, hhmm, fechaLarga, cuando, etiquetaDia, saludo, gs, duracion, esc, primerNombre, celular, celularLindo, wa,
    urlReservas, urlPanel, libres, aplicarMarca, aplicarColores, coloresDe, pie, TZ, MESES, DIAS_CORTO };
})();
