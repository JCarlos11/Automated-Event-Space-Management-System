/**
 * ============================================================
 * BaseDatos.gs — Gestión de la hoja BASE_DATOS
 * ============================================================
 * Guarda, actualiza y compara eventos.  También gestiona
 * el historial de cambios.
 * ============================================================
 */

/**
 * Inicializa la hoja BASE_DATOS con sus encabezados si no existe.
 */
function inicializarBaseDatos() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = obtenerOCrearHoja(ss, HOJAS.BASE_DATOS);

  // Si ya tiene encabezados, no hacer nada
  if (hoja.getLastRow() > 0 && hoja.getRange(1, 1).getValue() === HEADERS_BD[0]) return;

  // Escribir encabezados
  hoja.clearContents();
  const rango = hoja.getRange(1, 1, 1, HEADERS_BD.length);
  rango.setValues([HEADERS_BD]);
  rango.setBackground('#434343');
  rango.setFontColor('#ffffff');
  rango.setFontWeight('bold');
  hoja.setFrozenRows(1);

  // Ajustar anchos de columna
  hoja.setColumnWidth(COL_BD.TITULO, 250);
  hoja.setColumnWidth(COL_BD.DESCRIPCION, 300);
  hoja.setColumnWidth(COL_BD.UBICACION, 200);
  hoja.setColumnWidth(COL_BD.INVITADOS, 200);

  logRegistro('INFO', 'Hoja BASE_DATOS inicializada');
}

/**
 * Lee todos los eventos actuales de la BASE_DATOS.
 * @returns {object} mapa { id: fila_index } para búsqueda rápida
 */
function leerBaseDatos() {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(HOJAS.BASE_DATOS);
  if (!hoja || hoja.getLastRow() <= 1) return {};

  const datos = hoja.getRange(2, 1, hoja.getLastRow() - 1, HEADERS_BD.length).getValues();
  const mapa  = {};

  datos.forEach((fila, idx) => {
    const id = fila[COL_BD.ID - 1];
    if (id) {
      mapa[id] = {
        fila: idx + 2,  // fila real en la hoja (1-indexed, +1 por header)
        datos: fila
      };
    }
  });

  return mapa;
}

/**
 * Sincroniza la base de datos con los eventos del calendario.
 * Detecta: NUEVO, MODIFICADO, ELIMINADO.
 * @param {object[]} eventosCalendario — Eventos clasificados recién leídos
 * @returns {object} { nuevos, modificados, eliminados, pendientes }
 */
function sincronizarBaseDatos(eventosCalendario) {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(HOJAS.BASE_DATOS);

  const bdActual   = leerBaseDatos();
  const idsBD      = new Set(Object.keys(bdActual));
  const idsCalend  = new Set(eventosCalendario.map(e => e.id));

  const cambios = {
    nuevos:      [],
    modificados: [],
    eliminados:  [],
    pendientes:  []   // Sin espacio o tipo identificado
  };

  const ahora = new Date();

  // ── NUEVOS Y MODIFICADOS ────────────────────────────────────
  eventosCalendario.forEach(ev => {
    const filaEv = eventoAFila(ev, 'NUEVO', ahora);

    if (!idsBD.has(ev.id)) {
      // NUEVO: agregar a la hoja
      hoja.appendRow(filaEv);
      cambios.nuevos.push(ev);
      logRegistro('CAMBIO', `NUEVO evento: "${ev.titulo}" (${formatFecha(ev.fechaInicio)})`);
    } else {
      // Verificar si fue modificado comparando con los datos almacenados
      const datosBD = bdActual[ev.id].datos;
      const filaNum = bdActual[ev.id].fila;

      if (fueModificado(ev, datosBD)) {
        filaEv[COL_BD.ACCION - 1] = 'MODIFICADO';
        hoja.getRange(filaNum, 1, 1, HEADERS_BD.length).setValues([filaEv]);
        cambios.modificados.push(ev);
        logRegistro('CAMBIO', `MODIFICADO evento: "${ev.titulo}" (${formatFecha(ev.fechaInicio)})`);
      }
    }

    // Registrar pendientes (sin espacio o sin tipo)
    if (!ev.espacio || !ev.tipo) {
      cambios.pendientes.push({
        ...ev,
        pendienteEspacio: !ev.espacio,
        pendienteTipo:    !ev.tipo
      });
    }
  });

  // ── ELIMINADOS ──────────────────────────────────────────────
  idsBD.forEach(id => {
    if (!idsCalend.has(id)) {
      const filaNum = bdActual[id].fila;
      // Marcar como eliminado (no borrar físicamente para mantener historial)
      hoja.getRange(filaNum, COL_BD.ACCION).setValue('ELIMINADO');
      hoja.getRange(filaNum, COL_BD.ULTIMA_ACT).setValue(formatFechaHora(ahora));
      hoja.getRange(filaNum, 1, 1, HEADERS_BD.length).setBackground('#f4cccc');

      cambios.eliminados.push({ id, titulo: bdActual[id].datos[COL_BD.TITULO - 1] });
      logRegistro('CAMBIO', `ELIMINADO evento ID: ${id}`);
    }
  });

  // ── ACTUALIZAR HOJA DE PENDIENTES ───────────────────────────
  actualizarHojaPendientes(cambios.pendientes);

  return cambios;
}

/**
 * Convierte un objeto evento a una fila de la BASE_DATOS.
 */
function eventoAFila(ev, accion, ahora) {
  const fila = new Array(HEADERS_BD.length).fill('');
  fila[COL_BD.ID          - 1] = ev.id;
  fila[COL_BD.TITULO      - 1] = ev.titulo;
  fila[COL_BD.DESCRIPCION - 1] = ev.descripcion;
  fila[COL_BD.UBICACION   - 1] = ev.ubicacion.toLowerCase();
  fila[COL_BD.FECHA_INICIO- 1] = formatFechaHora(ev.fechaInicio);
  fila[COL_BD.FECHA_FIN   - 1] = formatFechaHora(ev.fechaFin);
  fila[COL_BD.TODO_DIA    - 1] = ev.todoDia ? 'SÍ' : 'NO';
  fila[COL_BD.ESTADO      - 1] = ev.estado;
  fila[COL_BD.CREADOR     - 1] = ev.creador;
  fila[COL_BD.INVITADOS   - 1] = ev.invitados;
  fila[COL_BD.ETIQUETAS   - 1] = ev.etiquetas;
  fila[COL_BD.ESPACIO     - 1] = ev.espacio   || '⚠️ PENDIENTE';
  fila[COL_BD.TIPO        - 1] = ev.tipo      ? (ETIQUETAS_TIPO[ev.tipo] || ev.tipo) : '⚠️ PENDIENTE';
  fila[COL_BD.ULTIMA_ACT  - 1] = formatFechaHora(ahora || new Date());
  fila[COL_BD.ACCION      - 1] = accion       || 'NUEVO';
  fila[COL_BD.REQ_TECNICOS- 1] = ev.reqTecnicos || '';
  return fila;
}

/**
 * Determina si un evento fue modificado comparando con la versión en BD.
 * @param {object} evNuevo
 * @param {Array}  filaBD — fila de datos guardada
 * @returns {boolean}
 */
function fueModificado(evNuevo, filaBD) {
  const checks = [
    [evNuevo.titulo,                           filaBD[COL_BD.TITULO      - 1]],
    [evNuevo.descripcion,                      filaBD[COL_BD.DESCRIPCION - 1]],
    [evNuevo.ubicacion.toLowerCase(),          filaBD[COL_BD.UBICACION   - 1]],
    [formatFechaHora(evNuevo.fechaInicio),     filaBD[COL_BD.FECHA_INICIO- 1]],
    [formatFechaHora(evNuevo.fechaFin),        filaBD[COL_BD.FECHA_FIN   - 1]],
    [evNuevo.estado,                           filaBD[COL_BD.ESTADO      - 1]]
  ];
  return checks.some(([nuevo, guardado]) => String(nuevo) !== String(guardado));
}

/**
 * Actualiza la hoja PENDIENTES con los eventos que no tienen espacio o tipo.
 * @param {object[]} pendientes
 */
function actualizarHojaPendientes(pendientes) {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = obtenerOCrearHoja(ss, HOJAS.PENDIENTES);

  hoja.clearContents();
  hoja.clearFormats();

  const headers = [
    'ID', 'TÍTULO', 'FECHA INICIO', 'ESPACIO', 'TIPO', 'DESCRIPCIÓN', 'PROBLEMA'
  ];
  const encRow = hoja.getRange(1, 1, 1, headers.length);
  encRow.setValues([headers]);
  encRow.setBackground('#e06666');
  encRow.setFontColor('#ffffff');
  encRow.setFontWeight('bold');

  if (pendientes.length === 0) {
    hoja.getRange(2, 1).setValue('✅ Sin pendientes en esta sincronización');
    return;
  }

  pendientes.forEach((ev, i) => {
    const problema = [];
    if (ev.pendienteEspacio) problema.push('Sin espacio identificado');
    if (ev.pendienteTipo)    problema.push('Sin tipo de actividad');

    const fila = [
      ev.id,
      ev.titulo,
      formatFechaHora(ev.fechaInicio),
      ev.espacio || '❌',
      ev.tipo    || '❌',
      ev.descripcion.substring(0, 200),
      problema.join(' | ')
    ];
    hoja.getRange(i + 2, 1, 1, headers.length).setValues([fila]);
    hoja.getRange(i + 2, 1, 1, headers.length).setBackground('#fff2cc');
  });

  logRegistro('ALERTA', `${pendientes.length} eventos pendientes de clasificación`);
}

/**
 * Busca eventos en la BASE_DATOS por ID o título parcial.
 * @param {string} termino
 * @returns {object[]}
 */
function buscarEventos(termino) {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(HOJAS.BASE_DATOS);
  if (!hoja || hoja.getLastRow() <= 1) return [];

  const datos = hoja.getRange(2, 1, hoja.getLastRow() - 1, HEADERS_BD.length).getValues();
  const termNorm = normalizarTexto(termino);

  return datos
    .filter(fila => {
      const id    = normalizarTexto(String(fila[COL_BD.ID     - 1]));
      const titulo = normalizarTexto(String(fila[COL_BD.TITULO - 1]));
      return id.includes(termNorm) || titulo.includes(termNorm);
    })
    .map(fila => ({
      id:          fila[COL_BD.ID          - 1],
      titulo:      fila[COL_BD.TITULO      - 1],
      descripcion: fila[COL_BD.DESCRIPCION - 1],
      ubicacion:   fila[COL_BD.UBICACION   - 1],
      fechaInicio: fila[COL_BD.FECHA_INICIO- 1],
      fechaFin:    fila[COL_BD.FECHA_FIN   - 1],
      espacio:     fila[COL_BD.ESPACIO     - 1],
      tipo:        fila[COL_BD.TIPO        - 1],
      accion:      fila[COL_BD.ACCION      - 1],
      reqTecnicos: fila[COL_BD.REQ_TECNICOS- 1]
    }));
}