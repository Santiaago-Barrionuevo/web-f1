// server.js
// Servidor web: recibe pedidos del navegador y responde con datos de la base.

// Cargamos las variables del archivo .env (PORT, etc.)
require('dotenv').config();

const express = require('express'); // framework para crear el servidor
const cors = require('cors');       // permite que el frontend (otro puerto) nos pida datos
const pool = require('./db');       // conexión a PostgreSQL

const app = express();

// Middleware: se ejecutan antes de cada ruta
app.use(cors());          // habilita CORS
app.use(express.json());  // permite leer el cuerpo de los pedidos en formato JSON

// Función auxiliar: ejecuta una consulta y responde con las filas en JSON.
// Así no repetimos el try/catch en cada ruta.
async function responder(res, sql, params, mensajeError) {
  try {
    const r = await pool.query(sql, params);
    res.json(r.rows);
  } catch (err) {
    console.error(err.message); // el motivo real queda en la terminal
    res.status(500).json({ error: mensajeError });
  }
}

// Ruta de prueba: sirve para ver que el servidor está vivo
app.get('/api/salud', (req, res) => {
  res.json({ ok: true });
});

// Clasificación de pilotos (vista v_clasificacion_pilotos)
app.get('/api/clasificacion/pilotos', (req, res) => {
  responder(
    res,
    'SELECT * FROM v_clasificacion_pilotos ORDER BY posicion',
    [],
    'No se pudo obtener la clasificación de pilotos'
  );
});

// Clasificación de escuderías (vista v_clasificacion_escuderias)
app.get('/api/clasificacion/escuderias', (req, res) => {
  responder(
    res,
    'SELECT * FROM v_clasificacion_escuderias',
    [],
    'No se pudo obtener la clasificación de escuderías'
  );
});

// Victorias por piloto (para las barras de estadísticas).
// Solo los que ganaron al menos una carrera, de mayor a menor.
app.get('/api/victorias', (req, res) => {
  responder(
    res,
    `SELECT codigo, piloto, escuderia, color_hex, victorias
       FROM v_clasificacion_pilotos
      WHERE victorias > 0
      ORDER BY victorias DESC, piloto`,
    [],
    'No se pudieron obtener las victorias'
  );
});

// Calendario completo: las 23 carreras con su estado y ganador (vista v_calendario)
app.get('/api/calendario', (req, res) => {
  responder(
    res,
    `SELECT ronda, nombre_gp, fecha, circuito, ciudad, pais, disputada, ganador
       FROM v_calendario
      ORDER BY ronda`,
    [],
    'No se pudo obtener el calendario'
  );
});

// Historial de sanciones (tabla historial_sanciones), la más reciente primero
app.get('/api/sanciones', (req, res) => {
  responder(
    res,
    `SELECT h.id_sancion, p.codigo, p.nombre || ' ' || p.apellido AS piloto,
            h.puntos_agregados, h.puntos_total, h.estado_resultante, h.fecha
       FROM historial_sanciones h
       JOIN piloto p ON p.id_piloto = h.id_piloto
      ORDER BY h.fecha DESC, h.id_sancion DESC
      LIMIT 50`,
    [],
    'No se pudo obtener el historial de sanciones'
  );
});

// Aplicar una sanción: llama al procedimiento almacenado de la base.
// Espera un JSON así: { "id_piloto": 10, "puntos": 2 }
app.post('/api/sanciones', async (req, res) => {
  const id = Number(req.body.id_piloto);
  const puntos = Number(req.body.puntos);

  // Validamos la entrada antes de tocar la base
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Elegí un piloto válido' });
  }
  if (!Number.isInteger(puntos) || puntos < 1 || puntos > 12) {
    return res.status(400).json({ error: 'Los puntos de sanción deben ser un entero entre 1 y 12' });
  }

  try {
    // ¿Existe el piloto?
    const existe = await pool.query('SELECT 1 FROM piloto WHERE id_piloto = $1', [id]);
    if (existe.rows.length === 0) {
      return res.status(404).json({ error: 'Piloto no encontrado' });
    }

    // El procedimiento suma los puntos, valida y suspende con 12 o más.
    // El trigger registra la sanción en historial_sanciones.
    await pool.query('CALL aplicar_sancion_piloto($1, $2)', [id, puntos]);

    // Leemos cómo quedó la licencia para mostrárselo al usuario
    const lic = await pool.query(
      'SELECT estado, puntos_penalizacion FROM superlicencia WHERE id_piloto = $1',
      [id]
    );
    const { estado, puntos_penalizacion } = lic.rows[0];

    res.json({
      ok: true,
      estado,
      puntos_penalizacion,
      mensaje: `Sanción aplicada. Puntos acumulados: ${puntos_penalizacion}. Licencia: ${estado}.`
    });
  } catch (err) {
    console.error(err.message);
    // P0001 = error lanzado a propósito dentro del procedimiento (RAISE EXCEPTION)
    if (err.code === 'P0001') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'No se pudo aplicar la sanción' });
  }
});

// Lista de pilotos activos, para el desplegable de sanciones
app.get('/api/pilotos', (req, res) => {
  responder(
    res,
    `SELECT p.id_piloto, p.codigo, p.nombre, p.apellido, p.numero_coche,
            e.nombre AS escuderia
       FROM piloto p
       JOIN escuderia e ON e.id_escuderia = p.id_escuderia
      WHERE p.activo = true
      ORDER BY p.apellido`,
    [],
    'No se pudo obtener la lista de pilotos'
  );
});

// Lista de escuderías activas, para el desplegable del alta de piloto
app.get('/api/escuderias', (req, res) => {
  responder(
    res,
    `SELECT id_escuderia, nombre
       FROM escuderia
      WHERE activa = true
      ORDER BY nombre`,
    [],
    'No se pudo obtener la lista de escuderías'
  );
});

// Alta de piloto + su superlicencia, en UNA sola transacción.
// Espera: { nombre, apellido, nacionalidad, fecha_nacimiento, numero_coche, codigo, id_escuderia }
app.post('/api/pilotos', async (req, res) => {
  const b = req.body;

  // Limpiamos y convertimos cada dato recibido
  const nombre = String(b.nombre || '').trim();
  const apellido = String(b.apellido || '').trim();
  const nacionalidad = String(b.nacionalidad || '').trim();
  const nacimiento = String(b.fecha_nacimiento || '').trim();
  const numero = Number(b.numero_coche);
  const codigo = String(b.codigo || '').trim().toUpperCase();
  const idEscuderia = Number(b.id_escuderia);

  // Validaciones (devolvemos 400 = pedido incorrecto)
  if (!nombre || !apellido || !nacionalidad) {
    return res.status(400).json({ error: 'Completá nombre, apellido y nacionalidad' });
  }
  const fecha = new Date(nacimiento);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nacimiento) || isNaN(fecha) || fecha > new Date()) {
    return res.status(400).json({ error: 'La fecha de nacimiento no es válida' });
  }
  if (!Number.isInteger(numero) || numero < 1 || numero > 99) {
    return res.status(400).json({ error: 'El número de coche debe ser un entero entre 1 y 99' });
  }
  if (!/^[A-Z]{3}$/.test(codigo)) {
    return res.status(400).json({ error: 'El código debe tener exactamente 3 letras (por ejemplo VER)' });
  }
  if (!Number.isInteger(idEscuderia)) {
    return res.status(400).json({ error: 'Elegí una escudería' });
  }

    // ¿Ya existe ese código, o ese número entre los pilotos activos?
    const repetido = await pool.query(
      'SELECT codigo, numero_coche FROM piloto WHERE codigo = $1 OR (numero_coche = $2 AND activo = true)',
      [codigo, numero]
    );
    // Si alguna fila tiene el mismo código, avisamos del código; si no, el choque es el número
    if (repetido.rows.some(p => p.codigo === codigo)) {
      return res.status(409).json({ error: 'El código ' + codigo + ' ya está usado por otro piloto' });
    }
    if (repetido.rows.length > 0) {
      return res.status(409).json({ error: 'El número ' + numero + ' ya lo usa otro piloto activo' });
    }

  // Pedimos UNA conexión del pool: una transacción tiene que usar siempre la misma
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // empieza la transacción

    // 1) Insertamos el piloto y nos quedamos con el id que le asignó la base
    const nuevo = await client.query(
      `INSERT INTO piloto
         (nombre, apellido, nacionalidad, fecha_nacimiento,
          numero_coche, id_escuderia, codigo, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING id_piloto`,
      [nombre, apellido, nacionalidad, nacimiento, numero, idEscuderia, codigo]
    );
    const idPiloto = nuevo.rows[0].id_piloto;

    // 2) Le creamos la superlicencia (relación 1:1): Activa y sin puntos
    await client.query(
      `INSERT INTO superlicencia (estado, puntos_penalizacion, id_piloto)
       VALUES ('Activa', 0, $1)`,
      [idPiloto]
    );

    await client.query('COMMIT'); // se guardan los dos cambios juntos
    res.status(201).json({
      ok: true,
      id_piloto: idPiloto,
      mensaje: `Piloto ${nombre} ${apellido} (${codigo}) creado con su superlicencia.`
    });
  } catch (err) {
    await client.query('ROLLBACK'); // si algo falló, se deshace todo
    console.error(err.message);
    if (err.code === '23503') {
      return res.status(400).json({ error: 'La escudería elegida no existe' });
    }
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un registro con esos datos' });
    }
    if (err.code === '22001') {
      return res.status(400).json({ error: 'Algún texto es demasiado largo' });
    }
    res.status(500).json({ error: 'No se pudo crear el piloto' });
  } finally {
    client.release(); // devolvemos la conexión al pool, pase lo que pase
  }
});

// Ficha de un piloto: datos, escudería, licencia, puntos y últimas 5 carreras.
// El :id de la dirección llega en req.params.id
app.get('/api/pilotos/:id', async (req, res) => {
  // Validamos la entrada: tiene que ser un número entero
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'El id del piloto debe ser un número' });
  }

  try {
    // Datos del piloto + su escudería + su licencia + sus totales.
    // Usamos $1 para pasar el id de forma segura (evita inyección SQL).
    const consultaFicha = pool.query(
      `SELECT p.id_piloto, p.codigo, p.nombre, p.apellido, p.nacionalidad,
              p.fecha_nacimiento, p.numero_coche, p.foto_url,
              e.nombre AS escuderia, e.color_hex, e.sede,
              e.jefe_equipo, e.motorista,
              s.estado AS estado_licencia, s.puntos_penalizacion,
              c.posicion, c.puntos_total, c.victorias, c.podios
         FROM piloto p
         JOIN escuderia e ON e.id_escuderia = p.id_escuderia
         LEFT JOIN superlicencia s ON s.id_piloto = p.id_piloto
         LEFT JOIN v_clasificacion_pilotos c ON c.id_piloto = p.id_piloto
        WHERE p.id_piloto = $1`,
      [id]
    );

    // Últimas 5 carreras del piloto, la más reciente primero
    const consultaCarreras = pool.query(
      `SELECT ca.ronda, ca.nombre_gp, ca.fecha,
              r.posicion, r.puntos, r.puntos_sprint, r.estado_final
         FROM resultados r
         JOIN carrera ca ON ca.id_carrera = r.id_carrera
        WHERE r.id_piloto = $1
        ORDER BY ca.ronda DESC
        LIMIT 5`,
      [id]
    );

    // Las dos consultas se hacen a la vez
    const [ficha, carreras] = await Promise.all([consultaFicha, consultaCarreras]);

    // Si no hay filas, el piloto no existe
    if (ficha.rows.length === 0) {
      return res.status(404).json({ error: 'Piloto no encontrado' });
    }

    // Devolvemos la ficha y le agregamos la lista de carreras
    res.json({ ...ficha.rows[0], ultimas_carreras: carreras.rows });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'No se pudo obtener la ficha del piloto' });
  }
});

// Lista de carreras ya disputadas (para el desplegable de resultados).
// Viene de la vista v_calendario; la más reciente primero.
app.get('/api/carreras', (req, res) => {
  responder(
    res,
    `SELECT ronda, nombre_gp, fecha, circuito, ganador
       FROM v_calendario
      WHERE disputada = true
      ORDER BY ronda DESC`,
    [],
    'No se pudo obtener la lista de carreras'
  );
});

// Resultados de un GP: datos de la carrera + tabla de posiciones.
// El :ronda de la dirección coincide con id_carrera.
app.get('/api/carreras/:ronda', async (req, res) => {
  // Validamos la entrada: tiene que ser un número entero
  const ronda = Number(req.params.ronda);
  if (!Number.isInteger(ronda)) {
    return res.status(400).json({ error: 'La ronda debe ser un número' });
  }

  try {
    // Datos generales del GP (vista v_calendario)
    const consultaGp = pool.query(
      `SELECT ronda, nombre_gp, fecha, circuito, ciudad, pais, ganador
         FROM v_calendario
        WHERE ronda = $1`,
      [ronda]
    );

    // Resultados de esa carrera, con el piloto y su escudería.
    // Los que no tienen posición (abandonos) van al final.
    const consultaResultados = pool.query(
      `SELECT r.posicion, p.codigo, p.nombre || ' ' || p.apellido AS piloto,
              e.nombre AS escuderia, e.color_hex,
              r.puntos, r.puntos_sprint, r.estado_final
         FROM resultados r
         JOIN piloto p ON p.id_piloto = r.id_piloto
         JOIN escuderia e ON e.id_escuderia = p.id_escuderia
        WHERE r.id_carrera = $1
        ORDER BY r.posicion NULLS LAST, p.apellido`,
      [ronda]
    );

    // Las dos consultas se hacen a la vez
    const [gp, resultados] = await Promise.all([consultaGp, consultaResultados]);

    // Si no hay datos del GP, la ronda no existe
    if (gp.rows.length === 0) {
      return res.status(404).json({ error: 'Carrera no encontrada' });
    }

    // Devolvemos los datos del GP y le agregamos los resultados
    res.json({ ...gp.rows[0], resultados: resultados.rows });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'No se pudieron obtener los resultados' });
  }
});

// Arrancamos el servidor en el puerto del .env (o 3000 si no está)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});