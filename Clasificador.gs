**
 * ============================================================
 * Clasificador.gs — Identificación de espacio y tipo de evento
 * ============================================================
 * Analiza título, descripción y ubicación del evento para
 * determinar en qué espacio del museo ocurre y qué tipo de
 * actividad es.  Aplica normalización para ignorar acentos,
 * mayúsculas, singular/plural y variaciones ortográficas.
 * Si hay API Key de Claude configurada, recurre a IA para
 * casos ambiguos.
 * ============================================================
 */

// ─── PALABRAS CLAVE POR ESPACIO ────────────────────────────────
const KEYWORDS_ESPACIO = {
  'POLIVALENTE': [
    'polivalente', 'sala polivalente', 'sala principal', 'auditorio'
  ],
  'TALLERES': [
    'taller', 'talleres', 'mecatronica', 'mecatrónica',
    'sala de talleres', 'sala talleres', 'laboratorio'
  ],
  'CINE': [
    'cine', 'sala de cine', 'sala cine', 'cineteca',
    'cinema', 'sala audiovisual', 'proyeccion', 'proyección'
  ],
  'TERRAZA': [
    'terraza', 'azotea', 'aire libre', 'exterior'
  ],
  'MEMORIAL': [
    'memorial', 'sala memorial', 'sala de memorial'
  ],
  'VIRTUAL': [
    'virtual', 'en linea', 'online', 'zoom', 'teams',
    'meet', 'google meet', 'digital', 'streaming', 'transmision',
    'transmisión', 'plataforma', 'web', 'facebook live', 'youtube live'
  ],
  'EXTRAMUROS': [
    'extramuros', 'externo', 'fuera del museo', 'fuera',
    'sede externa', 'otro espacio', 'afuera', 'ext.'
  ]
};

// ─── PALABRAS CLAVE POR TIPO DE ACTIVIDAD ─────────────────────
const KEYWORDS_TIPO = {
  'EXPOSICION': [
    'exposicion', 'exhibicion', 'muestra', 'galeria', 'galería',
    'exposición', 'exhibición', 'colección', 'coleccion', 'instalacion artistica',
    'obra', 'arte'
  ],
  'MONTAJE': [
    'montaje', 'instalacion de', 'instalación de', 'preparacion de espacio',
    'preparación', 'armado', 'setup', 'set up'
  ],
  'DESMONTAJE': [
    'desmontaje', 'desinstalacion', 'desinstalación', 'retiro',
    'levantamiento', 'desarme', 'tear down'
  ],
  'TALLER': [
    'taller', 'workshop', 'curso', 'capacitacion', 'capacitación',
    'formacion', 'formación', 'clase', 'sesion', 'sesión'
  ],
  'CHARLA': [
    'charla', 'conferencia', 'ponencia', 'platica', 'plática',
    'seminario', 'panel', 'foro', 'coloquio', 'dialogo', 'diálogo',
    'mesa redonda', 'presentacion', 'presentación', 'talk'
  ],
  'PROYECCION': [
    'proyeccion', 'proyección', 'pelicula', 'película', 'documental',
    'cortometraje', 'largometraje', 'cine club', 'cineclub',
    'funcion', 'función', 'videoclip', 'video', 'vídeo', 'screening'
  ],
  'VIRTUAL': [
    'virtual', 'digital', 'online', 'en linea', 'streaming',
    'en vivo por internet', 'transmision en vivo', 'transmisión en vivo'
  ],
  'TRANSMISION': [
    'transmision', 'transmisión', 'requiere transmision',
    'requiere transmisión', 'en vivo', 'live stream', 'broadcast'
  ],
  'CONCIERTO': [
    'concierto', 'musica', 'música', 'banda', 'orquesta', 'recital',
    'actuacion', 'actuación', 'show musical', 'grupo musical',
    'cantante', 'dj', 'jam session'
  ],
  'VISITA_GUIADA': [
    'visita guiada', 'recorrido', 'tour', 'guia', 'guía',
    'visita escolar', 'grupos escolares', 'visita grupal'
  ],
  'ESPECIAL': [
    'especial', 'inauguracion', 'inauguración', 'clausura',
    'premiere', 'apertura', 'lanzamiento', 'ceremonia', 'gala'
  ],
  'RADIO': [
    'radio', 'podcast', 'grabacion', 'grabación', 'programa de radio',
    'transmision radial', 'estudio'
  ],
  'FESTIVAL': [
    'festival', 'feria', 'carnaval', 'celebracion', 'celebración',
    'festejo', 'fiestas', 'temporada', 'ciclo', 'jornada'
  ]
};

/**
 * Clasifica un evento: determina espacio y tipo de actividad.
 * Modifica el objeto evento directamente (agrega .espacio, .tipo, .color).
 * @param {object} evento
 * @returns {object} El evento con espacio, tipo y color asignados
 */
function clasificarEvento(evento) {
  // Construir texto combinado para análisis (todo en minúsculas sin acentos)
  const textoCompleto = normalizarTexto([
    evento.titulo,
    evento.descripcion,
    evento.ubicacion
  ].join(' '));

  // ── DETECTAR ESPACIO ──
  evento.espacio = detectarEspacio(textoCompleto, evento);

  // ── DETECTAR TIPO DE ACTIVIDAD ──
  evento.tipo = detectarTipo(textoCompleto, evento);

  // ── ASIGNAR COLOR ──
  evento.color = evento.tipo ? (COLORES_TIPO[evento.tipo] || null) : null;

  // ── EXTRAER REQUERIMIENTOS TÉCNICOS ──
  evento.reqTecnicos = extraerRequerimientosTecnicos(evento.descripcion);

  return evento;
}

/**
 * Detecta el espacio del museo analizando el texto del evento.
 * @param {string} textoNorm — texto ya normalizado
 * @param {object} evento
 * @returns {string|null} clave de espacio o null si no se identifica
 */
function detectarEspacio(textoNorm, evento) {
  // Dar prioridad al campo 'ubicación' del calendario si contiene información relevante
  const ubicNorm = normalizarTexto(evento.ubicacion);

  for (const [espacio, keywords] of Object.entries(KEYWORDS_ESPACIO)) {
    for (const kw of keywords) {
      const kwNorm = normalizarTexto(kw);
      // Primero revisar ubicación (más confiable), luego texto completo
      if (ubicNorm && ubicNorm.includes(kwNorm)) return espacio;
    }
  }

  // Si no hay match en ubicación, buscar en texto completo (título + descripción)
  for (const [espacio, keywords] of Object.entries(KEYWORDS_ESPACIO)) {
    for (const kw of keywords) {
      const kwNorm = normalizarTexto(kw);
      if (textoNorm.includes(kwNorm)) return espacio;
    }
  }

  // Si hay API Key configurada, intentar con IA
  if (CLAUDE_API_KEY && CLAUDE_API_KEY.length > 10) {
    return clasificarConIA(evento, 'espacio');
  }

  return null; // No identificado
}

/**
 * Detecta el tipo de actividad.
 * @param {string} textoNorm
 * @param {object} evento
 * @returns {string|null}
 */
function detectarTipo(textoNorm, evento) {
  // Orden de prioridad: tipos más específicos primero
  const ordenPrioridad = [
    'DESMONTAJE', 'MONTAJE', 'FESTIVAL', 'CONCIERTO', 'ESPECIAL',
    'VISITA_GUIADA', 'TRANSMISION', 'VIRTUAL', 'RADIO',
    'PROYECCION', 'TALLER', 'CHARLA', 'EXPOSICION'
  ];

  for (const tipo of ordenPrioridad) {
    for (const kw of (KEYWORDS_TIPO[tipo] || [])) {
      if (textoNorm.includes(normalizarTexto(kw))) return tipo;
    }
  }

  // Si hay API Key configurada, intentar con IA
  if (CLAUDE_API_KEY && CLAUDE_API_KEY.length > 10) {
    return clasificarConIA(evento, 'tipo');
  }

  return null;
}

/**
 * Extrae requerimientos técnicos de la descripción del evento.
 * Busca listas y palabras clave relacionadas con equipamiento.
 * @param {string} descripcion
 * @returns {string}
 */
function extraerRequerimientosTecnicos(descripcion) {
  if (!descripcion) return '';

  const desc = descripcion.toLowerCase();
  const reqEncontrados = [];

  const keywords = [
    'silla', 'sillas', 'mesa', 'mesas', 'proyector', 'pantalla',
    'microfono', 'micrófono', 'micrófonos', 'audio', 'sonido',
    'internet', 'wifi', 'red', 'cable', 'electricidad', 'contacto',
    'extensión', 'extension', 'luz', 'iluminacion', 'iluminación',
    'camara', 'cámara', 'tripie', 'tripié', 'streaming',
    'laptop', 'computadora', 'hdmi', 'usb', 'adaptador',
    'bocina', 'bafle', 'amplificador', 'mezcladora', 'mixer'
  ];

  keywords.forEach(kw => {
    if (normalizarTexto(desc).includes(normalizarTexto(kw))) {
      reqEncontrados.push(kw);
    }
  });

  // También extraer listas (líneas que empiezan con - o •)
  const lineas = descripcion.split('\n');
  lineas.forEach(linea => {
    linea = linea.trim();
    if (linea.startsWith('-') || linea.startsWith('•') || linea.startsWith('*')) {
      reqEncontrados.push(linea.replace(/^[-•*]\s*/, '').trim());
    }
  });

  // Eliminar duplicados
  return [...new Set(reqEncontrados)].join(', ');
}

/**
 * Clasifica un evento usando la API de Claude (IA).
 * Se usa como fallback cuando las palabras clave no son suficientes.
 * @param {object} evento
 * @param {'espacio'|'tipo'} campo — Qué se desea clasificar
 * @returns {string|null}
 */
function clasificarConIA(evento, campo) {
  try {
    const espaciosOpciones = Object.keys(KEYWORDS_ESPACIO).join(', ');
    const tiposOpciones = Object.keys(KEYWORDS_TIPO).join(', ');

    const pregunta = campo === 'espacio'
      ? `¿En qué espacio de un museo ocurre este evento? Opciones: ${espaciosOpciones}. Responde SOLO con una de las opciones exactas o "null" si no puedes determinarlo.`
      : `¿Qué tipo de actividad es este evento? Opciones: ${tiposOpciones}. Responde SOLO con una de las opciones exactas o "null" si no puedes determinarlo.`;

    const prompt = `
Evento de museo:
- Título: ${evento.titulo}
- Descripción: ${evento.descripcion}
- Ubicación: ${evento.ubicacion}

${pregunta}`;

    const respuesta = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 50,
        messages: [{ role: 'user', content: prompt }]
      }),
      muteHttpExceptions: true
    });

    const data = JSON.parse(respuesta.getContentText());
    const texto = data.content[0].text.trim().toUpperCase();

    // Validar que la respuesta sea una opción válida
    const opciones = campo === 'espacio'
      ? Object.keys(KEYWORDS_ESPACIO)
      : Object.keys(KEYWORDS_TIPO);

    if (opciones.includes(texto)) return texto;
    return null;

  } catch (e) {
    logRegistro('ERROR', `Error en clasificación por IA: ${e.message}`);
    return null;
  }
}

/**
 * Detecta eventos que se traslapan en el mismo espacio.
 * @param {object[]} eventos
 * @returns {object[]} Lista de pares de eventos traslapados
 */
function detectarTraslapos(eventos) {
  const traslapos = [];
  const eventosConEspacio = eventos.filter(e => e.espacio && !e.todoDia && e.estado !== 'cancelled');

  for (let i = 0; i < eventosConEspacio.length; i++) {
    for (let j = i + 1; j < eventosConEspacio.length; j++) {
      const a = eventosConEspacio[i];
      const b = eventosConEspacio[j];

      // Solo verificar si están en el mismo espacio y el mismo día
      if (a.espacio === b.espacio &&
          a.fechaInicio.toDateString() === b.fechaInicio.toDateString()) {
        if (seTraslapan(a.fechaInicio, a.fechaFin, b.fechaInicio, b.fechaFin)) {
          traslapos.push({
            espacio: a.espacio,
            eventoA: { id: a.id, titulo: a.titulo, inicio: formatFechaHora(a.fechaInicio), fin: formatFechaHora(a.fechaFin) },
            eventoB: { id: b.id, titulo: b.titulo, inicio: formatFechaHora(b.fechaInicio), fin: formatFechaHora(b.fechaFin) }
          });
        }
      }
    }
  }

  return traslapos;
}