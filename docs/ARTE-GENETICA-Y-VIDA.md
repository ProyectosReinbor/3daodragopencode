# AODASE PETS — arte, genética y vida

8 de octubre de 2026. Complemento técnico del GDD 2.2. Implementación de la ampliación de mascotas coleccionables 3D y nacimiento por calor o a los 90 segundos.

## Dirección artística

La dirección actual toma como referencia la [Pokédex aportada por el creador](https://www.pokemon.com/es/pokedex): criaturas de aventura con especies reconocibles, anatomía sólida, colores claros y rasgos elementales. Se mantiene el 3D y se crean diseños y nombres propios. La referencia anterior de CryptoKitties queda como antecedente. No se importan ilustraciones ni modelos del catálogo.

Las 14 familias originales son Florvyn, Brumacan, Nuborín, Ascuzorro, Pedrumb, Ventorel, Nacarín, Coralco, Marelio, Brotalia, Orbun, Rocor, Brasal y Velúm. Sus IDs internos mantienen compatibilidad. Los nombres personales existentes se conservan; el nombre de familia se propone a los bebés nuevos y se muestra en el taller y la portada.

Los cuadrúpedos tienen cuerpo bajo, profundidad y cuatro apoyos; los bípedos distinguen brazos de piernas. Peces, insectos, aves y espíritus conservan sus propias anatomías. Las patas son más gruesas, los ojos menos salientes y las crestas vegetales y minerales aportan identidad fantástica. El taller conserva las herramientas de escultura y desplazamiento de ojos.

`pet-model.ts` construye un único modelo para portada, taller, hábitat y aventura. Usa materiales Toon, contorno discreto, iris coloreados, reflejos, hocico y vientre contrastante. El pelaje y las marcas usan un shader analítico sobre la superficie esculpida, sin archivos raster ni texturas crecientes por variante. El modelo conserva `sculpt-head`, `sculpt-body`, ojos editables y extremidades para no romper las herramientas del taller.

La interfaz comparte ahora el estilo oscuro futurista de la portada. `src/game-theme.css`, cargado después de los estilos de pantalla, centraliza fondos azul profundo, superficies elevadas, texto claro, acentos menta y focos visibles. Aplica al taller, onboarding, acceso, cuenta, colección, negocios, canjes, hábitat, incubadora, catálogo y controles/paneles del mundo. El hábitat usa un paisaje nocturno y el taller una plataforma 3D azul; los colores propios de mascotas, huevos y objetivos de dardos se conservan para distinguirlos.

## Combinaciones disponibles

- Familias: gato, insecto, extraterrestre, monstruo, dragón, espíritu, perro, conejo, zorro, oso, ave, ajolote, tortuga y pez.
- Pelajes: liso, peludo, rayado, moteado, sucio, escamas, marmolado, calicó y esmoquin.
- Marcas: ninguna, antifaz, calcetines, franja, pecas y bandas.
- Iris: menta, cielo, ámbar, violeta, rosa y lima.
- Anatomía: orejas, alas, cola, ojos, patas/manos/tentáculos/garras, formas, longitudes y número de extremidades; dimensiones y posiciones normalizadas.

`shared/pet-genetics.js` expone `generatePetTraits(theme, rng)`. Todos los temas permiten las 14 familias con pesos distintos. Nacimiento y Random comparten perfiles anatómicos. Los híbridos varían el acabado y ocasionalmente incorporan alas de murciélago en familias compatibles; no mezclan libremente orejas, colas, cuerpos ni cantidades de extremidades. Random añade escultura suave y poderes, y sigue permitiendo modificaciones manuales. Ambos conservan cabezas unidas y ojos sobre su superficie. El servidor aporta aleatoriedad criptográfica; pruebas y portada pueden aportar una semilla reproducible.

El genoma guarda dos alelos por locus. El expresado corresponde a la apariencia almacenada y el recesivo permanece en el servidor. Se incluyen categorías, dimensiones, anatomía, paleta y afinidad. El DTO revela únicamente genes conocidos y un contador de información oculta. La identidad del Pet es su ID; no se promete que ninguna combinación visual pueda repetirse. La reproducción con padres y el consumo de ADN siguen pendientes del plan urbano.

## Incubación y confirmación

Los huevos nuevos guardan `createdAt` y `readyAt` separados por 90000 ms por defecto. Dar calor fortalece al bebé: +1 a todas las estadísticas base por acción confirmada, hasta +3. Al tercer cuidado puede nacer antes del reloj; con menos cuidados nace al vencer el tiempo con el bonus acumulado. Las estadísticas de los dados permanecen guardadas y el bonus se aplica una sola vez al nacimiento. La configuración admite de 90 segundos a siete días y no reescribe fechas anteriores.

La interfaz usa el desfase del reloj del servidor para mostrar el tiempo. Al vencer el tiempo o confirmar el tercer cuidado solicita `hatch` con idempotencia; al volver de una pestaña oculta reconcilia el estado. Sólo una confirmación válida revela el Pet. Cada 20 segundos y en cada Dar calor, la cáscara tiembla y muestra más grietas. En el nacimiento se divide, caen fragmentos y aparece luz durante dos segundos; el bebé permanece oculto hasta terminar la ruptura. Después se ofrece el nombre. El botón manual permite recuperar un intento fallido; un error no provoca una cadena de reintentos.

## Interacciones vivas

| Acción | Duración | Respuesta 3D |
|---|---|---|
| Alimentar | 3,2 s | Recipiente, bocados y movimiento para comer |
| Jugar | 3,2 s | Pelota y saltos |
| Descansar | 4 s | Postura de sueño, ojos cerrados y letras Z |
| Bañar | 3,6 s | Burbujas y sacudida |
| Acariciar | 3 s | Corazones, inclinación y respuesta de cabeza |
| Entrenar | 3,5 s | Movimiento activo y estrellas |

`createPetAnimator(model, reducedMotion)` ofrece `step(deltaSeconds)`, `react(action, phase)`, `setCare`, `setReducedMotion` y `dispose`. Los grupos nombrados forman un rig ligero. Una fase de intención anticipa la acción; éxito reproduce la respuesta completa y cancelación vuelve al reposo. Respiración, parpadeo, mirada, orejas y cola expresan vida entre acciones. Energía, hambre y ánimo ajustan la postura de forma suave.

La expresión facial del hábitat depende de las necesidades confirmadas, no sólo del gesto genético inicial. Ojos, iris, cejas, mejillas y sonrisa expresan alegría, calma, tristeza, cansancio, cariño, sueño o concentración. Los ojos somnolientos pueden abrirse y un gesto gruñón puede sonreír. Alimentar, jugar y bañar muestran alegría; acariciar relaja los ojos; descansar los cierra y entrenar enfoca la mirada. Al terminar la reacción, la cara vuelve al estado de cuidado vigente. Intención y errores no simulan una recompensa emocional. La genética y los rasgos guardados permanecen intactos; movimiento reducido conserva las expresiones.

`mountPetPreview` devuelve una función de limpieza con controles `react` y `setCare`. El hábitat conserva el renderer cuando cambia sólo el nombre o las necesidades. Ocultar la pestaña pausa el bucle; volver reinicia su referencia temporal sin saltar una reacción completa. Movimiento reducido mantiene posturas y señales con desplazamientos mínimos. Los efectos se liberan y `disposePetModel` deduplica geometrías, materiales y texturas al retirar una mascota.

El mundo conserva su controlador de desplazamiento y combate; no aplica el animador del hábitat sobre la posición del jugador. Todos los espacios comparten la misma apariencia.

## Verificación

Las pruebas comprueban diversidad de familias por tema, normalización, unión de cabeza/ojos/extremidades, expresión de genes, reloj de nacimiento, idempotencia, conservación de datos antiguos y limpieza del animador. Las HTTP usan bases temporales propias y envejecen únicamente sus fixtures para comprobar el nacimiento; no hay un atajo de incubación en producción. La guía de implementación registra la verificación visual y los resultados completos.
