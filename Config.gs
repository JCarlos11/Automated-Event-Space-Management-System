/**
 * ============================================================
 * Config.gs — Configuración Central del Sistema
 * ============================================================
 * Todos los parámetros ajustables del sistema están aquí.
 * Modificar este archivo antes de ejecutar por primera vez.
 * ============================================================
 */

// ─── PARÁMETROS PRINCIPALES ───────────────────────────────────
const CALENDAR_ID = '9c2ecr0ui1n7gu2dgm3tdqhqhc@group.calendar.google.com';  // ← CAMBIAR

const EMAIL_REPORTES = 'jocarlos.ccd@gmail.com';            // ← CAMBIAR

// Intervalo de sincronización en minutos (mínimo 1, recomendado 15-60)
const INTERVALO_SYNC_MINUTOS = 30;

// ID del Spreadsheet (se obtiene automáticamente)
const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

// API Key de Claude (Anthropic) para clasificación por IA — OPCIONAL
// Dejar vacío ('') para desactivar la clasificación por IA
const CLAUDE_API_KEY = '';

// Año del sistema
const ANIO = 2026;

// ─── NOMBRES DE HOJAS ─────────────────────────────────────────
const HOJAS = {
  BASE_DATOS:        'BASE_DATOS',
  REGISTRO_CAMBIOS:  'REGISTRO_CAMBIOS',
  LEYENDA:           'LEYENDA_COLORES',
  PENDIENTES:        'PENDIENTES',
  CONFIG:            'CONFIGURACION'
};

// ─── NOMBRES DE MESES ─────────────────────────────────────────
const NOMBRES_MESES = [
  '', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

const NOMBRES_DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];

// ─── COLORES POR TIPO DE ACTIVIDAD ───────────────────────────
const COLORES_TIPO = {
  'EXPOSICION':      '#fff2cc',
  'MONTAJE':         '#d5a6bd',
  'DESMONTAJE':      '#d5a6bd',
  'TALLER':          '#8e7cc3',
  'CHARLA':          '#93c47d',
  'PROYECCION':      '#00ffff',
  'VIRTUAL':         '#ff0000',
  'TRANSMISION':     '#9900ff',
  'CONCIERTO':       '#00ff00',
  'VISITA_GUIADA':   '#ffff00',
  'ESPECIAL':        '#ff9900',
  'RADIO':           '#76a5af',
  'PENDIENTE':       '#ff00ff',
  'FESTIVAL':        '#4a86e8',
  'TODO_DIA':        '#efefef'  // Color para filas de todo el día
};

// Etiquetas legibles para mostrar en la hoja
const ETIQUETAS_TIPO = {
  'EXPOSICION':      'EXPOSICIÓN',
  'MONTAJE':         'MONTAJE',
  'DESMONTAJE':      'DESMONTAJE',
  'TALLER':          'TALLER',
  'CHARLA':          'CHARLA',
  'PROYECCION':      'PROYECCIÓN',
  'VIRTUAL':         'SUCEDE DE MANERA DIGITAL VIRTUAL',
  'TRANSMISION':     'REQUIERE TRANSMISIÓN',
  'CONCIERTO':       'CONCIERTO / TRANSMISIÓN RADIO',
  'VISITA_GUIADA':   'VISITA GUIADA',
  'ESPECIAL':        'ESPECIAL',
  'RADIO':           'RADIO',
  'PENDIENTE':       'OTRO INTERNO / PENDIENTE',
  'FESTIVAL':        'FESTIVAL'
};

// ─── COLORES POR MES ─────────────────────────────────────────
const COLORES_MESES = {
  1:  '#cfe2f3',  // Enero   — azul claro
  2:  '#fce5cd',  // Febrero — naranja claro
  3:  '#d9ead3',  // Marzo   — verde claro
  4:  '#ead1dc',  // Abril   — rosa claro
  5:  '#ffd966',  // Mayo    — amarillo dorado
  6:  '#d0e0e3',  // Junio   — verde azulado
  7:  '#e6d0de',  // Julio   — lavanda
  8:  '#f4cccc',  // Agosto  — rojo claro
  9:  '#d9d2e9',  // Sept    — morado claro
  10: '#fce5cd',  // Oct     — durazno
  11: '#d9ead3',  // Nov     — verde menta
  12: '#c9daf8'   // Dic     — azul grisáceo
};

// Color para la fila de encabezados de columna (DIA, HORA, POLIVALENTE…)
const COLOR_ENCABEZADO = '#b7b7b7';

// Color para filas de montaje
const COLOR_MONTAJE_FILA = '#d5a6bd';

// ─── ESPACIOS DEL MUSEO ───────────────────────────────────────
// El orden aquí define el orden de columnas en la hoja mensual
const ESPACIOS_COLUMNAS = [
  'POLIVALENTE',
  'TALLERES',       // Incluye MECATRÓNICA
  'CINE',
  'TERRAZA',
  'MEMORIAL',
  'VIRTUAL',
  'EXTRAMUROS'
];

// Encabezados legibles para mostrar (deben coincidir en orden con ESPACIOS_COLUMNAS)
const ENCABEZADOS_ESPACIOS = [
  'POLIVALENTE',
  'TALLERES/MECATRÓNICA',
  'CINE',
  'TERRAZA',
  'MEMORIAL',
  'VIRTUAL',
  'EXTRAMUROS'
];

// ─── HORARIO LABORAL ──────────────────────────────────────────
const HORARIO = {
  INICIO: { h: 11, m: 0 },
  FIN:    { h: 18, m: 0 }
};

// ─── COLUMNAS DE BASE_DATOS ───────────────────────────────────
// Índice (1-based) de cada columna en la hoja BASE_DATOS
const COL_BD = {
  ID:               1,
  TITULO:           2,
  DESCRIPCION:      3,
  UBICACION:        4,
  FECHA_INICIO:     5,
  FECHA_FIN:        6,
  TODO_DIA:         7,
  ESTADO:           8,
  CREADOR:          9,
  INVITADOS:        10,
  ETIQUETAS:        11,
  ESPACIO:          12,
  TIPO:             13,
  ULTIMA_ACT:       14,
  ACCION:           15,
  REQ_TECNICOS:     16   // Requerimientos técnicos extraídos
};

const HEADERS_BD = [
  'ID ACTIVIDAD', 'TÍTULO', 'DESCRIPCIÓN', 'UBICACIÓN / ESPACIO',
  'FECHA INICIO', 'FECHA FIN', 'TODO EL DÍA', 'ESTADO',
  'CREADOR', 'INVITADOS', 'ETIQUETAS', 'ESPACIO IDENTIFICADO',
  'TIPO ACTIVIDAD', 'ÚLTIMA ACTUALIZACIÓN', 'ACCIÓN', 'REQ. TÉCNICOS'
];