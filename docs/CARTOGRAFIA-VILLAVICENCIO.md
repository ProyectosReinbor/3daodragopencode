# Cartografía de Villavicencio

La geografía del juego utiliza un extracto público de OpenStreetMap importado el 11 de octubre de 2026. Sustituye las avenidas y ubicaciones conceptuales de la versión anterior.

## Fuente y alcance

- Fuente: https://www.openstreetmap.org/
- Atribución: © OpenStreetMap contributors.
- Licencia del extracto geográfico: Open Database License (ODbL) 1.0, https://opendatacommons.org/licenses/odbl/1-0/.
- Información y condiciones de atribución: https://www.openstreetmap.org/copyright.
- Área descargada: latitud 4.04–4.20, longitud -73.70–-73.48. Incluye la ciudad y el corredor hacia la sede Barcelona de Unillanos; no abarca todo el municipio rural.
- Extracto derivado redistribuido: `shared/villavicencio-osm.js`. Conserva IDs públicos, nombres, tipos y coordenadas; elimina datos de colaboradores y otros metadatos personales del XML original.

Los 10.725 tramos y sus 61.717 vértices proceden del trazado publicado. Se conservan curvas y cruces compartidos, sin sustituirlos por avenidas inventadas. La precisión y cobertura corresponden a OpenStreetMap; no se afirma una reproducción topográfica perfecta ni exhaustiva de cada negocio de la ciudad.

## Escala y lugares

El origen está en el centro geométrico de la Plaza de Los Libertadores. X apunta al este y Z al sur. La proyección local equirectangular usa el radio terrestre medio y el coseno de la latitud de origen: una unidad equivale aproximadamente a un metro en ambos ejes. Las distancias del mapa son en línea recta, no distancias de rutas peatonales.

Viva, Único, Unicentro, Primavera Urbana, Llanocentro, Villacentro, Cooperativa, Unimeta, Santo Tomás y las sedes Barcelona y San Antonio de Unillanos se ubican mediante puntos o centros de geometrías de OSM. Los centros de polígonos son marcadores de referencia, no necesariamente puertas de entrada. Cooperativa Chorillano sigue pendiente de confirmar; no se inventa una ubicación.

Los negocios del catálogo usan la misma proyección y se rechazan coordenadas fuera del extracto. Los biomas, terreno plano, criaturas, recursos, forja y campo de entrenamiento son elementos artísticos del videojuego. Tampoco se ofrece navegación vial o validación de visitas físicas.

## Ciudad en 3D

`shared/villavicencio-urban.js` añade 7.096 contornos cerrados de edificios, 77 puntos de semáforos y 318 tramos de cursos de agua del mismo extracto OSM. Las vías conservan la etiqueta de puente: hay 153 tramos señalados, que no equivalen necesariamente a 153 puentes distintos.

Los edificios se extruyen sobre sus polígonos reales, con alturas publicadas cuando existen y una estimación de tres metros por piso en los demás casos; sin pisos publicados se usan dos pisos. Fachadas, ventanas, puertas, cubiertas y colores son una interpretación artística. El importador conserva un indicador para distinguir alturas publicadas de estimadas. Solo se incluyen edificios con contornos cerrados de vías OSM; relaciones multipolígono y partes complejas quedan pendientes.

Las carreteras tienen asfalto, líneas discontinuas, aceras y alumbrado. Los puntos de semáforos generan postes junto a la vía, luces con ciclo rojo/amarillo/verde y cruces peatonales decorativos. Su orientación, posición precisa del poste, ciclos y marcas no reproducen una regulación de tráfico real. No hay simulación de vehículos.

Los tramos de puente generan tableros inclinados, rampas, barandas y pilares, con una altura artística máxima de cuatro metros. La mascota y la cámara siguen la superficie elevada cuando cruzan el tablero. Los cursos de agua se representan bajo las vías. Las dimensiones de puentes y ríos son aproximadas; no proceden de un levantamiento topográfico.

No se afirma una réplica fotográfica de fachadas, niveles de intercambiadores o relieve. Las alturas visibles ahora se amplían artísticamente para ofrecer edificios de tres a seis pisos y locales especiales de cuatro a ocho pisos; los datos originales se conservan separados. La ciudad añade hasta 2.500 edificios procedurales sobre espacios sin contornos registrados, junto a calles y evitando otras construcciones, vías y parques. Estos edificios llevan `generated: true` y no se presentan como edificios reales levantados en campo.

## Ciudad habitada e interiores

Seis locales ficticios del juego cerca de la plaza: Botica Nébula, Café Luciérnaga, Galería AODASE, Mirador Llanero, Taller del Alba y Centro de Guardianes. Sus nombres no implican negocios reales ni afiliaciones. Tienen mostradores, NPC, compra de pociones y maná con monedas del juego y misiones; no procesan pagos reales.

Acercarse a una puerta y usar F o el botón de interacción abre el interior en el mismo lugar geográfico. Los edificios con dimensiones suficientes, incluidos los procedurales, tienen pisos y terraza accesibles con ascensor. Solo se construye el piso activo; se retira temporalmente la carcasa exterior para dejar ver por ventanas transparentes a la ciudad que continúa renderizándose alrededor. Se conservan la posición de entrada, el límite del piso y la altura de cámara; salir restaura la fachada y vuelve a la calle. Las dimensiones del interior son de juego y no reproducciones de distribuciones arquitectónicas reales.

Las fachadas exteriores bloquean el paso y permiten deslizarse por los bordes. La mascota se mantiene dentro de los límites del piso o de la terraza. Los monstruos exteriores no atacan dentro de edificios. No se simulan todavía escaleras transitables, caídas ni colisiones complejas contra cada mueble.

La plaza incluye puestos, bancos y NPC con animación de brazos. Doce parques próximos registrados en OSM tienen zonas de combate y cuatro encuentros canónicos cada uno. La misión de parques exige ocho derrotas; el servidor cuenta únicamente enemigos de esos encuentros y paga una sola vez. Otras misiones urbanas usan los contadores existentes de materiales y fabricación. Los NPC y escenarios son elementos ficticios superpuestos a la geografía.

## Renderizado y actualización

La red 3D se indexa en celdas de 100 metros y carga segmentos a 220 metros de la mascota, con instancias limitadas. Los edificios se agrupan en dos mallas de cuerpos y cubiertas; ventanas, aceras, marcas, lámparas y puentes usan instancias con capacidad fija. La selección urbana se actualiza cada 50 metros, limita a 500 edificios próximos y libera las geometrías sustituidas. La vegetación deja libres caminos y contornos de edificios. El minimapa muestra vías cercanas; el mapa completo permite acercar, alejar, desplazarse y enfocar cada lugar.

Para actualizar, descargar 16 teselas XML mediante la API de lectura de OSM, dividiendo el área indicada en cuatro columnas y cuatro filas: `https://www.openstreetmap.org/api/0.6/map?bbox=west,south,east,north`. Guardarlas como `tile-0.osm` hasta `tile-15.osm` en `.cartography-work/`, respetando los límites y políticas del servicio. Ejecutar `node scripts/import-villavicencio.mjs .cartography-work`. El importador deduplica IDs, conserva las vías dentro del área y valida la presencia del parque y la red vial antes de escribir los dos extractos. Los XML quedan excluidos de Git. Ambos extractos derivados mantienen la licencia ODbL de la fuente.

Después, ejecutar las pruebas del mundo y de aventuras, comprobar TypeScript y generar la compilación. La cartografía se incluye en el proyecto: jugar no consulta los servidores de OSM ni descarga mosaicos.
