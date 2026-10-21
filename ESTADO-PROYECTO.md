# Estado del proyecto — AODASE PETS

Fecha de revisión: 20 de octubre de 2026 (Colombia). Base analizada: commit `3026977`, rama `main`.

## Diagnóstico

AODASE PETS tiene una base funcional amplia de crianza de mascotas y aventura urbana 3D. La clasificación recomendada es **prototipo avanzado, candidato a piloto controlado tras estabilización**. Esta clasificación es una evaluación técnica del repositorio, no una certificación de producción.

El producto evolucionó desde Reinos Ancestrales y Foodie Pets: hoy combina mascotas, exploración de Villavicencio y negocios locales. El mapa urbano ya existe; presentarlo como una entrega enteramente futura, como hace el README anterior a esta revisión, es incorrecto. Las visitas físicas verificadas y la operación independiente por negocio siguen pendientes.

No se comprobó el alojamiento remoto, el DNS, los certificados, la disponibilidad pública ni el estado de un servicio systemd. No hay evidencia en esta revisión para afirmar que la versión local esté desplegada.

## Inventario funcional

| Área | Estado observado | Evidencia principal y límite |
|---|---|---|
| Cuenta y persistencia | Implementado | `server/index.js`: registro, JWT, perfiles versionados y SQLite; conservar compatibilidad y comprobar concurrencia al ampliar operaciones. |
| Crianza | Implementado | `server/guardian-domain.js`, `server/foodie-guardian.js`, `src/game/guardian-ui.ts`: huevos, calor, nacimiento, nombre, cuidados y misiones. |
| Apariencia y genética | Implementado parcialmente respecto al diseño completo | `shared/pet-genetics.js`, `shared/pet-species.js`, `src/game/pet-model.ts`: especies, genomas y fenotipo; no equivalen a reproducción o evolución completa. |
| Taller experimental | Implementado | Editor anatómico, Random, dados, dardo y prueba; convive con el nacimiento por huevo del recorrido principal. |
| Mundo urbano | Implementado como juego | `shared/villavicencio-osm.js`, `src/game/city-urban.ts`, `src/game/world-play.ts`: cartografía, edificios, interiores, biomas, mapa y minimapa. La decoración es fantástica; los lugares no acreditan alianzas comerciales. |
| Aventura y economía | Implementado | Recolección, extracción temporizada, recetas, equipo, misiones, aventura guiada, campamentos, pasaporte, memoria y consumibles. Reglas en `shared/` y operaciones en `server/foodie-world.js`. |
| Combate | Autoridad parcial | El servidor calcula daño a enemigos, recompensas, recargas y reaparición; el cliente conserva movimiento, IA y daño recibido. Falta autoridad integral antes de competencia con premios. |
| Controles | Implementado con pruebas simuladas | Teclado, pantalla y mando estándar; falta validación con mandos y teléfonos físicos finales. |
| Negocios y compras | Base implementada | Catálogo territorial, productos, promociones, emisión y canje con XP e historial. No demuestra integración con facturación fiscal ni operación comercial validada. |
| Administración | Implementado, alcance global | `admin/`, `server/admin-management.js`, `server/admin-crud.js`: cuentas, inventarios, tiendas, facturas y auditoría. Falta aislamiento por organización. |
| Presencia social | Inicial | `/api/world/presence` devuelve hasta cuatro compañeros cercanos con posiciones reportadas. No es multijugador autoritativo completo. |
| PWA | Manifest y registro disponibles | `public/sw.js` activa el worker y limpia cachés; no implementa manejador `fetch` ni caché offline. No prometer juego sin conexión. |

## Arquitectura y mantenibilidad

Frontend en TypeScript, Three.js y Vite, sin framework de interfaz. Backend Express con JWT, bcrypt y SQLite. `server/database.js` usa better-sqlite3 y contempla alternativa con node:sqlite cuando falta el módulo/binario. En esta revisión se utilizó Node 24.12.0; esto no confirma compatibilidad con todas las versiones de Node.

`shared/` reúne contratos y reglas reutilizados por cliente y servidor. La carga diferida del mundo ya está implementada en `src/game/lazy-world.ts`; su siguiente paso es medir el resultado en dispositivos reales. `src/game/world-play.ts` concentra aproximadamente 111 kB de código fuente y `server/index.js` unos 48 kB: conviene dividirlos por responsabilidad al modificar esos flujos, con pruebas de regresión.

Las sesiones de mundo y presencia se guardan en memoria del proceso. Reinicios y múltiples procesos requieren una estrategia explícita antes de escalar. SQLite sigue siendo razonable para un piloto de una instancia; no hay mediciones de carga que justifiquen una migración inmediata.

## Riesgos y brechas prioritarias

1. **Confianza en posiciones:** las acciones de proximidad usan coordenadas declaradas por el cliente. El servidor limita acciones y premios, pero no acredita desplazamiento legítimo ni presencia física. No habilitar premios por visitas reales con este mecanismo.
2. **Calidad continua incompleta:** `.github/workflows/ci.yml` instala dependencias raíz y ejecuta pruebas Vitest/build; no instala dependencias de servidor ni ejecuta `node --test server/*.test.js`. Utiliza Node 20, diferente del entorno local revisado. Su nombre CI/CD no significa que despliegue: solo sube el artefacto de compilación.
3. **Operación pendiente de comprobación:** existen Nginx, variables de ejemplo y script de despliegue, pero falta verificar instalación reproducible, servicio sin privilegios innecesarios, backups/restauración, rollback y observabilidad. `deploy.sh` aún configura `User=root`.
4. **Piloto comercial:** faltan roles por negocio, catálogo aprobado, reglas comerciales, trazabilidad empresarial y validación con un aliado. La moneda del juego no debe confundirse con saldo comercial.
5. **Experiencia y rendimiento:** las pruebas automatizadas no sustituyen validación visual, cámara real, accesibilidad ni mediciones de WebGL en teléfonos. La guía de destinos sigue una línea recta, no una ruta peatonal.
6. **Documentación divergente:** README y guías de las primeras entregas conservan pendientes ya implementados y cifras históricas. Este archivo y el plan nuevo son la referencia de la revisión; los GDD conservan visión y las guías conservan historial.

## Verificación de esta revisión

Los resultados ejecutados se registran al final de este documento. No se leyeron bases de usuarios, no se modificó lógica de aplicación y no se probó el despliegue remoto. La inspección es de arquitectura, flujos y pruebas; no es una auditoría exhaustiva de seguridad.

## Siguiente objetivo

Cerrar la estabilización y completar una primera evolución visible antes de ampliar multijugador o premios comerciales. El orden, las dependencias y los criterios de salida están en [PLAN_DESARROLLO.md](PLAN_DESARROLLO.md). Los documentos Foodie Pets se mantienen como antecedentes, no como backlog vigente.

### Resultados ejecutados el 20 de octubre de 2026

| Comprobación | Resultado |
|---|---|
| `npm run build` | Aprobado: TypeScript y Vite. Advertencia por paquetes mayores de 500 kB. |
| `npm test` | 336 pruebas aprobadas en 41 archivos, incluyendo contratos compartidos. |
| `node --test server/*.test.js` | 48 pruebas aprobadas, cero fallos. La traza de fallo inyectado corresponde a la prueba aprobada de rollback. |
| `npm run lint` | Salida 0, cero errores y 5.836 advertencias existentes. |
| `npm run format:check` | Salida 1: problemas de estilo en 24 archivos de `src/`; no corregidos en este cambio documental. |

El chequeo agregado `npm run check` no puede considerarse aprobado mientras falle formato. El workflow actual también puede detenerse en ese paso antes de llegar a pruebas/build. Estos fallos de base se registran como trabajo de la fase 0; la revisión documental no los introduce ni certifica su resolución.

Salida de build: entrada JavaScript 173,05 kB (58,54 kB gzip), Three.js 524,70 kB (133,94 kB gzip) y mundo diferido 4.798,81 kB (1.018,48 kB gzip). Son tamaños de artefactos, no tiempos medidos de carga. Conviene investigar la contribución de cartografía y geometría antes de decidir cómo dividir o externalizar datos.

## Avance de estabilización — 20 de octubre de 2026

Implementado el primer bloque de fase 0: Node 24.12.0 como referencia en `.nvmrc`, rango Node 24 en ambos paquetes y lockfiles, scripts `typecheck`, `test:server` y `test:all`, y `check` incluyendo servidor. CI instala dependencias de ambos paquetes y ejecuta la comprobación agregada con la versión declarada. Se corrigió el formato pendiente de `src/`; los cambios de fuentes se verificaron contra la salida de Prettier sobre HEAD para confirmar que son únicamente de formato.

La compilación vuelve a pasar y conserva los mismos tamaños de artefactos. Formato ahora pasa; lint queda en 14 advertencias y cero errores. La instalación limpia en Linux y la ejecución remota de GitHub Actions quedan sujetas al resultado del workflow; no se han certificado desde este equipo. El resto de las fases continúa pendiente.

Arranque local comprobado con `npm run dev`: web en `http://localhost:5173/`, panel en `http://localhost:3000/`, API de salud directa y mediante proxy con respuesta HTTP 200. No se crearon usuarios ni se ejercieron operaciones de escritura para esta comprobación.

Resultado final del bloque: `npm run check` aprobado (salida 0), con 336 pruebas Vitest y 48 pruebas Node aprobadas; `npm run build` aprobado. Persisten 14 advertencias no bloqueantes de lint y el aviso de tamaño de bundles. Esto sustituye el fallo de formato registrado en la revisión inicial, conservada arriba como historial.

## Revisión detallada de alcance y brechas

El [análisis detallado](docs/ANALISIS-DETALLADO-PROYECTO.md), sobre `a6bcfd8`, inventaría funcionalidades conectadas, código heredado y criterios faltantes por bloque A0–A6. La sonda aislada en memoria confirmó tres prioridades: ataque sin posición aceptado, reinicio de cooldown/encuentros al crear sesión y compra idéntica cobrada dos veces. También se detectó que la API de presencia no tiene consumidor en el cliente actual y que el formulario administrativo conserva la emisión inmediata en lugar del código pendiente de canje. Estos puntos son hallazgos pendientes, no correcciones aplicadas.

## Desarrollo: combate persistente al reconectar

Implementado el primer cierre del análisis: encuentros y cooldowns se conservan en el perfil de la cuenta; reconexión, cambio de Pet y reinicio del proceso no reinician premios ni esperas. El mundo restaura representación de enemigos y temporizadores al entrar. Véanse alcance y regresiones en `docs/MUNDO-ABIERTO-VILLAVICENCIO.md`. Ataques sin alcance validado y compras sin idempotencia continúan pendientes.

## Desarrollo: compras sin doble cobro

Implementadas claves obligatorias de compra, recibos persistentes y recuperación de respuesta perdida mediante «Confirmar compra pendiente». Los reintentos no vuelven a descontar monedas; cambiar producto/cantidad con la misma clave produce conflicto. El cliente conserva la intención por cuenta al recargar. Véanse límites de almacenamiento e implementación en `docs/MUNDO-ABIERTO-VILLAVICENCIO.md`. La validación autoritativa de alcance/movimiento y recursos de combate sigue pendiente.
