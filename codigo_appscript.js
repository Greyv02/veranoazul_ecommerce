/**
 * -------------------------------------------------------------
 * API de Solo Lectura para Inventario de Google Sheets
 * -------------------------------------------------------------
 * 1. Abre tu hoja de Google Sheets.
 * 2. Ve a "Extensiones" > "Apps Script".
 * 3. Borra el código existente y pega todo este código.
 * 4. Guarda el proyecto.
 * 5. Haz clic en "Implementar" (Deploy) > "Nueva implementación".
 * 6. Selecciona tipo "Aplicación Web" (Web app).
 * 7. Ejecutar como: "Tú"
 * 8. Quién tiene acceso: "Cualquier persona" (Anyone)
 * 9. Autoriza los permisos si te los pide.
 * 10. Copia la URL generada y pégala en `app.js` en la variable SCRIPT_URL.
 */

const SHEET_NAME = "Inventario";

function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    
    // Si no encuentra la hoja, devuelve un error claro
    if (!sheet) {
      return responseJSON({ "error": "No se encontró la pestaña '" + SHEET_NAME + "'" }, 404);
    }

    const data = sheet.getDataRange().getValues();
    
    // Si la hoja está vacía
    if (data.length <= 1) {
      return responseJSON([], 200);
    }

    // La fila 1 contiene los encabezados (Nombres de las columnas)
    const headers = data[0];
    const rows = data.slice(1);
    
    const jsonArray = rows.map((row) => {
      let obj = {};
      row.forEach((cell, index) => {
        // Usa el nombre de la columna como la clave del objeto. 
        // Reemplaza espacios con '_' para evitar problemas en JS.
        let key = String(headers[index]).trim().replace(/\s+/g, '_');
        obj[key] = cell;
      });
      return obj;
    });

    return responseJSON(jsonArray, 200);

  } catch (error) {
    return responseJSON({ "error": error.toString() }, 500);
  }
}

/**
 * Función helper para formatear la respuesta como JSON
 * e incluir CORS headers permitiendo solicitudes desde cualquier lugar.
 */
function responseJSON(data, code) {
  const output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
    
  return output;
}
