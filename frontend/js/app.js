// app.js
// Todo el JavaScript de la página: pide datos al servidor con fetch y completa el HTML.

// Dirección del servidor (el backend de Express)
const API = 'http://localhost:3000/api';

// Sirven para ignorar respuestas viejas si el usuario toca dos cosas rápido
let ultimoPedido = 0;
let ultimoPedidoGp = 0;

// Id del piloto que se está viendo en la ficha
let pilotoActual = null;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// ---------- Utilidades ----------

// Pide datos al servidor (GET) y devuelve el JSON.
// Si el servidor responde con error, lanzamos un Error con su mensaje.
async function pedir(ruta) {
  const respuesta = await fetch(API + ruta);
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.error || 'Error del servidor');
  return datos;
}

// Envía datos al servidor (POST) en formato JSON y devuelve la respuesta.
async function enviar(ruta, cuerpo) {
  const respuesta = await fetch(API + ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo)
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.error || 'Error del servidor');
  return datos;
}

// Convierte un error en un texto entendible para el usuario.
// Si el servidor está apagado, fetch lanza un TypeError.
function textoError(err) {
  return err instanceof TypeError
    ? 'No se pudo conectar con el servidor. ¿Está corriendo?'
    : err.message;
}

// Crea un elemento HTML con clase y texto.
// Usamos textContent (y no innerHTML) para que ningún dato de la base pueda meter código en la página.
function crear(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

// Escribe un texto en el elemento que tiene ese id
function texto(id, valor) {
  document.getElementById(id).textContent = valor;
}

// Pasa "2026-11-01T03:00:00.000Z" a "1 de noviembre de 2026".
// Tomamos solo AAAA-MM-DD del texto para evitar corrimientos por la zona horaria.
function formatearFecha(iso) {
  const [anio, mes, dia] = iso.slice(0, 10).split('-');
  return Number(dia) + ' de ' + MESES[Number(mes) - 1] + ' de ' + anio;
}

// Muestra un mensaje verde (ok) o rojo (error) debajo de un formulario
function mostrarMensaje(elemento, mensaje, esOk) {
  elemento.textContent = mensaje;
  elemento.className = 'mensaje ' + (esOk ? 'is-ok' : 'is-error');
}

// Llena un <select> con opciones. La primera (value vacío) obliga a elegir.
function llenarSelect(select, opciones, textoVacio) {
  select.replaceChildren();
  const vacia = crear('option', '', textoVacio);
  vacia.value = '';
  select.append(vacia);
  opciones.forEach(o => {
    const opcion = crear('option', '', o.texto);
    opcion.value = o.valor;
    select.append(opcion);
  });
}

// Reemplaza el contenido de una tabla por una sola fila con un aviso
function filaAviso(cuerpoTabla, aviso) {
  const fila = document.createElement('tr');
  const celda = crear('td', '', aviso);
  celda.colSpan = 5;
  fila.append(celda);
  cuerpoTabla.replaceChildren(fila);
}

// Elige texto oscuro o blanco según el brillo del color de fondo, para que se lea bien.
function colorTexto(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const brillo = (r * 299 + g * 587 + b * 114) / 1000; // fórmula de brillo percibido
  return brillo > 150 ? '#0f172a' : '#ffffff';
}

// Imagen de respaldo con las iniciales del piloto (cuando falta su foto).
function fotoDeRespaldo(ficha, colorLetra) {
  const iniciales = ficha.nombre[0] + ficha.apellido[0];
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' +
    '<text x="100" y="125" font-size="80" font-weight="700" font-family="sans-serif" ' +
    'text-anchor="middle" fill="' + colorLetra + '" fill-opacity="0.7">' + iniciales + '</text></svg>';
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

// ---------- Navegación entre secciones ----------

function mostrarSeccion(nombre) {
  // Solo la sección elegida queda visible; las demás reciben "hidden"
  document.querySelectorAll('.seccion').forEach(seccion => {
    seccion.hidden = seccion.id !== nombre;
  });
  // Solo el botón elegido lleva la clase is-activo
  document.querySelectorAll('.barra__boton').forEach(boton => {
    boton.classList.toggle('is-activo', boton.dataset.seccion === nombre);
  });
}

document.querySelectorAll('.barra__boton').forEach(boton => {
  boton.addEventListener('click', () => mostrarSeccion(boton.dataset.seccion));
});

// ---------- Clasificación (columna izquierda) ----------

// Marca en la lista la fila del piloto que se está viendo
function marcarFilaSeleccionada() {
  document.querySelectorAll('#lista-clasificacion .fila').forEach(fila => {
    fila.classList.toggle('is-seleccionado', Number(fila.dataset.id) === pilotoActual);
  });
}

async function cargarClasificacion() {
  const lista = document.getElementById('lista-clasificacion');
  try {
    const pilotos = await pedir('/clasificacion/pilotos');
    const lider = Math.max(...pilotos.map(p => p.puntos_total));

    lista.replaceChildren(); // vaciamos el "Cargando…"
    pilotos.forEach(p => {
      const fila = crear('li', 'fila');
      fila.style.setProperty('--color-fila', p.color_hex); // el CSS usa esta variable
      fila.dataset.id = p.id_piloto;
      fila.tabIndex = 0; // permite llegar con el teclado

      // Diferencia de puntos con el líder
      const dif = p.puntos_total === lider ? 'LÍDER' : '−' + (lider - p.puntos_total);

      fila.append(
        crear('span', 'fila__pos', p.posicion),
        crear('span', 'fila__codigo', p.codigo),
        crear('span', 'fila__dif', dif)
      );

      fila.addEventListener('click', () => elegirPiloto(p.id_piloto));
      fila.addEventListener('keydown', evento => {
        if (evento.key === 'Enter' || evento.key === ' ') {
          evento.preventDefault();
          elegirPiloto(p.id_piloto);
        }
      });
      lista.append(fila);
    });
    marcarFilaSeleccionada();
    return pilotos;
  } catch (err) {
    console.error(err);
    lista.replaceChildren(crear('li', '', 'No se pudo cargar. ¿Está corriendo el servidor (node server.js)?'));
    return [];
  }
}

// ---------- Ficha del piloto (sección Inicio) ----------

async function elegirPiloto(id) {
  const turno = ++ultimoPedido;
  pilotoActual = id;
  marcarFilaSeleccionada();

  try {
    const ficha = await pedir('/pilotos/' + id);
    if (turno !== ultimoPedido) return; // llegó tarde: ya se eligió otro piloto
    pintarFicha(ficha);
  } catch (err) {
    console.error(err);
    texto('piloto-nombre', 'No se pudo cargar la ficha');
  }
}

function pintarFicha(f) {
  // Tarjeta grande: colores de la escudería (el CSS lee estas dos variables)
  const tarjeta = document.getElementById('tarjeta-piloto');
  const colorLetra = colorTexto(f.color_hex);
  tarjeta.style.setProperty('--color-equipo', f.color_hex);
  tarjeta.style.setProperty('--color-texto-equipo', colorLetra);

  texto('piloto-numero', f.numero_coche);
  texto('piloto-escuderia', f.escuderia);
  texto('piloto-nombre', f.nombre + ' ' + f.apellido);

  // Foto por código del piloto; si no existe, mostramos las iniciales
  const foto = document.getElementById('piloto-foto');
  foto.onerror = () => {
    foto.onerror = null; // evita un bucle si el respaldo también fallara
    foto.src = fotoDeRespaldo(f, colorLetra);
  };
  foto.src = 'img/pilotos/' + f.codigo + '.png';
  foto.alt = 'Foto de ' + f.nombre + ' ' + f.apellido;

  // Medidor de sanciones: el arco mide 100 (pathLength), así que llenamos pct de 100
  const puntosSancion = f.puntos_penalizacion ?? 0;
  const pct = Math.min(puntosSancion, 12) / 12 * 100;
  document.getElementById('medidor-valor').style.strokeDasharray = pct + ' 100';
  texto('medidor-numero', puntosSancion);
  texto('estado-licencia', f.estado_licencia || 'Sin licencia');

  // Cifras (un piloto recién creado todavía no tiene datos: mostramos 0)
  texto('cifra-puntos', f.puntos_total ?? 0);
  texto('cifra-victorias', f.victorias ?? 0);
  texto('cifra-podios', f.podios ?? 0);

  // Escudería
  texto('esc-nombre', f.escuderia);
  texto('esc-motorista', f.motorista);
  texto('esc-jefe', f.jefe_equipo);
  texto('esc-sede', f.sede);

  // Últimas 5 carreras
  const lista = document.getElementById('ultimas-carreras');
  lista.replaceChildren();
  if (f.ultimas_carreras.length === 0) {
    lista.append(crear('li', '', 'Todavía no corrió carreras'));
  }
  f.ultimas_carreras.forEach(c => {
    const puntos = c.puntos + c.puntos_sprint;
    const resultado = (c.posicion ? 'P' + c.posicion : c.estado_final) + ' · ' + puntos + ' pts';
    const item = crear('li', 'ficha');
    item.append(crear('span', '', c.nombre_gp), crear('span', '', resultado));
    lista.append(item);
  });
}

// ---------- Resultados ----------

// Llena el desplegable con las carreras disputadas y muestra la última
async function cargarListaCarreras() {
  const select = document.getElementById('select-gp');
  try {
    const carreras = await pedir('/carreras');
    select.replaceChildren();
    carreras.forEach(c => {
      const opcion = crear('option', '', 'R' + c.ronda + ' · ' + c.nombre_gp);
      opcion.value = c.ronda;
      select.append(opcion);
    });
    // Cada vez que se cambia de GP, pedimos sus resultados
    select.addEventListener('change', () => cargarResultados(select.value));
    if (carreras.length > 0) cargarResultados(carreras[0].ronda);
  } catch (err) {
    console.error(err);
    filaAviso(document.getElementById('tabla-resultados'), 'No se pudieron cargar las carreras');
  }
}

async function cargarResultados(ronda) {
  const turno = ++ultimoPedidoGp;
  const cuerpo = document.getElementById('tabla-resultados');
  try {
    const gp = await pedir('/carreras/' + ronda);
    if (turno !== ultimoPedidoGp) return; // llegó tarde

    // Datos del Gran Premio
    texto('gp-nombre', gp.nombre_gp);
    texto('gp-fecha', formatearFecha(gp.fecha));
    texto('gp-circuito', gp.circuito + ' (' + gp.ciudad + ', ' + gp.pais + ')');
    texto('gp-ganador', gp.ganador || '–');

    // Tabla de posiciones: una fila <tr> por piloto
    cuerpo.replaceChildren();
    gp.resultados.forEach(r => {
      const fila = document.createElement('tr');

      const celdaPiloto = crear('td', '', r.piloto);
      celdaPiloto.style.borderLeft = '4px solid ' + r.color_hex; // franja con el color del equipo

      // Si hubo puntos de sprint en ese fin de semana, los mostramos aparte
      const puntos = r.puntos_sprint > 0
        ? r.puntos + ' (+' + r.puntos_sprint + ' sprint)'
        : String(r.puntos);

      fila.append(
        crear('td', '', r.posicion ?? '–'),
        celdaPiloto,
        crear('td', '', r.escuderia),
        crear('td', '', puntos),
        crear('td', '', r.estado_final)
      );
      cuerpo.append(fila);
    });
  } catch (err) {
    console.error(err);
    filaAviso(cuerpo, 'No se pudieron cargar los resultados');
  }
}

// ---------- Estadísticas ----------

// Dona de puntos por escudería (se dibuja con CSS conic-gradient)
async function cargarDona() {
  const dona = document.getElementById('dona');
  const leyenda = document.getElementById('leyenda-dona');
  try {
    const escuderias = await pedir('/clasificacion/escuderias');
    const total = escuderias.reduce((suma, e) => suma + e.puntos_total, 0);

    leyenda.replaceChildren();
    const tramos = [];
    let acumulado = 0; // porcentaje donde empieza cada tramo

    // Las escuderías sin puntos no ocupan lugar en la dona
    escuderias.filter(e => e.puntos_total > 0).forEach(e => {
      const pct = e.puntos_total / total * 100;
      tramos.push(e.color_hex + ' ' + acumulado.toFixed(2) + '% ' + (acumulado + pct).toFixed(2) + '%');
      acumulado += pct;

      // Leyenda: cuadradito de color (<i>) + nombre, puntos y porcentaje
      const item = crear('li');
      item.style.setProperty('--color-item', e.color_hex);
      item.append(
        crear('i'),
        document.createTextNode(e.escuderia + ' · ' + e.puntos_total + ' pts (' + pct.toFixed(1) + '%)')
      );
      leyenda.append(item);
    });

    dona.style.setProperty('--dona-gradiente', 'conic-gradient(' + tramos.join(', ') + ')');
  } catch (err) {
    console.error(err);
    leyenda.replaceChildren(crear('li', '', 'No se pudo cargar la dona'));
  }
}

// Barras de victorias por piloto
async function cargarBarras() {
  const lista = document.getElementById('barras-victorias');
  try {
    const pilotos = await pedir('/victorias');
    const maximo = Math.max(...pilotos.map(p => p.victorias));

    lista.replaceChildren();
    pilotos.forEach(p => {
      const item = crear('li');
      item.style.setProperty('--color-item', p.color_hex);

      // La barra mide el porcentaje de victorias respecto al que más tiene
      const relleno = crear('div', 'barras__relleno');
      relleno.style.width = (p.victorias / maximo * 100) + '%';
      const pista = crear('div', 'barras__pista');
      pista.append(relleno);

      item.append(crear('span', '', p.piloto), pista, crear('span', '', p.victorias));
      lista.append(item);
    });
  } catch (err) {
    console.error(err);
    lista.replaceChildren(crear('li', '', 'No se pudieron cargar las victorias'));
  }
}

// ---------- Calendario ----------

async function cargarCalendario() {
  const lista = document.getElementById('linea-tiempo');
  try {
    const carreras = await pedir('/calendario');
    const disputadas = carreras.filter(c => c.disputada).length;

    // Contador y barra de avance
    texto('cal-disputadas', disputadas);
    texto('cal-total', carreras.length);
    const barra = document.getElementById('cal-progreso');
    barra.max = carreras.length;
    barra.value = disputadas;

    // Línea de tiempo: una carrera por línea, con su estado
    lista.replaceChildren();
    carreras.forEach(c => {
      const item = crear('li', 'linea__item ' + (c.disputada ? 'is-disputada' : 'is-pendiente'));
      const estado = c.disputada ? 'Ganó ' + c.ganador : 'Pendiente';
      item.append(
        crear('strong', '', 'R' + c.ronda + ' · ' + c.nombre_gp),
        crear('span', '', formatearFecha(c.fecha) + ' · ' + c.circuito),
        crear('span', 'insignia', estado)
      );
      lista.append(item);
    });
  } catch (err) {
    console.error(err);
    lista.replaceChildren(crear('li', '', 'No se pudo cargar el calendario'));
  }
}

// ---------- Gestión: desplegables e historial ----------

// Llena los desplegables de los dos formularios con datos de la base
async function cargarDesplegables() {
  try {
    const [pilotos, escuderias] = await Promise.all([pedir('/pilotos'), pedir('/escuderias')]);

    llenarSelect(
      document.getElementById('sancion-piloto'),
      pilotos.map(p => ({ valor: p.id_piloto, texto: p.codigo + ' · ' + p.nombre + ' ' + p.apellido })),
      'Elegí un piloto'
    );
    llenarSelect(
      document.getElementById('p-escuderia'),
      escuderias.map(e => ({ valor: e.id_escuderia, texto: e.nombre })),
      'Elegí una escudería'
    );
  } catch (err) {
    console.error(err);
  }
}

async function cargarHistorial() {
  const cuerpo = document.getElementById('tabla-historial');
  try {
    const sanciones = await pedir('/sanciones');
    if (sanciones.length === 0) {
      filaAviso(cuerpo, 'Todavía no hay sanciones');
      return;
    }
    cuerpo.replaceChildren();
    sanciones.forEach(s => {
      const fila = document.createElement('tr');
      fila.append(
        crear('td', '', new Date(s.fecha).toLocaleString('es-AR')),
        crear('td', '', s.piloto),
        crear('td', '', '+' + s.puntos_agregados),
        crear('td', '', s.puntos_total),
        crear('td', '', s.estado_resultante)
      );
      cuerpo.append(fila);
    });
  } catch (err) {
    console.error(err);
    filaAviso(cuerpo, 'No se pudo cargar el historial');
  }
}

// ---------- Gestión: formulario de sanción ----------

document.getElementById('form-sancion').addEventListener('submit', async evento => {
  evento.preventDefault(); // evita que el navegador recargue la página al enviar
  const formulario = evento.target;
  const mensaje = document.getElementById('mensaje-sancion');
  const boton = formulario.querySelector('button[type="submit"]');
  const id = Number(formulario.elements.id_piloto.value);

  boton.disabled = true; // evita enviar dos veces seguidas
  try {
    const r = await enviar('/sanciones', {
      id_piloto: id,
      puntos: Number(formulario.elements.puntos.value)
    });
    mostrarMensaje(mensaje, r.mensaje, true);
    await cargarHistorial();                // refrescamos el historial
    if (id === pilotoActual) elegirPiloto(id); // y la ficha, si es el piloto que se está viendo
  } catch (err) {
    mostrarMensaje(mensaje, textoError(err), false);
  } finally {
    boton.disabled = false;
  }
});

// ---------- Gestión: formulario de alta de piloto ----------

// El código se escribe siempre en mayúsculas (el campo exige 3 letras A-Z)
const campoCodigo = document.getElementById('p-codigo');
campoCodigo.addEventListener('input', () => {
  campoCodigo.value = campoCodigo.value.toUpperCase();
});

document.getElementById('form-piloto').addEventListener('submit', async evento => {
  evento.preventDefault();
  const formulario = evento.target;
  const mensaje = document.getElementById('mensaje-piloto');
  const boton = formulario.querySelector('button[type="submit"]');
  const campos = formulario.elements; // los campos, por su atributo name

  // Armamos el objeto con los datos; los nombres coinciden con las columnas de la tabla piloto
  const piloto = {
    nombre: campos.nombre.value,
    apellido: campos.apellido.value,
    nacionalidad: campos.nacionalidad.value,
    fecha_nacimiento: campos.fecha_nacimiento.value,
    numero_coche: Number(campos.numero_coche.value),
    codigo: campos.codigo.value,
    id_escuderia: Number(campos.id_escuderia.value)
  };

  boton.disabled = true;
  try {
    const r = await enviar('/pilotos', piloto);
    mostrarMensaje(mensaje, r.mensaje, true);
    formulario.reset();
    // Refrescamos todo lo que muestra pilotos: la clasificación y el desplegable de sanciones
    await Promise.all([cargarClasificacion(), cargarDesplegables()]);
  } catch (err) {
    mostrarMensaje(mensaje, textoError(err), false);
  } finally {
    boton.disabled = false;
  }
});

// ---------- Arranque ----------

async function iniciar() {
  // Pedimos todo a la vez; cada función maneja sus propios errores
  const [pilotos] = await Promise.all([
    cargarClasificacion(),
    cargarListaCarreras(),
    cargarDona(),
    cargarBarras(),
    cargarCalendario(),
    cargarDesplegables(),
    cargarHistorial()
  ]);
  // Al abrir la página mostramos la ficha del líder
  if (pilotos.length > 0) elegirPiloto(pilotos[0].id_piloto);
}

iniciar();