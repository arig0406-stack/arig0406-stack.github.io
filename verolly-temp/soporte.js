/* VerollyTemp - Soporte (solo ArigService): alta de estudios contables, usuarios, códigos y accesos. */
'use strict';

const API = (window.VT_API || '').trim();
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const fmtD = ts => { if (!ts) return '—'; const d = new Date(Number(ts)); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); };
const LS = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
};
const BASE = location.href.replace(/[^/]*([?#].*)?$/, ''); // carpeta donde está la página
const ROLES = { admin: 'Dueño/a del estudio', equipo: 'Equipo', soporte: 'Soporte' };

let sesion = JSON.parse(LS.get('verollytemp_sesion') || 'null');
let datos = { estudios: [], usuarios: [] }, filtro = '';

function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2800); }
async function api(accion, extra) {
  const r = await fetch(API, { method: 'POST', body: JSON.stringify({ accion, token: sesion && sesion.token, ...(extra || {}) }) });
  const j = await r.json();
  if (j.error === 'sesion') { salir(true); throw new Error(j.msg); }
  if (j.error === 'permiso') { salir(false, 'Este usuario no es de soporte. Entrá con tu usuario de ArigService.'); throw new Error(j.msg); }
  return j;
}
const dlg = $('#dlg');
function abrirDlg(html) { $('#dlgIn').innerHTML = html; if (!dlg.open) dlg.showModal(); }
function cerrarDlg() { if (dlg.open) dlg.close(); }
dlg.addEventListener('click', e => { if (e.target === dlg) cerrarDlg(); });

/* ---------------- ingreso ---------------- */
function pantallaLogin(activar, msg) {
  document.body.classList.add('sin-sesion');
  $('#app').innerHTML = `
  <div class="login panel">
    <img src="img/verolly-temp-logo.webp" alt="VerollyTemp">
    ${activar ? `<h1>Activar usuario de soporte</h1><p class="muted">Poné el código y elegí tu contraseña.</p>
    <form id="fActivar" class="campos">
      <div class="campo full"><label for="l_u">Usuario</label><input id="l_u" name="usuario" autocomplete="username" autocapitalize="none" required></div>
      <div class="campo full"><label for="l_c">Código de activación</label><input id="l_c" name="codigo" autocapitalize="none" placeholder="abcd-1234" required></div>
      <div class="campo full"><label for="l_p">Elegí tu contraseña (8 o más)</label><input id="l_p" name="clave" type="password" autocomplete="new-password" required></div>
      <div class="campo full"><label for="l_p2">Repetila</label><input id="l_p2" name="clave2" type="password" autocomplete="new-password" required></div>
      <div class="campo full"><button class="btn pri ancho" type="submit">Activar y entrar</button></div>
    </form>
    <p class="chico"><a href="#" data-act="verLogin">Ya tengo contraseña</a></p>`
    : `<h1>Soporte</h1><p class="muted">Administración de estudios y usuarios de VerollyTemp.</p>
    <form id="fLogin" class="campos">
      <div class="campo full"><label for="l_u">Usuario</label><input id="l_u" name="usuario" autocomplete="username" autocapitalize="none" required></div>
      <div class="campo full"><label for="l_p">Contraseña</label><input id="l_p" name="clave" type="password" autocomplete="current-password" required></div>
      <div class="campo full"><button class="btn pri ancho" type="submit">Entrar</button></div>
    </form>
    <p class="chico"><a href="#" data-act="verActivar">Es mi primera vez: tengo un código de activación</a></p>`}
    <p class="login-msg" id="loginMsg">${esc(msg || '')}</p>
  </div>`;
  $('#l_u').focus();
}
async function entrar(form) {
  const f = Object.fromEntries(new FormData(form)), btn = form.querySelector('button[type=submit]');
  if (form.id === 'fActivar') {
    if (String(f.clave).length < 8) { $('#loginMsg').textContent = 'La contraseña necesita 8 caracteres o más.'; return; }
    if (f.clave !== f.clave2) { $('#loginMsg').textContent = 'Las dos contraseñas no coinciden.'; return; }
  }
  btn.disabled = true; $('#loginMsg').textContent = 'Entrando…';
  try {
    const r = await api(form.id === 'fActivar' ? 'activar' : 'login', { usuario: f.usuario, clave: f.clave, codigo: f.codigo });
    if (!r.ok) { $('#loginMsg').textContent = r.msg || 'No se pudo entrar.'; btn.disabled = false; return; }
    if (r.usuario.rol !== 'soporte') { $('#loginMsg').textContent = 'Este usuario no es de soporte. Entrá a la herramienta desde index.html.'; btn.disabled = false; return; }
    sesion = { token: r.token, usuario: r.usuario }; LS.set('verollytemp_sesion', JSON.stringify(sesion));
    await cargar();
  } catch (e) { $('#loginMsg').textContent = 'Sin conexión. Probá de nuevo.'; btn.disabled = false; }
}
function salir(vencida, msg) {
  if (sesion && !vencida && !msg) api('salir').catch(() => {});
  sesion = null; LS.set('verollytemp_sesion', null); cerrarDlg();
  pantallaLogin(false, msg || (vencida ? 'Tu sesión venció. Volvé a entrar.' : ''));
}

/* ---------------- datos ---------------- */
async function cargar() {
  $('#app').innerHTML = '<p class="vacio" style="text-align:center;padding:60px 0">Cargando…</p>';
  try {
    const r = await api('sop_listar');
    if (!r.ok) throw new Error(r.msg);
    datos = r; document.body.classList.remove('sin-sesion'); pintar();
  } catch (e) { if (sesion) $('#app').innerHTML = '<div class="panel bienvenida"><h2>No se pudo cargar</h2><p>' + esc(e.message) + '</p><button class="btn pri" onclick="location.reload()">Reintentar</button></div>'; }
}
async function accion(nombre, extra, okMsg) {
  try {
    const r = await api(nombre, extra);
    if (!r.ok) { toast(r.msg || 'No se pudo'); return null; }
    if (okMsg) toast(okMsg);
    const l = await api('sop_listar'); if (l.ok) { datos = l; pintar(); }
    return r;
  } catch (e) { toast(e.message || 'Sin conexión'); return null; }
}

const linkHerramienta = () => BASE + 'index.html';
function badgeUsuario(u) {
  if (!u.activo) return '<span class="badge b-mal">Bloqueado</span>';
  if (u.pendiente) return '<span class="badge b-aviso">Falta activar</span>';
  return '<span class="badge b-ok">Activo</span>';
}
function filaUsuario(u) {
  const yo = sesion.usuario.usuario === u.usuario;
  return `<tr class="${u.activo ? '' : 'baja'}">
    <td><b>${esc(u.nombre)}</b>${yo ? ' <span class="muted chico">(vos)</span>' : ''}<div class="muted chico">${esc(u.correo || 'sin correo')}</div></td>
    <td class="num">${esc(u.usuario)}</td><td>${esc(ROLES[u.rol] || u.rol)}</td><td>${badgeUsuario(u)}</td>
    <td><div class="acciones">
      ${yo ? '' : `<button class="btn sm" data-act="codigo" data-u="${esc(u.usuario)}">Código nuevo</button>`}
      <button class="btn sm" data-act="editarU" data-u="${esc(u.usuario)}">Editar</button>
      ${yo ? '' : `<button class="btn sm ${u.activo ? 'peligro' : ''}" data-act="bloquear" data-u="${esc(u.usuario)}">${u.activo ? 'Bloquear' : 'Desbloquear'}</button>`}
    </div></td></tr>`;
}
function tablaUsuarios(lista, vacio) {
  return `<div class="tabla-wrap"><table><thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
    <tbody>${lista.length ? lista.map(filaUsuario).join('') : `<tr><td colspan="5" class="vacio">${vacio}</td></tr>`}</tbody></table></div>`;
}

function pintar() {
  const q = filtro.toLowerCase();
  const est = datos.estudios.filter(e => !q || [e.nombre, e.slug, e.contacto, e.correo].join(' ').toLowerCase().includes(q) ||
    datos.usuarios.some(u => u.estudio === e.slug && [u.nombre, u.usuario].join(' ').toLowerCase().includes(q)));
  const sop = datos.usuarios.filter(u => u.rol === 'soporte');
  $('#app').innerHTML = `
  <div class="titulo"><div><h1>Soporte</h1><p>Hola, ${esc(sesion.usuario.nombre)}. Desde acá das de alta estudios contables y administrás sus accesos.</p></div>
    <div class="acciones"><button class="btn pri" data-act="nuevoEstudio">+ Nuevo estudio</button><button class="btn" data-act="cuenta">Mi cuenta</button></div></div>
  <div class="tiles">
    <div class="tile"><div class="k">Estudios</div><div class="v">${datos.estudios.length}</div><div class="s">${datos.estudios.filter(e => !e.activo).length} pausados</div></div>
    <div class="tile"><div class="k">Usuarios</div><div class="v">${datos.usuarios.length}</div><div class="s">${datos.usuarios.filter(u => u.pendiente).length} sin activar</div></div>
    <div class="tile"><div class="k">Bloqueados</div><div class="v">${datos.usuarios.filter(u => !u.activo).length}</div><div class="s">sin acceso</div></div>
  </div>
  <div class="filtros"><input type="search" id="fq" placeholder="Buscar estudio, contadora o usuario…" value="${esc(filtro)}"></div>
  ${est.map(e => {
    const us = datos.usuarios.filter(u => u.estudio === e.slug && u.rol !== 'soporte');
    return `<section class="panel ${e.activo ? '' : 'pausado'}">
      <div class="panel-cab"><div><h2>${esc(e.nombre)} ${e.activo ? '<span class="badge b-ok">Activo</span>' : '<span class="badge b-mal">Pausado</span>'}</h2>
        <div class="muted chico">${esc(e.contacto || '—')} · ${esc(e.correo || 'sin correo')} · ${esc(e.whatsapp || 'sin WhatsApp')} · alta ${fmtD(e.creado)} · código ${esc(e.slug)}</div></div>
        <div class="acciones">
          <a class="btn sm pri" href="index.html?e=${encodeURIComponent(e.slug)}" target="_blank" rel="noopener">Administrar</a>
          <a class="btn sm" href="${esc(e.planilla)}" target="_blank" rel="noopener">Planilla</a>
          <button class="btn sm" data-act="nuevoU" data-e="${esc(e.slug)}">+ Usuario</button>
          <button class="btn sm" data-act="editarE" data-e="${esc(e.slug)}">Editar</button>
          <button class="btn sm ${e.activo ? 'peligro' : ''}" data-act="pausar" data-e="${esc(e.slug)}">${e.activo ? 'Pausar' : 'Reactivar'}</button>
        </div></div>
      ${tablaUsuarios(us, 'Este estudio todavía no tiene usuarios.')}
    </section>`;
  }).join('') || '<section class="panel"><p class="vacio">Ningún estudio coincide con la búsqueda.</p></section>'}
  <section class="panel"><div class="panel-cab"><h2>Usuarios de soporte</h2><button class="btn sm" data-act="nuevoU" data-e="" data-rol="soporte">+ Soporte</button></div>
    <p class="muted chico" style="margin-top:0">Pueden entrar a esta página y administrar todos los estudios.</p>
    ${tablaUsuarios(sop, 'Sin usuarios de soporte.')}</section>`;
}

/* ---------------- formularios ---------------- */
function cabDlg(sub, titulo) { return `<div class="dlg-cab"><div><div class="muted chico">${sub}</div><h2>${esc(titulo)}</h2></div><button class="cerrar" type="button" data-act="cerrar" aria-label="Cerrar">×</button></div>`; }
const opcionesEstudio = sel => datos.estudios.map(e => `<option value="${esc(e.slug)}" ${e.slug === sel ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('');

function formEstudio(slug) {
  const e = slug ? datos.estudios.find(x => x.slug === slug) : {};
  abrirDlg(`<form id="fEstudio" data-slug="${esc(slug || '')}">${cabDlg(slug ? 'Editar estudio' : 'Alta de estudio contable', slug ? e.nombre : 'Nuevo estudio')}
  <div class="dlg-cuerpo"><div class="campos">
    <div class="campo full"><label for="e_n">Nombre del estudio o consultoría *</label><input id="e_n" name="nombre" required value="${esc(e.nombre)}" placeholder="Estudio Contable Ejemplo"></div>
    <div class="campo"><label for="e_d">Nombre de la contadora o dueño/a</label><input id="e_d" name="${slug ? 'contacto' : 'dueno'}" value="${esc(e.contacto)}"></div>
    ${slug ? '' : '<div class="campo"><label for="e_u">Usuario para entrar *</label><input id="e_u" name="usuario" required autocapitalize="none" placeholder="maria.gomez"><div class="ayuda">Minúsculas, sin espacios.</div></div>'}
    <div class="campo"><label for="e_c">Correo</label><input id="e_c" name="correo" type="email" value="${esc(e.correo)}"><div class="ayuda">Ahí le responden los clientes a los avisos.</div></div>
    <div class="campo"><label for="e_w">WhatsApp</label><input id="e_w" name="whatsapp" inputmode="tel" value="${esc(e.whatsapp)}" placeholder="0981 123 456"></div>
  </div>
  ${slug ? '' : '<p class="muted chico" style="margin-bottom:0">Se crea una planilla propia para el estudio y un usuario con código de activación. La persona elige su contraseña al entrar por primera vez.</p>'}</div>
  <div class="dlg-pie"><button class="btn" type="button" data-act="cerrar">Cancelar</button><button class="btn pri" type="submit">${slug ? 'Guardar' : 'Crear estudio'}</button></div></form>`);
  $('#e_n').focus();
}
function formUsuario(usuario, estudio, rol) {
  const u = usuario ? datos.usuarios.find(x => x.usuario === usuario) : { estudio, rol: rol || 'equipo' };
  const esSop = u.rol === 'soporte';
  abrirDlg(`<form id="fUsuario" data-u="${esc(usuario || '')}">${cabDlg(usuario ? 'Editar usuario' : 'Nuevo usuario', usuario ? u.nombre : (esSop ? 'Usuario de soporte' : 'Usuario del estudio'))}
  <div class="dlg-cuerpo"><div class="campos">
    <div class="campo"><label for="u_n">Nombre *</label><input id="u_n" name="nombre" required value="${esc(u.nombre)}"></div>
    ${usuario ? `<div class="campo"><label>Usuario</label><input value="${esc(u.usuario)}" disabled></div>` : '<div class="campo"><label for="u_u">Usuario *</label><input id="u_u" name="usuario" required autocapitalize="none"><div class="ayuda">Minúsculas, sin espacios.</div></div>'}
    <div class="campo"><label for="u_c">Correo</label><input id="u_c" name="correo" type="email" value="${esc(u.correo)}"></div>
    <div class="campo"><label for="u_r">Rol</label><select id="u_r" name="rol">${Object.keys(ROLES).filter(r => esSop ? r === 'soporte' : r !== 'soporte').map(r => `<option value="${r}" ${u.rol === r ? 'selected' : ''}>${ROLES[r]}</option>`).join('')}</select></div>
    ${esSop ? '' : `<div class="campo full"><label for="u_e">Estudio</label><select id="u_e" name="estudio">${opcionesEstudio(u.estudio)}</select></div>`}
  </div></div>
  <div class="dlg-pie"><button class="btn" type="button" data-act="cerrar">Cancelar</button><button class="btn pri" type="submit">${usuario ? 'Guardar' : 'Crear usuario'}</button></div></form>`);
  $('#u_n').focus();
}
function mostrarCodigo(usuario, codigo, nombre, telefono, nuevo) {
  const msg = `Hola ${nombre || ''}! ${nuevo ? 'Ya tenés acceso a VerollyTemp' : 'Te generamos un código nuevo para VerollyTemp'}.\n\n` +
    `1. Entrá a ${linkHerramienta()}\n2. Tocá "Es mi primera vez: tengo un código de activación"\n3. Usuario: ${usuario}\n4. Código: ${codigo}\n5. Elegí tu contraseña (8 o más caracteres).\n\nCualquier duda escribime. ArigService`;
  let tel = String(telefono || '').replace(/\D/g, '');
  if (tel.startsWith('0')) tel = '595' + tel.slice(1); else if (tel.length === 9 && tel.startsWith('9')) tel = '595' + tel;
  abrirDlg(`${cabDlg('Código de activación', nombre || usuario)}
  <div class="dlg-cuerpo">
    <div class="codigo-caja"><div><span>Usuario</span><b>${esc(usuario)}</b></div><div><span>Código</span><b>${esc(codigo)}</b></div></div>
    <p class="muted chico">El código sirve una sola vez. Con él la persona elige su contraseña (vos no la ves). Si lo pierde, tocá "Código nuevo".</p>
    <label for="msgWa">Mensaje para enviar</label><textarea id="msgWa" style="min-height:190px">${esc(msg)}</textarea>
  </div>
  <div class="dlg-pie"><button class="btn" type="button" data-act="copiar">Copiar mensaje</button>
    <a class="btn wa" href="https://wa.me/${tel}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Enviar por WhatsApp</a>
    <button class="btn pri" type="button" data-act="cerrar">Listo</button></div>`);
}
function formCuenta() {
  abrirDlg(`<form id="fClave">${cabDlg('Mi cuenta', sesion.usuario.nombre)}
  <div class="dlg-cuerpo"><p class="muted chico" style="margin-top:0">Usuario: ${esc(sesion.usuario.usuario)}</p><div class="campos">
    <div class="campo"><label for="k_a">Contraseña actual</label><input id="k_a" name="actual" type="password" autocomplete="current-password" required></div>
    <div class="campo"><label for="k_n">Contraseña nueva (8 o más)</label><input id="k_n" name="nueva" type="password" autocomplete="new-password" required></div>
  </div></div>
  <div class="dlg-pie"><button class="btn" type="button" data-act="salir">Cerrar sesión</button><button class="btn pri" type="submit">Cambiar contraseña</button></div></form>`);
}

/* ---------------- eventos ---------------- */
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act, u = b.dataset.u, es = b.dataset.e;
  if (b.tagName === 'A' && b.getAttribute('href') === '#') e.preventDefault();
  switch (act) {
    case 'cerrar': cerrarDlg(); break;
    case 'verActivar': pantallaLogin(true); break;
    case 'verLogin': pantallaLogin(false); break;
    case 'salir': if (confirm('¿Cerrar sesión?')) salir(); break;
    case 'cuenta': formCuenta(); break;
    case 'nuevoEstudio': formEstudio(); break;
    case 'editarE': formEstudio(es); break;
    case 'nuevoU': formUsuario(null, es, b.dataset.rol); break;
    case 'editarU': formUsuario(u); break;
    case 'pausar': {
      const est = datos.estudios.find(x => x.slug === es);
      if (!confirm(est.activo ? `¿Pausar "${est.nombre}"? Sus usuarios no van a poder entrar y no se mandan correos automáticos. No se borra nada.` : `¿Reactivar "${est.nombre}"?`)) return;
      accion('sop_editarEstudio', { slug: es, activo: !est.activo }, est.activo ? 'Estudio pausado' : 'Estudio reactivado'); break;
    }
    case 'bloquear': {
      const us = datos.usuarios.find(x => x.usuario === u);
      if (!confirm(us.activo ? `¿Bloquear a ${us.nombre}? Se cierra su sesión y no puede entrar hasta que lo desbloquees.` : `¿Desbloquear a ${us.nombre}?`)) return;
      accion('sop_editarUsuario', { usuario: u, activo: !us.activo }, us.activo ? 'Usuario bloqueado' : 'Usuario desbloqueado'); break;
    }
    case 'codigo': {
      const us = datos.usuarios.find(x => x.usuario === u);
      if (!confirm(`¿Dar un código nuevo a ${us.nombre}? Su contraseña actual deja de servir y se cierran sus sesiones.`)) return;
      const r = await accion('sop_codigo', { usuario: u });
      if (r) { const est = datos.estudios.find(x => x.slug === us.estudio) || {}; mostrarCodigo(r.usuario, r.codigo, us.nombre, est.whatsapp, false); }
      break;
    }
    case 'copiar': {
      const t = $('#msgWa').value;
      try { await navigator.clipboard.writeText(t); toast('Mensaje copiado'); } catch (err) { $('#msgWa').select(); toast('Seleccionado: copialo con Ctrl+C'); }
      break;
    }
  }
});
document.addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target, f = Object.fromEntries(new FormData(form)), btn = form.querySelector('button[type=submit]');
  if (form.id === 'fLogin' || form.id === 'fActivar') { entrar(form); return; }
  btn && (btn.disabled = true);
  try {
    if (form.id === 'fEstudio') {
      if (form.dataset.slug) { if (await accion('sop_editarEstudio', { slug: form.dataset.slug, ...f }, 'Estudio guardado')) cerrarDlg(); }
      else {
        btn.textContent = 'Creando planilla…';
        const r = await accion('sop_crearEstudio', f, 'Estudio creado');
        if (r) mostrarCodigo(r.usuario, r.codigo, f.dueno || f.nombre, f.whatsapp, true);
      }
    } else if (form.id === 'fUsuario') {
      if (form.dataset.u) { if (await accion('sop_editarUsuario', { usuario: form.dataset.u, ...f }, 'Usuario guardado')) cerrarDlg(); }
      else {
        const r = await accion('sop_crearUsuario', f, 'Usuario creado');
        if (r) { const est = datos.estudios.find(x => x.slug === f.estudio) || {}; mostrarCodigo(r.usuario, r.codigo, f.nombre, est.whatsapp, true); }
      }
    } else if (form.id === 'fClave') {
      if (String(f.nueva).length < 8) { toast('La contraseña nueva necesita 8 caracteres o más'); return; }
      const r = await api('clave', f);
      if (!r.ok) { toast(r.msg); return; }
      sesion = { token: r.token, usuario: r.usuario }; LS.set('verollytemp_sesion', JSON.stringify(sesion));
      cerrarDlg(); toast('Contraseña cambiada');
    }
  } catch (err) { toast(err.message || 'Sin conexión'); }
  finally { if (btn && document.body.contains(btn)) { btn.disabled = false; } }
});
document.addEventListener('input', e => {
  if (e.target.id === 'fq') { filtro = e.target.value; const pos = e.target.selectionStart; pintar(); const n = $('#fq'); n.focus(); n.setSelectionRange(pos, pos); }
});
$('#btnTema').addEventListener('click', () => {
  const r = document.documentElement;
  const oscuro = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  r.dataset.theme = oscuro ? 'light' : 'dark';
  LS.set('verollytemp_tema', r.dataset.theme);
});

if (!API) $('#app').innerHTML = '<div class="panel bienvenida"><h2>Falta configurar el servidor</h2><p>Completá la dirección en config.js.</p></div>';
else if (sesion && sesion.token) cargar();
else pantallaLogin(false);
