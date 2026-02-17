// Data cleaning utilities

/**
 * Cleans position name by removing prefix before the first dot
 * and removing trailing dot
 */
function cleanPozisyon(pozisyon) {
  if (!pozisyon || typeof pozisyon !== 'string') return '';

  let cleaned = pozisyon.trim();

  // Remove prefix before first dot
  const dotIndex = cleaned.indexOf('.');
  if (dotIndex !== -1 && dotIndex < cleaned.length - 1) {
    cleaned = cleaned.substring(dotIndex + 1).trim();
  }

  // Remove trailing dot
  if (cleaned.endsWith('.')) {
    cleaned = cleaned.substring(0, cleaned.length - 1).trim();
  }

  return cleaned;
}

/**
 * Apply data cleaning to all records
 * Creates pozisyon_clean field
 */
function cleanDataRecords(records) {
  return records.map(record => ({
    ...record,
    pozisyon_clean: cleanPozisyon(record.pozisyon)
  }));
}
