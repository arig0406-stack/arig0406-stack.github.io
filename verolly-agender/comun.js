// VerollyAgender - funciones compartidas por la página de reservas y el panel.
(function () {
  const TZ = 'America/Asuncion';
  const API = (window.VEROLLY_API_URL || '').trim();
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
    'septiembre', 'octubre', 'noviembre', 'diciembre'];

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
    const CLAVE = 'verollyAgenderDemo_v2';
    const negocio = { nombre: 'Estudio de Uñas Vero', duena: 'Vero', whatsapp: '595981000000',
      direccion: 'Asunción, Paraguay', logo: '', color: '#533afd' };
    const reglas = { intervalo: 30, anticipacionMin: 120, diasAdelante: 21, simultaneos: 1 };
    const servicios = [
      { nombre: 'Esmaltado común', precio: 35000, duracion: 45, detalle: 'Manos' },
      { nombre: 'Semipermanente', precio: 80000, duracion: 60, detalle: 'Dura hasta 3 semanas' },
      { nombre: 'Kapping', precio: 120000, duracion: 90, detalle: 'Refuerzo sobre uña natural' },
      { nombre: 'Uñas esculpidas', precio: 180000, duracion: 120, detalle: 'Acrílico o gel' },
      { nombre: 'Corte de pelo', precio: 60000, duracion: 45, detalle: 'Incluye lavado' },
      { nombre: 'Brushing', precio: 50000, duracion: 45, detalle: '' },
      { nombre: 'Tintura', precio: 200000, duracion: 120, detalle: 'Precio desde' }
    ];
    const sem = { abre: 480, cierra: 1080, dIni: 720, dFin: 780 };
    const horarios = { 1: sem, 2: sem, 3: sem, 4: sem, 5: sem, 6: { abre: 480, cierra: 780, dIni: null, dFin: null } };

    function semilla() {
      // los ejemplos caen en los próximos días que el negocio abre
      const abiertos = [];
      for (let i = 0; abiertos.length < 4 && i < 14; i++) {
        const f = sumarDias(ahora().fecha, i);
        if (horarios[diaSemana(f)]) abiertos.push(f);
      }
      const [hoy, man, d2, d3] = abiertos;
      const t = (fecha, hora, s, nombre, cel, estado) => {
        const sv = servicios.find(x => x.nombre === s);
        return { id: 'D' + fecha.replace(/-/g, '') + hora.replace(':', ''), fecha, hora,
          fin: hhmm(min(hora) + sv.duracion), servicio: s, precio: sv.precio, nombre, celular: cel, estado };
      };
      return [
        t(hoy, '08:00', 'Semipermanente', 'Ana Benítez', '595981111222', 'Atendido'),
        t(hoy, '09:00', 'Kapping', 'Lucía Giménez', '595982333444', 'Confirmado'),
        t(hoy, '10:30', 'Esmaltado común', 'Rosa Martínez', '595971555666', 'Pendiente'),
        t(hoy, '11:30', 'Brushing', 'Carla Ortiz', '595991777888', 'Pendiente'),
        t(man, '09:00', 'Uñas esculpidas', 'María Fernández', '595983999000', 'Pendiente'),
        t(man, '11:00', 'Semipermanente', 'Gloria Duarte', '595985343434', 'Confirmado'),
        t(d2, '09:00', 'Tintura', 'Patricia Rolón', '595981565656', 'Pendiente'),
        t(d3, '08:00', 'Kapping', 'Natalia Vera', '595982787878', 'Pendiente'),
        t(d3, '10:00', 'Corte de pelo', 'Mirta Cáceres', '595983909090', 'Pendiente')
      ];
    }
    function cargar() {
      try { const d = JSON.parse(localStorage.getItem(CLAVE)); if (d && d.turnos) return d; } catch (e) { /* nada */ }
      const d = { turnos: semilla() };
      guardar(d);
      return d;
    }
    function guardar(d) { localStorage.setItem(CLAVE, JSON.stringify(d)); }
    const espera = () => new Promise(r => setTimeout(r, 350));

    return {
      async info() {
        await espera();
        const hoy = ahora().fecha;
        const ocupados = cargar().turnos.filter(t => t.estado !== 'Cancelado' && t.fecha >= hoy)
          .map(t => ({ fecha: t.fecha, ini: min(t.hora), fin: min(t.fin) }));
        const pub = Object.assign({}, negocio); delete pub.duena;
        return { ok: true, negocio: pub, reglas, servicios, horarios, bloqueos: [], ocupados };
      },
      async reservar(b) {
        await espera();
        const cel = celular(b.celular);
        if (!b.nombre || b.nombre.trim().length < 2) throw new Error('Escribí tu nombre');
        if (!cel) throw new Error('Revisá el número de celular (ej: 0981 123 456)');
        const d = cargar();
        const sv = servicios.find(s => s.nombre === b.servicio);
        const info = await this.info();
        if (libres(b.fecha, sv.duracion, info).indexOf(min(b.hora)) === -1)
          throw new Error('Ese horario se acaba de ocupar. Elegí otro, por favor.');
        const turno = { id: 'D' + Date.now(), fecha: b.fecha, hora: b.hora, fin: hhmm(min(b.hora) + sv.duracion),
          servicio: sv.nombre, precio: sv.precio, nombre: b.nombre.trim(), celular: cel, estado: 'Pendiente' };
        d.turnos.push(turno);
        guardar(d);
        return { ok: true, turno };
      },
      async login(usuario, clave) {
        await espera();
        if (String(usuario).trim().toLowerCase() !== 'vero' || clave !== 'demo')
          throw new Error('Usuario o contraseña incorrectos');
        return { ok: true, token: 'demo', nombre: 'Vero' };
      },
      async activar(usuario, codigo, clave) {
        await espera();
        if (String(usuario).trim().toLowerCase() !== 'vero' || String(codigo).trim() !== '123456')
          throw new Error('Usuario o código de activación incorrectos');
        return { ok: true, token: 'demo', nombre: 'Vero' };
      },
      async panel(token, desde, hasta) {
        await espera();
        if (token !== 'demo') throw new Error('SESION: Tu sesión terminó. Entrá de nuevo.');
        const turnos = cargar().turnos.filter(t => t.fecha >= desde && t.fecha <= hasta)
          .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
        const pub = Object.assign({}, negocio); delete pub.duena;
        return { ok: true, negocio: pub, usuario: { nombre: 'Vero' }, horarios,
          ajustes: { emailCalendario: cargar().emailCalendario || '' }, turnos };
      },
      async ajustes(token, emailCalendario) {
        await espera();
        const d = cargar();
        const correos = String(emailCalendario || '').split(/[,;\s]+/).map(c => c.trim().toLowerCase()).filter(Boolean);
        if (correos.length > 5) throw new Error('Podés poner hasta 5 correos.');
        const malo = correos.find(c => !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c));
        if (malo) throw new Error('Revisá este correo: ' + malo);
        d.emailCalendario = correos.join(', ');
        guardar(d);
        return { ok: true, ajustes: { emailCalendario: d.emailCalendario } };
      },
      async estado(pin, id, estado) {
        await espera();
        const d = cargar();
        const t = d.turnos.find(x => x.id === id);
        if (!t) throw new Error('No encontré ese turno');
        t.estado = estado;
        guardar(d);
        return { ok: true, id, estado };
      },
      reiniciar() { localStorage.removeItem(CLAVE); }
    };
  })();

  const demo = !API;
  const api = {
    info: () => demo ? Demo.info() : get({ accion: 'info' }),
    reservar: d => demo ? Demo.reservar(d) : post(Object.assign({ accion: 'reservar' }, d)),
    login: (usuario, clave) => demo ? Demo.login(usuario, clave) : post({ accion: 'login', usuario, clave }),
    activar: (usuario, codigo, clave) => demo ? Demo.activar(usuario, codigo, clave) : post({ accion: 'activar', usuario, codigo, clave }),
    panel: (token, desde, hasta) => demo ? Demo.panel(token, desde, hasta) : post({ accion: 'panel', token, desde, hasta }),
    estado: (token, id, estado) => demo ? Demo.estado(token, id, estado) : post({ accion: 'estado', token, id, estado }),
    ajustes: (token, emailCalendario) => demo ? Demo.ajustes(token, emailCalendario) : post({ accion: 'ajustes', token, emailCalendario })
  };

  function aplicarMarca(n) {
    if (n.color) document.documentElement.style.setProperty('--marca', n.color);
    document.querySelectorAll('[data-negocio]').forEach(e => { e.textContent = n.nombre; });
    document.querySelectorAll('[data-logo]').forEach(e => {
      e.innerHTML = n.logo
        ? '<img src="' + esc(n.logo) + '" alt="">'
        : '<span>' + esc((n.nombre || '?').trim().charAt(0).toUpperCase()) + '</span>';
    });
    if (demo) document.body.classList.add('modo-demo');
  }

  window.V = { demo, api, Demo, ahora, sumarDias, diaSemana, diasEntre, min, hhmm, fechaLarga, cuando,
    etiquetaDia, saludo, gs, duracion, esc, primerNombre, celular, celularLindo, wa, libres, aplicarMarca, TZ };
})();
