# Análisis detallado de funcionalidades, fases y mejoras

Fecha: 20 de octubre de 2026 (Colombia). Código revisado: `a6bcfd8`, rama `main`.

## 1. Evaluación general

AODASE PETS es un prototipo avanzado con dos núcleos funcionales: crianza de mascotas y aventura urbana virtual. Tiene más contenido jugable del que reflejan algunas guías antiguas, pero todavía no completa el MVP urbano del GDD: falta conectar descubrimiento validado, ADN, elección evolutiva y trazabilidad del origen.

La principal necesidad es cerrar y conectar sistemas, además de corregir puntos de autoridad y operación. Añadir más edificios o actividades antes de resolver estas brechas aumentaría el coste de mantenimiento sin completar la promesa central de evolución.

Este informe distingue funcionalidad conectada al recorrido actual, implementación parcial, código heredado y diseño pendiente. No se asigna un porcentaje global: las fases tienen tamaños diferentes y no hay un backlog estimado que permita calcularlo con rigor.

## 2. Funcionalidades disponibles en el recorrido actual

| Sistema | Qué está creado | Evidencia y alcance |
|---|---|---|
| Acceso | Registro con teléfono y contraseña, login, JWT, salida y recuperación del perfil | `src/main.ts`, `src/game/api.ts`, `server/index.js`. El teléfono es identificador; no se encontró verificación mediante SMS ni recuperación autónoma de contraseña. |
| Portada y navegación | Marca AODASE, vistas 3D rotativas, acceso a cuenta y taller experimental, navegación entre pantallas | `landing-ui.ts`, `navigation.ts`, `main.ts`. Las pantallas ocultas se vuelven inertes para interacción. |
| Primer Pet | Cuenta vacía → incubadora → elección de huevo → calor → nacimiento → nombre | `guardian-domain.js`, `guardian-ui.ts`. 90 segundos por defecto o tercer cuidado, tres segundos entre cuidados, máximo +3 a cada estadística. |
| Crianza | Alimentar, jugar, descansar, bañar, acariciar y entrenar; deterioro acotado durante ausencia y recuperación gratuita | Reglas en servidor, reacciones visuales y misiones de bienvenida. No hay muerte permanente por ausencia. |
| Colección | Mascotas persistentes, selección activa, nombres y estadísticas | `characters-ui.ts`, `foodie-guardian.js`. Nacimiento inicial y adicional conservan reglas diferentes de selección. |
| Apariencia | 14 familias, combinaciones anatómicas, pelajes, marcas, ojos y modelos procedurales | `pet-species.js`, `pet-genetics.js`, `pet-model.ts`. Fenotipo almacenado y genotipo privado. |
| Taller | Edición de anatomía, color, ojos y escultura; Random, dados, dardo y prueba del Pet | `pet-editor.ts`, `onboarding-ui.ts`, `foodie-onboarding.js`, `pet-trial.ts`. Es experimental y no sustituye el huevo del ingreso principal. |
| Mundo urbano | Cartografía OSM de Villavicencio, biomas fantásticos, edificios, calles, puentes, agua y decoración | `city-world.js`, `villavicencio-osm.js`, `villavicencio-urban.js`, `city-urban.ts`. Cartografía empaquetada; no es una réplica exacta ni navegación vial. |
| Interiores | Entrada/salida, pisos, ascensor y terrazas; conservación de posición exterior | `city-life.ts`, `world-play.ts`. Arquitectura interior artística. |
| Lugares jugables | Seis locales ficticios con NPC y actividades | `shared/city-life.js`: Botica Nébula, Café Luciérnaga, Galería AODASE, Mirador Llanero, Taller del Alba y Centro de Guardianes. No acreditan comercios afiliados. |
| Movimiento | Cámara libre, teclado, joystick, mando estándar, impulso y colisiones | `world-movement.ts`, `gamepad.ts`, `world-play.ts`. Soporte de hardware físico aún por validar. |
| PvE | Cuatro familias de enemigos canónicos del mundo, habilidades, señales de ataque, daño visible y recuperación tras derrota | `world-items.js`, `enemy-combat.ts`, `world-play.ts`. El servidor calcula daño al enemigo y botín; IA, vida y maná del jugador se simulan localmente. |
| Materiales | Cinco materiales, recogida inmediata y extracción con desafío temporal | `world-crafting.js`, `foodie-world.js`: mineral, madera, esencia, cristal y obsidiana. El servidor conserva cantidades y recuperación de nodos. |
| Fabricación | Tres recetas: hoja, coraza y gema | Costes comprobados antes de descontar; no vuelve a cobrar una pieza ya poseída. La gema es equipo, no una evolución. |
| Equipo | Nueve definiciones de objetos, ranuras, comparación y vista previa antes de confirmar | `world-items.js`, `equipment-preview.ts`. Un mismo objeto es posesión en una lista, no inventario general de ejemplares con durabilidad. |
| Misiones | Seis misiones del catálogo y aventura guiada de cinco pasos con Ari | `world-quests.js`, `world-adventure.js`: materiales, combate, fabricar, equipar y regresar. Etapas y premios persistentes. |
| Orientación | Mapa, minimapa, filtros, marcas, selección de destino y flecha relativa a la cámara | `city-map.ts`, `world-presentation.ts`. Indicación en línea recta; no calcula itinerarios para rodear edificios. |
| Reaparición | Cuatro balizas definidas, activación y punto guardado | `world-camps.js`. El acceso depende de posición virtual declarada, no de presencia física. |
| Pasaporte | Sellos de los seis locales y premio único al completar | `world-passport.js`. Es pasaporte virtual. |
| Minijuego | Memoria con secuencia, token, tiempo mínimo, caducidad y premio limitado por local | `venue-game.js`. El patrón se entrega al cliente porque necesita mostrarlo: valida reglas y tiempo, no demuestra habilidad humana ni resistencia a automatización. |
| Tienda virtual | Pociones y maná en paquetes de 1, 3 o 5; precio y saldo validados | `world-shop.js`. Sin pagos reales. |
| Feedback | Diario de botín, subida de nivel confirmada, guía de materiales, disponibilidad y recargas | `reward-journal.ts`, `resource-status.ts`, `consumable-status.ts`. El diario visual de sesión no reemplaza un ledger de todos los movimientos. |
| Catálogo comercial | Ciudades, 13 categorías, búsqueda, filtros y detalle de tiendas/productos/promociones | `urban-businesses.js`, `stores-ui.ts`. Coordenadas desconocidas y demostraciones se distinguen explícitamente. |
| Canje | Código manual o QR, Pet destinatario, XP y premio, historial y consumo único | `redeem-ui.ts`, `reward-manager.ts`, `/api/redeem`. Flujo de compra transaccional con SQLite. |
| Administración | Login separado, usuarios, negocios, facturas, inventario, cambios de contraseña y auditoría | `admin/`, `admin-management.js`, `admin-crud.js`. Administración global, no portal de cada empresa. |
| Calidad | Scripts integrados, Node 24, pruebas cliente/servidor y workflow de CI | `package.json`, `.nvmrc`, `.github/workflows/ci.yml`. Build genera artefacto; no despliega automáticamente. |

## 3. Implementaciones parciales y código heredado

### Edad y genética no equivalen a evolución

`stageFor` clasifica bebé, juvenil y adulto por nivel (juvenil desde 4, adulto desde 10). No existe todavía la elección de tres adaptaciones con consumo de ADN, transformación persistente y registro de fuentes. Tampoco se encontró reproducción, herencia entre padres o historial de cruces. La personalidad inicial permanece en «curioso»; el repertorio de personalidades del GDD sigue pendiente.

### Presencia no equivale a multijugador visible

Existe `/api/world/presence`, con posición limitada al área y respuesta de hasta cuatro compañeros cercanos. La búsqueda del endpoint en `src/` no encontró consumidor: no se presenta como presencia conectada en el mundo actual. Faltan integración visual, salas, sincronización, reconexión, consentimiento y movimiento validado. El pasaporte y las misiones actuales son individuales.

### El RPG anterior conserva sistemas fuera del arranque principal

`game.ts`, `game-ui.ts`, `battlepass.ts`, `leaderboard.ts`, `bosses.ts` y otros módulos conservan combate por zonas, jefes, pase, logros y retos diarios. La entrada actual usa `mountLazyWorld` y `world-play.ts`; no se encontró una instancia de la clase `Game` en ese recorrido. El taller de prueba también utiliza el mundo actual.

El ranking heredado usa localStorage y genera entradas NPC. El pase conserva estado local. Los logros y retos diarios siguen presentes en modelos y utilidades, pero eso no acredita progresión integrada con todas las acciones urbanas. No anunciarlos como ranking global, temporada operativa o sistema actual completo sin conectar y comprobar sus flujos.

### Inventarios y economías coexistentes

Conviven `profile.inventory`, `profile.crafted`, `profile.currency`, cristales y `profile.world` con materiales, ítems, pociones y monedas. `inventory-ui.ts` muestra campos heredados; el mundo tiene sus propios paneles de materiales/equipo. Esta separación puede confundir al jugador que obtiene un recurso y luego busca verlo en «Inventario» del hub. Conviene definir una vista unificada por origen y uso, manteniendo adaptadores para datos antiguos.

### Comercio y panel no cierran el mismo recorrido

Existe `/api/admin/stores/:id/invoice-codes`, que crea un código AVAILABLE por referencia de compra. Sin embargo, el formulario de `admin/index.html` llama a `/invoices`: entrega inmediatamente y marca REDEEMED. Esa ruta tampoco aplica la misma función de XP de compra que `/api/redeem`. Falta conectar la emisión pendiente a una interfaz con QR/impresión y aclarar o retirar del recorrido normal la entrega heredada.

### PWA y escaneo

Hay manifest, iconos, instalación y worker. `public/sw.js` no tiene manejador fetch ni precarga: no hay juego offline implementado. La cámara QR depende de BarcodeDetector; sin él existe entrada manual. Las pruebas simuladas no acreditan cámara física ni compatibilidad universal.

## 4. Hallazgos prioritarios comprobados

### P0 — Reiniciar sesión permite eludir recuperación de combate

`/api/world/start` elimina sesiones anteriores de la cuenta y crea mapas vacíos de encuentros y cooldowns. Salud de enemigos y reaparición viven en esa sesión. Una prueba aislada, con reloj fijo y perfil ficticio en memoria, obtuvo: primer ataque definitivo 200, repetición inmediata 429, nueva sesión y mismo ataque 200; el perfil terminó con dos derrotas registradas.

**Impacto:** reiniciar el mundo permite repetir recompensas sin respetar recuperación. **Mejora:** persistir o conservar por cuenta los estados que condicionan premios, separar sesión de interfaz del estado de encuentros y añadir regresión de reconexión/múltiples pestañas.

### P0 — Alcance y recursos de combate insuficientemente autorizados

La rama `attack` comprueba enemigo canónico, tipo y cooldown, pero no exige posición ni distancia al objetivo. La prueba aislada consiguió una derrota sin enviar posición. Tampoco mantiene vida/maná del jugador: el cliente restringe estos recursos, no el servidor.

**Impacto:** la economía recibe resultados que no acreditan un combate legítimo. **Mejora:** posición y movimiento válidos, alcance/altura, requisitos de habilidad y recursos antes de daño y recompensa. Las coordenadas para recogida/forja se comparan con el destino, pero siguen declaradas por el cliente; esa comprobación no autoriza visitas físicas.

### P1 — Compras de consumibles sin idempotencia

La misma compra con el mismo `requestId` se ejecutó dos veces y descontó 24 monedas por dos elixires. `/api/world/action` no interpreta ese identificador. Cada solicitud podría ser una compra voluntaria; el problema aparece si se repite por recuperación de red o doble envío.

**Mejora:** recibo persistente por usuario/intención y fingerprint, respuesta recuperable, transacción del recibo y perfil. Guardian ya ofrece una referencia de este patrón. Distinguir operaciones que toleran repetición por su estado (equipar/fabricar ya poseído) de operaciones que vuelven a gastar.

### P1 — Política global de peticiones puede bloquear juego normal

`server/index.js` aplica 100 solicitudes/minuto por IP a toda la API. El ataque básico permite una solicitud cada 450 ms: el máximo teórico de ataques básicos ya ronda 133 por minuto, sin contar otras acciones. Es una incompatibilidad inferida del código, no una prueba de carga ni de uso humano sostenido.

**Mejora:** presupuestos por ruta y cuenta, separar autenticación/administración de acciones de juego y verificar múltiples jugadores tras una misma red. Mantener límites de abuso sin impedir las acciones que el propio juego permite.

### P1 — Sesiones de acceso y administración requieren endurecimiento

La contraseña de jugador admite cuatro caracteres; los JWT duran 60 días. Cambiar contraseña no incorpora revocación/versionado del token. `adminAuth` valida firma/rol sin consultar vigencia de la cuenta administrativa. El login admin tiene el límite general, pero no el límite específico de 10 intentos de login/registro del jugador.

**Mejora:** política de contraseña coherente, versión de sesión por cuenta, revocación al cambiar acceso y límite específico de login administrativo. Revisar CORS y trust proxy para el alojamiento real. No se comprobó un ataque externo ni se afirma compromiso.

### P1 — Errores y reintentos no siguen un contrato único

`api.ts` reintenta también respuestas de negocio; `apiSaveProfile` convierte errores en booleano. Guardian, mundo y recompensas usan clientes fetch diferentes. El mundo muestra el fallo de sesión, pero no establece una recuperación general automática del estado tras expirar o reiniciar servidor. Guardian genera un nuevo requestId por llamada: el recibo del servidor no resuelve por sí solo la recuperación de una intención cuyo resultado se perdió en red.

**Mejora:** cliente HTTP compartido con errores tipados, timeout y cancelación; reintentar lecturas y solo intenciones idempotentes; conservar la clave mientras se reconcilia una acción incierta; mostrar claramente guardado pendiente, confirmado o fallido.

## 5. Estado de fases del GDD

| Bloque | Evaluación actual | Qué falta para cerrarlo |
|---|---|---|
| A0 — adaptación | Base funcional implementada | Mantener regresiones y coherencia de documentación/recorrido. |
| A1 — evolución | Pendiente | ADN gratuito, grants de origen, oferta de tres alternativas, costes, elección atómica, cambio visual e historial. |
| A2 — mapa | Implementación parcial respecto al GDD | Mapa virtual y cartografía presentes; posición física opcional, publicación/revisión de oportunidades y modelo territorial operativo pendientes. |
| A3 — ruta gratuita | Parcial, con aventura virtual creada | Hay misiones, pasaporte y memoria; falta descubrimiento validado con procedencia y ADN utilizable en evolución. |
| A4 — comercio completo | Parcial | Hay catálogo/códigos/canje/admin; faltan organizaciones, roles, sedes, campañas presupuestadas, Reward Definitions, grants, ledger y conciliación. |
| A5 — piloto vivo | Pendiente de validación operativa | Aliado y catálogo confirmados, contenido local, soporte, métricas y retención reales. No se inspeccionó alojamiento ni usuarios reales. |
| A6 — social/expansión | Infraestructura inicial y diseño | Presencia conectada, privacidad, cooperación y operación multicudad. No hay evidencia de expansión funcional terminada. |

El GDD conserva frases de octubre temprano que declaran mapa y misiones completamente futuros. Son estado histórico, no evidencia del código actual. Sus criterios de producto siguen siendo útiles: mapa virtual no sustituye descubrimiento físico.

## 6. Mejoras de producto y experiencia

1. **Un ciclo principal reconocible:** desde el hub mostrar el siguiente objetivo real: cuidar → hablar con Ari → obtener materiales → fabricar → evolucionar cuando exista. Evitar que el taller experimental compita con el ingreso por huevo.
2. **Inventario comprensible:** reunir materiales, consumibles, equipo y recompensas en una vista con secciones y fuente; evitar pantallas donde parezca desaparecer el botín urbano.
3. **Evolución visible como siguiente gran entrega:** aporta identidad y propósito a los recursos; más recetas o edificios no reemplazan este hito.
4. **Recorrido comercial coherente:** emitir código pendiente, mostrar QR, elegir Pet al canjear y explicar el origen del premio. Diferenciar moneda virtual, factura y cualquier beneficio físico.
5. **Objetivos accesibles:** las marcas directas pueden apuntar detrás de fachadas. Probar trayectos reales dentro del juego, mejorar señales y entradas; añadir rutas transitables si los ensayos confirman fricción.
6. **Progreso y retos:** conservar las seis misiones actuales como introducción y diseñar repetición diaria/semanal autorizada antes de ampliar el mapa. Medir si hay una razón clara para regresar después de completarlas.
7. **Accesibilidad y dispositivos:** completar revisión de foco/dialogos, tamaño táctil, contraste, movimiento reducido, orientación, mandos y cámara en dispositivos físicos. Hay soporte y pruebas, pero no una auditoría integral.
8. **Identidad local:** usar narrativa, criaturas y eventos propios de Villavicencio con contenido revisado; no depender únicamente de calles reales y lugares conocidos.

## 7. Arquitectura, rendimiento y operación

- **Mantener monolito modular:** SQLite y Express pueden servir al piloto. No hay mediciones que justifiquen microservicios o cambio de base inmediato.
- **Dividir coordinadores grandes:** `world-play.ts` tiene unos 111 kB y `server/index.js` unos 48 kB. Extraer transporte de mundo, sesiones, combate, paneles, entradas y migraciones con contratos claros; no hacer una reescritura global.
- **Reducir transferencia y parseo:** los extractos geográficos fuente suman unos 4,92 MB (2,65 MB de vías y 2,27 MB urbanos). El build previo produjo un chunk de mundo de 4.798,81 kB, 1.018,48 kB gzip. Hay relación plausible, pero falta un análisis del bundle para atribuir cada byte. Evaluar datos por sectores y carga bajo demanda después de medir.
- **Aprovechar lo existente:** mundo diferido, vegetación local, instancias e índice urbano ya están creados; la mejora debe medirlos, no volver a proponerlos como ausentes.
- **Persistencia consciente:** perfil y varios estados son JSON; documentar versión y migraciones. Mantener recibos, propiedad y transacciones como contratos transversales. Definir retención/limpieza de recibos y sesiones antes de crecimiento sostenido.
- **Calidad de backend:** CI ahora ejecuta pruebas del servidor, pero lint/formato siguen apuntando a `src/`; `shared/`, `server/` y `admin/` necesitan reglas apropiadas. Hay abundante lógica JS compartida con declaraciones `.d.ts` manuales; comprobar que no diverjan.
- **Pruebas que faltan:** reconexión sin reiniciar premios, alcance falso, maná/vida, reintentos de compra, dos pestañas, sesión expirada, revocación de acceso y errores de almacenamiento en acciones de mundo. Añadir E2E de navegador para el recorrido completo y pruebas de carga con presupuesto acordado.
- **Alojamiento:** conciliar `deploy.sh` (puerto 3002, servicio root, `/home/aodase`) y ejemplo Nginx (upstream 3000 y `/var/www/aodase/dist`). Ambos pueden funcionar con configuración específica; no constituyen un procedimiento único reproducible tal como están documentados. Hacen falta usuario limitado, TLS, backup/restauración y rollback ensayados.
- **Observabilidad:** separar health básico de preparación de dependencias; registrar errores y latencia por operación sin exponer teléfono o secretos. El login legado actualmente puede escribir el teléfono en logs al migrar hash.

## 8. Orden recomendado de trabajo

| Prioridad | Entrega | Criterio verificable |
|---|---|---|
| 1 | Cerrar evasión por sesión y autoridad mínima de combate | Reiniciar/reconectar no reinicia premios; sin alcance o recursos válidos no hay daño premiado. |
| 2 | Intenciones idempotentes y reconciliación de red | Repetir compra con la misma clave cobra una vez; una respuesta perdida se recupera sin duplicar. |
| 3 | Unificar inventario y emisión comercial | Lo obtenido aparece en el hub; el panel emite QR pendiente y el canje conserva XP/premio coherentes. |
| 4 | Primera evolución de extremo a extremo | ADN gratuito → tres opciones → coste atómico → modelo transformado → origen persistente. |
| 5 | Rendimiento/operación y piloto limitado | Métricas en teléfonos, despliegue reproducible, restauración probada y aliado con reglas aprobadas. |
| 6 | Visitas verificadas y portal por negocio | Descubrimiento con validación proporcional y permisos aislados; presupuestos auditables. |
| 7 | Social y expansión | Presencia visual optativa y sesiones robustas antes de PvP o siguientes ciudades. |

Las tareas 1 y 2 preceden a nuevos premios de valor. El diseño visual de evolución y las mediciones móviles pueden prepararse mientras se cierran estos contratos. No se proponen fechas sin conocer capacidad del equipo y alcance comercial.

## 9. Evidencia y límites de la revisión

Se inspeccionaron entrada/navegación, módulos de mascota y mundo, catálogos compartidos, rutas de cuenta/guardian/comercio/admin, pruebas, CI, cartografía, worker y despliegue. Se contrastaron con GDD, guías y plan actual.

En esta revisión se ejecutó una sonda del controlador de mundo con perfil clonado y reloj fijo, exclusivamente en memoria: confirmó ataque sin posición, reinicio de recuperación por nueva sesión y doble cobro de compra idéntica. No usó autenticación de producción, no leyó ni escribió bases y no contactó servicios externos. Estas son reproducciones del comportamiento del controlador; no una prueba de penetración del alojamiento.

La última comprobación integral del mismo código `a6bcfd8`, realizada en el bloque anterior, aprobó `npm run check` (336 pruebas Vitest + 48 Node), formato, TypeScript y build; lint conservó 14 advertencias. Este cambio solo añade documentación y no vuelve a certificar CI remoto. No se repitió toda la batería sin cambios de lógica.

No se recorrió visualmente la aplicación en esta revisión, no se probó hardware móvil, no se inspeccionaron datos de jugadores ni se validó el despliegue remoto. La presencia del navegador en localhost no sustituye esas pruebas. Las funciones descritas como implementadas se basan en conexión estática y pruebas existentes, con los límites señalados.

## Actualización posterior: reinicio de recompensas corregido

La entrega de persistencia de combate conserva encuentros y cooldowns en el perfil de la cuenta y los restaura al entrar al mundo. El hallazgo «reiniciar sesión permite eludir recuperación de combate» queda corregido para nuevas acciones guardadas, incluidas reconexiones y reinicios de proceso. Las sesiones temporales todavía deben reabrirse tras reiniciar servidor; no se convierten en sesiones permanentes. Los hallazgos de alcance/recursos de combate y compras idempotentes permanecen abiertos. Véase `MUNDO-ABIERTO-VILLAVICENCIO.md` para alcance y pruebas.

## Actualización posterior: doble cobro de compras corregido

El mundo exige clave de compra y conserva recibos por cuenta junto con saldo/inventario. Repetir la misma intención no vuelve a gastar; cambiar su contenido da conflicto. La tienda conserva la intención local y permite confirmar una respuesta perdida con la misma clave tras reentrar. El hallazgo de doble cobro queda corregido para este recorrido; la recuperación desde otro dispositivo o tras borrar almacenamiento sigue fuera de esta entrega. Véase `MUNDO-ABIERTO-VILLAVICENCIO.md`.
