/**
 * ============================================================
 * Utilidades.gs — Funciones de apoyo reutilizables
 * ============================================================
 */

/**
 * Normaliza un texto: minúsculas + sin acentos + sin espacios extras.
 * Permite comparar palabras sin importar tildación, mayúsculas ni singular/plural.
 * @param {string} texto
 * @returns {string}
 */
function normalizarTexto(texto) {
  if (!texto) return '';
  return texto
    .toLowerCase()
    .normalize('NFD')                    // descompone caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '')     // elimina marcas diacríticas
    .replace(/\s+/g, ' ')               // colapsa espacios múltiples
    .trim();
}

/**
 * Verifica si una palabra normalizada aparece en un texto normalizado.
 * Busca como palabra completa (word boundary simple via espacios y puntuación).
 * @param {string} texto - Texto donde buscar
 * @param {string} palabra - Palabra a buscar
 * @returns {boolean}
 */
function contieneWord(texto, palabra) {
  if (!texto || !palabra) return false;
  const t = normalizarTexto(texto);
  const p = normalizarTexto(palabra);
  // Busca la palabra rodeada de inicio/fin, espacios o puntuación
  const regex = new RegExp('(^|[\\s,;:/\\-()\\[\\]])' + escapeRegex(p) + '($|[\\s,;:/\\-()\\[\\]])', 'i');
  return regex.test(t);
}

/**
 * Escapa caracteres especiales para uso en regex.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Convierte una fecha a string "HH:MM".
 * @param {Date} fecha
 * @returns {string}
 */
function formatHora(fecha) {
  if (!fecha) return '';
  const h = fecha.getHours().toString().padStart(2, '0');
  const m = fecha.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Convierte una fecha a string "DD/MM/YYYY".
 */
function formatFecha(fecha) {
  if (!fecha) return '';
  const d = fecha.getDate().toString().padStart(2, '0');
  const m = (fecha.getMonth() + 1).toString().padStart(2, '0');
  const y = fecha.getFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * Convierte una fecha a string "DD/MM/YYYY HH:MM".
 */
function formatFechaHora(fecha) {
  if (!fecha) return '';
  return `${formatFecha(fecha)} ${formatHora(fecha)}`;
}

/**
 * Extrae hashtags (#etiqueta) de un texto.
 * @param {string} texto
 * @returns {string[]} lista de etiquetas sin el #
 */
function extraerEtiquetas(texto) {
  if (!texto) return [];
  const matches = texto.match(/#[\wáéíóúüñÁÉÍÓÚÜÑ]+/g);
  return matches ? matches.map(t => t.substring(1)) : [];
}

/**
 * Aplica formato de negrita a una celda.
 */
function negrita(celda) {
  celda.setFontWeight('bold');
}

/**
 * Obtiene o crea una hoja por nombre.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} nombre
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function obtenerOCrearHoja(ss, nombre) {
  let hoja = ss.getSheetByName(nombre);
  if (!hoja) {
    hoja = ss.insertSheet(nombre);
  }
  return hoja;
}

/**
 * Lee un valor de la hoja CONFIGURACION.
 * @param {string} clave
 * @returns {*}
 */
function leerConfig(clave) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(HOJAS.CONFIG);
  if (!hoja) return null;
  const datos = hoja.getDataRange().getValues();
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][0] === clave) return datos[i][1];
  }
  return null;
}

/**
 * Escribe un valor en la hoja CONFIGURACION.
 */
function escribirConfig(clave, valor) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(HOJAS.CONFIG);
  if (!hoja) return;
  const datos = hoja.getDataRange().getValues();
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][0] === clave) {
      hoja.getRange(i + 1, 2).setValue(valor);
      return;
    }
  }
  // Si no existe, agregar al final
  hoja.appendRow([clave, valor, '']);
}

/**
 * Añade una fila al log/registro de cambios.
 * @param {string} tipo - 'INFO', 'ERROR', 'CAMBIO', 'ALERTA'
 * @param {string} mensaje
 * @param {object} [extra] - Datos adicionales opcionales
 */
function logRegistro(tipo, mensaje, extra) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = obtenerOCrearHoja(ss, HOJAS.REGISTRO_CAMBIOS);
    const ahora = new Date();
    const extraStr = extra ? JSON.stringify(extra) : '';
    hoja.appendRow([formatFechaHora(ahora), tipo, mensaje, extraStr]);

    // Colorear según tipo
    const ult = hoja.getLastRow();
    const colores = { INFO: '#ffffff', ERROR: '#f4cccc', CAMBIO: '#d9ead3', ALERTA: '#fff2cc' };
    hoja.getRange(ult, 1, 1, 4).setBackground(colores[tipo] || '#ffffff');
  } catch (e) {
    console.error('Error en logRegistro:', e);
  }
}

/**
 * Agrupación de eventos por día del mes.
 * @param {object[]} eventos
 * @returns {object} { diaMes: [eventos] }
 */
function agruparPorDia(eventos) {
  const grupos = {};
  eventos.forEach(ev => {
    const dia = ev.fechaInicio.getDate();
    if (!grupos[dia]) grupos[dia] = [];
    grupos[dia].push(ev);
  });
  return grupos;
}

/**
 * Resta una hora a una fecha, devuelve nueva fecha.
 */
function restarUnaHora(fecha) {
  const nueva = new Date(fecha);
  nueva.setHours(nueva.getHours() - 1);
  return nueva;
}

/**
 * Verifica si dos rangos de tiempo se traslapan.
 * @param {Date} inicio1 @param {Date} fin1
 * @param {Date} inicio2 @param {Date} fin2
 * @returns {boolean}
 */
function seTraslapan(inicio1, fin1, inicio2, fin2) {
  return inicio1 < fin2 && inicio2 < fin1;
}