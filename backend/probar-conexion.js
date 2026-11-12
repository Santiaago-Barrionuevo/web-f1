// probar-conexion.js
// Prueba rápida: ¿Node puede hablar con PostgreSQL?

// Importamos el Pool de conexiones que armamos en db.js
const pool = require('./db');

async function probar() {
  try {
    // Pedimos a la base cuántas filas tiene la tabla resultados
    const r = await pool.query('SELECT COUNT(*) AS total FROM resultados');
    console.log('Conexión OK. Filas en resultados:', r.rows[0].total);
  } catch (err) {
    // Si algo falla, mostramos el motivo
    console.error('Error de conexión:', err.message);
  } finally {
    // Cerramos el pool para que el programa termine solo
    await pool.end();
  }
}

probar();