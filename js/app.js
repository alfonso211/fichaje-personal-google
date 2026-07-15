// Lógica principal: vinculación del dispositivo, selección de empleado por
// PIN, registro de Entrada / Descanso / Salida con ubicación, y panel de
// administrador (alta/baja de empleados, ver fichajes recientes).

let currentEmployee = null;
let pinBuffer = "";
let filaHoyActual = null; // { index, values } de la fila de hoy del empleado activo
let empleadosCache = [];
let adminLogueado = false;

const $ = (id) => document.getElementById(id);

function pad(n) {
  return String(n).padStart(2, "0");
}
function formatFechaHora(d) {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function prefijoHoy(d) {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}

function obtenerUbicacion() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve("No disponible (dispositivo sin GPS)");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        resolve(`${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${Math.round(accuracy)}m)`);
      },
      () => resolve("No disponible (permiso denegado)"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  });
}

function mostrarPantalla(id) {
  document.querySelectorAll(".pantalla").forEach((el) => el.classList.add("oculto"));
  $(id).classList.remove("oculto");
}

function mostrarMensaje(texto, tipo = "info") {
  const el = $("mensaje-texto");
  el.textContent = texto;
  el.className = tipo;
  $("mensaje").classList.remove("oculto");
  clearTimeout(mostrarMensaje._t);
  mostrarMensaje._t = setTimeout(() => $("mensaje").classList.add("oculto"), 4000);
}

function manejarErrorGraph(err) {
  if (err.message === "REAUTH") {
    mostrarMensaje("Se ha cerrado la sesión de Google en este dispositivo. Vuelve a conectar.", "error");
    mostrarPantalla("pantalla-vincular");
    return;
  }
  console.error(err);
  mostrarMensaje(err.message || "Ha ocurrido un error. Inténtalo de nuevo.", "error");
}

// ---------- Vinculación del dispositivo con Google ----------

async function actualizarPantallaInicial() {
  await initAuth();
  if (isDeviceLinked()) {
    await mostrarPantallaEmpleados();
  } else {
    mostrarPantalla("pantalla-vincular");
  }
}

$("btn-vincular").addEventListener("click", async () => {
  if (CONFIG.google.clientId === "TU_CLIENT_ID_AQUI.apps.googleusercontent.com") {
    mostrarMensaje(
      "Falta configurar js/config.js: crea las credenciales en Google Cloud (README, paso 2) y pon el Client ID real.",
      "error"
    );
    return;
  }
  if (!location.protocol.startsWith("http")) {
    mostrarMensaje("Esta app debe abrirse desde una URL http(s), no como archivo local. Ver README, paso 4.", "error");
    return;
  }
  try {
    await linkDevice();
    await mostrarPantallaEmpleados();
  } catch (err) {
    console.error(err);
    mostrarMensaje(`No se pudo iniciar sesión con Google: ${err.message || err}`, "error");
  }
});
$("btn-desvincular").addEventListener("click", async () => {
  if (confirm("¿Desvincular este dispositivo de Google? Habrá que volver a conectar para fichar.")) {
    await unlinkDevice();
    mostrarPantalla("pantalla-vincular");
  }
});

// ---------- Selección de empleado ----------

async function mostrarPantallaEmpleados() {
  mostrarPantalla("pantalla-empleados");
  $("lista-empleados").innerHTML = "<p class='cargando'>Cargando empleados…</p>";
  try {
    await cargarEmpleados();
    construirListaEmpleados();
  } catch (err) {
    manejarErrorGraph(err);
    $("lista-empleados").innerHTML = "<p class='vacio'>No se ha podido cargar la lista de empleados.</p>";
  }
}

async function cargarEmpleados() {
  empleadosCache = await fetchEmpleados();
}

function construirListaEmpleados() {
  const cont = $("lista-empleados");
  cont.innerHTML = "";
  if (!empleadosCache.length) {
    cont.innerHTML = "<p class='vacio'>Todavía no hay empleados dados de alta. Pide al administrador que los añada.</p>";
    return;
  }
  empleadosCache.forEach((emp) => {
    const btn = document.createElement("button");
    btn.className = "btn-empleado";
    btn.textContent = `${emp.nombre} ${emp.apellidos}`;
    btn.addEventListener("click", () => seleccionarEmpleado(emp));
    cont.appendChild(btn);
  });
}

function seleccionarEmpleado(emp) {
  currentEmployee = emp;
  pinBuffer = "";
  actualizarPuntosPin();
  $("pin-empleado-nombre").textContent = `${emp.nombre} ${emp.apellidos}`;
  mostrarPantalla("pantalla-pin");
}

// ---------- Teclado PIN ----------

function actualizarPuntosPin() {
  $("pin-puntos").textContent = pinBuffer.length ? "●".repeat(pinBuffer.length) : "····";
}

document.querySelectorAll(".tecla-num").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (pinBuffer.length < 8) pinBuffer += btn.dataset.num;
    actualizarPuntosPin();
  });
});

$("btn-pin-borrar").addEventListener("click", () => {
  pinBuffer = pinBuffer.slice(0, -1);
  actualizarPuntosPin();
});

$("btn-pin-cancelar").addEventListener("click", () => {
  currentEmployee = null;
  pinBuffer = "";
  mostrarPantalla("pantalla-empleados");
});

$("btn-pin-entrar").addEventListener("click", async () => {
  if (pinBuffer === currentEmployee.pin) {
    pinBuffer = "";
    mostrarPantalla("pantalla-fichaje");
    $("fichaje-empleado-nombre").textContent = `${currentEmployee.nombre} ${currentEmployee.apellidos}`;
    await refrescarEstadoDia();
  } else {
    mostrarMensaje("PIN incorrecto", "error");
    pinBuffer = "";
    actualizarPuntosPin();
  }
});

// ---------- Pantalla de fichaje ----------

$("btn-cambiar-empleado").addEventListener("click", () => {
  currentEmployee = null;
  filaHoyActual = null;
  mostrarPantalla("pantalla-empleados");
});

function nombreCompleto(emp) {
  return `${emp.nombre} ${emp.apellidos}`.trim();
}

async function refrescarEstadoDia() {
  $("fichaje-estado").textContent = "Consultando estado del día…";
  setBotonesFichaje({ entrada: false, descanso: false, salida: false });
  try {
    filaHoyActual = await findTodayRow(nombreCompleto(currentEmployee), prefijoHoy(new Date()));
    if (!filaHoyActual) {
      $("fichaje-estado").textContent = "Aún no has fichado la entrada hoy.";
      setBotonesFichaje({ entrada: true, descanso: false, salida: false });
      return;
    }
    const v = filaHoyActual.values;
    const partes = [];
    if (v[COL.ENTRADA]) partes.push(`Entrada: ${v[COL.ENTRADA]}`);
    if (v[COL.DESCANSO]) partes.push(`Descanso: ${v[COL.DESCANSO]}`);
    if (v[COL.SALIDA]) partes.push(`Salida: ${v[COL.SALIDA]}`);
    $("fichaje-estado").textContent = partes.join(" · ");

    if (v[COL.SALIDA]) {
      setBotonesFichaje({ entrada: false, descanso: false, salida: false });
      $("fichaje-estado").textContent += " · Jornada completada";
    } else {
      setBotonesFichaje({ entrada: false, descanso: !v[COL.DESCANSO], salida: true });
    }
  } catch (err) {
    manejarErrorGraph(err);
  }
}

function setBotonesFichaje({ entrada, descanso, salida }) {
  $("btn-entrada").disabled = !entrada;
  $("btn-descanso").disabled = !descanso;
  $("btn-salida").disabled = !salida;
}

async function registrarEvento(tipo) {
  setBotonesFichaje({ entrada: false, descanso: false, salida: false });
  mostrarMensaje("Obteniendo ubicación y registrando…", "info");
  try {
    const ubicacion = await obtenerUbicacion();
    const ahora = formatFechaHora(new Date());

    if (tipo === "entrada") {
      await addEntradaRow(currentEmployee, ahora, ubicacion);
    } else {
      if (!filaHoyActual) throw new Error("Debes fichar primero la Entrada.");
      const campo = tipo === "descanso" ? COL.DESCANSO : COL.SALIDA;
      await actualizarCampoFila(filaHoyActual.index, filaHoyActual.values, campo, ahora, ubicacion);
    }
    mostrarMensaje(`${tipo[0].toUpperCase() + tipo.slice(1)} registrada correctamente.`, "success");
    await refrescarEstadoDia();
  } catch (err) {
    manejarErrorGraph(err);
    await refrescarEstadoDia();
  }
}

$("btn-entrada").addEventListener("click", () => registrarEvento("entrada"));
$("btn-descanso").addEventListener("click", () => registrarEvento("descanso"));
$("btn-salida").addEventListener("click", () => registrarEvento("salida"));

// ==================== Panel de administrador ====================

$("btn-abrir-admin").addEventListener("click", () => {
  $("admin-usuario").value = "";
  $("admin-clave").value = "";
  mostrarPantalla("pantalla-admin-login");
});

$("btn-admin-cancelar").addEventListener("click", () => mostrarPantalla("pantalla-empleados"));

$("btn-admin-entrar").addEventListener("click", () => {
  const usuario = $("admin-usuario").value.trim();
  const clave = $("admin-clave").value;
  if (usuario.toLowerCase() === CONFIG.admin.usuario.toLowerCase() && clave === CONFIG.admin.clave) {
    adminLogueado = true;
    mostrarPantalla("pantalla-admin");
    renderEmpleadosAdmin();
    $("lista-fichajes-admin").innerHTML = "";
  } else {
    mostrarMensaje("Usuario o clave incorrectos.", "error");
  }
});

$("btn-admin-volver").addEventListener("click", async () => {
  adminLogueado = false;
  await mostrarPantallaEmpleados();
});

function renderEmpleadosAdmin() {
  const cont = $("lista-empleados-admin");
  cont.innerHTML = "";
  if (!empleadosCache.length) {
    cont.innerHTML = "<p class='vacio'>Todavía no hay empleados dados de alta.</p>";
    return;
  }
  empleadosCache.forEach((emp) => {
    const card = document.createElement("div");
    card.className = "tarjeta-empleado-admin";
    pintarFilaEmpleado(card, emp);
    cont.appendChild(card);
  });
}

function pintarFilaEmpleado(card, emp) {
  card.innerHTML = `
    <div class="datos-empleado-admin">
      <strong>${escapeHtml(emp.nombre)} ${escapeHtml(emp.apellidos)}</strong>
      <span>Empresa: ${escapeHtml(emp.empresa)}</span>
      <span>PIN: ${escapeHtml(emp.pin)}</span>
    </div>
    <div class="acciones-empleado-admin">
      <button class="btn-editar-empleado">Editar</button>
      <button class="btn-eliminar-empleado">Eliminar</button>
    </div>
  `;
  card.querySelector(".btn-editar-empleado").addEventListener("click", () => activarEdicionEmpleado(card, emp));
  card.querySelector(".btn-eliminar-empleado").addEventListener("click", () => eliminarEmpleado(emp));
}

function activarEdicionEmpleado(card, emp) {
  card.innerHTML = `
    <div class="form-edicion-empleado">
      <input type="text" class="edit-nombre" value="${escapeHtml(emp.nombre)}" placeholder="Nombre" />
      <input type="text" class="edit-apellidos" value="${escapeHtml(emp.apellidos)}" placeholder="Apellidos" />
      <input type="text" class="edit-empresa" value="${escapeHtml(emp.empresa)}" placeholder="Empresa" />
      <input type="text" class="edit-pin" value="${escapeHtml(emp.pin)}" placeholder="PIN" inputmode="numeric" />
      <div class="acciones-empleado-admin">
        <button class="btn-guardar-empleado">Guardar</button>
        <button class="btn-cancelar-empleado">Cancelar</button>
      </div>
    </div>
  `;
  card.querySelector(".btn-guardar-empleado").addEventListener("click", async () => {
    const cambios = {
      nombre: card.querySelector(".edit-nombre").value.trim(),
      apellidos: card.querySelector(".edit-apellidos").value.trim(),
      empresa: card.querySelector(".edit-empresa").value.trim(),
      pin: card.querySelector(".edit-pin").value.trim(),
    };
    if (!cambios.nombre || !cambios.apellidos || !cambios.empresa || !cambios.pin) {
      mostrarMensaje("Todos los campos son obligatorios.", "error");
      return;
    }
    try {
      await actualizarEmpleadoRow(emp, cambios);
      mostrarMensaje("Empleado actualizado.", "success");
      await cargarEmpleados();
      renderEmpleadosAdmin();
    } catch (err) {
      manejarErrorGraph(err);
    }
  });
  card.querySelector(".btn-cancelar-empleado").addEventListener("click", () => pintarFilaEmpleado(card, emp));
}

async function eliminarEmpleado(emp) {
  if (!confirm(`¿Eliminar a ${emp.nombre} ${emp.apellidos}? Esta acción no se puede deshacer.`)) return;
  try {
    await eliminarEmpleadoRow(emp.index);
    mostrarMensaje("Empleado eliminado.", "success");
    await cargarEmpleados();
    renderEmpleadosAdmin();
  } catch (err) {
    manejarErrorGraph(err);
  }
}

$("btn-anadir-empleado").addEventListener("click", async () => {
  const nombre = $("nuevo-empleado-nombre").value.trim();
  const apellidos = $("nuevo-empleado-apellidos").value.trim();
  const empresa = $("nuevo-empleado-empresa").value.trim();
  const pin = $("nuevo-empleado-pin").value.trim();
  if (!nombre || !apellidos || !empresa || !pin) {
    mostrarMensaje("Rellena todos los campos para añadir un empleado.", "error");
    return;
  }
  try {
    await addEmpleadoRow(nombre, apellidos, empresa, pin);
    ["nuevo-empleado-nombre", "nuevo-empleado-apellidos", "nuevo-empleado-empresa", "nuevo-empleado-pin"].forEach(
      (id) => ($(id).value = "")
    );
    mostrarMensaje("Empleado añadido.", "success");
    await cargarEmpleados();
    renderEmpleadosAdmin();
  } catch (err) {
    manejarErrorGraph(err);
  }
});

$("btn-cargar-fichajes").addEventListener("click", async () => {
  $("lista-fichajes-admin").innerHTML = "<p class='cargando'>Cargando…</p>";
  try {
    const fichajes = await fetchFichajesRecientes(30);
    renderFichajesAdmin(fichajes);
  } catch (err) {
    manejarErrorGraph(err);
  }
});

function renderFichajesAdmin(fichajes) {
  const cont = $("lista-fichajes-admin");
  if (!fichajes.length) {
    cont.innerHTML = "<p class='vacio'>No hay fichajes registrados todavía.</p>";
    return;
  }
  cont.innerHTML = fichajes
    .map(
      (v) => `
    <div class="fila-fichaje-admin">
      <strong>${escapeHtml(v[COL.NOMBRE])} ${escapeHtml(v[COL.APELLIDOS])}</strong> · ${escapeHtml(v[COL.EMPRESA])}<br/>
      Entrada: ${escapeHtml(v[COL.ENTRADA] || "—")} · Descanso: ${escapeHtml(v[COL.DESCANSO] || "—")} · Salida: ${escapeHtml(v[COL.SALIDA] || "—")}<br/>
      Ubicación: ${escapeHtml(v[COL.UBICACION] || "—")}
    </div>`
    )
    .join("");
}

// ---------- Arranque ----------

actualizarPantallaInicial();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
