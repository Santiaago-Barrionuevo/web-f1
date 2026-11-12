# F1 2026: estadísticas y resultados

Trabajo práctico de Programación I y Base de Datos II.
Alumno: Santiago Nicolás Barrionuevo Navarro.

La app muestra los datos del Mundial de Fórmula 1 de 2026. Los datos están guardados en PostgreSQL, y la página los pide a una API propia, así que el HTML no tiene nada fijo.

## Qué se puede ver

- **Inicio:** la clasificación del campeonato y la ficha de cada piloto, con el color de su escudería, su número, las sanciones, las victorias y los podios.
- **Resultados:** la tabla de cada Gran Premio.
- **Estadísticas:** el porcentaje de puntos por escudería y las victorias por piloto.
- **Calendario:** los 23 Grandes Premios, separando los que ya se corrieron de los que faltan.
- **Gestión:** un formulario para aplicar sanciones (usa el procedimiento `aplicar_sancion_piloto`), el alta de pilotos y el historial de sanciones.

## Tecnologías

La base es PostgreSQL. El frontend está hecho con HTML, CSS y JavaScript. El backend va a ser una API con Node.js, Express y el paquete `pg`, y todavía no está terminado.

## Estructura

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
├── backend/            API en Node.js (en desarrollo)
├── base-de-datos/      scripts SQL, backup y diagramas
└── documentos/         consignas, modelos e informe del uso de IA
```

## La base de datos

Tiene seis tablas: `escuderia`, `piloto`, `superlicencia`, `circuito`, `carrera` y `resultados`. Sobre el modelo original agregué lo siguiente:

- Columnas nuevas: `codigo`, `activo` y `foto_url` en `piloto`; `color_hex` y `activa` en `escuderia`; `ronda`, `nombre_gp` y `tiene_sprint` en `carrera`; `puntos_sprint` y `estado_final` en `resultados`.
- La tabla `historial_sanciones`, que se completa sola con un trigger cada vez que cambian los puntos de una superlicencia.
- El procedimiento `aplicar_sancion_piloto`, con sus validaciones.
- Cuatro vistas: `v_clasificacion_pilotos`, `v_clasificacion_escuderias`, `v_calendario` y `v_ficha_piloto`.

### Cómo cargarla

1. Crear una base vacía llamada `formula1_db` en PostgreSQL.
2. Restaurar el backup de `base-de-datos/` o, si preferís, usar el script original.
3. Ejecutar `01_migracion_2026.sql` y después `03_resultados_2026.sql`.
4. Comprobar con `SELECT COUNT(*) FROM resultados;`. Tiene que dar 418.

## Cómo verlo

1. Abrir la carpeta `web-f1` en el editor.
2. Con la extensión Live Server, hacer clic derecho sobre `frontend/index.html` y elegir *Open with Live Server*.
3. Para el backend, cuando esté listo: entrar a `backend/`, correr `npm install`, crear un archivo `.env` con los datos de conexión a la base y ejecutar `npm start`.

## Fuentes

- Calendario, grillas y resultados de las carreras 1 a 19: [formula1.com](https://www.formula1.com).
- Los puntos de penalización de las superlicencias son datos de demostración.
- Jefes de equipo y números de coche: todavía no los verifiqué con la fuente oficial.

## Uso de IA

El proyecto lo desarrollé con ayuda de Claude. En `documentos/` están los prompts que usé, los errores que cometió la IA y cómo los corregí.

## Aviso

Fórmula 1, F1 y los logos relacionados son marcas registradas de Formula One Licensing BV. Las fotos y el logo se usan solo con fines educativos y sin ningún fin comercial.