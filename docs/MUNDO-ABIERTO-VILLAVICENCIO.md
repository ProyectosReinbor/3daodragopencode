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

### Historial de recompensas — 16 de octubre de 2026

El botón Botín abre las veinte entradas más recientes recibidas durante la sesión del mundo. Incluye monedas, XP, consumibles, piezas y materiales indicados en respuestas satisfactorias de combate, recolección, fabricación y cobro de misiones. Las peticiones rechazadas y las recetas ya fabricadas no generan premios ficticios. Consultar el historial no vuelve a cobrar ni cambia el inventario.

Una subida de nivel confirmada en el perfil del servidor muestra un aviso temporal y queda anotada en la entrada. El historial es informativo y temporal: se vacía al salir del mundo, mientras la cuenta conserva las recompensas mediante su persistencia existente. Las pruebas verifican campos válidos, límite de veinte entradas, rechazo de solicitudes y nivel confirmado.

### Forja y búsqueda de materiales — 16 de octubre de 2026

Cada receta muestra sus cantidades disponibles, requisitos y faltantes, además de la variación de estadísticas frente a la pieza equipada. Fabricar conserva la validación del servidor; los botones se bloquean mientras se procesa la petición y las piezas ya poseídas ofrecen acceso a Equipo. Consultar recetas o buscar materiales no consume recursos.

«Buscar material» abre el mapa con una fuente del material requerido. Prioriza las fuentes sin recarga conocida y elige la más cercana en línea recta. Si todas están recuperándose, propone la más cercana e informa los segundos de espera según el reloj del servidor. Esta orientación no reserva un nodo ni garantiza un camino transitable; el servidor vuelve a comprobar disponibilidad al recoger. Las pruebas cubren faltantes, recetas ya poseídas, fuentes en recarga y selección desde la interfaz.

### Comparación de equipo — 16 de octubre de 2026

El panel Equipo muestra las estadísticas actuales, las tres ranuras y filtros de armas, armaduras y reliquias. «Comparar» calcula una sustitución local: resta la pieza de esa ranura, añade la candidata y muestra valores actuales, previstos y diferencias con signo. Las reliquias que cambian de atributo muestran tanto la pérdida como la ganancia, incluida la vida máxima derivada de Vitalidad. La vista previa no envía peticiones ni modifica el inventario.

«Equipar» conserva la operación autenticada del servidor; las piezas equipadas y los controles durante una petición quedan deshabilitados. Las estadísticas se actualizan con la respuesta confirmada. Reducir la vida máxima limita la vida actual sin curarla; aumentar la vida máxima tampoco cura. Los objetos desconocidos de datos antiguos se omiten sin romper el panel. Las pruebas cubren sustitución de armas, intercambio entre vitalidad y poder, filtros, vista previa sin peticiones y confirmación del servidor.

### Diario de misiones — 16 de octubre de 2026

Las misiones se pueden filtrar por disponibles, en curso, listas para cobrar y completadas. Cada categoría muestra su cantidad y cada tarjeta incluye progreso accesible, recompensa y estado. Cumplir una métrica antes de aceptar la misión no la presenta como aceptada; las recompensas cobradas siguen deshabilitadas. Las misiones de un NPC conservan su alcance después de aceptar o cobrar y ofrecen acceso explícito al diario completo.

«Ver objetivo en mapa» sugiere el nodo más cercano para materiales, el parque más cercano para combate o la forja para fabricación. Desde allí se utiliza «Seguir destino». Son sugerencias en línea recta: un nodo puede estar en recarga y los caminos pueden tener obstáculos. El diario no modifica las reglas del servidor ni entrega premios por visitar la marca. Los filtros son temporales; las misiones y recompensas conservan su persistencia existente.

### Destinos de exploración — 16 de octubre de 2026

El mapa permite seleccionar lugares de referencia, negocios, parques y nodos de materiales y pulsar «Seguir destino». La guía muestra nombre, distancia en metros y flecha relativa a la cámara; comparte el espacio del objetivo de aventura para evitar superponer paneles. El destino aparece en el minimapa, en el mundo y mediante una línea discontinua en el mapa completo. La indicación es en línea recta: todavía no calcula una ruta transitable por calles ni evita edificios.

Al llegar a ocho metros en el exterior se muestra un aviso y vuelve el objetivo de aventura. Tocar la guía abre el mapa; «Quitar destino» permite cancelar y recuperar la guía de misión sin modificar su progreso. Los destinos son temporales durante la sesión y no otorgan recompensas ni teletransportan al personaje. Las pruebas verifican selección de negocios y recursos, marcas del mapa y cancelación.

### Combate legible y recuperación — 16 de octubre de 2026

Los monstruos preparan el golpe antes de aplicarlo: un círculo rojo fija el área del ataque y una advertencia explica cómo esquivarlo. Cada especie tiene un tiempo de preparación entre 0,7 y 1,4 segundos y un periodo de recuperación propio. Salir del círculo antes del golpe o cambiar de altura evita el daño. Los enemigos se detienen durante la preparación y regresan a su punto cuando pierden al jugador. Las advertencias se cancelan al pausar con menús o entrar a un edificio para evitar golpes instantáneos al regresar.

La mascota muestra la cantidad de daño y un borde de impacto breve; el borde se oculta con la preferencia de movimiento reducido. Al llegar a cero de vida se pausa el juego y aparece la opción de volver al punto seguro con vida y maná completos, cuatro segundos de protección y sin descontar equipo, monedas, materiales ni misiones. Las recargas de poderes se conservan para coincidir con las del servidor. No se admiten otras acciones mientras está abierta la pantalla de derrota.

Caminar e Impulso usan el mismo desplazamiento por pasos pequeños, con deslizamiento contra paredes y límites de pisos, terrazas y terreno. Esto impide atravesar fachadas delgadas con el desplazamiento corto. Las pruebas cubren esquiva, preparación, recuperación, pausa y colisiones del impulso. La vida recibida y la IA siguen siendo simulación local; el servidor mantiene las recompensas y los contadores de aventura, pero esta etapa no añade combate multijugador autoritativo.

### Primera aventura guiada — 16 de octubre de 2026

Ari inicia un recorrido persistente de cinco pasos: recoger seis materiales desde el inicio de la aventura, derrotar tres monstruos de los parques, fabricar o poseer la Hoja del explorador, equiparla en la mascota activa y volver con el guía. La interfaz muestra el objetivo, su progreso, distancia en línea recta, flecha relativa a la cámara, anillo de destino y marca en el minimapa. Las instrucciones explican controles, extracción y receta; el panel permite avanzar cuando el servidor confirma los requisitos.

El servidor guarda etapa y contadores iniciales en `world.adventure`, exige la etapa esperada y entrega una vez 75 monedas, 100 XP, dos pociones y dos elixires de maná. Las etapas no pueden saltarse mediante cantidades enviadas por el cliente. Reiniciar la sesión conserva la aventura; una solicitud repetida devuelve el perfil actual para recuperar la interfaz sin duplicar premios. Las cuentas que ya poseen el arma pueden continuar sin fabricar una copia imposible.

La proximidad a Ari usa la posición reportada; no implica movimiento autoritativo ni verificación de visita física. La brújula indica dirección directa, no una ruta peatonal calculada alrededor de edificios. Las demás misiones siguen disponibles. La cámara libre y el joystick respecto a la vista se conservan; las colisiones urbanas comprueban además un margen de 0,45 metros alrededor de la mascota para reducir el solapamiento con fachadas.

La cámara conserva el ángulo elegido al arrastrar el mundo, tanto en reposo como durante el movimiento. El joystick y las flechas se interpretan respecto a la vista: arriba avanza hacia el fondo de la pantalla y derecha desplaza a la derecha. La mascota gira hacia su desplazamiento; ese giro no modifica la cámara.

Instanciar vegetación y caminos; medir tiempos de renderizado en móvil horizontal antes de aumentar densidad. Probar continuidad del mapa, entradas y salida, persistencia, doble reclamación, caducidad, pérdidas de conexión y limpieza de recursos. No anunciar torneos, recompensas comerciales ni visitas verificadas antes de completar sus servicios.

Referencia municipal de corredores: https://villavicencio.gov.co/inician-obras-para-eliminar-cuello-de-botella-en-la-curva-que-conecta-el-anillo-vial-con-la-avenida-40/

## Terreno y expansión

El terreno es una única malla con color por vértice: los biomas no superponen superficies coplanares. Las transiciones mezclan colores próximos al límite. Las calles preservan los vértices OSM y sus curvas; negocios y lugares usan una proyección métrica común. El mapa muestra distancias geográficas en línea recta, no rutas peatonales. Los biomas y modelos siguen siendo fantásticos.

La vegetación se actualiza por celdas alrededor de la mascota, con instancias limitadas a un radio de 100 metros y exclusión de caminos, lugares y recursos; cada árbol pertenece a un único bioma. Las calles usan un índice espacial y carga local a 220 metros. Hay reserva de superficie para nuevos negocios.

## Primera aventura jugable — 11 de octubre de 2026

Tres misiones: reunir seis materiales, derrotar cinco monstruos y fabricar una pieza. Guías en campamento y rutas, diario con progreso y cobro. Las recompensas incluyen monedas, XP y pociones; el servidor conserva misiones aceptadas y cobradas.

Objetos recogibles y vetas tienen ubicación, cantidad y recuperación definidas en el catálogo compartido. La extracción requiere tres segundos y un token de sesión; recoger objetos es inmediato. Los materiales también llegan del botín de monstruos. La forja junto al inicio permite fabricar hoja, coraza y gema y equiparlas desde Equipo. El minimapa marca recursos, guías y forja; el mapa completo lista coordenadas y distancias.

Los encuentros del mundo usan IDs y tipos de un manifiesto compartido para rechazar enemigos inventados. Hay encuentros cerca del inicio, patrullas junto a caminos y grupos de bioma. La proximidad de recogida y fabricación se comprueba con la posición reportada por el cliente; esto no constituye movimiento autoritativo ni prueba de visita física. Las pruebas de aventura usan perfiles ficticios en memoria.
