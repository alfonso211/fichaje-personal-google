# Fichaje de Personal

App web instalable (PWA) para Android e iPhone. Cada empleado se identifica con un PIN y ficha Entrada / Descanso / Salida; cada fichaje se guarda al instante como una fila en una hoja de cálculo de Google Sheets dentro de tu Google Drive, junto con la ubicación del dispositivo. No hay servidor ni base de datos externa: la app habla directamente con tu propia cuenta de Google a través de la API de Google Sheets.

Un panel de administrador (solo accesible con usuario y contraseña) permite dar de alta y editar empleados, asignarles empresa y PIN, y consultar los fichajes recientes, sin tocar código ni la hoja de cálculo a mano.

Hay que hacer 4 cosas una sola vez para dejarlo funcionando: crear la hoja de cálculo, crear las credenciales en Google Cloud, rellenar `config.js`, y publicar la app en una URL con https (los móviles no pueden instalar una PWA desde un archivo local).

---

## 1. Crear la hoja de cálculo en Google Drive

Esta hoja tiene **dos pestañas**: una donde se guardan los fichajes, y otra donde el administrador gestiona los empleados.

1. Ve a [drive.google.com](https://drive.google.com) con tu cuenta de Google Workspace, y navega hasta la carpeta `1._INVERSIETE S.A / 2._PERSONAL / 1._FICHAJE_PERSONAL` (la misma que ves en `H:\` en este PC — es la misma carpeta, sincronizada).
2. **Nuevo → Hojas de cálculo de Google → En blanco**. Nómbrala **`Fichaje_Personal`**.

**Pestaña de fichajes** (la primera, por defecto se llama "Hoja 1"):

3. Haz doble clic en el nombre de la pestaña (abajo a la izquierda) y cámbialo a **`Fichajes`**.
4. En la primera fila, escribe estas cabeceras, una por columna, en este orden exacto:

   | Empresa | Nombre | Apellidos | Entrada | Descanso | Salida | Ubicación |
   |---|---|---|---|---|---|---|

**Pestaña de empleados** (pulsa el **+** de abajo para añadir una pestaña nueva):

5. Nómbrala **`Empleados`**.
6. En la primera fila, escribe estas cabeceras, en este orden exacto:

   | Nombre | Apellidos | Empresa | PIN |
   |---|---|---|---|

7. No hace falta rellenar filas: los empleados se añaden luego desde el panel de administrador de la propia app.

8. Copia el **ID de la hoja de cálculo**: está en la URL, entre `/d/` y `/edit`:

   `https://docs.google.com/spreadsheets/d/`**`ESTE-ES-EL-ID`**`/edit`

Guárdalo, lo necesitas en el paso 3.

> Si usas otros nombres de pestaña, recuerda reflejarlo luego en `config.js`.

---

## 2. Crear las credenciales en Google Cloud

Esto le da permiso a la app para leer y escribir en tu hoja de cálculo, sin exponer contraseñas.

1. Ve a [console.cloud.google.com](https://console.cloud.google.com) con tu cuenta de Google Workspace.
2. Arriba, en el selector de proyectos, crea un **proyecto nuevo** (por ejemplo, `Fichaje Personal`) o usa uno existente.
3. Ve a **APIs y servicios → Biblioteca**, busca **Google Sheets API** y pulsa **Habilitar**.
4. Ve a **APIs y servicios → Pantalla de consentimiento de OAuth**:
   - **Tipo de usuario**: elige **Interno** (solo visible con cuenta de Google Workspace; esto hace que solo la gente de tu organización pueda usar la app, y evita el proceso de revisión pública de Google).
   - Rellena **Nombre de la aplicación** (`Fichaje de Personal`), tu correo como **correo de asistencia** y como **datos de contacto del desarrollador**.
   - En **Permisos (Scopes)**, pulsa **Añadir o quitar permisos**, busca "Sheets" y marca el permiso `.../auth/spreadsheets` (Ver, editar, crear y eliminar hojas de cálculo de Google Sheets). Guarda.
   - Guarda el resto de pasos con los valores por defecto.
5. Ve a **APIs y servicios → Credenciales → + Crear credenciales → ID de cliente de OAuth**:
   - **Tipo de aplicación**: **Aplicación web**.
   - **Nombre**: `Fichaje Personal Web`.
   - En **Orígenes de JavaScript autorizados**, de momento déjalo vacío; lo completas en el paso 4 con la URL donde publiques la app (aquí solo hace falta el dominio, sin ruta ni barra final — a diferencia de otros proveedores).
   - Pulsa **Crear**.
6. Copia el **ID de cliente** (termina en `.apps.googleusercontent.com`). Lo necesitas en el paso 3.

---

## 3. Configurar `config.js`

Abre [js/config.js](js/config.js) y edita:

- `google.clientId`: el ID de cliente del paso 2.
- `sheets.spreadsheetId`: el ID de la hoja de cálculo del paso 1.
- `sheets.hojaFichajes` / `sheets.hojaEmpleados`: nombres de las pestañas (por defecto `Fichajes` y `Empleados`).
- `admin.usuario` y `admin.clave`: credenciales para entrar al panel de administrador. Cámbialas por unas propias (ver el aviso de seguridad en la sección 7).

Los empleados **no se escriben en este archivo**: se dan de alta desde el panel de administrador dentro de la propia app (ver sección 7).

---

## 4. Publicar la app en una URL con https

Los navegadores solo permiten instalar una PWA y el inicio de sesión de Google desde una dirección **https** pública, no desde un archivo abierto directamente en el móvil. La opción más sencilla y gratuita es **GitHub Pages**:

1. Crea una cuenta gratuita en [github.com](https://github.com) si no tienes una.
2. Crea un repositorio nuevo (puede ser privado), por ejemplo `fichaje-personal`.
3. Sube todo el contenido de esta carpeta (`index.html`, `manifest.json`, `service-worker.js`, `css/`, `js/`, `icons/`, `README.md`) a ese repositorio.
4. En el repositorio, ve a **Settings → Pages**, y en "Source" elige la rama principal (`main`) y carpeta `/ (root)`. Guarda.
5. GitHub te dará una URL del tipo `https://tu-usuario.github.io/fichaje-personal/`. Espera 1-2 minutos a que se publique.
6. Vuelve a **Google Cloud Console → Credenciales → tu ID de cliente**, y en **Orígenes de JavaScript autorizados** añade **solo el origen**, sin ruta: `https://tu-usuario.github.io` (sin `/fichaje-personal/` al final). Guarda.

> Alternativas igual de válidas si prefieres no usar GitHub: Azure Static Web Apps, Netlify o Cloudflare Pages. El paso 6 es el mismo: registrar ahí el origen final en Google Cloud.

---

## 5. Instalar la app en los móviles

- **Android (Chrome):** abre la URL, pulsa el menú (⋮) y elige **"Instalar aplicación"** o **"Añadir a la pantalla de inicio"**.
- **iPhone (Safari):** abre la URL, pulsa el icono de **compartir** y elige **"Añadir a pantalla de inicio"**.

Queda un icono como el de cualquier app normal.

---

## 6. Primer uso

1. Abre la app en el dispositivo (puede ser un móvil/tablet compartido en la entrada, o el móvil de cada persona).
2. Pulsa **"Conectar con Google"** e inicia sesión con la cuenta de Google Workspace que tiene acceso a la hoja de cálculo del paso 1. Esto se hace **una sola vez por dispositivo**.
3. Entra en **"Administración"** (ver siguiente sección) y da de alta al primer empleado.
4. A partir de ahí, cada empleado simplemente elige su nombre e introduce su PIN para fichar Entrada, Descanso o Salida. No necesita cuenta de Google propia.

Para desvincular un dispositivo (por ejemplo, si se pierde o se sustituye), hay un enlace **"Desvincular este dispositivo"** en la pantalla de selección de empleado.

---

## 7. Panel de administrador

En la pantalla "¿Quién eres?" hay un enlace **"Administración"**. Pide el usuario y la contraseña configurados en `config.js` (`admin.usuario` / `admin.clave`, por defecto Alfonso Ruiz).

Desde ahí, Alfonso puede:

- **Ver, editar y eliminar empleados**: nombre, apellidos, empresa asignada y PIN.
- **Añadir empleados nuevos** con su empresa y PIN.
- **Ver los fichajes más recientes** (los últimos 30) sin necesidad de abrir la hoja de cálculo.

Los cambios se guardan al instante en Google Sheets; no hace falta volver a publicar la app.

> **Aviso de seguridad importante:** esta app no tiene servidor propio — todo el código corre en el navegador del móvil. La comprobación de usuario/contraseña del panel de administrador se hace ahí mismo, lo que significa que **no es una protección fuerte**: cualquier persona con conocimientos técnicos podría ver la contraseña en el código fuente de la página o saltarse la comprobación. Es suficiente para evitar que un empleado entre por error o curiosidad, pero no para proteger datos sensibles frente a alguien decidido a acceder. No reutilices esa contraseña en ningún otro sitio. Esto es así independientemente de si el almacenamiento es Google o Microsoft: la protección real vendría de un servidor backend propio (un proyecto bastante más grande que esta app).

---

## Notas

- El PIN identifica al empleado, no sustituye una contraseña de seguridad fuerte; no compartas dispositivos con personas ajenas al equipo.
- Fichar requiere conexión a internet (el fichaje se escribe directamente en Google Sheets en el momento).
- La ubicación se obtiene del GPS del dispositivo en el momento de fichar. Si el empleado deniega el permiso de ubicación, el fichaje se guarda igualmente con "No disponible" en esa columna.
- Para añadir, editar o eliminar empleados: usa el panel de **Administración** dentro de la app (sección 7). Ya no hace falta editar código ni volver a publicar nada para eso.
- La sesión con Google se renueva sola mientras la cuenta siga conectada en ese navegador/dispositivo. Si alguien cierra sesión de Google manualmente en ese dispositivo, la app lo detecta y pide volver a pulsar "Conectar con Google".
- Solo se pide permiso de acceso a Google Sheets (no a todo Google Drive), para reducir al mínimo lo que la app puede tocar en tu cuenta.
