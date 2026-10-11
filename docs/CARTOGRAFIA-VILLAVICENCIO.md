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

Los negocios del catálogo usan la misma proyección y se rechazan coordenadas fuera del extracto. Los modelos de edificios, anchos de vías, biomas, terreno plano, criaturas, recursos, forja y campo de entrenamiento son elementos artísticos del videojuego. No se han reproducido fachadas, alturas, relieve, carriles ni desniveles de puentes. Tampoco se ofrece navegación vial o validación de visitas físicas.

## Renderizado y actualización

La red 3D se indexa en celdas de 100 metros y carga segmentos a 220 metros de la mascota, con instancias limitadas. La vegetación consulta el índice local para dejar libres los caminos. El minimapa muestra vías cercanas; el mapa completo permite acercar, alejar, desplazarse y enfocar cada lugar.

Para actualizar, descargar 16 teselas XML mediante la API de lectura de OSM, dividiendo el área indicada en cuatro columnas y cuatro filas: `https://www.openstreetmap.org/api/0.6/map?bbox=west,south,east,north`. Guardarlas como `tile-0.osm` hasta `tile-15.osm` en `.cartography-work/`, respetando los límites y políticas del servicio. Ejecutar `node scripts/import-villavicencio.mjs .cartography-work`. El importador deduplica IDs, conserva las vías dentro del área y valida la presencia del parque y la red vial antes de escribir el extracto. Los XML quedan excluidos de Git.

Después, ejecutar las pruebas del mundo y de aventuras, comprobar TypeScript y generar la compilación. La cartografía se incluye en el proyecto: jugar no consulta los servidores de OSM ni descarga mosaicos.
