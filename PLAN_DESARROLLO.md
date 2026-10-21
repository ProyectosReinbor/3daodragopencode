# Plan de desarrollo — AODASE PETS

Fecha: 20 de octubre de 2026. Basado en [el estado revisado](ESTADO-PROYECTO.md) y el código del commit `3026977`.

## Objetivo de producto

Entregar un piloto estable donde una persona registre su cuenta, críe un Pet, complete una aventura urbana, evolucione su compañero y pueda interactuar con un negocio habilitado. Mantener claramente separadas la exploración virtual, la presencia física y las recompensas comerciales.

Las fases siguientes son propuestas de ejecución, no compromisos de fecha. Cada fase debe cerrar sus criterios antes de publicar como terminada; estimar calendario cuando se definan equipo, capacidad y negocio piloto.

## Fase 0 — Estabilización y base verificable (P0)

- Resolver o acotar con un plan explícito la deuda de lint/formato existente, sin reformatear todo el juego junto con cambios funcionales.
- Alinear Node local, CI y producción; declarar la versión soportada y comprobar la instalación limpia, incluido SQLite.
- Ampliar CI con dependencias del servidor y toda la batería `node --test server/*.test.js`; invocar el chequeo TypeScript de forma reproducible mediante un script o `npx tsc --noEmit`.
- Actualizar README y guías de acceso para reflejar mapa disponible, límites del worker y estado real del alojamiento.
- Añadir pruebas de regresión de sesiones reiniciadas, solicitudes obsoletas y pérdida de conexión donde falten; conservar idempotencia y migraciones aditivas.

**Salida:** instalación limpia documentada, build y pruebas cliente/servidor aprobados en CI; cada fallo de calidad resuelto o identificado sin presentar el chequeo completo como aprobado. Cuenta nueva y existente conservan colección, inventario y progreso tras recargar y reiniciar servidor.

## Fase 1 — Autoridad de juego y operación (P0)

Depende de la fase 0. Puede prepararse el diseño de evolución mientras se cierra esta fase.

- Definir qué autoridad exige cada acción: juego casual, competencia y recompensa comercial. Revisar alcance, posición, velocidad, sesión, enfriamientos y replay en rutas de mundo.
- Validar movimiento y alcance en servidor antes de usar resultados competitivos; para visitas físicas diseñar un mecanismo separado con consentimiento y controles de fraude.
- Hacer explícita la recuperación de sesiones en memoria al reiniciar; probar dos pestañas y solicitudes simultáneas. Diseñar almacenamiento compartido solo si se requiere más de una instancia.
- Preparar ejecución con usuario de servicio limitado, configuración coherente de puertos/dominios, HTTPS, logs útiles y procedimiento de backup, restauración y reversión de versión.
- Separar gradualmente coordinación de escena, paneles, entrada y red en `world-play.ts`; extraer rutas y migraciones de `server/index.js` cuando el trabajo de autoridad las toque.

**Salida:** casos de teletransporte, alcance falso, acciones duplicadas y sesión vencida rechazan premios que requieran validación; reinicio recuperable, restauración ensayada con datos de prueba y runbook revisable. No declarar visita real verificada hasta completar su mecanismo específico.

## Fase 2 — Primera evolución del Pet (P1)

Depende de contratos persistentes estabilizados y de la autoridad necesaria para obtener los recursos.

- Definir recursos/ADN y procedencia, requisitos, costes y exactamente tres alternativas de evolución, siguiendo el GDD vigente.
- Implementar operación transaccional en servidor con propiedad, petición idempotente, requisitos y versión del perfil; preservar genomas y ejemplares heredados.
- Mostrar alternativas, coste, vista previa y confirmación; aplicar una transformación 3D reconocible y conservar historial.
- Mantener un camino gratuito de progreso y distinguir poder de aventura de beneficio comercial.

**Salida:** una cuenta completa el ciclo huevo → cuidados → aventura → recursos → evolución; recargar conserva apariencia y costes. Doble solicitud, recursos insuficientes o Pet ajeno no duplican ni consumen parcialmente premios. Los tres resultados tienen pruebas de contrato y revisión visual.

## Fase 3 — Calidad del mundo y uso móvil (P1)

Depende de la fase 0; las mediciones pueden comenzar antes de terminar evolución.

- Medir carga inicial y entrada al mundo, FPS, memoria y pérdida/restauración del contexto WebGL en al menos un Android de gama media y un iPhone disponibles; registrar modelo, navegador y condiciones.
- Fijar presupuestos a partir de esas mediciones y ajustar densidad, geometría, sombras e instancias. Verificar liberación de recursos tras entrar y salir repetidamente.
- Revisar flujo completo en vertical y horizontal, teclado, foco, movimiento reducido, cámara QR y alternativas manuales.
- Probar mando físico en PC y celular; documentar combinaciones compatibles sin prometer soporte universal.
- Revisar obstáculos y legibilidad de destinos. Priorizar rutas transitables solo si las pruebas muestran que la guía directa impide completar tareas.

**Salida:** recorrido completo sin bloqueos en dispositivos de referencia, informe con métricas antes/después y límites conocidos. Las interrupciones de conexión muestran estado recuperable y no aparentan guardados exitosos.

## Fase 4 — Piloto con un negocio (P1)

Depende de fases 1 y 3; la evolución debe estar lista si forma parte de la propuesta piloto.

- Confirmar aliado, catálogo, contacto, reglas de XP/premios, vigencia y soporte. Identificar contenido demo y distinguir lugares geográficos de negocios afiliados.
- Crear organizaciones y membresías con permisos por negocio: ningún operador accede a usuarios, códigos o campañas de otra organización.
- Completar emisión y presentación/impresión de QR, consulta de canjes y auditoría. Mantener referencia de compra única y consumo atómico; integrar facturación externa solo con contrato definido.
- Separar registros comerciales de monedas de aventura; establecer cancelaciones y responsabilidades sobre premios físicos.
- Ensayar con cuentas ficticias, luego habilitar un grupo limitado con criterios de seguimiento acordados.

**Salida:** compra de prueba → código → canje → XP del Pet correcto → historial consistente. Reintentos y canjes simultáneos entregan una vez. Operadores aislados por organización, restauración ensayada y reglas aprobadas por el responsable del negocio.

## Fase 5 — Expansión posterior (P2)

Depende de resultados del piloto y de autoridad suficiente. Priorizar por uso observado: salas y reconexión multijugador; eventos y PvP voluntario; mazmorras; reproducción/cooperación/intercambio; más ciudades y negocios. Contenido social requiere consentimiento, tratamiento de imágenes y moderación antes de activarse.

**Salida por entrega:** objetivo medible, contrato servidor, protección contra duplicados/abuso, pruebas y revisión en dispositivos. No ampliar estas funciones solo por tener una API inicial de presencia o un GDD.

## Próximo lote recomendado

1. Corregir la canalización de CI para cubrir servidor y alinear Node.
2. Resolver las comprobaciones de calidad pendientes y actualizar README.
3. Añadir regresiones de confianza en posiciones, sesiones y concurrencia; definir el alcance del piloto.
4. Especificar contrato de primera evolución y sus tres alternativas.
5. Medir el mundo en los dispositivos disponibles y preparar el runbook de alojamiento.

Cada lote debe revisarse, comprobarse, confirmarse en Git y publicarse siguiendo `AGENTS.md`. Publicar código en GitHub no equivale a desplegarlo en el alojamiento.

## Seguimiento de ejecución

Primer bloque de fase 0 implementado el 20 de octubre de 2026: versión Node compartida con CI, pruebas de servidor integradas en `check`, instalación de dependencias del servidor en el workflow y formato de cliente corregido. La fase 0 sigue abierta: quedan validación de instalación limpia/CI remoto, regresiones adicionales de recuperación y actualización gradual de guías históricas. Véase el avance y la verificación en `ESTADO-PROYECTO.md`.

## Ajuste de prioridades tras revisión detallada

Antes de ampliar recompensas o implementar evolución: impedir que una sesión nueva reinicie encuentros/cooldowns premiados, validar alcance y recursos de combate, y hacer idempotentes las compras del mundo. Después, unificar la presentación del inventario y conectar el panel a emisión de códigos pendientes. El [análisis detallado](docs/ANALISIS-DETALLADO-PROYECTO.md) contiene reproducciones, límites y criterios; las fases de producto permanecen abiertas según sus criterios de salida.

Avance posterior: estado de combate y recargas persistidos por cuenta, con restauración visual al entrar y regresiones de reconexión/reinicio. La prioridad 1 sigue abierta respecto a alcance, movimiento y recursos de combate; la prioridad 2 de compras idempotentes sigue pendiente.

Avance de compras: implementados recibos persistentes, conflictos por clave reutilizada y confirmación de compra pendiente tras pérdida de respuesta. Queda por ampliar la reconciliación a otras intenciones y dispositivos, y migrar recibos fuera del JSON de progreso si las mediciones de volumen lo requieren. Continúa abierta la autoridad de alcance y recursos de combate.

Avance de recursos de combate: maná, regeneración, costes y recargas se controlan en servidor, incluidos apoyos. La fase de autoridad permanece abierta para movimiento, alcance, vida y daño recibido; no habilitar premios competitivos como si la simulación ya fuera íntegramente autoritativa.

Avance de alcance: implementadas comprobaciones de posiciones declaradas, distancia, altura y radio de persecución compartido. Permanece abierta la validación del movimiento y posición mantenidos en servidor; esta comprobación geométrica no cierra por sí sola la autoridad de combate.
