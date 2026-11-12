// db.js · Conexión a PostgreSQL
// Lee PGHOST, PGPORT, PGUSER, PGPASSWORD y PGDATABASE del archivo .env
require('dotenv').config();
const { Pool } = require('pg');

// Un "Pool" mantiene conexiones abiertas y las reutiliza en cada consulta
module.exports = new Pool();