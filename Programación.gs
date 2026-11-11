/**
 * ============================================================
 * Programacion.gs — Generación de hojas mensuales formateadas
 * ============================================================
 * Crea o recrea cada hoja mensual (ENERO … DICIEMBRE) con el
 * formato visual descrito: encabezados, colores, filas de
 * montaje, y columna de pendientes.
 *
 * Estructura de columnas:
 *  A=DiaNombre  B=DiaNúmero  C=Hora  D=Polivalente  E=Talleres
 *  F=Cine  G=Terraza  H=Memorial  I=Virtual  J=Extramuros
 *  K=PendientesPorUbicar
 * ============================================================
 */

const NUM_COLS = 11;  // Total de columnas en la hoja mensual

/**
 * Genera todas las hojas mensuales del año.
 * Llama a esta función para regenerar toda la programación.
 */
function generarTodasLasHojas() {
  logRegistro('INFO', `Generando hojas mensuales para ${ANIO}`);
  for (let mes = 1; mes <= 12; mes++) {
    generarHojaMensual(mes, ANIO);
    SpreadsheetApp.flush(); // Forzar escritura al terminar cada mes
  }
  logRegistro('INFO', 'Todas las hojas mensuales generadas');
}

/**
 * Genera (o regenera) la hoja mensual de un mes específico.
 * @param {number} mes  1=Enero ... 12=Diciembre
 * @param {number} anio
 */
function generarHojaMensual(mes, anio) {
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const nombreMes = NOMBRES_MESES[mes];

  logRegistro('INFO', `Generando hoja ${nombreMes} ${anio}`);

  // Eliminar hoja previa si existe y crear una nueva limpia
  let hoja = ss.getSheetByName(nombreMes);
  if (hoja) ss.deleteSheet(hoja);
  hoja = ss.insertSheet(nombreMes);

  // Mover la hoja al lugar correcto (mes 1 = posición 3, tras configuración)
  // Las hojas de sistema van primero
  const posicion = mes + 5;  // Dejar espacio para hojas de sistema
  try { ss.moveActiveSheet(posicion); } catch (e) { /* Ignorar si falla */ }

  // Leer eventos del mes y clasificarlos
  const eventosRaw = leerEventosMes(mes, anio);
  const eventos = eventosRaw
    .filter(ev => ev.estado !== 'cancelled')
    .map(ev => clasificarEvento(ev));

  // Agrupar por día
  const eventosPorDia = agruparPorDia(eventos);

  let fila = 1;

  // ── 1. ENCABEZADO DEL MES ────────────────────────────────────
  fila = escribirEncabezadoMes(hoja, fila, mes, anio);

  // ── 2. DÍAS DEL MES ─────────────────────────────────────────
  const diasEnMes = new Date(anio, mes, 0).getDate();

  for (let dia = 1; dia <= diasEnMes; dia++) {
    const fecha = new Date(anio, mes - 1, dia);
    const eventosDelDia = (eventosPorDia[dia] || [])
      .sort((a, b) => a.fechaInicio - b.fechaInicio);

    // Encabezados de columnas para este día
    fila = escribirEncabezadoColumnas(hoja, fila, fecha);

    // Eventos de todo el día (horario laboral 11:00-18:00)
    const todoDia = eventosDelDia.filter(e => e.todoDia);
    if (todoDia.length > 0) {
      fila = escribirEventosTodoDia(hoja, fila, todoDia, fecha);
    }

    // Eventos con hora específica (ordenados cronológicamente)
    const conHora = eventosDelDia.filter(e => !e.todoDia);
    if (conHora.length > 0) {
      fila = escribirEventosConHora(hoja, fila, conHora);
    }

    // Si no hay eventos, dejar una fila vacía para el día
    if (eventosDelDia.length === 0) {
      hoja.getRange(fila, 1).setValue('Sin eventos');
      hoja.getRange(fila, 1, 1, NUM_COLS).setBackground('#f8f8f8');
      fila++;
    }

    // Espacio visual entre días
    fila++;
  }

  // ── 3. FORMATO FINAL DE LA HOJA ─────────────────────────────
  aplicarFormatoFinalHoja(hoja);

  const totalEventos = eventos.length;
  const ubicados = eventos.filter(e => e.espacio).length;
  logRegistro('INFO',
    `Hoja ${nombreMes}: ${totalEventos} eventos (${ubicados} ubicados, ${totalEventos - ubicados} pendientes)`);

  return hoja;
}

// ─── FUNCIONES DE ESCRITURA EN HOJA ───────────────────────────

/**
 * Escribe la barra del nombre del mes (fila 1).
 * @returns {number} Siguiente fila disponible
 */
function escribirEncabezadoMes(hoja, fila, mes, anio) {
  const rango = hoja.getRange(fila, 1, 1, NUM_COLS);
  rango.merge();
  rango.setValue(`${NOMBRES_MESES[mes]} ${anio}`);
  rango.setBackground(COLORES_MESES[mes]);
  rango.setFontWeight('bold');
  rango.setFontSize(14);
  rango.setHorizontalAlignment('center');
  rango.setVerticalAlignment('middle');
  hoja.setRowHeight(fila, 35);
  return fila + 1;
}

/**
 * Escribe la fila de encabezados de columnas (DIA, HORA, POLIVALENTE…)
 * Se repite para cada día.
 * @returns {number} Siguiente fila disponible
 */
function escribirEncabezadoColumnas(hoja, fila, fecha) {
  const headers = [
    'DÍA', '',          // Col A (nombre) y B (número) — DÍA ocupa ambas
    'HORA',
    ...ENCABEZADOS_ESPACIOS,
    'PENDIENTES POR UBICAR'
  ];

  const rango = hoja.getRange(fila, 1, 1, NUM_COLS);
  rango.setValues([headers]);
  rango.setBackground(COLOR_ENCABEZADO);
  rango.setFontWeight('bold');
  rango.setFontSize(9);
  rango.setHorizontalAlignment('center');

  // Fusionar las dos columnas de DÍA en el encabezado
  hoja.getRange(fila, 1, 1, 2).merge().setValue('DÍA');

  hoja.setRowHeight(fila, 20);
  return fila + 1;
}

/**
 * Escribe la fila de eventos de todo el día con el nombre y número del día.
 * @returns {number} Siguiente fila
 */
function escribirEventosTodoDia(hoja, fila, eventosDelDia, fecha) {
  // Primera fila del día: nombre del día, número, "11:00-18:00" y los eventos
  const nombreDia = NOMBRES_DIAS[fecha.getDay()];
  const numDia    = fecha.getDate();

  // Crear una fila por cada evento de todo el día
  // Si hay múltiples eventos de todo el día, apilarlos
  eventosDelDia.forEach((ev, idx) => {
    const colEspacio = obtenerColumnaEspacio(ev.espacio);
    const filaVals   = new Array(NUM_COLS).fill('');

    if (idx === 0) {
      filaVals[0] = nombreDia;   // Columna A: Nombre del día
      filaVals[1] = numDia;      // Columna B: Número del día
      filaVals[2] = '11:00 - 18:00';  // Columna C: Horario
    }

    // Colocar el evento en su columna de espacio
    const textoEvento = construirTextoEvento(ev);
    if (colEspacio !== null) {
      filaVals[colEspacio] = textoEvento;
    } else {
      // Sin espacio: va a PENDIENTES POR UBICAR (última columna)
      filaVals[NUM_COLS - 1] = textoEvento;
    }

    hoja.getRange(fila, 1, 1, NUM_COLS).setValues([filaVals]);

    // Color de toda la fila para eventos de todo el día
    const color = ev.color || COLORES_TIPO['TODO_DIA'];
    hoja.getRange(fila, 1, 1, NUM_COLS).setBackground(color);

    // Negrita en la celda del evento
    if (colEspacio !== null) {
      hoja.getRange(fila, colEspacio + 1).setFontWeight('bold');
    }

    hoja.setRowHeight(fila, 25);
    fila++;
  });

  return fila;
}

/**
 * Escribe los eventos con hora específica, incluyendo fila de montaje.
 * Agrupa eventos que ocurren a la misma hora en distintos espacios en una sola fila.
 * @returns {number} Siguiente fila
 */
function escribirEventosConHora(hoja, fila, eventos) {
  // Ordenar por hora de inicio
  eventos.sort((a, b) => a.fechaInicio - b.fechaInicio);

  // ─── FILAS DE MONTAJE ──────────────────────────────────────
  // Agregar fila de montaje 1 hora antes de cada evento
  const montajesAgregados = new Set();

  eventos.forEach(ev => {
    const horaMontaje = restarUnaHora(ev.fechaInicio);
    const keyMontaje  = `${formatHora(horaMontaje)}_${ev.espacio}`;

    if (!montajesAgregados.has(keyMontaje)) {
      montajesAgregados.add(keyMontaje);
      const colEspacio = obtenerColumnaEspacio(ev.espacio);
      const filaVals   = new Array(NUM_COLS).fill('');

      filaVals[2] = formatHora(horaMontaje);  // HORA

      const textoMontaje = `MONTAJE: ${ev.titulo}${ev.reqTecnicos ? ' | ' + ev.reqTecnicos : ''}`;
      if (colEspacio !== null) {
        filaVals[colEspacio] = textoMontaje;
        hoja.getRange(fila, colEspacio + 1).setFontStyle('italic');
      } else {
        filaVals[NUM_COLS - 1] = textoMontaje;
      }

      hoja.getRange(fila, 1, 1, NUM_COLS).setValues([filaVals]);
      hoja.getRange(fila, 1, 1, NUM_COLS).setBackground(COLOR_MONTAJE_FILA);
      hoja.setRowHeight(fila, 20);
      fila++;
    }
  });

  // ─── FILAS DE EVENTOS (agrupadas por hora) ─────────────────
  // Agrupar eventos por hora de inicio para colocarlos en la misma fila
  const porHora = {};
  eventos.forEach(ev => {
    const h = formatHora(ev.fechaInicio);
    if (!porHora[h]) porHora[h] = [];
    porHora[h].push(ev);
  });

  // Ordenar las horas
  const horas = Object.keys(porHora).sort();

  horas.forEach(hora => {
    const evsEnHora = porHora[hora];
    const filaVals  = new Array(NUM_COLS).fill('');

    filaVals[2] = hora;  // HORA

    let todosUbicados = true;

    evsEnHora.forEach(ev => {
      const colEspacio = obtenerColumnaEspacio(ev.espacio);
      const textoEvento = construirTextoEvento(ev);

      if (colEspacio !== null) {
        // Si la celda ya tiene algo (evento traslapado en mismo espacio), concatenar
        if (filaVals[colEspacio]) {
          filaVals[colEspacio] += '\n' + textoEvento;
        } else {
          filaVals[colEspacio] = textoEvento;
        }
        // Colorear celda con el color del tipo del evento
        if (ev.color) {
          hoja.getRange(fila, colEspacio + 1).setBackground(ev.color);
        }
      } else {
        // Sin espacio identificado → columna PENDIENTES
        todosUbicados = false;
        const pendActual = filaVals[NUM_COLS - 1];
        filaVals[NUM_COLS - 1] = pendActual
          ? pendActual + '\n' + textoEvento
          : textoEvento;
        hoja.getRange(fila, NUM_COLS).setBackground(COLORES_TIPO['PENDIENTE']);
      }
    });

    hoja.getRange(fila, 1, 1, NUM_COLS).setValues([filaVals]);

    // Negrita en todas las celdas de eventos
    evsEnHora.forEach(ev => {
      const col = obtenerColumnaEspacio(ev.espacio);
      if (col !== null) {
        hoja.getRange(fila, col + 1).setFontWeight('bold');
      }
    });

    hoja.setRowHeight(fila, 30);
    fila++;
  });

  return fila;
}

/**
 * Construye el texto que se muestra en la celda de un evento.
 * Aplica negritas en la hoja y maneja el caso de tipo pendiente.
 */
function construirTextoEvento(ev) {
  const tipoLabel = ev.tipo
    ? (ETIQUETAS_TIPO[ev.tipo] || ev.tipo)
    : '**PENDIENTE DE IDENTIFICAR TIPO DE ACTIVIDAD**';

  const horaFin = ev.todoDia ? '' : ` → ${formatHora(ev.fechaFin)}`;

  return `${tipoLabel}\n${ev.titulo}${horaFin}`;
}

/**
 * Devuelve el índice de columna (0-based dentro de la fila) para un espacio.
 * Columnas: A=0(DiaNom), B=1(DiaNum), C=2(Hora), D=3(Poliv)...
 * @param {string|null} espacio
 * @returns {number|null} Índice 0-based o null si no identificado
 */
function obtenerColumnaEspacio(espacio) {
  if (!espacio) return null;
  const idx = ESPACIOS_COLUMNAS.indexOf(espacio);
  if (idx === -1) return null;
  return idx + 3;  // +3 por las columnas DiaNom, DiaNum, Hora
}

/**
 * Aplica formato final a toda la hoja: anchos, bordes, freeze.
 */
function aplicarFormatoFinalHoja(hoja) {
  hoja.setColumnWidth(1, 100);  // Día nombre
  hoja.setColumnWidth(2, 40);   // Día número
  hoja.setColumnWidth(3, 90);   // Hora
  hoja.setColumnWidth(4, 160);  // Polivalente
  hoja.setColumnWidth(5, 160);  // Talleres
  hoja.setColumnWidth(6, 160);  // Cine
  hoja.setColumnWidth(7, 130);  // Terraza
  hoja.setColumnWidth(8, 130);  // Memorial
  hoja.setColumnWidth(9, 130);  // Virtual
  hoja.setColumnWidth(10, 130); // Extramuros
  hoja.setColumnWidth(11, 160); // Pendientes

  // Congelar la primera fila (encabezado del mes)
  hoja.setFrozenRows(1);

  // Envolver texto en todas las celdas
  hoja.getRange(1, 1, hoja.getLastRow(), NUM_COLS)
    .setWrap(true)
    .setVerticalAlignment('middle');
}