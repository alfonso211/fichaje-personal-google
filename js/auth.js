// Inicio de sesión con Google (una vez por dispositivo) para poder
// escribir en la hoja de cálculo de Google Sheets. El PIN de cada
// empleado (ver app.js) es independiente de esta sesión.

const GOOGLE_SCOPES = "https://www.googleapis.com/auth/spreadsheets";
const LINKED_FLAG_KEY = "fichaje_google_linked_v1";

let tokenClient = null;
let currentAccessToken = null;
let tokenExpiresAt = 0;
let deviceLinked = false;

async function initAuth() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.google.clientId,
    scope: GOOGLE_SCOPES,
    callback: () => {}, // se sobreescribe en cada llamada concreta
  });
  deviceLinked = localStorage.getItem(LINKED_FLAG_KEY) === "1";
}

function isDeviceLinked() {
  return deviceLinked;
}

function linkDevice() {
  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if (resp.error) {
        reject(new Error(resp.error_description || resp.error));
        return;
      }
      currentAccessToken = resp.access_token;
      tokenExpiresAt = Date.now() + resp.expires_in * 1000 - 60000;
      deviceLinked = true;
      localStorage.setItem(LINKED_FLAG_KEY, "1");
      resolve();
    };
    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

function unlinkDevice() {
  return new Promise((resolve) => {
    const finish = () => {
      currentAccessToken = null;
      tokenExpiresAt = 0;
      deviceLinked = false;
      localStorage.removeItem(LINKED_FLAG_KEY);
      resolve();
    };
    if (currentAccessToken) {
      google.accounts.oauth2.revoke(currentAccessToken, finish);
    } else {
      finish();
    }
  });
}

// Devuelve un token de acceso válido para llamar a Google Sheets.
// Si la sesión ha caducado y no se puede renovar en silencio, marca el
// dispositivo como no vinculado y lanza REAUTH para que la app pida
// volver a conectar.
async function getGoogleToken() {
  if (!deviceLinked) throw new Error("Dispositivo no vinculado con Google.");
  if (currentAccessToken && Date.now() < tokenExpiresAt) return currentAccessToken;

  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if (resp.error) {
        deviceLinked = false;
        localStorage.removeItem(LINKED_FLAG_KEY);
        reject(new Error("REAUTH"));
        return;
      }
      currentAccessToken = resp.access_token;
      tokenExpiresAt = Date.now() + resp.expires_in * 1000 - 60000;
      resolve(currentAccessToken);
    };
    tokenClient.requestAccessToken({ prompt: "" });
  });
}
