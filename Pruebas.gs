/**
 * DIAGNÓSTICO — Ejecutar una sola vez para encontrar el ID correcto.
 * Lista TODOS los calendarios a los que tiene acceso esta cuenta de Google.
 * El resultado aparece en: Ver > Registros (o Ctrl+Enter)
 */
function diagnosticarCalendarios() {
  Logger.log('=== CALENDARIOS DISPONIBLES ===\n');

  const calendarios = CalendarApp.getAllCalendars();

  if (calendarios.length === 0) {
    Logger.log('❌ No se encontró ningún calendario.');
    Logger.log('   Verifica que la cuenta de Google conectada al script');
    Logger.log('   sea la misma que tiene acceso al calendario del museo.');
    return;
  }

  calendarios.forEach((cal, i) => {
    Logger.log(`[${i + 1}] Nombre : ${cal.getName()}`);
    Logger.log(`     ID    : ${cal.getId()}`);
    Logger.log(`     Color : ${cal.getColor()}`);
    Logger.log(`     ¿Mío? : ${cal.isOwnedByMe()}`);
    Logger.log('     ---');
  });

  Logger.log('\n✅ Copia el ID del calendario correcto y pégalo');
  Logger.log('   en CALENDAR_ID dentro de Config.gs');
}