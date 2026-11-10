# F1 2026 · Sistema de estadísticas y resultados

Trabajo práctico de **Bases de Datos II**.
Alumno: Santiago Nicolás Barrionuevo Navarro.

Aplicación web que muestra y gestiona los datos del Campeonato Mundial de Fórmula 1 (temporada 2026), guardados en una base de datos **PostgreSQL**. La página lee los datos de la base a través de una API propia; ningún dato está escrito a mano en el HTML.

> Estado: **en desarrollo**. El frontend (HTML y CSS) está en construcción; el backend y la conexión con la base son los siguientes pasos.

## Qué incluye

- **Inicio:** clasificación del campeonato y ficha del piloto elegido (color de su escudería, número, medidor de sanciones, victorias y podios).
- **Resultados:** tabla de cada Gran Premio.
- **Estadísticas:** puntos por escudería (porcentaje) y victorias por piloto.
- **Calendario:** los 23 Grandes Premios, con los disputados y los pendientes.
- **Gestión:** formulario de sanciones (llama al procedimiento almacenado `aplicar_sancion_piloto`), alta de piloto e historial de sanciones.

## Tecnologías

| Parte | Herramienta |
|---|---|
| Base de datos | PostgreSQL |
| Frontend | HTML5, CSS3 y JavaScript |
| Backend | Node.js con Express y el paquete `pg` (pendiente) |
| Editor | Cursor |
| Tipografías | Michroma (títulos) y Barlow (texto) |

## Estructura del proyecto

```
web-f1/
├── frontend/
│   ├── index.html
│   ├── css/            variables.css, base.css, layout.css, componentes.css
│   ├── js/             app.js
│   ├── img/
│   │   ├── iconos/     íconos SVG de la barra
│   │   └── pilotos/    fotos con el código del piloto (VER.png, ANT.png, ...)
│   └── fuentes/        tipografías
├── backend/            API en Node.js (pendiente)
├── base-de-datos/      scripts SQL, backup y diagramas
└── documentos/         consignas, modelos e informe del uso de IA
```

## Base de datos

El modelo tiene 6 tablas: `escuderia`, `piloto`, `superlicencia`, `circuito`, `carrera` y `resultados`. Se agregaron algunas extensiones al modelo original:

- Columnas nuevas: `codigo`, `activo` y `foto_url` (piloto), `color_hex` y `activa` (escudería), `ronda`, `nombre_gp` y `tiene_sprint` (carrera), `puntos_sprint` y `estado_final` (resultados).
- Tabla `historial_sanciones`, que completa un trigger cada vez que cambian los puntos de una superlicencia.
- Procedimiento `aplicar_sancion_piloto` con validaciones.
- Vistas: `v_clasificacion_pilotos`, `v_clasificacion_escuderias`, `v_calendario` y `v_ficha_piloto`.

### Cómo cargar la base

1. Crear una base vacía llamada `formula1_db` en PostgreSQL.
2. Restaurar el backup de `base-de-datos/` (o el script original).
3. Ejecutar `01_migracion_2026.sql`.
4. Ejecutar `03_resultados_2026.sql`.
5. Comprobar con `SELECT COUNT(*) FROM resultados;` (debe dar 418).

## Cómo ver la página

1. Abrir la carpeta `web-f1` en el editor.
2. Con la extensión **Live Server**, hacer clic derecho sobre `frontend/index.html` y elegir *Open with Live Server*.
3. Cuando esté listo el backend: entrar a `backend/`, ejecutar `npm install`, crear el archivo `.env` con los datos de conexión y luego `npm start`.

## Fuentes de los datos

- Calendario, grilla y resultados de las carreras 1 a 19: [formula1.com](https://www.formula1.com).
- Los puntos de penalización de las superlicencias son datos de demostración del trabajo.
- Jefes de equipo y números de coche: pendientes de verificar en la fuente oficial.

### Limitaciones conocidas

- Faltan cargar las sprints de Gran Bretaña y Países Bajos, por lo que algunos totales de puntos quedan por debajo de la clasificación oficial.
- Lawson corrió tres carreras para Red Bull, pero en la base figura siempre en Racing Bulls.

## Uso de inteligencia artificial

El proyecto se desarrolló con ayuda de IA (Claude). El detalle de los prompts, los errores que cometió y cómo se corrigieron está en `documentos/`.

## Aviso

Fórmula 1, F1 y los logos relacionados son marcas registradas de Formula One Licensing BV. Las fotos y el logo se usan únicamente con fines educativos, sin fines comerciales.