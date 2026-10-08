# Villavicencio — mundo abierto AODASE PETS

## Dirección de diseño

Conservar la web, las mascotas 3D y la interfaz oscura futurista. Reinterpretar Villavicencio como un territorio continuo de bosque, selva, fuego, nieve y cuevas. El clima es fantástico. La primera distribución es conceptual: no reproduce coordenadas ni ofrece navegación urbana.

Referencias solicitadas: Viva, Único Outlet, Unicentro, Primavera Urbana, Llanocentro y Villacentro; Universidad de los Llanos, Cooperativa, Unimeta y Santo Tomás. Cooperativa Chorillano queda como referencia pendiente de confirmar la sede. Parque Central es un parque de juego con campo para entrenamiento y futuros torneos, no una afirmación sobre un parque real.

## Primera base implementada

Mapa continuo de 180 unidades, cinco biomas, corredores inspirados en Avenida 40, Anillo Vial, Catama, Los Maracos, Carrera 34 y conexiones barriales. Doce lugares de referencia, parque y campo central, edificios exteriores, mapa consultable y encuentros distribuidos fuera del punto inicial. Los edificios no implican afiliación comercial.

Se prepararon cinco yacimientos y tres recetas. El servidor conserva materiales, exige una extracción de tres segundos con un desafío temporal, impide recoger dos veces y aplica recuperación de treinta segundos. Fabricar comprueba todos los costes antes de descontar materiales. La gema auroral es una reliquia de poder; todavía no provoca evolución. La integración de estas acciones con controles de recolección y forja está pendiente.

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
