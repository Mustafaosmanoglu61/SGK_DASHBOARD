// Data cleaning utilities

/**
 * Cleans department name by removing prefix before the first dot
 * Example: "ULU.Teknik Hizmetler Müdürlüğü" -> "Teknik Hizmetler Müdürlüğü"
 * Example: "GEB.Misafir Hizmetleri Müdürlüğü" -> "Misafir Hizmetleri Müdürlüğü"
 */
function cleanDepartman(departman) {
  if (!departman || typeof departman !== 'string') return '';
  
  const trimmed = departman.trim();
  const dotIndex = trimmed.indexOf('.');
  
  if (dotIndex !== -1 && dotIndex < trimmed.length - 1) {
    return trimmed.substring(dotIndex + 1).trim();
  }
  
  return trimmed;
}

/**
 * Cleans position name by removing prefix before the first dot
 * and removing trailing dot
 * Example: "ULU.Elektrik Teknisyeni." -> "Elektrik Teknisyeni"
 * Example: "GEB.Ayaktan Misafir Hizmetleri Yetkilisi." -> "Ayaktan Misafir Hizmetleri Yetkilisi"
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
 * This creates new fields: departman_clean and pozisyon_clean
 */
function cleanDataRecords(records) {
  return records.map(record => ({
    ...record,
    departman_clean: cleanDepartman(record.departman),
    pozisyon_clean: cleanPozisyon(record.pozisyon)
  }));
}
