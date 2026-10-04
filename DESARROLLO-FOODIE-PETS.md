# Foodie Pets — primera versión funcional

Fecha: 4 de octubre de 2026.

## Implementado

- Portada Foodie Pets con dos tarjetas 3D del catálogo que cambian cada siete segundos, botón para unirse, descripción comercial, ilustración provisional de escaneo y sección para negocios.
- Ruleta de seis elementos con resultado decidido y conservado en SQLite; todos los elementos tienen la misma probabilidad. El Pet inicial es común, con forma y estadísticas variables.
- Nombre editable antes del dardo. Un lanzamiento por sesión, elección de estadística y bonus de 0 a 3 puntos. Alternativa sin movimiento de +1 punto.
- Registro/inicio de sesión después de descubrir el Pet, reclamación idempotente y un único inicial por cuenta. Sesiones anónimas con caducidad de 24 horas. Recargar retoma el resultado al volver a «Unirse al mundo».
- Colección y centro con modelo 3D del Pet activo, estadísticas, nivel y XP. Regreso a la portada desde la colección.
- Escáner de factura fuera del mundo 3D; cámara detenida al salir y entrada manual como alternativa. El canje permite elegir el Pet destinatario.
- XP de compras aplicada en servidor junto con el premio existente, dentro de una transacción. Regla provisional de 25 XP por producto, campo `products.purchase_xp`; admite varias subidas de nivel y máximo nivel 100.
- Comprobación de negocio activo, titularidad del Pet, vigencia y consumo único del código. Historial con XP y actualización del perfil al continuar desde el resultado.
- Emisión administrativa de códigos pendientes, identificados por referencia única de compra; repetir una referencia devuelve el mismo código.
- Corrección del método de guardado POST/PUT y del formato legado `nft`. Versiones de perfil para rechazar guardados antiguos. Los Pets nuevos con ID `FP-`, sus estadísticas y sus premios comerciales se conservan desde el servidor.
- Marca instalable e iconos Foodie Pets, navegación que excluye las pantallas ocultas del teclado, adaptación móvil y movimiento reducido.

Los modelos procedurales actuales se reutilizan en esta primera versión. La ilustración de la factura es estática y reserva el lugar de la animación definitiva. No se modificaron datos del despliegue remoto.

## Ejecutar localmente

```powershell
npm install
npm install --prefix server
npm run server
npm run dev -- --host 127.0.0.1
```

Servidor: puerto 3000. Vista web: puerto 5173. Los scripts ya incluyen `--configLoader runner` para evitar la restricción de acceso del cargador predeterminado observada en este equipo.

Si el complemento nativo de SQLite no tiene binario compatible, el servidor puede usar `node:sqlite` en una versión de Node que lo incluya (probado con Node 24). En ese caso se puede instalar con `npm install --prefix server --ignore-scripts`. El adaptador conserva consultas y transacciones; un error real al abrir la base de datos no se oculta como incompatibilidad.

Para WhatsApp, copiar `.env.example` a `.env`, completar `VITE_FOODIE_WHATSAPP` con código de país y número, y reiniciar/recompilar. Mientras no exista un número válido, el enlace permanece desactivado y la página lo explica.

## Endpoints añadidos

| Método | Ruta | Función |
|---|---|---|
| POST | `/api/onboarding` | Crear sesión anónima |
| GET | `/api/onboarding/:id` | Recuperar etapa y resultado |
| POST | `/api/onboarding/:id/spin` | Descubrir elemento y Pet una sola vez |
| POST | `/api/onboarding/:id/dart/start` | Validar nombre, estadística e iniciar reto |
| POST | `/api/onboarding/:id/dart/throw` | Registrar un único bonus |
| POST | `/api/onboarding/:id/claim` | Guardar el inicial en una cuenta autenticada |
| POST | `/api/admin/stores/:id/invoice-codes` | Emitir código pendiente y payload QR de una compra |

Emisión pendiente: requiere autenticación administrativa y `{ "product_id": "…", "purchase_reference": "…" }`. Devuelve el código y su texto QR; aún no incorpora un editor ni impresión de QR en el panel administrativo. El endpoint antiguo `/invoices` conserva su entrega inmediata para compatibilidad; no utilizarlo para el recorrido nuevo de escaneo.

Canje: `/api/redeem` acepta `{ "code": "…", "characterId": "…" }`. Si se omite el destinatario, utiliza el seleccionado. Devuelve el premio más `growth`, con XP, nombre y nivel antes/después. Los datos de demostración del catálogo siguen siendo los del RPG y deben reemplazarse antes del piloto.

## Verificación

```powershell
npm run build
npm test
node node_modules/eslint/bin/eslint.js src/ --quiet
node --test server/foodie-integration.test.js
```

Las pruebas de integración arrancan otro servidor en el puerto 3107 con una base de datos temporal aislada y la eliminan al terminar. Cubren el alta, giro y dardo únicos, persistencia, rechazos de escritura obsoleta o manipulación del nuevo Pet, XP de múltiples niveles, canje simultáneo y emisión idempotente de compra pendiente. Las pruebas de cámara usan simulaciones; no se solicitó acceso a la cámara física.

Resultado: 184 pruebas de frontend y 3 pruebas de servidor aprobadas; compilación de producción y análisis de errores de lint aprobados. El repositorio conserva advertencias de formato previas en archivos heredados, especialmente por saltos de línea de Windows; no se realizó una reformateación global del RPG.

También se revisó el navegador a 390 × 844 y en escritorio, incluyendo nombre, bonus, inicio de sesión con cuenta ficticia, recarga y canje manual de una factura de ejemplo. La vista local de esta entrega utiliza `.foodie-test-data`, separada de `server/data`; no representa negocios reales.

## Pendiente para el piloto

1. Número de WhatsApp y recurso animado definitivo.
2. Catálogo propio de especies Foodie Pets y arte final; aprobar rarezas, nombres y reglas comerciales.
3. Panel de emisión/impresión de QR y cuentas limitadas a cada restaurante. La nueva emisión todavía se realiza mediante API administrativa.
4. Integración con el software de facturación de un restaurante piloto. El QR fiscal de una factura cualquiera no se convierte automáticamente en un código Foodie Pets.
5. Campañas de habilidades, accesorios y regalos físicos, con sus condiciones y comprobación por el negocio. El MVP entrega XP y las recompensas existentes.
6. Migración definitiva de la economía del RPG: los personajes nuevos FP tienen progreso protegido, pero el contrato legado de personajes RA debe retirarse/endurecerse antes de un uso comercial público. El combate original conserva comportamiento local; el guardado general no aumenta XP de los nuevos Pets.
7. Adaptador de lectura QR para navegadores sin BarcodeDetector si se desea cámara en todos ellos. Actualmente disponen de entrada manual.

No se ha publicado esta versión. El archivo PLAN-FOODIE-PETS.md conserva el plan completo de referencia.


## Actualización: creador personalizable y dardos

- La creación permite elegir nombre, seis elementos, cuatro formas, color y dos poderes del catálogo. Los poderes elegidos también se usan en el juego existente.
- Cada estadística se obtiene sumando dos dados de seis caras. El servidor conserva un único lanzamiento y la interfaz anima los dados durante 1,8 segundos.
- El minijuego comienza cuando el usuario pulsa empezar. Una flecha recorre verticalmente una barra roja, naranja y verde durante un máximo de 30 segundos; se detiene con el botón o la barra espaciadora.
- Distancia al centro: hasta 2 % especial (+5), hasta 6 % legendario (+4), hasta 15 % épico (+3), hasta 30 % raro (+2), resto común (+1). El bonus se aplica a la estadística elegida; rareza y nivel de experiencia son independientes.
- El instante del lanzamiento se envía al servidor con validación temporal para conservar el punto mostrado pese a la latencia. La entrega es idempotente. Sin movimiento o al expirar: común +1.
- La elección y los resultados sobreviven a recargas. Los Pets ya creados se conservan.


## Actualización: pasos editables, anatomía y prueba del mundo

Esta actualización reemplaza la regla anterior de un único lanzamiento de dados.

- Se puede volver desde los dados, el dardo y el resumen a editar el personaje, o regresar a los dados. Los datos se restauran en el formulario.
- Cabeza redonda, cuadrada o diamante; cuatro cuerpos; 0/2/4/6/8 extremidades y largo de 0,5 a 1,8. El mismo modelo personalizado aparece en la vista previa y en el campo del mundo.
- Los dados pueden repetirse antes de guardar: giran durante dos segundos y cada resultado muestra la suma exacta de dos dados. Cada repetición reemplaza las estadísticas. La repetición de una solicitud con el mismo identificador no vuelve a sortearlas.
- Tras detener el indicador de puntería, un dardo vuela durante dos segundos hacia una diana roja y blanca. El impacto corresponde al resultado calculado; el centro concede el premio máximo.
- Volver atrás elimina el regalo previo; el siguiente lanzamiento lo reemplaza, sin acumular bonus.
- El resumen permite crear una cuenta o probar el Pet sin registro en el campo de la aldea existente. Incluye movimiento por teclado y controles táctiles, poderes visuales y regreso al creador; la prueba no modifica el progreso de la cuenta.
