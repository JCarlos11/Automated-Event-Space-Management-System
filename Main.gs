/**
 * ============================================================
 * Main.gs — Orquestador principal y configuración de triggers
 * ============================================================
 */

/**
 * FUNCIÓN DE INICIALIZACIÓN — Ejecutar solo una vez al inicio.
 * Crea las hojas de sistema, la leyenda de colores y el trigger.
 */
function inicializarSistema() {
  logRegistro('INFO', '=== INICIANDO SISTEMA DE GESTIÓN DE EVENTOS ===');

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── Crear hojas de sistema ────────────────────────────────
  inicializarBaseDatos();
  inicializarRegistroCambios();
  inicializarLeyenda();
  inicializarHojaConfig();
  obtenerOCrearHoja(ss, HOJAS.PENDIENTES);

  // ── Configurar trigger automático ─────────────────────────
  configurarTrigger();

  // ── Primera sincronización ────────────────────────────────
  SpreadsheetApp.flush();
  ejecutarSincronizacion();

  logRegistro('INFO', '=== SISTEMA INICIALIZADO CORRECTAMENTE ===');
  SpreadsheetApp.getUi().alert(
    '✅ Sistema inicializado correctamente.\n\n' +
    'El calendario se sincronizará cada ' + INTERVALO_SYNC_MINUTOS + ' minutos.\n' +
    'Para acceder a la app web: Extensiones > Apps Script > Implementar > App web.'
  );
}

/**
 * Función principal de sincronización. Es llamada por el trigger automático
 * y también desde la app web.
 * @returns {object} Resumen de la sincronización
 */
function ejecutarSincronizacion() {
  const inicio = new Date();
  logRegistro('INFO', `--- Inicio de sincronización: ${formatFechaHora(inicio)} ---`);

  try {
    // 1. Leer eventos del año completo del calendario
    const eventosRaw = leerEventosAnio(ANIO);

    // 2. Clasificar cada evento (espacio + tipo)
    const eventos = eventosRaw.map(ev => clasificarEvento(ev));

    // 3. Sincronizar con la BASE_DATOS y obtener cambios
    const cambios = sincronizarBaseDatos(eventos);

    // 4. Detectar traslapos
    const traslapos = detectarTraslapos(eventos.filter(e => e.estado !== 'cancelled'));

    // 5. Verificar pendientes
    const pendientes = cambios.pendientes;

    // 6. Estadísticas de verificación
    const totalCalendario = eventos.filter(e => e.estado !== 'cancelled').length;
    const totalUbicados   = eventos.filter(e => e.estado !== 'cancelled' && e.espacio).length;

    logRegistro('INFO',
      `Verificación: ${totalCalendario} eventos del calendario, ` +
      `${totalUbicados} ubicados (${totalCalendario - totalUbicados} pendientes)`
    );

    // 7. Regenerar hojas mensuales si hubo cambios
    if (cambios.nuevos.length > 0 || cambios.modificados.length > 0 || cambios.eliminados.length > 0) {
      // Solo regenerar los meses afectados para eficiencia
      const mesesAfectados = new Set();
      [...cambios.nuevos, ...cambios.modificados].forEach(ev => {
        mesesAfectados.add(ev.fechaInicio.getMonth() + 1);
      });
      mesesAfectados.forEach(mes => {
        logRegistro('INFO', `Regenerando hoja de ${NOMBRES_MESES[mes]}`);
        generarHojaMensual(mes, ANIO);
      });
    }

    // 8. Enviar reporte si hay cambios relevantes
    const hayNovedad = cambios.nuevos.length > 0 ||
                       cambios.modificados.length > 0 ||
                       cambios.eliminados.length > 0 ||
                       traslapos.length > 0 ||
                       pendientes.length > 0;

    if (hayNovedad) {
      enviarReporteCambios(cambios, traslapos, pendientes);
    }

    // 9. Actualizar timestamp de última sincronización
    escribirConfig('ULTIMA_SYNC', formatFechaHora(new Date()));
    escribirConfig('PENDIENTES_COUNT', pendientes.length);
    escribirConfig('TRASLAPOS_COUNT', traslapos.length);

    const fin = new Date();
    const duracion = Math.round((fin - inicio) / 1000);
    logRegistro('INFO',
      `--- Sincronización completada en ${duracion}s. ` +
      `Nuevos: ${cambios.nuevos.length} | Mod: ${cambios.modificados.length} | ` +
      `Elim: ${cambios.eliminados.length} | Pendientes: ${pendientes.length} ---`
    );

    return { ok: true, cambios, traslapos, pendientes, duracion };

  } catch (e) {
    logRegistro('ERROR', `Sincronización fallida: ${e.message}\n${e.stack}`);
    return { ok: false, error: e.message };
  }
}

/**
 * Configura el trigger automático de sincronización.
 * Elimina triggers existentes del mismo nombre para evitar duplicados.
 */
function configurarTrigger() {
  // Eliminar triggers anteriores de sincronización
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'ejecutarSincronizacion') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Crear nuevo trigger
  const intervalo = parseInt(leerConfig('INTERVALO_SYNC') || INTERVALO_SYNC_MINUTOS);
  ScriptApp.newTrigger('ejecutarSincronizacion')
    .timeBased()
    .everyMinutes(intervalo)
    .create();

  logRegistro('INFO', `Trigger configurado: cada ${intervalo} minutos`);
}

/**
 * Inicializa la hoja de REGISTRO_CAMBIOS con encabezados.
 */
function inicializarRegistroCambios() {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = obtenerOCrearHoja(ss, HOJAS.REGISTRO_CAMBIOS);

  if (hoja.getLastRow() > 0) return;  // Ya inicializada

  const headers = ['FECHA Y HORA', 'TIPO', 'MENSAJE', 'DATOS ADICIONALES'];
  const rango   = hoja.getRange(1, 1, 1, headers.length);
  rango.setValues([headers]);
  rango.setBackground('#434343');
  rango.setFontColor('#ffffff');
  rango.setFontWeight('bold');
  hoja.setFrozenRows(1);
  hoja.setColumnWidth(1, 150);
  hoja.setColumnWidth(3, 400);
}

/**
 * Inicializa la hoja LEYENDA_COLORES.
 */
function inicializarLeyenda() {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = obtenerOCrearHoja(ss, HOJAS.LEYENDA);
  hoja.clearContents();
  hoja.clearFormats();

  // Título
  const titulo = hoja.getRange(1, 1, 1, 3);
  titulo.merge();
  titulo.setValue('LEYENDA DE COLORES — TIPOS DE ACTIVIDAD');
  titulo.setBackground('#2c5282');
  titulo.setFontColor('#ffffff');
  titulo.setFontWeight('bold');
  titulo.setFontSize(13);
  titulo.setHorizontalAlignment('center');

  // Encabezados
  const headers = hoja.getRange(2, 1, 1, 3);
  headers.setValues([['TIPO DE ACTIVIDAD', 'COLOR', 'CÓDIGO HEX']]);
  headers.setBackground('#434343');
  headers.setFontColor('#ffffff');
  headers.setFontWeight('bold');

  // Entradas
  const entradas = Object.entries(COLORES_TIPO);
  entradas.forEach(([clave, color], i) => {
    const fila = i + 3;
    hoja.getRange(fila, 1).setValue(ETIQUETAS_TIPO[clave] || clave);
    hoja.getRange(fila, 2).setBackground(color).setValue('       ');
    hoja.getRange(fila, 3).setValue(color);
    hoja.getRange(fila, 1, 1, 3).setFontWeight('bold');
  });

  hoja.setColumnWidth(1, 280);
  hoja.setColumnWidth(2, 80);
  hoja.setColumnWidth(3, 100);
}

/**
 * Inicializa la hoja CONFIGURACION con valores por defecto.
 */
function inicializarHojaConfig() {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = obtenerOCrearHoja(ss, HOJAS.CONFIG);
  hoja.clearContents();

  const headers = ['PARÁMETRO', 'VALOR', 'DESCRIPCIÓN'];
  hoja.getRange(1, 1, 1, 3).setValues([headers])
    .setBackground('#434343').setFontColor('#ffffff').setFontWeight('bold');

  const defaults = [
    ['CALENDAR_ID',    CALENDAR_ID,              'ID del calendario de Google a sincronizar'],
    ['EMAIL_REPORTES', EMAIL_REPORTES,            'Correo donde se envían los reportes'],
    ['INTERVALO_SYNC', INTERVALO_SYNC_MINUTOS,    'Minutos entre sincronizaciones (mín. 1)'],
    ['CLAUDE_API_KEY', CLAUDE_API_KEY,            'API Key de Claude para clasificación IA (opcional)'],
    ['ULTIMA_SYNC',    'Nunca',                   'Timestamp de la última sincronización exitosa'],
    ['PENDIENTES_COUNT', 0,                       'Número de eventos pendientes de clasificar'],
    ['TRASLAPOS_COUNT',  0,                       'Número de traslapos detectados'],
  ];

  defaults.forEach((fila, i) => {
    hoja.getRange(i + 2, 1, 1, 3).setValues([fila]);
  });

  hoja.setColumnWidth(1, 180);
  hoja.setColumnWidth(2, 300);
  hoja.setColumnWidth(3, 350);
  hoja.setFrozenRows(1);
}