# AODASE PETS — adaptación urbana inicial

6 de octubre de 2026. Entrega A0 del [GDD técnico vigente](GDD-TECNICO-AODASE-PETS.md). El plan maestro amplía Foodie Pets a toda la ciudad y sus negocios locales, comenzando por Villavicencio. Esta entrega adapta la base existente; las siguientes entregas incorporarán el mapa y la primera evolución.

## Recorrido disponible

1. La portada presenta **AODASE PETS · Tu ciudad. Tu Pet. Tu evolución.** Conserva las dos vistas 3D rotativas y la ilustración animada del QR. La escena urbana nueva está identificada como conceptual.
2. **Entrar al mundo** abre la cuenta. Al registrarse sin mascotas, se abre directamente la incubadora; el taller pendiente no se convierte en el primer Pet.
3. Elige un huevo gratuito de Bosque, Fuego, Agua o Misterioso. Nacerá tras 90 segundos o al tercer Dar calor. Cada cuidado suma +1 a todas sus estadísticas, hasta +3; sin calor nace con estadísticas más bajas. Se anima una grieta cada 20 segundos y con cada cuidado.
4. La cáscara se rompe durante dos segundos tras la confirmación. El primer Pet se añade a la colección y se selecciona. **Dar la bienvenida** queda como alternativa manual si hay que recuperar una solicitud fallida. Puedes ponerle nombre en el hábitat y cambiarlo después.
5. Alimenta, juega, descansa, baña, acaricia o entrena: cada acción tiene su propia reacción 3D. Las misiones entregan recompensas una vez y aplican la experiencia al compañero indicado.
6. Puedes explorar el campo PvE 3D, volver a tu cuenta y abrir **Negocios de mi ciudad**. El catálogo empieza en Villavicencio, con búsqueda y filtros. Si aún no existen registros, lo comunica claramente.
7. **Probar el taller 3D** conserva el editor, Random, dados y dardo como experiencia experimental. Su resumen explica que el compañero de una cuenta nueva nace de un huevo.

Las cuentas con mascotas conservan su colección y acceso habitual. Un nacimiento adicional no cambia la mascota activa de aventura. Los datos anteriores, incluidos los negocios de otras ciudades, siguen accesibles.

## Cambios técnicos

| Área | Implementación |
|---|---|
| Marca | Portada, navegación visible, hábitat, PWA y administración AODASE PETS |
| Primer nacimiento | Perfil vacío normalizado sin fabricar una mascota; nacimiento y selección atómicos |
| Nombre | `rename_pet`, 1–24 caracteres normalizados, propiedad e idempotencia |
| Incubación | `AODASE_INCUBATION_MS`, entero de 90000 a 604800000; 90 segundos por defecto y sólo afecta huevos nuevos |
| Apariencia | 14 especies, híbridos compatibles, pelajes/marcas/iris y renderer 3D de tonos suaves |
| Genética | Alelos de anatomía, dimensiones, colores y afinidad; fenotipo expresado exacto y recesivos privados |
| Vida | Seis reacciones 3D, respiración/parpadeo, pausa al ocultarse y lienzo conservado durante cuidados |
| Territorio | Catálogo compartido: Colombia → Meta → Villavicencio; ID interno `CO-MET-VVC` |
| Categorías | 13 IDs compartidos entre cliente y servidor, conservando las cinco categorías originales |
| Negocios | `city_id`, país, región, nombre de fantasía, afinidad y roles opcionales |
| Ubicación | `location_known`; el DTO devuelve `lat/lng: null` cuando no hay coordenadas cargadas |
| Demostración | `is_demo` para los cinco registros originales identificados por ID, nombre y ciudad |
| Administración | Creación y edición validadas; ID inmutable y coordenadas cargadas como par |
| Compatibilidad | Migración SQLite aditiva; no renombra tablas, sesiones, negocios ni códigos QR |

`affinity` y `place_roles` describen contenido futuro: no conceden ADN, una misión ni recompensas por guardar un negocio. Una coordenada declarada no demuestra presencia física. El registro de una ciudad no acredita negocios aliados.

## API disponible

- `GET /api/guardian` y `POST /api/guardian/action`: estado y acciones de crianza, ahora admitiendo una cuenta sin Pet.
- `rename_pet`: intención `{ action, requestId, petId, name }`; altera únicamente el nombre.
- `GET /api/urban/catalog`: categorías y ciudades habilitadas.
- `GET /api/cities`: ciudades y selección piloto por defecto.
- `GET /api/stores` y `GET /api/stores/:id`: catálogo y detalle con metadatos territoriales.
- `POST /api/admin/stores`: alta por el administrador autorizado.
- `PATCH` o `PUT /api/admin/stores/:id`: edición validada, conservando las referencias existentes.

La administración actual sigue siendo global. No se presenta como portal multiempresa ni como registro autónomo para comerciantes.

## Ejecutar y configurar

```powershell
npm run dev
```

Arranca backend en 3000 y frontend en 5173. Reinicia Express si seguía ejecutándose con el código anterior. Iniciar sólo Vite produce errores de proxy cuando Express está apagado.

Para modificar la duración antes de iniciar el servidor:

```powershell
$env:AODASE_INCUBATION_MS = '86400000'
npm run dev
```

Este ejemplo establece un día para los huevos nuevos. El valor por defecto y mínimo es 90 segundos. Los huevos existentes conservan su `readyAt`, incluidos los antiguos de treinta segundos. Una configuración inválida impide iniciar el módulo en vez de aplicar una duración ambigua.

Los datos demo se cargan únicamente con `SEED_DEMO_DATA=true`. No habilites esa opción para publicar el piloto. Los registros previos se conservan y se muestran como demostración cuando coinciden con las semillas originales. Un negocio sin coordenadas puede publicarse en el catálogo; todavía no aparecerá en un mapa.

Vite admite `VITE_AODASE_WHATSAPP` con el número comercial completo. También reconoce `VITE_FOODIE_WHATSAPP` para conservar configuraciones anteriores. Mientras no haya un teléfono configurado, la portada muestra que el contacto está pendiente.

## Verificación

```powershell
npm run build
npm run test
node --test server/foodie-integration.test.js server/guardian-domain.test.js server/guardian-integration.test.js server/urban-businesses.test.js server/aodase-integration.test.js
```

La batería cubre cuentas vacías, nacimiento inicial y adicional, selección, renombrado, propiedad, idempotencia, genomas ocultos, maduración y persistencia. El catálogo verifica categorías, filtros combinados, textos con acentos, registros heredados, coordenadas desconocidas, controles de administrador y migración repetible. Las pruebas HTTP usan bases temporales y usuarios propios.

Resultados de la entrega urbana inicial: **224 pruebas de cliente y 32 de servidor**. Ampliación de arte y vida, verificada el **7 de octubre de 2026**: **245 pruebas de cliente y 35 de servidor pasan**. TypeScript, compilación de producción, formato y ESLint en los archivos de cliente modificados pasan. El build conserva la advertencia de tamaño del paquete de Three.js, aproximadamente 518 kB sin compresión; requiere medición y carga diferida antes del piloto. El muestreo genético puro usa entorno Node para no depender de la carga de múltiples entornos DOM.

Verificación visual con usuario y base propios: registro desde la portada, huevo, tres cuidados, maduración, nacimiento, nombre y persistencia al recargar. Revisados escritorio de 1280 × 850, hábitat y catálogo verticales de 390 × 844, y mundo horizontal de 844 × 390 sin desbordamiento horizontal. La definitiva del recién nacido derrotó un monstruo, confirmó 25 XP y monedas, y permitió volver a la cuenta sin errores de consola. Estas pruebas de viewport no sustituyen mediciones en teléfonos físicos.

Verificación de arte y vida del 7 de octubre: un huevo creado con cinco minutos de incubación y cero cuidados nació automáticamente al retomar la sesión tras una ausencia, conservando su fecha original. Se revisaron en el navegador las seis reacciones (comida, pelota, sueño, burbujas, corazones y entrenamiento), sus cambios persistentes y el nombre después de recargar. Hábitat y catálogo sin desbordamiento a 390 × 844; modelo y controles del mundo a 844 × 390; portada, Gatito y Ajolotito en el taller a 1280 × 850. Sin errores de consola WebGL en la versión corregida. La revisión detectó un identificador GLSL reservado en el material; se corrigió y añadió comprobación de regresión. La ruptura de dos segundos, su pausa al ocultarse y el nacimiento exactamente al vencer el reloj se verifican además en las pruebas automatizadas.

El [diseño de arte, genética y vida](ARTE-GENETICA-Y-VIDA.md) describe los contratos y límites de esta ampliación. Las mascotas y genomas existentes permanecen almacenados sin reescribir sus rasgos; el renderer común adapta su presentación.

## Cambio de incubación del 7 de octubre

El calor deja de ser puramente decorativo: mejora todas las estadísticas base en +1 por cuidado (máximo +3) y el tercer cuidado desbloquea el nacimiento anticipado. El reloj de los huevos nuevos es de 90 segundos por defecto. Grietas y sacudidas a los 20, 40, 60 y 80 segundos, además de cada Dar calor; ruptura final de dos segundos antes de revelar al bebé. Las verificaciones anteriores de cinco minutos quedan como historial.

Verificación: 247 pruebas de cliente y 36 de servidor pasan; TypeScript, build, ESLint y formato del flujo de incubación pasan. Los tests cubren +0/+1/+2/+3 por calor en todas las estadísticas, nacimiento anticipado y por reloj, replay sin bonus duplicado, grietas cada 20 segundos aun cuando un cuidado ya agrietó la cáscara y revelación del bebé tras la ruptura.

## Entregas siguientes

1. **ADN y primera evolución visible:** recursos gratuitos persistentes, exactamente tres alternativas, coste y procedencia del recurso, transformación coherente y registro evolutivo.
2. **Mapa de Villavicencio:** capa 2D con lugares publicados, espacios públicos y oportunidades. Geolocalización opcional y estado sin permiso.
3. **Primer recorrido urbano gratuito:** descubrimiento, actividad local y recompensa única; registro de lugar y progreso sin exigir compra.
4. **Negocios del piloto:** portal por organización, contenido aprobado, canjes auditables y ledger empresarial separado de las monedas de aventura.

No están conectados todavía el mapa real, las visitas verificadas, ADN, rutas urbanas, reproducción, cooperación ni intercambio. El GDD especifica sus contratos, dependencias y criterios de aceptación.
