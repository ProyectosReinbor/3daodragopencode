# Foodie Pets: análisis y plan de transformación

Fecha: 4 de octubre de 2026. Alcance de esta entrega: análisis del código y plan de implementación; no se modifica todavía la aplicación.

## 1. Objetivo

Transformar Reinos Ancestrales en una web de personajes únicos coleccionables que crecen gracias a compras verificadas en negocios de comida. La experiencia principal será descubrir un Pet, personalizarlo, mejorar sus estadísticas iniciales con un dardo y hacerlo progresar escaneando facturas de restaurantes afiliados.

El mundo abierto puede conservarse como actividad secundaria. Para la primera versión, el centro del producto será la colección y la relación con los restaurantes. Esta es una propuesta de alcance: si se conserva el combate, su progresión debe definirse por separado para que no sustituya la progresión comercial.

## 2. Diagnóstico del proyecto actual

La aplicación usa TypeScript, Vite y Three.js sin framework de interfaz. El servidor usa Express, SQLite, JWT y bcrypt. Hay navegación entre 11 pantallas, colección de personajes, inventario, negocios, promociones, productos, canje e historial. No hace falta rehacer todo el proyecto ni introducir otro framework.

| Área | Evidencia en el código | Implicación para Foodie Pets |
|---|---|---|
| Portada | `index.html`, `src/main.ts`, `src/styles.css` | Ya contiene dos tarjetas y el botón «Unirse al mundo». Cambia las tarjetas cada 7 segundos. Se puede adaptar esta estructura. |
| Variedad de las tarjetas | `randomCharacter()` llama a `generateSlimeCharacter()` | Varían elemento, colores y estadísticas, pero todos son Slimes comunes de cuerpo golem. No exhibe la variedad de formas y rarezas que soporta el generador general. |
| Alta inicial | `showNftCreation()` genera desde el hash del teléfono | El elemento se decide antes de la presentación. No existe ruleta, nombre editable ni juego del dardo. |
| Personajes | `characters.ts`, `nft.ts` | Hay seis elementos: fuego, agua, tierra, aire, sombra y luz; cuatro rarezas; cinco estadísticas y modelos procedurales. Base aprovechable para los Pets. |
| Colección | `CharacterCollection`, `CharacterManager`, `characters-ui.ts` | Permite seleccionar el personaje activo. Hay dos referencias de selección (`selectedId` y `selectedCharacter`) que conviene unificar mediante migración. |
| Progresión | `progress.ts`, `game.ts`, misiones y combate | El crecimiento actual gira alrededor del RPG. Hay que introducir una progresión comercial independiente de los monstruos. `addExperience()` procesa un solo nivel por llamada: compras que otorguen mucha XP deben poder subir varios niveles. |
| Comercio | `stores-ui.ts`, `stores.ts`, tablas de tiendas, productos y promociones | Ya existen negocios y promociones; hay que convertir los datos de ejemplo en un catálogo real de restaurantes afiliados. |
| Canje del servidor | `POST /api/redeem`, `deliverReward()`, `reward_history` | Ya valida el estado del código y entrega recompensas dentro de una transacción. Admite personajes, objetos, consumibles y monedas; faltan XP, mejoras de estadísticas y desbloqueo de habilidades para el Pet elegido. |
| Canje en pantalla | `redeem-ui.ts`, `reward-manager.ts`, `main.ts` | Después de canjear se muestra el resultado, pero no se vuelve a obtener el perfil para actualizar `currentProfile` y `currentManager`. Puede seguir mostrándose una colección desactualizada. |
| Escáner | `qr-scanner.ts`, conectado desde `game.ts` | El escáner está en el juego, no en la pantalla de canje comercial. Depende de BarcodeDetector y ofrece entrada manual si no está disponible. Sus mensajes están en inglés. |
| Persistencia | `apiSaveProfile()` y `server/index.js` | El cliente usa el helper `req()`, que envía POST cuando hay body; el servidor define PUT para `/api/profile`. Además el servidor exige `nft`, mientras `createProfile()` produce `characters` y la migración elimina `nft`. El guardado captura el error y devuelve false, pero el alta no espera ni verifica ese resultado. Es un bloqueo prioritario. |
| Integridad del perfil | `PUT /api/profile` | El servidor acepta la colección y las monedas del cliente y sustituye el perfil completo. Eso permite manipulación y que un guardado viejo sobrescriba una recompensa nueva. Las operaciones comerciales deben ser autoridad del servidor. |
| Emisión para negocios | `/api/admin/stores/:id/invoices` | La ruta actual genera la factura y entrega inmediatamente la recompensa a un usuario. No equivale al flujo solicitado de emitir un QR pendiente y que el cliente lo escanee. Deben existir operaciones diferenciadas. |
| Marca e instalación | HTML, manifest, iconos y paquetes | Conservan Reinos Ancestrales. Hay que cambiar nombre visible, metadatos e identidad instalable. Las claves locales antiguas requieren migración, no un reemplazo directo. |
| PWA | `public/sw.js` | Instala y activa, pero elimina las cachés y no tiene estrategia de fetch offline. La documentación promete más de lo que implementa. Canjear debe requerir conexión; no mostrar éxito offline. |

Los archivos README y ESTADO-PROYECTO contienen información desactualizada: el README menciona almacenamiento JSON, mientras el servidor usa SQLite; el documento de estado describe un Slime fijo de agua, pero el código actual sortea su elemento. Para este plan se toma el código como fuente principal.

## 3. Portada solicitada

Orden de arriba hacia abajo:

1. **Foodie Pets** como título principal, con identidad amable, colores cálidos, acentos por elemento y personajes expresivos.
2. **Dos tarjetas de personajes coleccionables**: modelo o ilustración, nombre, elemento, rareza y estadísticas. Cambian cada 7 segundos con transición suave. Sustituir «VS» por una composición de colección. Mostrar ejemplos reales del catálogo disponible, sin insinuar que el usuario recibirá necesariamente uno de los dos ejemplos.
3. **Botón «Unirse al mundo»** que abre directamente la ruleta.
4. **Descripción:** «Apoya a tus restaurantes favoritos y mejora tus Foodie Pets. Compra, escanea el código QR de tu factura y desbloquea niveles, regalos y habilidades para tus personajes únicos».
5. **Espacio para una imagen animada:** persona escaneando con el celular el QR de una factura; detrás, sus Pets felices, con señales de subida de nivel, regalos y habilidades. Reservar un contenedor adaptable con ilustración provisional y texto alternativo. La animación final será un recurso posterior; el espacio debe funcionar sin él.
6. **Invitación a negocios:** «¿Tienes un negocio de comida? Únete a Foodie Pets y convierte las compras de tus clientes en una aventura».
7. **Botón «Contáctanos por WhatsApp»**, con mensaje preparado: «Hola, tengo un negocio de comida y quiero implementar Foodie Pets».

El número de WhatsApp está pendiente de suministro. No inventarlo ni publicar un enlace vacío. Es configuración comercial necesaria antes de activar el botón.

En celular conservar las dos tarjetas visibles en paralelo cuando sean legibles y apilarlas en pantallas muy estrechas. Evitar que una portada larga tape las secciones inferiores. Pausar carrusel y renderizado cuando la portada no esté visible; respetar la preferencia de movimiento reducido y ofrecer alternativa estática si WebGL falla.

## 4. Flujo de creación del primer Pet

`Portada → Ruleta → Revelación del Pet → Nombre → Dardo → Resumen → Registro/inicio de sesión → Guardado → Mi mundo Foodie Pets`

La sesión iniciada puede guardar directamente. Si la cuenta ya tiene su Pet inicial, «Unirse al mundo» debe llevar a su colección; no entregar otro Pet inicial mediante recargas o nuevos inicios de sesión.

### Ruleta

- Propuesta inicial: seis sectores iguales, uno por elemento existente. Cada uno tiene probabilidad 1/6; cualquier cambio futuro se reflejará en las reglas visibles.
- Un botón «Girar», bloqueo durante el giro, desaceleración y resultado inequívoco: el sector bajo el indicador coincide con el elemento entregado.
- Sorteo de apariencia, rareza y estadísticas por separado. Las probabilidades del generador actual (55/28/13/4 %) son una referencia existente, no una regla comercial aprobada.
- Generar el resultado en el servidor y animar hacia él. No confiar en un resultado enviado por el navegador.
- Para abrir la ruleta antes del registro: crear una sesión anónima de alta con identificador opaco, resultado persistido y caducidad. Al registrarse, asociarla de forma transaccional a la cuenta. Una restricción por cuenta impide reclamar dos Pets iniciales; limitar intentos anónimos y definir protección ante múltiples cuentas antes de lanzar campañas de valor.
- Reabrir una sesión o recargar retoma su resultado. La creación final debe ser idempotente y no depender del número de clics.

### Nombre personalizable

Propuesta: entre 2 y 24 caracteres, espacios y letras Unicode; eliminar espacios externos y caracteres de control. Mostrar el nombre con APIs de texto, sin insertarlo como HTML. El identificador único del Pet permanece separado del nombre. Previsualizar el nombre y permitir editarlo antes de confirmar.

### Juego de disparar un dardo

Propuesta concreta: una diana con indicador móvil; el usuario pulsa «Lanzar dardo» para detenerlo. En móvil, el mismo botón funciona por toque; en escritorio también por teclado.

| Zona alcanzada | Bonus propuesto |
|---|---|
| Centro | +3 puntos |
| Anillo intermedio | +2 puntos |
| Anillo exterior | +1 punto |
| Fuera | Sin bonus; conserva sus estadísticas base |

Antes de lanzar se elige la estadística que se quiere mejorar. El bonus se registra separado de las estadísticas base para mostrar «base + dardo + compras». Un lanzamiento por alta; sin penalización a la base. La habilidad depende del momento del disparo, no de otro sorteo oculto.

El servidor debe fijar el inicio, duración y trayectoria del reto y validar el resultado dentro de una sesión consumible una sola vez. Un minijuego en navegador no demuestra por sí solo que juega una persona; limitar el bonus y no convertirlo en premio económico. Incluir una alternativa accesible con bonus modesto definido y registrado en la misma sesión, sin abrir un segundo intento.

Las cifras, el lanzamiento único y la estadística elegible son propuestas ajustables de producto.

## 5. Mi mundo y progresión por compras

Tras el alta, abrir un centro con el Pet activo, nivel, barra de XP, estadísticas y habilidades. Acciones principales: «Mis Foodie Pets», «Escanear factura», «Restaurantes» e «Historial de regalos». El acceso al mundo 3D puede quedar secundario si se decide conservarlo.

Flujo comercial:

1. El negocio afiliado registra una compra elegible y emite un código único pendiente.
2. El cliente elige qué Pet quiere mejorar y escanea el QR o escribe el código.
3. El servidor comprueba autenticación, negocio activo, vigencia, compra elegible, titularidad del Pet y que el código no se haya consumido.
4. En una transacción, consume el código, aplica XP y el premio configurado, registra el historial y devuelve el estado actualizado.
5. La web muestra antes/después: XP, nivel, estadísticas y regalos. Actualiza colección y centro con el perfil confirmado.

Una factura debe generar una entrega comercial verificable, sin permitir multiplicarla por varios Pets. Para el MVP se aplica al Pet elegido; el reparto entre personajes puede añadirse más adelante.

Propuesta inicial: XP fija por compra elegible y regalos por promoción, con límites configurables. No asumir que el valor de la factura se puede leer automáticamente ni que el QR de una factura fiscal existente es compatible: el negocio necesita emitir un QR Foodie Pets o integrar su sistema de facturación.

Separar premios digitales (XP, accesorios, personajes, habilidades) de beneficios reales del restaurante. Los regalos físicos necesitan condiciones, vencimiento y confirmación del comercio. No anunciar beneficios reales que todavía no estén configurados.

## 6. Arquitectura y cambios por archivo

| Archivo o módulo | Trabajo previsto |
|---|---|
| `index.html` | Portada Foodie Pets, espacio de animación, CTA de negocios y pantallas del alta. |
| `src/styles.css` | Identidad visual, tarjetas, ruleta, diana y estilos adaptables; preferencia de movimiento reducido. Extraer estilos por sección si facilita mantenimiento. |
| `src/main.ts` | Coordinar el alta y actualizar el estado tras canjes; descargar lógica de portada y alta a módulos. Cargar el juego 3D solo cuando se abra. |
| `src/game/navigation.ts` | Añadir pantallas de ruleta, nombre, dardo y resumen; impedir saltos que omitan pasos obligatorios y reanudar sesiones. |
| `src/game/characters.ts`, `nft.ts` | Catálogo de Pets con diversidad real, IDs independientes de nombres y teléfono, reglas de generación compatibles con el elemento del servidor. Mantener adaptadores para personajes antiguos. |
| Nuevos `landing-ui.ts`, `onboarding-ui.ts` | Separar portada y control del flujo inicial de `main.ts`. |
| Nuevos `element-wheel.ts`, `dart-game.ts` | Animación y entradas accesibles; mostrar el resultado validado, sin otorgar estadísticas por sí solos. |
| `src/game/profile.ts` | Perfil versionado, migración explícita y selección consistente. No crear automáticamente otro inicial al migrar una cuenta existente. |
| `src/game/api.ts` | Métodos HTTP explícitos, nuevos contratos del alta y canje, errores de guardado visibles y revisión de concurrencia. |
| `redeem-ui.ts`, `qr-scanner.ts`, `reward-manager.ts` | Escáner fuera del RPG, mensajes en español, entrada manual y confirmación del Pet destino; detener cámara al abandonar la pantalla. |
| `hub-ui.ts`, `characters-ui.ts`, `reward-result-ui.ts` | Colección como centro, estadísticas desglosadas, nuevas habilidades y resultado de compra con actualización inmediata. |
| `server/index.js` | Corregir contrato de perfiles, sesiones de alta, premios comerciales y operaciones por restaurante; separar reglas en módulos de servidor. |
| `server/admin.html` | Catálogo y campañas, emisión de códigos pendientes y consulta de entregas. Añadir acceso de negocio separado del administrador global. |
| `public/manifest.webmanifest`, iconos, metadatos | Marca Foodie Pets y política realista de conectividad. Migración de almacenamiento local. |
| README y ESTADO-PROYECTO | Documentar implementación real, requisitos comerciales y entorno. |

Datos nuevos propuestos: catálogo de especies, sesiones de alta con etapa/resultado/dardo/caducidad, referencia de alta inicial por usuario, habilidades por Pet, reglas de recompensa, registro de compras y accesos por negocio. Las tablas actuales de negocios, promociones, códigos e historial se extienden cuando sea posible. Distinguir el ID de especie del ID único de cada ejemplar: la recompensa actual detecta duplicados por un ID de personaje fijo.

Contratos propuestos: crear/consultar sesión de alta; girar; registrar dardo; reclamar Pet autenticado; renombrar Pet; emitir factura pendiente desde el negocio; canjear con `code` y `characterId`. Definir las rutas y esquemas antes de construir la interfaz.

No permitir que una actualización general de perfil cambie nivel, XP, bonus comerciales, códigos consumidos o moneda. Guardar preferencias mediante operaciones acotadas. Usar revisión de perfil o rechazo de escrituras obsoletas para evitar que el juego abierto sobrescriba compras. El servidor controla tanto los premios de QR como los cambios de progreso que afecten a ellos.

## 7. Implementación por fases

### Fase 1 — Corregir base y definir contratos

Corregir POST/PUT, retirar la exigencia obsoleta de `nft`, conservar todos los campos versionados y hacer que el alta confirme persistencia. Definir una sola selección activa. Preparar migraciones con copia de respaldo de datos, autoridad del servidor y concurrencia. Validar que una cuenta nueva y una existente sobreviven al cierre y reapertura.

### Fase 2 — Portada Foodie Pets

Implementar el orden y textos de la sección 3, catálogo variado, carrusel y espacio de animación. Actualizar identidad instalable y metadatos. Preparar el contacto de WhatsApp configurable. Entregable: portada adaptable completa; el recurso animado definitivo puede seguir reservado.

### Fase 3 — Ruleta, nombre y dardo

Construir sesiones de alta y restricciones de servidor; después conectar las pantallas y animaciones. Reclamar el Pet una sola vez tras autenticación. Entregable: un alta completa que se puede reanudar y cuyo resultado coincide con el perfil guardado.

### Fase 4 — Compras, QR y evolución

Extender premios con XP, estadísticas y habilidades; emitir códigos pendientes y elegir Pet destino. Reutilizar el escáner, añadir alternativa manual y sincronizar perfiles. Entregable: una compra de prueba mejora el Pet y queda en el historial sin duplicarse.

### Fase 5 — Operación de restaurantes y acabado

Acceso limitado por negocio, configuración de campañas, reglas de premios reales y piloto con un restaurante. Incorporar recurso animado final, revisar rendimiento móvil, accesibilidad y documentación. Publicar después de validar configuración y comportamiento comercial.

Dependencias: la fase 1 precede al alta y a recompensas; la portada puede diseñarse mientras se definen contratos. La integración con software de facturación específico queda posterior al flujo manual de emisión, salvo que ya exista una integración concreta.

## 8. Criterios de aceptación y pruebas necesarias

- La portada muestra «Foodie Pets», exactamente dos tarjetas, el botón, la descripción, el espacio animado y la invitación para negocios en el orden solicitado.
- El carrusel cambia realmente los personajes del catálogo y no sigue creando renderizadores o partículas al entrar y salir repetidamente.
- La ruleta entrega el elemento señalado y la cuenta obtiene un único Pet inicial aunque recargue o reclame simultáneamente.
- Nombre y bonus del dardo persisten al iniciar sesión desde otro navegador; no hay segundo bonus por recarga.
- El flujo funciona con teclado y toque; dispone de alternativa al movimiento y de mensajes claros de conexión.
- Un QR válido aumenta XP del Pet elegido y puede subir varios niveles. Otro Pet no cambia.
- Un mismo código canjeado dos veces o al mismo tiempo solo entrega una recompensa. Código inválido, vencido, cancelado o de negocio inactivo no entrega nada.
- Un navegador con estado viejo no puede borrar una compra ni alterar XP o moneda mediante el guardado general.
- Tras canjear, centro, colección e historial muestran el mismo resultado sin recargar la página.
- Un negocio solo puede emitir y consultar sus códigos; el administrador conserva la gestión global.
- Migrar cuentas existentes conserva su colección; el alta nueva no depende de `nft` antiguo.
- Comprobar creación/canje contra Express y SQLite reales: los tests unitarios del navegador no detectan por sí solos los desacuerdos entre cliente y servidor.

## 9. Verificación realizada y límites

Se revisaron la entrada de la aplicación, HTML y estilos de portada, generación y colección, migración de perfiles, navegación, comunicación HTTP, progresión, canje, escáner, esquema y rutas del servidor, manifest y service worker. No se inspeccionaron datos privados de usuarios ni se probó el despliegue remoto.

Se intentaron los tests y la compilación. `npm run build` completó el paso TypeScript, pero Vite no pudo cargar su configuración por una restricción de acceso a directorios del entorno. Vitest tampoco pudo cargar su configuración por el mismo motivo. No se puede afirmar que los tests pasan ni que existe una compilación validada. La revisión visual en navegador y las pruebas de integración quedan para la implementación.

## 10. Decisiones comerciales pendientes

Antes de lanzar: número de WhatsApp; identidad definitiva de las especies; reglas aprobadas de rareza y bonus; premios y XP por compra; restaurante piloto y método de emisión de facturas; condiciones de regalos físicos. Para la primera implementación pueden usarse las propuestas explícitas de este documento y datos de demostración identificados como tales.

Decisión de alcance pendiente: conservar el mundo abierto como opción secundaria o retirarlo del producto principal. La arquitectura propuesta permite construir Foodie Pets conservando temporalmente el juego y sus datos, sin hacer del combate un requisito para escanear compras.
