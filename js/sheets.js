// Lectura/escritura de las hojas "Fichajes" y "Empleados" en la hoja de
// cálculo de Google Sheets, a través de la API de Google Sheets.

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

// Orden de columnas que debe tener la hoja "Fichajes".
const COL = { EMPRESA: 0, NOMBRE: 1, APELLIDOS: 2, ENTRADA: 3, DESCANSO: 4, SALIDA: 5, UBICACION: 6 };

// Orden de columnas que debe tener la hoja "Empleados".
const COL_EMP = { NOMBRE: 0, APELLIDOS: 1, EMPRESA: 2, PIN: 3 };

const SHEET_ID_CACHE_KEY = "fichaje_sheetIds_v1";

async function sheetsFetch(path, options = {}) {
  const token = await getGoogleToken();

  const res = await fetch(`${SHEETS_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets API ${res.status}: ${body}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// id numérico interno (gid) de una pestaña, necesario para borrar filas.
async function getSheetGid(nombreHoja) {
  const cached = localStorage.getItem(SHEET_ID_CACHE_KEY);
  if (cached) {
    const parsed = JSON.parse(cached);
    if (parsed.spreadsheetId === CONFIG.sheets.spreadsheetId && parsed.gids[nombreHoja] !== undefined) {
      return parsed.gids[nombreHoja];
    }
  }
  const data = await sheetsFetch(`/${CONFIG.sheets.spreadsheetId}?fields=sheets.properties`);
  const gids = {};
  data.sheets.forEach((s) => {
    gids[s.properties.title] = s.properties.sheetId;
  });
  localStorage.setItem(SHEET_ID_CACHE_KEY, JSON.stringify({ spreadsheetId: CONFIG.sheets.spreadsheetId, gids }));
  return gids[nombreHoja];
}

// Lee todas las filas con datos de una pestaña (a partir de la fila 2,
// para saltar la cabecera). Cada elemento incluye su número de fila real.
async function fetchAllRowsFromSheet(nombreHoja) {
  const range = encodeURIComponent(`${nombreHoja}!A2:Z`);
  const data = await sheetsFetch(`/${CONFIG.sheets.spreadsheetId}/values/${range}`);
  const values = data.values || [];
  return values.map((v, i) => ({ rowNumber: i + 2, values: v }));
}

// ==================== Hoja Fichajes ====================

async function fetchAllRows() {
  return fetchAllRowsFromSheet(CONFIG.sheets.hojaFichajes);
}

// Busca la fila de hoy para un empleado (por Entrada que empiece por hoy).
// Devuelve { index, values } o null si no existe.
async function findTodayRow(nombreCompleto, todayPrefix) {
  const rows = await fetchAllRows();
  const match = rows
    .filter((r) => {
      const v = r.values;
      const nombreFila = `${v[COL.NOMBRE] || ""} ${v[COL.APELLIDOS] || ""}`.trim();
      return nombreFila === nombreCompleto && String(v[COL.ENTRADA] || "").startsWith(todayPrefix);
    })
    .pop();
  return match ? { index: match.rowNumber, values: match.values } : null;
}

// Devuelve las últimas `limite` filas de fichajes, más recientes primero.
async function fetchFichajesRecientes(limite = 30) {
  const rows = await fetchAllRows();
  return rows.slice(-limite).reverse().map((r) => r.values);
}

async function addEntradaRow(empleado, fechaHoraTexto, ubicacionTexto) {
  const values = [empleado.empresa, empleado.nombre, empleado.apellidos, fechaHoraTexto, "", "", ubicacionTexto];
  const range = encodeURIComponent(`${CONFIG.sheets.hojaFichajes}!A1`);
  await sheetsFetch(`/${CONFIG.sheets.spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({ values: [values] }),
  });
}

async function actualizarCampoFila(rowNumber, filaActual, campo, fechaHoraTexto, ubicacionTexto) {
  const nuevaFila = [...filaActual];
  while (nuevaFila.length < 7) nuevaFila.push("");
  nuevaFila[campo] = fechaHoraTexto;
  nuevaFila[COL.UBICACION] = ubicacionTexto || nuevaFila[COL.UBICACION] || "";

  const rangeTexto = `${CONFIG.sheets.hojaFichajes}!A${rowNumber}:G${rowNumber}`;
  await sheetsFetch(`/${CONFIG.sheets.spreadsheetId}/values/${encodeURIComponent(rangeTexto)}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: JSON.stringify({ range: rangeTexto, values: [nuevaFila] }),
  });
}

// ==================== Hoja Empleados ====================

async function fetchEmpleados() {
  const rows = await fetchAllRowsFromSheet(CONFIG.sheets.hojaEmpleados);
  return rows.map((r) => {
    const v = r.values;
    return {
      index: r.rowNumber,
      nombre: v[COL_EMP.NOMBRE] || "",
      apellidos: v[COL_EMP.APELLIDOS] || "",
      empresa: v[COL_EMP.EMPRESA] || "",
      pin: String(v[COL_EMP.PIN] || ""),
    };
  });
}

async function addEmpleadoRow(nombre, apellidos, empresa, pin) {
  const range = encodeURIComponent(`${CONFIG.sheets.hojaEmpleados}!A1`);
  await sheetsFetch(`/${CONFIG.sheets.spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({ values: [[nombre, apellidos, empresa, pin]] }),
  });
}

// cambios: objeto con cualquiera de las claves nombre/apellidos/empresa/pin
async function actualizarEmpleadoRow(empleado, cambios) {
  const nuevaFila = [empleado.nombre, empleado.apellidos, empleado.empresa, empleado.pin];
  if (cambios.nombre !== undefined) nuevaFila[COL_EMP.NOMBRE] = cambios.nombre;
  if (cambios.apellidos !== undefined) nuevaFila[COL_EMP.APELLIDOS] = cambios.apellidos;
  if (cambios.empresa !== undefined) nuevaFila[COL_EMP.EMPRESA] = cambios.empresa;
  if (cambios.pin !== undefined) nuevaFila[COL_EMP.PIN] = cambios.pin;

  const rangeTexto = `${CONFIG.sheets.hojaEmpleados}!A${empleado.index}:D${empleado.index}`;
  await sheetsFetch(`/${CONFIG.sheets.spreadsheetId}/values/${encodeURIComponent(rangeTexto)}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: JSON.stringify({ range: rangeTexto, values: [nuevaFila] }),
  });
}

async function eliminarEmpleadoRow(rowNumber) {
  const sheetId = await getSheetGid(CONFIG.sheets.hojaEmpleados);
  await sheetsFetch(`/${CONFIG.sheets.spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: { sheetId, dimension: "ROWS", startIndex: rowNumber - 1, endIndex: rowNumber },
          },
        },
      ],
    }),
  });
}
