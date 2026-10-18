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

### Extracción sincronizada y cancelable — 18 de octubre de 2026

El panel de extracción usa `readyAt` y la hora ajustada del servidor para mostrar avance, segundos restantes y el plazo de 30 segundos para recoger. Incluye cancelación explícita y aviso de caducidad; no recoge automáticamente. Cada panel conserva sus propios elementos y temporizador, evitando que una extracción cerrada habilite el botón o sustituya el token al volver al mismo yacimiento. Los temporizadores terminan al ocultar, reemplazar o destruir el panel y al salir del mundo. La API mantiene las comprobaciones existentes de distancia, sesión, token y tiempo. Verificados 30 tests, incluidos límites de disponibilidad, caducidad, reapertura y liberación, además de ESLint y compilación de producción.

### Guía de materiales — 18 de octubre de 2026

El menú del mundo incluye los cinco materiales del catálogo con sus existencias guardadas, recetas que los requieren y monstruos que los dejan. Cada material permite localizar una fuente usando la selección existente: prioriza fuentes disponibles y, si todas se recuperan, indica la espera al abrir el mapa. También permite marcar la forja. Consultar la guía no ejecuta acciones de compra, recolección o fabricación; fabricar sigue requiriendo proximidad a la forja. Se conserva la interfaz oscura y adaptable del mundo. Verificados 29 tests de controles, guía y planificación, ESLint y compilación de producción.

### Compras por paquetes — 18 de octubre de 2026

La tienda permite comprar 1, 3 o 5 pociones o elixires por operación. Muestra precio total, existencias y monedas faltantes; deshabilita compras sin saldo y controles durante la solicitud. Las existencias se actualizan con la respuesta del servidor. Los precios y cantidades permitidas están en un catálogo compartido; la API valida el paquete completo antes de descontar monedas y mantiene compatibilidad con compras antiguas de una unidad. Pruebas con perfiles ficticios: cantidades inválidas, saldo insuficiente, precios manipulados, sesión de otra cuenta y compra confirmada desde la interfaz. Verificados 28 tests y compilación de producción.

### Ayuda y pausa por cambio de ventana — 18 de octubre de 2026

El menú incluye Ayuda y controles con movimiento relativo a la cámara, selección de objetivos, poderes, consumibles, interacción y acceso al mapa y actividades. El contenido se presenta como texto legible dentro del mismo panel oscuro del mundo.

Al perder el foco de la ventana se restablecen teclas, joystick y arrastre y se pausa la simulación local. Los ataques pendientes se cancelan mediante el mismo mecanismo de pausa de los menús. Al recuperar el foco se restablecen nuevamente los controles, por lo que no se reanuda una dirección cuya tecla se soltó fuera del juego. Los listeners se liberan al salir. La prueba de integración verifica pausa, ausencia de movimiento residual, reanudación y acceso a la ayuda.

### Selección de objetivos de combate — 18 de octubre de 2026

Un toque o clic sobre el modelo de un rival lo fija como objetivo; arrastrar la cámara no selecciona. T y el botón de cambio recorren los candidatos cercanos. Un anillo azul y la etiqueta «Fijado» distinguen la selección de las advertencias rojas de ataques. El botón de soltar devuelve el comportamiento de elegir al rival más cercano.

La selección busca rivales vivos y visibles a menos de doce metros, en la misma altura aproximada, y consulta las huellas de edificios para descartar fachadas intermedias. Se libera al morir, salir del rango, quedar bloqueado o entrar en un edificio. Mantener una selección fuera del alcance de un ataque pide acercarse; no desvía el golpe a otro rival ni aumenta el alcance básico o de los poderes. Los controles se suspenden con menús y derrota igual que el resto del combate.

Las pruebas verifican orden y ciclo de candidatos, fachadas, diferencias de altura, ataque a la selección, distancia, muerte del objetivo y separación entre toque y arrastre. Es selección y visibilidad del cliente; esta entrega no convierte las posiciones o el combate completo en simulación autoritativa del servidor.

### Menú compacto del mundo — 18 de octubre de 2026

La cabecera conserva Equipo y un menú desplegable con las herramientas secundarias: Misiones, Actividades, Pasaporte, Guía, Botín, calidad gráfica, pantalla completa y salida. Las herramientas disponibles se adaptan al campo de prueba. El desplegable tiene botones de al menos 44 píxeles, anchura limitada al viewport y desplazamiento vertical para pantallas horizontales bajas.

Abrir el menú pausa la simulación local y cancela ataques enemigos pendientes. Los controles de movimiento se restablecen al abrir/cerrar; Escape cierra el desplegable y devuelve el foco a su resumen. Elegir una herramienta cierra el menú antes de abrir su panel y tocar fuera también lo descarta. El resumen y sus botones mantienen la activación nativa mediante teclado. Las pruebas verifican cabecera compacta, acceso a herramientas, pausa, cancelación de ataques y ausencia de movimiento residual.

### Directorio de actividades y recargas — 18 de octubre de 2026

Desde Misiones se abre Actividades de la ciudad. Los seis locales ficticios se ordenan por distancia y muestran sello del pasaporte, minijuego, recompensa y misión de su NPC. Hay filtros para todos, premios disponibles y lugares sin visitar, con contadores actualizados y acceso al mapa. El minijuego solo se puede abrir desde la tarjeta del local en cuyo interior está la mascota.

Los tiempos conocidos de los premios se muestran en horas/minutos o minutos/segundos usando el desfase del servidor. Mientras el panel está abierto se actualizan etiquetas, filtros y contadores sin peticiones adicionales. El botón inicial de Memoria de luces se habilita al vencer su recarga sin tener que cerrar el diálogo. Esta disponibilidad es orientativa; la API conserva la validación final del premio y no cambia su límite de 24 horas.

Las pruebas cubren el límite exacto del temporizador, perfiles antiguos, filtros independientes de sellos y premios y actualización de la interfaz sin nuevas peticiones.

### Memoria de luces en los locales — 17 de octubre de 2026

Los negocios ficticios ofrecen un minijuego desde su panel interior. Se muestran tres luces durante unos segundos; después el jugador repite la secuencia usando botones con símbolos y nombres. La animación de selección respeta la preferencia de movimiento reducido. Cerrar el panel detiene el bucle visual y salir del mundo libera el controlador.

El servidor emite un token y una secuencia, exige esperar al menos 3,5 segundos y limita el intento a un minuto. Al resolverlo comprueba sesión, token, proximidad declarada y secuencia; consume el intento, incluso si falla. Una victoria concede 10 monedas y 15 XP y guarda una recarga de 24 horas por local en `world.venueGameCooldowns`. Cambiar de sesión o repetir el token no vuelve a entregar el premio. Los fallos no descuentan recursos.

Es un minijuego virtual de los locales del mundo, no una campaña real de un comercio. La posición y la entrada se reciben del cliente; validar tiempos, tokens y límites no acredita presencia física ni impide automatizar una secuencia visible. Las pruebas cubren repetición, ventanas de tiempo, sesión ajena, cantidades elegidas por el servidor y persistencia del límite, además de luces, bloqueo de entrada, errores de confirmación y liberación al cerrar. Reiniciar la API para cargar las acciones `venue_game_start` y `venue_game_finish`.

### Carga diferida del mundo — 17 de octubre de 2026

La portada y el taller dejan de importar el mundo de forma estática. El acceso desde la cuenta y el campo de prueba comparten una carga diferida con pantalla de espera, cancelación y reintento. Salir durante la descarga descarta el resultado tardío y evita montar la escena o iniciar su sesión. La interfaz de fondo se bloquea durante la espera y recupera su estado al salir o al entregar el control al mundo.

La compilación de esta entrega separa el JavaScript principal: de 4.948,85 kB a 173,05 kB sin compresión (58,54 kB gzip). El mundo queda en un archivo diferido de 4.778,35 kB (1.011,17 kB gzip), con su CSS también separado. Three.js sigue siendo un archivo compartido de 524,70 kB y puede cargarse con los previews de la portada. No se reduce la cartografía ni se promete un tiempo de carga concreto; se pospone su descarga hasta entrar. La prueba del personaje usa por ahora el mismo módulo del mundo y también descarga ese archivo al abrirse.

Las pruebas cubren cancelar una descarga pendiente, reintentar un fallo, liberar una escena montada una sola vez y conservar el bloqueo previo del fondo. Se mantienen las pruebas de controles y progresión del mundo. En despliegue, conservar los archivos con hash de versiones previas mientras puedan existir pestañas abiertas que los soliciten.

### Pasaporte urbano — 17 de octubre de 2026

Desde Misiones y los locales se puede abrir un pasaporte de seis negocios ficticios existentes. Muestra sellos, progreso, distancias y el siguiente lugar cercano pendiente. Cada destino se conecta al mapa y a la guía de exploración. El sello se registra mediante una acción explícita cerca de la entrada o del centro interior del edificio, sin compras ni permisos de ubicación real.

La API valida sesión y proximidad declarada, guarda `world.visitedVenues` y concede una sola recompensa de 50 monedas y 75 XP al completar el catálogo. `world.passportRewarded` evita volver a premiar visitas repetidas o nuevas sesiones. Las visitas parciales no conceden premios. La posición sigue siendo declarada por el cliente; los sellos acreditan progreso virtual, no visitas físicas verificadas ni campañas comerciales. Perfiles antiguos comienzan sin sellos y conservan el resto de su progreso.

Las pruebas de servidor cubren entradas, interiores, rechazo por distancia o sesión ajena y premio único persistente. La interfaz verifica registro interior, bloqueo del sello repetido, restauración al reentrar y selección del siguiente negocio en el mapa. Reiniciar la API para cargar la acción `visit_venue`.

### Guía de monstruos — 16 de octubre de 2026

El libro del menú abre una guía de lobos, guardianes esqueleto, espíritus y gólems. Muestra vida, monedas, XP, material obtenido, piezas posibles y consejos sobre la preparación del ataque. Las piezas y consumibles aleatorios se presentan como posibilidades, no como premios garantizados. Los datos de recompensas y materiales proceden de los catálogos existentes.

«Localizar» selecciona el encuentro de esa especie más próximo dentro del catálogo real del mundo. Puede marcarse como destino; la guía no teletransporta, no entrega recompensas y no garantiza que el enemigo esté vivo en ese momento. El mapa señala el punto seleccionado con un anillo.

El servidor guarda `world.monsterKills` por especie solo al confirmar una derrota. Los ataques rechazados o repetidos sobre un enemigo derrotado no incrementan el contador. Las cuentas anteriores empiezan sin historial por especie; se conservan sus derrotas totales sin inventar una distribución retrospectiva. Las pruebas cubren conteo, repetición, cercanía de encuentros y navegación sin peticiones adicionales. Reiniciar la API para cargar el nuevo contador.

### Balizas de regreso — 16 de octubre de 2026

Cuatro balizas ficticias ofrecen puntos de regreso: Parque Central y sectores Viva, Primavera y Unillanos. Las tres balizas de sectores se ubican en vértices de calles importadas cercanos al lugar de referencia; no representan entradas de negocios reales. Se muestran como anillos luminosos y aparecen en el mapa y minimapa. Se pueden marcar como destinos y activar con F al llegar.

La API exige sesión del propietario, ID de baliza conocido y posición declarada a un máximo de seis metros; guarda `world.campId` sin conceder monedas, XP, objetos ni curación. Activar repetidamente no da premios. Al entrar de nuevo o recuperarse de una derrota se usa la baliza guardada; perfiles anteriores conservan el punto inicial. La recuperación tras derrota mantiene las reglas existentes de vida, maná y cuatro segundos de protección. La posición sigue siendo declarada por el cliente: esta validación no sustituye movimiento autoritativo del servidor.

Las pruebas HTTP usan perfiles aislados y verifican proximidad, propiedad de sesión, persistencia y ausencia de premios. La prueba de interfaz comprueba el inicio en la baliza guardada y su selección independiente de los lugares reales. Reiniciar la API después de actualizar para cargar la acción `activate_camp`.

### Ajustes gráficos del mundo — 16 de octubre de 2026

El botón de engranaje abre Ahorro, Equilibrado y Alto. Se reutiliza la preferencia gráfica existente: límites de resolución de 0,8 / 1 / 1,35 píxeles por píxel CSS y límites de dibujo de 30 / 45 / 60 FPS. Son límites solicitados, no una garantía de FPS. La simulación, controles, colisiones y tiempos de combate continúan en el bucle habitual; solo se limita el envío de fotogramas al renderizador.

La decoración de la capa de presentación cambia de densidad sin reconstruir la ciudad y Ahorro oculta las partículas ambientales. Las advertencias de ataques y elementos interactivos se conservan. La preferencia se aplica al volver al mundo y se intenta guardar en este navegador; si el almacenamiento está bloqueado se informa y el modo sigue funcionando durante la sesión. Esta entrega no reduce los datos cartográficos, edificios ni el tamaño inicial del paquete, y requiere medir rendimiento en dispositivos físicos. Las pruebas verifican persistencia, almacenamiento bloqueado y restauración de densidad al volver a Alto.

### Señales de recolección — 16 de octubre de 2026

Al acercarse a un recurso aparece su nombre, material, cantidad y disponibilidad. Los recursos en recuperación muestran segundos restantes; el botón distingue recoger hallazgos de extraer y se deshabilita durante la recarga cuando no hay otra interacción prioritaria. La tecla F también comprueba la recarga conocida antes de enviar una solicitud. Edificios, NPC, forja y puestos de misiones conservan su prioridad, con el texto del botón alineado a la acción real.

El mapa muestra la disponibilidad de cada fuente y actualiza los contadores mientras está abierto. Los plazos usan la hora del servidor y no desbloquean anticipadamente por redondeo; la validación definitiva sigue en la API. La búsqueda cercana elige el recurso más próximo en vez del primero del catálogo. Las referencias visuales se guardan al crear el mundo, evitando recorrer toda la escena por cada recurso en cada fotograma. Las pruebas cubren límites del temporizador, elección por distancia y actualizaciones del mapa sin peticiones adicionales.

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
