/**
 * ============================================================
 * Reportes.gs — Generación y envío de informes por correo
 * ============================================================
 */

/**
 * Genera y envía un reporte de cambios por email.
 * @param {object} cambios — Resultado de sincronizarBaseDatos()
 * @param {object[]} traslapos — Lista de traslapos detectados
 * @param {object[]} pendientes — Eventos sin clasificar
 */
function enviarReporteCambios(cambios, traslapos, pendientes) {
  const email     = leerConfig('EMAIL_REPORTES') || EMAIL_REPORTES;
  const ahora     = new Date();
  const asunto    = `[PROGRAMACIÓN] Reporte de sincronización — ${formatFechaHora(ahora)}`;

  let cuerpo = `
<html><body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
<h2 style="color: #2c5282;">📅 Reporte de Sincronización del Calendario</h2>
<p><strong>Fecha y hora:</strong> ${formatFechaHora(ahora)}</p>
<hr>
`;

  // ── RESUMEN ────────────────────────────────────────────────
  cuerpo += `
<h3 style="color: #2d6a4f;">📊 Resumen de Cambios</h3>
<table border="1" cellpadding="8" style="border-collapse:collapse; width:100%;">
  <tr style="background:#2d6a4f; color:white;">
    <th>Tipo de cambio</th><th>Cantidad</th>
  </tr>
  <tr><td>✅ Nuevos eventos</td><td>${cambios.nuevos.length}</td></tr>
  <tr><td>📝 Eventos modificados</td><td>${cambios.modificados.length}</td></tr>
  <tr><td>🗑️ Eventos eliminados</td><td>${cambios.eliminados.length}</td></tr>
  <tr><td>⚠️ Pendientes de clasificar</td><td>${pendientes.length}</td></tr>
  <tr><td>🔴 Traslapos detectados</td><td>${traslapos.length}</td></tr>
</table>
`;

  // ── NUEVOS EVENTOS ─────────────────────────────────────────
  if (cambios.nuevos.length > 0) {
    cuerpo += `<h3 style="color:#276749;">✅ Nuevos Eventos (${cambios.nuevos.length})</h3>
<table border="1" cellpadding="6" style="border-collapse:collapse; width:100%; font-size:12px;">
<tr style="background:#c6f6d5;"><th>Título</th><th>Fecha</th><th>Espacio</th><th>Tipo</th></tr>`;
    cambios.nuevos.forEach(ev => {
      cuerpo += `<tr>
        <td>${ev.titulo}</td>
        <td>${formatFechaHora(ev.fechaInicio)}</td>
        <td>${ev.espacio || '⚠️'}</td>
        <td>${ev.tipo ? (ETIQUETAS_TIPO[ev.tipo] || ev.tipo) : '⚠️'}</td>
      </tr>`;
    });
    cuerpo += '</table>';
  }

  // ── MODIFICADOS ─────────────────────────────────────────────
  if (cambios.modificados.length > 0) {
    cuerpo += `<h3 style="color:#744210;">📝 Eventos Modificados (${cambios.modificados.length})</h3>
<table border="1" cellpadding="6" style="border-collapse:collapse; width:100%; font-size:12px;">
<tr style="background:#fefcbf;"><th>Título</th><th>Nueva Fecha</th><th>Espacio</th></tr>`;
    cambios.modificados.forEach(ev => {
      cuerpo += `<tr>
        <td>${ev.titulo}</td>
        <td>${formatFechaHora(ev.fechaInicio)}</td>
        <td>${ev.espacio || '⚠️'}</td>
      </tr>`;
    });
    cuerpo += '</table>';
  }

  // ── ELIMINADOS ─────────────────────────────────────────────
  if (cambios.eliminados.length > 0) {
    cuerpo += `<h3 style="color:#742a2a;">🗑️ Eventos Eliminados (${cambios.eliminados.length})</h3>
<ul>`;
    cambios.eliminados.forEach(ev => {
      cuerpo += `<li>${ev.titulo} (ID: ${ev.id})</li>`;
    });
    cuerpo += '</ul>';
  }

  // ── TRASLAPOS ──────────────────────────────────────────────
  if (traslapos.length > 0) {
    cuerpo += `<h3 style="color:#c53030;">🔴 Traslapos Detectados (${traslapos.length})</h3>
<table border="1" cellpadding="6" style="border-collapse:collapse; width:100%; font-size:12px;">
<tr style="background:#fed7d7;"><th>Espacio</th><th>Evento A</th><th>Evento B</th></tr>`;
    traslapos.forEach(t => {
      cuerpo += `<tr>
        <td>${t.espacio}</td>
        <td>${t.eventoA.titulo}<br>${t.eventoA.inicio} – ${t.eventoA.fin}</td>
        <td>${t.eventoB.titulo}<br>${t.eventoB.inicio} – ${t.eventoB.fin}</td>
      </tr>`;
    });
    cuerpo += '</table>';
  }

  // ── PENDIENTES ─────────────────────────────────────────────
  if (pendientes.length > 0) {
    cuerpo += `<h3 style="color:#975a16;">⚠️ Eventos Pendientes de Clasificar (${pendientes.length})</h3>
<table border="1" cellpadding="6" style="border-collapse:collapse; width:100%; font-size:12px;">
<tr style="background:#feebc8;"><th>Título</th><th>Fecha</th><th>Problema</th><th>Descripción</th></tr>`;
    pendientes.forEach(ev => {
      const problema = [];
      if (ev.pendienteEspacio) problema.push('Sin espacio');
      if (ev.pendienteTipo)    problema.push('Sin tipo');
      cuerpo += `<tr>
        <td>${ev.titulo}</td>
        <td>${formatFechaHora(ev.fechaInicio)}</td>
        <td>${problema.join(', ')}</td>
        <td style="font-size:11px;">${(ev.descripcion || '').substring(0, 100)}</td>
      </tr>`;
    });
    cuerpo += '</table>';
  }

  cuerpo += `
<hr>
<p style="font-size:11px; color:#888;">
  Este reporte fue generado automáticamente por el Sistema de Gestión de Eventos.<br>
  Intervalo de sincronización: ${leerConfig('INTERVALO_SYNC') || INTERVALO_SYNC_MINUTOS} minutos.
</p>
</body></html>`;

  try {
    GmailApp.sendEmail(email, asunto, '', { htmlBody: cuerpo });
    logRegistro('INFO', `Reporte enviado a ${email}`);
  } catch (e) {
    logRegistro('ERROR', `Error al enviar reporte: ${e.message}`);
  }
}

/**
 * Genera y envía un reporte de eventos por período.
 * @param {Date} inicio
 * @param {Date} fin
 * @param {string} [emailDestino] — si no se pasa, usa el configurado
 */
function enviarReportePeriodo(inicio, fin, emailDestino) {
  const email = emailDestino || leerConfig('EMAIL_REPORTES') || EMAIL_REPORTES;

  const bd = leerBaseDatos();
  const eventos = Object.values(bd)
    .map(entry => entry.datos)
    .filter(d => {
      // Comparar fechas
      const fi = new Date(d[COL_BD.FECHA_INICIO - 1]);
      return fi >= inicio && fi <= fin && d[COL_BD.ACCION - 1] !== 'ELIMINADO';
    });

  const asunto = `[PROGRAMACIÓN] Reporte: ${formatFecha(inicio)} al ${formatFecha(fin)}`;
  let cuerpo = `<html><body style="font-family:Arial,sans-serif;">
<h2>📅 Programación del ${formatFecha(inicio)} al ${formatFecha(fin)}</h2>
<p>Total de eventos: <strong>${eventos.length}</strong></p>
<table border="1" cellpadding="6" style="border-collapse:collapse; width:100%; font-size:12px;">
<tr style="background:#2c5282; color:white;">
  <th>Fecha</th><th>Hora</th><th>Espacio</th><th>Tipo</th><th>Título</th><th>Requerimientos</th>
</tr>`;

  eventos.sort((a, b) => new Date(a[COL_BD.FECHA_INICIO - 1]) - new Date(b[COL_BD.FECHA_INICIO - 1]));
  eventos.forEach(d => {
    cuerpo += `<tr>
      <td>${d[COL_BD.FECHA_INICIO - 1]}</td>
      <td>${d[COL_BD.FECHA_FIN    - 1]}</td>
      <td>${d[COL_BD.ESPACIO      - 1]}</td>
      <td>${d[COL_BD.TIPO         - 1]}</td>
      <td>${d[COL_BD.TITULO       - 1]}</td>
      <td style="font-size:10px;">${d[COL_BD.REQ_TECNICOS - 1]}</td>
    </tr>`;
  });

  cuerpo += '</table></body></html>';

  try {
    GmailApp.sendEmail(email, asunto, '', { htmlBody: cuerpo });
    logRegistro('INFO', `Reporte de período enviado a ${email}`);
  } catch (e) {
    logRegistro('ERROR', `Error al enviar reporte de período: ${e.message}`);
  }
}