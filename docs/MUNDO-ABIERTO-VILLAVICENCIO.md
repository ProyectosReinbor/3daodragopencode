# Villavicencio — mundo abierto AODASE PETS

## Dirección de diseño

Conservar la web, las mascotas 3D y la interfaz oscura futurista. Reinterpretar Villavicencio como un territorio continuo de bosque, selva, fuego, nieve y cuevas. El clima es fantástico. Desde el 11 de octubre de 2026 las calles y lugares usan coordenadas de OpenStreetMap; la distribución conceptual anterior quedó sustituida. Ver [cartografía y alcance](CARTOGRAFIA-VILLAVICENCIO.md).

Referencias solicitadas: Viva, Único Outlet, Unicentro, Primavera Urbana, Llanocentro y Villacentro; Universidad de los Llanos (Barcelona y San Antonio), Cooperativa, Unimeta y Santo Tomás. Cooperativa Chorillano queda pendiente de confirmar la sede y no recibe una posición ficticia. La Plaza de Los Libertadores es el origen geográfico; su campo de entrenamiento es una adaptación del juego.

## Primera base implementada

Mapa continuo con terreno de 40 km de lado y extracto geográfico de aproximadamente 24 × 18 km, cinco biomas y 10.725 tramos reales de vías. Doce lugares georreferenciados, edificios exteriores artísticos, mapa con zoom y desplazamiento, minimapa y encuentros fuera del punto inicial. Los edificios no implican afiliación comercial.

Se prepararon cinco yacimientos y tres recetas. El servidor conserva materiales, exige una extracción de tres segundos con un desafío temporal, impide recoger dos veces y aplica recuperación de treinta segundos. Fabricar comprueba todos los costes antes de descontar materiales. La gema auroral es una reliquia de poder; todavía no provoca evolución. La recolección, extracción y forja están integradas con F y el botón de interacción.

Hay constructores de interiores y una API de presencia cercana como infraestructura inicial. Aún no constituyen locales completos ni multijugador terminado. Las posiciones recibidas del cliente no sirven como prueba de visita física ni justifican premios comerciales.

## Etapas siguientes y criterios de aceptación

1. Catálogo real: conectar interiores con productos publicados por comercios dados de alta. Ya se puede entrar y salir de edificios conservando posición, usar ascensores y terrazas y comprar consumibles en seis locales ficticios del juego. La forja y el equipo conservan costes persistentes. Cada comercio real requiere alta propia; universidades y centros comerciales son lugares contenedores.
2. Cartografía: confirmar la sede de Chorillano, ampliar lugares, incorporar relieve y validar cobertura en campo. La importación OSM, atribución, proyección métrica, contornos de edificios, infraestructura urbana 3D y carga local ya están implementadas. Mantener separada la geografía real de la decoración fantástica.
3. Multijugador: movimiento validado en servidor, salas exteriores e interiores, sincronización, reconexión y privacidad. PvP voluntario, emparejamiento, límites diarios y registro de recompensas antes de habilitar premios por victorias.
4. Eventos y minijuegos: desafíos emitidos por servidor, duración y resultado verificados, premios idempotentes, calendario y administración por negocio. Ampliar el campo central para torneos cuando exista esta autoridad.
5. Minas y mazmorras: instancias, dificultad, nodos y enemigos autorizados por servidor, tablas de botín, recetas equilibradas y evolución mediante requisitos verificables. No aceptar resultados o cantidades enviados por el cliente.
6. Experiencias sociales: subida de fotos con consentimiento, límites de tamaño y formato, retirada de metadatos, moderación y controles de publicación. Enlace voluntario a Google Maps; no publicar reseñas automáticamente ni premiar una calificación positiva.

## Verificación técnica

Instanciar vegetación y caminos; medir tiempos de renderizado en móvil horizontal antes de aumentar densidad. Probar continuidad del mapa, entradas y salida, persistencia, doble reclamación, caducidad, pérdidas de conexión y limpieza de recursos. No anunciar torneos, recompensas comerciales ni visitas verificadas antes de completar sus servicios.

Referencia municipal de corredores: https://villavicencio.gov.co/inician-obras-para-eliminar-cuello-de-botella-en-la-curva-que-conecta-el-anillo-vial-con-la-avenida-40/

## Terreno y expansión

El terreno es una única malla con color por vértice: los biomas no superponen superficies coplanares. Las transiciones mezclan colores próximos al límite. Las calles preservan los vértices OSM y sus curvas; negocios y lugares usan una proyección métrica común. El mapa muestra distancias geográficas en línea recta, no rutas peatonales. Los biomas y modelos siguen siendo fantásticos.

La vegetación se actualiza por celdas alrededor de la mascota, con instancias limitadas a un radio de 100 metros y exclusión de caminos, lugares y recursos; cada árbol pertenece a un único bioma. Las calles usan un índice espacial y carga local a 220 metros. Hay reserva de superficie para nuevos negocios.

## Primera aventura jugable — 11 de octubre de 2026

Tres misiones: reunir seis materiales, derrotar cinco monstruos y fabricar una pieza. Guías en campamento y rutas, diario con progreso y cobro. Las recompensas incluyen monedas, XP y pociones; el servidor conserva misiones aceptadas y cobradas.

Objetos recogibles y vetas tienen ubicación, cantidad y recuperación definidas en el catálogo compartido. La extracción requiere tres segundos y un token de sesión; recoger objetos es inmediato. Los materiales también llegan del botín de monstruos. La forja junto al inicio permite fabricar hoja, coraza y gema y equiparlas desde Equipo. El minimapa marca recursos, guías y forja; el mapa completo lista coordenadas y distancias.

Los encuentros del mundo usan IDs y tipos de un manifiesto compartido para rechazar enemigos inventados. Hay encuentros cerca del inicio, patrullas junto a caminos y grupos de bioma. La proximidad de recogida y fabricación se comprueba con la posición reportada por el cliente; esto no constituye movimiento autoritativo ni prueba de visita física. Las pruebas de aventura usan perfiles ficticios en memoria.
