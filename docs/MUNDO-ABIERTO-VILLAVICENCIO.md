# Villavicencio — mundo abierto AODASE PETS

## Dirección de diseño

Conservar la web, las mascotas 3D y la interfaz oscura futurista. Reinterpretar Villavicencio como un territorio continuo de bosque, selva, fuego, nieve y cuevas. El clima es fantástico. La primera distribución es conceptual: no reproduce coordenadas ni ofrece navegación urbana.

Referencias solicitadas: Viva, Único Outlet, Unicentro, Primavera Urbana, Llanocentro y Villacentro; Universidad de los Llanos, Cooperativa, Unimeta y Santo Tomás. Cooperativa Chorillano queda como referencia pendiente de confirmar la sede. Parque Central es un parque de juego con campo para entrenamiento y futuros torneos, no una afirmación sobre un parque real.

## Primera base implementada

Mapa continuo de 7200 unidades (7,2 km de lado en escala de juego), cinco biomas, corredores inspirados en Avenida 40, Anillo Vial, Catama, Los Maracos, Carrera 34 y conexiones barriales. Doce lugares de referencia, parque y campo central, edificios exteriores, mapa consultable y encuentros distribuidos fuera del punto inicial. Los edificios no implican afiliación comercial.

Se prepararon cinco yacimientos y tres recetas. El servidor conserva materiales, exige una extracción de tres segundos con un desafío temporal, impide recoger dos veces y aplica recuperación de treinta segundos. Fabricar comprueba todos los costes antes de descontar materiales. La gema auroral es una reliquia de poder; todavía no provoca evolución. La recolección, extracción y forja están integradas con F y el botón de interacción.

Hay constructores de interiores y una API de presencia cercana como infraestructura inicial. Aún no constituyen locales completos ni multijugador terminado. Las posiciones recibidas del cliente no sirven como prueba de visita física ni justifican premios comerciales.

## Etapas siguientes y criterios de aceptación

1. Integrar recolección, forja y catálogo real: entrar y salir de locales conservando posición, consultar productos publicados, fabricar y equipar con costes persistentes. Cada comercio requiere alta propia; universidades y centros comerciales son lugares contenedores.
2. Cartografía: confirmar sedes, importar un trazado autorizado, conservar atribución y licencia, proyectar coordenadas, convertir cruces en conexiones y dividir terreno en sectores. Mantener separada la geografía real de la decoración fantástica.
3. Multijugador: movimiento validado en servidor, salas exteriores e interiores, sincronización, reconexión y privacidad. PvP voluntario, emparejamiento, límites diarios y registro de recompensas antes de habilitar premios por victorias.
4. Eventos y minijuegos: desafíos emitidos por servidor, duración y resultado verificados, premios idempotentes, calendario y administración por negocio. Ampliar el campo central para torneos cuando exista esta autoridad.
5. Minas y mazmorras: instancias, dificultad, nodos y enemigos autorizados por servidor, tablas de botín, recetas equilibradas y evolución mediante requisitos verificables. No aceptar resultados o cantidades enviados por el cliente.
6. Experiencias sociales: subida de fotos con consentimiento, límites de tamaño y formato, retirada de metadatos, moderación y controles de publicación. Enlace voluntario a Google Maps; no publicar reseñas automáticamente ni premiar una calificación positiva.

## Verificación técnica

Instanciar vegetación y caminos; medir tiempos de renderizado en móvil horizontal antes de aumentar densidad. Probar continuidad del mapa, entradas y salida, persistencia, doble reclamación, caducidad, pérdidas de conexión y limpieza de recursos. No anunciar torneos, recompensas comerciales ni visitas verificadas antes de completar sus servicios.

Referencia municipal de corredores: https://villavicencio.gov.co/inician-obras-para-eliminar-cuello-de-botella-en-la-curva-que-conecta-el-anillo-vial-con-la-avenida-40/

## Terreno y expansión

El terreno es una única malla con color por vértice: los biomas no superponen superficies coplanares. Las transiciones mezclan colores próximos al límite. La distribución conceptual de avenidas, biomas y lugares se amplió 40 veces, conservando el tamaño de mascotas, edificios y velocidad. El parque se mantiene cerca del punto inicial. El mapa muestra distancias de juego, no recorridos geográficos medidos.

La vegetación se actualiza por celdas alrededor de la mascota, con instancias limitadas a un radio de 100 unidades y exclusión de caminos, lugares y recursos; cada árbol pertenece a un único bioma. Hay reserva de superficie para nuevos negocios. La distribución exacta por sedes y la importación de cartografía siguen pendientes.

## Primera aventura jugable — 11 de octubre de 2026

Tres misiones: reunir seis materiales, derrotar cinco monstruos y fabricar una pieza. Guías en campamento y rutas, diario con progreso y cobro. Las recompensas incluyen monedas, XP y pociones; el servidor conserva misiones aceptadas y cobradas.

Objetos recogibles y vetas tienen ubicación, cantidad y recuperación definidas en el catálogo compartido. La extracción requiere tres segundos y un token de sesión; recoger objetos es inmediato. Los materiales también llegan del botín de monstruos. La forja junto al inicio permite fabricar hoja, coraza y gema y equiparlas desde Equipo. El minimapa marca recursos, guías y forja; el mapa completo lista coordenadas y distancias.

Los encuentros del mundo usan IDs y tipos de un manifiesto compartido para rechazar enemigos inventados. Hay encuentros cerca del inicio, patrullas junto a caminos y grupos de bioma. La proximidad de recogida y fabricación se comprueba con la posición reportada por el cliente; esto no constituye movimiento autoritativo ni prueba de visita física. Las pruebas de aventura usan perfiles ficticios en memoria.
