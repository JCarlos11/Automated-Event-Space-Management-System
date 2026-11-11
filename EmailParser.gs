/**
 * ============================================================
 * EmailParser.gs — Extracción de requerimientos de correos
 * ============================================================
 * Busca correos recientes con ciertos criterios y extrae
 * información de requerimientos técnicos para asociarla
 * con eventos del calendario.
 * ============================================================
 */

/**
 * Busca correos de los últimos N días que contengan requerimientos técnicos.
 * Los asocia con eventos en la BASE_DATOS por similitud de título o fecha.
 * @param {number} diasAtras — Cuántos días hacia atrás buscar (default: 7)
 */
function parsearCorreosRequerimientos(diasAtras) {
  diasAtras = diasAtras || 7;
  logRegistro('INFO', `Parseando correos de los últimos ${diasAtras} días`);

  // Términos de búsqueda en asunto del correo
  const terminosBusqueda = [
    'requerimientos', 'requerimento', 'montaje', 'técnicos', 'tecnicos',
    'evento', 'solicitud de espacio', 'reserva', 'reservación'
  ];

  const query = `newer_than:${diasAtras}d (${terminosBusqueda.join(' OR ')})`;

  let hilos;
  try {
    hilos = GmailApp.search(query, 0, 50);
  } catch (e) {
    logRegistro('ERROR', `Error al buscar correos: ${e.message}`);
    return;
  }

  let procesados = 0;

  hilos.forEach(hilo => {
    const mensajes = hilo.getMessages();
    mensajes.forEach(msg => {
      const asunto = msg.getSubject();
      const cuerpo = msg.getPlainBody();
      const fecha  = msg.getDate();

      // Extraer requerimientos del cuerpo del correo
      const req = extraerRequerimientosDeCorreo(asunto, cuerpo);
      if (!req.requerimientos) return;

      // Intentar asociar con un evento existente
      const eventoId = asociarCorreoConEvento(asunto, fecha, req);

      if (eventoId) {
        // Actualizar los requerimientos en BASE_DATOS
        actualizarReqEventoBD(eventoId, req.requerimientos);
        logRegistro('INFO', `Correo asociado con evento ID: ${eventoId}`);
        procesados++;
      }
    });
  });

  logRegistro('INFO', `${procesados} correos procesados y asociados`);
}

/**
 * Extrae información de requerimientos técnicos de un correo.
 * @param {string} asunto
 * @param {string} cuerpo
 * @returns {object} { titulo, fecha, requerimientos, espacio }
 */
function extraerRequerimientosDeCorreo(asunto, cuerpo) {
  const resultado = {
    titulo:         asunto,
    requerimientos: '',
    espacio:        null
  };

  const cuerpoNorm = normalizarTexto(cuerpo);

  // Extraer palabras clave de equipamiento
  const equipos = [];
  const keywords = [
    'sillas', 'mesas', 'proyector', 'pantalla', 'microfono',
    'audio', 'sonido', 'internet', 'wifi', 'electricidad',
    'camara', 'tripie', 'bocinas', 'iluminacion', 'laptop',
    'hdmi', 'extension', 'streaming'
  ];

  keywords.forEach(kw => {
    // Buscar la keyword y un posible número antes de ella
    const regex = new RegExp(`(\\d+\\s+)?${escapeRegex(normalizarTexto(kw))}`, 'gi');
    const match  = cuerpoNorm.match(regex);
    if (match) equipos.push(match[0]);
  });

  // Si tenemos API de Claude, usar IA para extraer mejor
  if (CLAUDE_API_KEY && CLAUDE_API_KEY.length > 10 && equipos.length === 0) {
    return extraerConIA(asunto, cuerpo);
  }

  resultado.requerimientos = equipos.join(', ');

  // Intentar detectar espacio del correo
  const textoTotal = normalizarTexto(asunto + ' ' + cuerpo);
  for (const [espacio, keywords] of Object.entries(KEYWORDS_ESPACIO)) {
    if (keywords.some(kw => textoTotal.includes(normalizarTexto(kw)))) {
      resultado.espacio = espacio;
      break;
    }
  }

  return resultado;
}

/**
 * Usa Claude para extraer requerimientos de un correo (cuando hay API Key).
 */
function extraerConIA(asunto, cuerpo) {
  try {
    const prompt = `Del siguiente correo electrónico, extrae SOLO los requerimientos técnicos para un evento (equipos, mobiliario, servicios). Responde en formato JSON: {"requerimientos": "lista separada por comas", "espacio": "nombre del espacio o null"}

ASUNTO: ${asunto}
CUERPO: ${cuerpo.substring(0, 1000)}`;

    const respuesta = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      }),
      muteHttpExceptions: true
    });

    const data  = JSON.parse(respuesta.getContentText());
    const texto = data.content[0].text.trim();
    const json  = JSON.parse(texto.replace(/```json|```/g, ''));

    return { titulo: asunto, ...json };
  } catch (e) {
    logRegistro('ERROR', `Error en extracción IA de correo: ${e.message}`);
    return { titulo: asunto, requerimientos: '', espacio: null };
  }
}

/**
 * Intenta asociar un correo con un evento de la BASE_DATOS.
 * Compara título del correo con títulos de eventos en fechas cercanas.
 * @returns {string|null} ID del evento asociado
 */
function asociarCorreoConEvento(asunto, fechaCorreo, req) {
  const bd = leerBaseDatos();
  const asuntoNorm = normalizarTexto(asunto);

  // Buscar en ventana de ±7 días
  const ventana = 7 * 24 * 60 * 60 * 1000;

  let mejorMatch  = null;
  let mejorScore  = 0;

  Object.values(bd).forEach(entry => {
    const titulo = normalizarTexto(String(entry.datos[COL_BD.TITULO - 1]));
    const fi     = new Date(entry.datos[COL_BD.FECHA_INICIO - 1]);

    // Verificar ventana de tiempo
    if (Math.abs(fi - fechaCorreo) > ventana) return;

    // Calcular similitud por palabras comunes
    const palabrasAsunto = asuntoNorm.split(' ').filter(p => p.length > 3);
    const palabrasTitulo = titulo.split(' ').filter(p => p.length > 3);
    const comunes = palabrasAsunto.filter(p => palabrasTitulo.includes(p));

    const score = comunes.length;
    if (score > mejorScore) {
      mejorScore = score;
      mejorMatch = entry.datos[COL_BD.ID - 1];
    }
  });

  return mejorScore >= 2 ? mejorMatch : null;
}

/**
 * Actualiza los requerimientos técnicos de un evento en BASE_DATOS.
 */
function actualizarReqEventoBD(eventoId, requerimientos) {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(HOJAS.BASE_DATOS);
  if (!hoja) return;

  const bd = leerBaseDatos();
  if (bd[eventoId]) {
    hoja.getRange(bd[eventoId].fila, COL_BD.REQ_TECNICOS).setValue(requerimientos);
  }
}