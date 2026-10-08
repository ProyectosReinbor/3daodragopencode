# Foodie Pets — primera entrega del Guardián

Fecha: 5 de octubre de 2026. Fase M1 del [GDD técnico](GDD-TECNICO-FOODIE-PETS.md). Esta entrega inicia la visión de crianza con un recorrido completo y persistente, conservando la portada, el editor aprobado, los dados, el dardo y las mascotas existentes.

## Recorrido disponible

1. Guarda tu personaje y entra en tu cuenta. Abre **Mi hábitat**.
2. Alimenta, juega, descansa, baña, acaricia o entrena. Cada Pet tiene saciedad, energía, ánimo, higiene, afecto, salud y curiosidad persistentes. Las acciones comparten una espera de tres segundos por Pet.
3. Recibe la misión **Un primer vínculo**. Sus premios se aplican a la mascota que estás cuidando.
4. En **Incubadora**, elige un huevo gratuito de Bosque, Fuego, Agua o Misterioso. Dale calor tres veces, con tres segundos entre cuidados. Espera a que termine su maduración de treinta segundos desde la elección y pulsa **Dar la bienvenida**.
5. El recién nacido se suma a la colección y aparece en el hábitat. El compañero anterior conserva diseño, estadísticas e identidad. El nacimiento no sustituye la mascota activa de aventura.
6. Consulta **Catálogo**: especie, afinidad, etapa, origen, generación, huella genética, rasgos conocidos y cantidad de genes ocultos. Las especies y rasgos descubiertos corresponden a tu colección real.
7. Reclama las otras dos misiones y explora el mundo. Para cambiar la mascota activa del combate utiliza **Mis Foodie Pets**, en tu cuenta; el selector del hábitat elige a quién cuidar.

## Balance del primer recorrido

| Regla | Valor actual |
|---|---|
| Huevo de bienvenida | Uno por cuenta, adicional al fundador |
| Incubación | 30 segundos de reloj del servidor y tres cuidados |
| Colección admitida por el nuevo sistema | Máximo 40 Pets; no borra colecciones existentes |
| Alimentos iniciales | 8 |
| Alimentar | Consume 1 alimento; mejora bienestar |
| Jugar | Consume 6 de energía; entrega 2 alimentos |
| Descansar | Recupera 28 de energía, sin coste |
| Entrenar | Consume 8 de energía; entrega 3 XP reales |
| Primer vínculo | 5 alimentos, 10 monedas de aventura y 10 XP |
| Calor de hogar | 4 alimentos, 15 monedas de aventura y 15 XP |
| Una nueva amistad | 6 alimentos, 25 monedas de aventura y 25 XP |
| Etapa por nivel | Bebé antes de nivel 4; juvenil desde 4; adulto desde 10 |
| Desgaste por ausencia | Intervalos de 15 minutos; máximo 24 horas computadas por visita |
| Salud mínima por ausencia | 20; ninguna mascota muere permanentemente |

Estos valores aceleran la prueba del ciclo inicial. El entrenamiento y la recuperación forman un ciclo gratuito deliberado; todavía no tienen límites diarios ni balance de temporada. Las etapas cambian por nivel, sin transformación visual evolutiva. La personalidad inicial es **curioso**.

Las recompensas de misión se guardan en `profile.world.coins`; son las monedas de aventura que muestra el hábitat y utiliza el boticario. `profile.currency` conserva su función anterior. Esta entrega no fusiona saldos ni introduce dinero real o una moneda comercial nueva.

## Persistencia y autoridad

- `GET /api/guardian`: devuelve perfil y DTO público del hábitat, evaluados con el reloj del servidor.
- `POST /api/guardian/action`: recibe una intención con `action`, `requestId` y los identificadores correspondientes. Nunca acepta resultados, genes, experiencia ganada o fechas de maduración del cliente.
- `foodie_guardians`: estado separado del perfil con cuidados, huevos, genomas privados, descubrimientos, progreso, premios y recargas.
- `foodie_guardian_requests`: recibos de idempotencia por cuenta y solicitud. Repetir una petición devuelve el resultado guardado; reutilizar su ID con otro contenido devuelve 409.
- Nacimiento, publicación del genoma, guardado del perfil y recibo se confirman en una transacción SQLite. Un fallo revierte la operación entera.
- Un nacimiento o premio ya completado también se protege frente a otro `requestId`. Se comprueba la propiedad de Pets y huevos.
- Los alelos recesivos permanecen en el servidor. El catálogo recibe un resumen; los registros iniciales son generación 0 y aún no representan reproducción funcional.
- Los fundadores conservan sus rasgos. Los perfiles heredados con un solo `nft` se adaptan a colección sin perder su diseño.
- El cliente bloquea acciones mientras guarda, reconcilia un resultado incierto mediante GET y cancela solicitudes, temporizadores y vistas 3D al salir.

No se modifica la autoridad parcial del combate heredado; su ampliación para cooperación y PvP está definida en el GDD.

## Mejora visual inicial

El mundo utiliza iluminación por bioma, ACES y salida sRGB, vegetación y suelo instanciados, piedras, partículas y una sombra de contacto procedural bajo el Pet. El campo de prueba incorpora un círculo de arena. La capa utiliza los modelos existentes, limita decoración en dispositivos táctiles y respeta movimiento reducido; libera sus recursos al cambiar de zona o salir.

El hábitat incorpora una escena 3D del compañero, una incubadora animada y una revelación del nacimiento. Conserva acceso táctil, foco visible, mensajes de estado y diseño adaptativo. El mundo de combate sigue usando orientación horizontal y los controles ya aprobados.

No se incorporaron assets fotorrealistas ni se midió un presupuesto de FPS en dispositivos físicos: la dirección actual es fantasía estilizada con mejor luz y contacto con el terreno.

## Ejecución y verificación

Desde la raíz del proyecto:

```powershell
npm run dev
```

Inicia Vite en 5173 y Express en 3000. Si ya tenías un servidor levantado antes de esta entrega, reinícialo para cargar las rutas nuevas. No basta con arrancar únicamente Vite.

```powershell
npm run build
npm run test
node --test server/foodie-integration.test.js server/guardian-domain.test.js server/guardian-integration.test.js
npx eslint src/main.ts src/game/navigation.ts src/game/hub-ui.ts src/game/world-play.ts src/game/world-play.test.ts src/game/guardian-ui.ts src/game/guardian-ui.test.ts src/game/world-presentation.ts src/game/world-presentation.test.ts
```

Resultados de esta entrega: **208 pruebas de cliente y 20 pruebas de servidor pasan**; TypeScript, compilación de producción, formato y ESLint en los archivos de cliente modificados pasan. La batería cubre preservación de fundadores, reloj y desgaste, recuperación gratuita, forma válida de recién nacidos, propiedad, genomas ocultos, persistencia, solicitudes repetidas y simultáneas, recompensas únicas, reversión transaccional y migración heredada. La interfaz tiene pruebas de autenticación, acciones, selección local, destinatario de experiencia, reconciliación y liberación de recursos. Las pruebas HTTP usan una base temporal aislada y sus propios usuarios.

Comprobación visual en navegador con cuenta propia de pruebas y base aislada: alimentación, premio de misión, elección y tres cuidados de huevo, nacimiento, persistencia después de recarga y catálogo. Revisados escritorio, catálogo vertical de 390 × 844 sin desbordamiento horizontal y mundo horizontal de 844 × 390. La definitiva derrotó un monstruo y confirmó experiencia y monedas; salir devolvió la cuenta sin errores de consola. Estas revisiones de viewport no sustituyen pruebas en teléfonos físicos.

La compilación conserva la advertencia de Vite por el tamaño del paquete de Three.js, aproximadamente 517 kB sin compresión. No impide compilar; la carga diferida y medición en móviles están programadas en el GDD.

## Continuación de producción

El siguiente bloque debe conectar expediciones y misiones de bioma con los descubrimientos reales y añadir catálogo de contenido por datos. Después vienen evolución visual y especialización, personalidad dinámica, ADN y herencia, reproducción y genealogía. El GDD define las dependencias antes de geolocalización, campañas comerciales, cooperativo, PvP, intercambio y territorios.

Estas funciones están diseñadas y planificadas, pero no se presentan como implementadas en esta primera entrega. Tampoco se han creado usuarios ficticios en el mundo, presencia social simulada ni entregas comerciales nuevas.
