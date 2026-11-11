/**
 * ============================================================
 * CalendarService.gs — Lectura del Google Calendar
 * ============================================================
 */

/**
 * Lee todos los eventos de un rango de fechas del calendario configurado.
 * @param {Date} fechaInicio
 * @param {Date} fechaFin
 * @returns {object[]} Lista de eventos normalizados
 */
function leerEventosCalendario(fechaInicio, fechaFin) {
  logRegistro('INFO', `Leyendo calendario desde ${formatFecha(fechaInicio)} hasta ${formatFecha(fechaFin)}`);

  let eventos = [];

  try {
    // Usar la API avanzada de Calendar para obtener todos los campos
    let pageToken = null;
    do {
      const params = {
        calendarId: CALENDAR_ID,
        timeMin: fechaInicio.toISOString(),
        timeMax: fechaFin.toISOString(),
        maxResults: 2500,
        singleEvents: true,      // expande eventos recurrentes
        orderBy: 'startTime',
        showDeleted: true,        // incluye eventos eliminados (status: cancelled)
      };
      if (pageToken) params.pageToken = pageToken;

      const respuesta = Calendar.Events.list(CALENDAR_ID, params);

      if (respuesta.items && respuesta.items.length > 0) {
        respuesta.items.forEach(item => {
          const ev = normalizarEventoCalendario(item);
          if (ev) eventos.push(ev);
        });
      }

      pageToken = respuesta.nextPageToken;
    } while (pageToken);

    logRegistro('INFO', `Se leyeron ${eventos.length} eventos del calendario`);

  } catch (e) {
    logRegistro('ERROR', `Error al leer el calendario: ${e.message}`);
    throw e;
  }

  return eventos;
}

/**
 * Convierte un evento de la Google Calendar API a nuestro formato interno.
 * @param {object} item — Evento crudo de la API
 * @returns {object|null}
 */
function normalizarEventoCalendario(item) {
  try {
    const todoDia = !!item.start.date; // si tiene 'date' (no 'dateTime') es todo el día

    let fechaInicio, fechaFin;
    if (todoDia) {
      // Eventos de todo el día: 'date' es "YYYY-MM-DD"
      fechaInicio = new Date(item.start.date + 'T11:00:00');
      fechaFin    = new Date(item.end.date   + 'T18:00:00');
      // Google Calendar devuelve el día siguiente como fin para eventos de todo el día
      fechaFin.setDate(fechaFin.getDate() - 1);
    } else {
      fechaInicio = new Date(item.start.dateTime);
      fechaFin    = new Date(item.end.dateTime);
    }

    // Extraer invitados
    const invitados = (item.attendees || []).map(a => a.email).join(', ');

    // Extraer etiquetas (#) del título y descripción
    const etiquetas = [
      ...extraerEtiquetas(item.summary || ''),
      ...extraerEtiquetas(item.description || '')
    ];

    return {
      id:          item.id,
      titulo:      item.summary       || '(Sin título)',
      descripcion: item.description   || '',
      ubicacion:   item.location      || '',
      fechaInicio: fechaInicio,
      fechaFin:    fechaFin,
      todoDia:     todoDia,
      estado:      item.status        || 'confirmed',  // 'confirmed' o 'cancelled'
      creador:     item.creator        ? item.creator.email : '',
      invitados:   invitados,
      etiquetas:   etiquetas.join(', '),
      ultimaAct:   item.updated        ? new Date(item.updated) : new Date(),
      // Estos campos se llenarán por el Clasificador:
      espacio:     null,
      tipo:        null,
      color:       null,
      reqTecnicos: ''
    };
  } catch (e) {
    logRegistro('ERROR', `Error al normalizar evento ${item.id}: ${e.message}`);
    return null;
  }
}

/**
 * Lee eventos del mes y año dados.
 * @param {number} mes  (1=Enero, 12=Diciembre)
 * @param {number} anio
 * @returns {object[]}
 */
function leerEventosMes(mes, anio) {
  const inicio = new Date(anio, mes - 1, 1, 0, 0, 0);
  const fin    = new Date(anio, mes, 0, 23, 59, 59);  // último día del mes
  return leerEventosCalendario(inicio, fin);
}

/**
 * Lee eventos de todo el año.
 * @param {number} anio
 * @returns {object[]}
 */
function leerEventosAnio(anio) {
  const inicio = new Date(anio, 0, 1, 0, 0, 0);
  const fin    = new Date(anio, 11, 31, 23, 59, 59);
  return leerEventosCalendario(inicio, fin);
}