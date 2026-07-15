// ============================================================
// CONFIGURACIÓN DE LA APP DE FICHAJE
// Edita este archivo con tus datos. No hace falta tocar nada más.
// Los empleados NO se añaden aquí: se gestionan desde el panel
// de administrador dentro de la propia app (ver README.md).
// ============================================================

const CONFIG = {
  // --- Datos del proyecto registrado en Google Cloud Console ---
  // Ver README.md, sección "2. Crear las credenciales en Google Cloud" para obtener este valor.
  google: {
    clientId: "371105375852-msejneik446ss0fcaa10t79e8sf8ddbj.apps.googleusercontent.com",
  },

  // --- Hoja de cálculo de Google Sheets donde se guardan los fichajes ---
  // Ver README.md, sección "1. Crear la hoja de cálculo en Google Drive".
  sheets: {
    // El ID va en la URL de la hoja: https://docs.google.com/spreadsheets/d/ESTE_TROZO/edit
    spreadsheetId: "1PoDgeeAaFS3NjMPi39Vu4b5G5uZ8zRgWgubWLoelT3Y",
    hojaFichajes: "Fichajes",
    hojaEmpleados: "Empleados",
  },

  // --- Acceso al panel de administrador (alta/baja de empleados, ver fichajes) ---
  // AVISO DE SEGURIDAD: esta app no tiene servidor propio, así que esta
  // comprobación se hace en el propio navegador. Evita que un empleado
  // cualquiera entre por error, pero NO es una protección fuerte frente a
  // alguien con conocimientos técnicos. No reutilices aquí una contraseña
  // que uses en otro sitio importante.
  admin: {
    usuario: "Alfonso Ruiz",
    clave: "Lucia@0711",
  },
};
