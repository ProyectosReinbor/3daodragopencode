# Reinos Ancestrales — Contexto del Proyecto

## Descripción General
RPG 3D en navegador (PWA) con generación determinista de personajes NFT, combate en tiempo real, crafting, misiones, jefes, y sistema de logros. Todo en español.

- **Versión:** 0.9.0 (Extracción LootManager, ProgressManager, CraftingManager)
- **Stack:** TypeScript + Three.js + Vite (frontend), Node.js + Express + SQLite (backend)
- **Licencia:** Privada — Todos los derechos reservados

---

## Estructura del Proyecto

```
3daodrag/
├── index.html              # HTML único con todos los paneles UI
├── package.json            # Frontend: Three.js, Vite, TypeScript, Vitest
├── vite.config.ts          # Proxy /api -> :3000
├── tsconfig.json           # ES2022, strict, bundler
├── eslint.config.js        # ESLint + Prettier
│
├── src/
│   ├── main.ts             # Entry point: login, Hub, navegación, flujo PWA
│   ├── styles.css          # Todos los estilos CSS (~2100 líneas)
│   └── game/
│       ├── game.ts         # Clase principal Game (~955 líneas) — loop, orquestación
│       ├── combat.ts       # Sistema de combate: daño, enemigos, bosses, habilidades (sin loot/BP/dailies)
│       ├── crafting-manager.ts # Nuevo: CraftingManager — recetas, canCraft, performCraft
│       ├── loot.ts          # Nuevo: LootManager — tablas de botín, rollLoot, applyDrops
│       ├── progress.ts      # Nuevo: ProgressManager — XP, niveles, Battle Pass, logros, quest tracking
│       ├── world.ts        # Generación procedural de zonas, enemigos, recursos, NPCs
│       ├── nft.ts          # Sistema NFT: generación determinista, traits, modelo 3D
│       ├── nft.test.ts     # Tests unitarios NFT
│       ├── characters.ts   # Sistema de personajes: Character, CharacterCollection, CharacterManager
│       ├── characters.test.ts # Tests unitarios del sistema de personajes
│       ├── navigation.ts   # Sistema de pantallas: Login → Hub → Characters → Inventory → Game
│       ├── navigation.test.ts # Tests unitarios de navegación
│       ├── hub-ui.ts       # Hub Principal: bienvenida, personaje activo, noticias
│       ├── characters-ui.ts # Pantalla Mis Personajes: colección, selección
│       ├── inventory-ui.ts # Pantalla Inventario: categorías, materiales, consumibles
│       ├── ui.test.ts      # Tests unitarios de Hub, Characters UI, Inventory UI
│       ├── profile.ts      # Perfil, inventario, misiones, comercio, recetas, colección de personajes
│       ├── profile.test.ts # Tests unitarios perfil
│       ├── abilities.ts    # Sistema de habilidades por elemento (2 c/u, 12 total)
│       ├── achievements.ts # Sistema de logros (20 logros)
│       ├── bosses.ts       # Sistema de jefes (3 jefes, fases, habilidades)
│       ├── zones.ts        # Configuración de zonas, detección de proximidad
│       ├── api.ts          # Cliente HTTP para auth/profile/stores API
│       ├── stores.ts       # Interfaces: Store, Promotion, Product, StoreDetail
│       ├── stores.test.ts     # Tests unitarios de tipos, promociones, productos
│       ├── promotions.ts      # Utilidades de promociones (fechas, estado)
│       ├── products.ts        # Utilidades de productos (recompensas, rareza, precio)
│       ├── stores-ui.ts       # UI de Tiendas Asociadas: listado y detalle
│       ├── reward-manager.ts  # Cliente HTTP para canje de facturas
│       ├── redeem-ui.ts       # UI de canje de código de factura
│       ├── reward-result-ui.ts # UI de animación de entrega de recompensa
│       ├── input.ts        # Control: teclado + joystick táctil
│       ├── qr-scanner.ts   # Escáner QR con Barcode Detection API
│       ├── rewards.ts      # Sistema de recompensas QR
│       ├── quality.ts      # Detección de calidad gráfica (baja/media/alta)
│       ├── audio.ts        # Sistema de audio (Web Audio API)
│       ├── minimap.ts      # Minimapa con niebla de guerra
│       ├── visual.ts       # Efectos visuales: partículas, daño, clima
│       ├── battlepass.ts   # Pase de batalla (30 niveles)
│       ├── daily-quests.ts # Misiones diarias con racha de inicio
│       └── leaderboard.ts  # Tabla de clasificación global
│
├── server/
│   ├── package.json        # Express, bcryptjs, better-sqlite3, jsonwebtoken
│   └── index.js            # Servidor Express: auth, API, SQLite, archivos estáticos
│
├── public/
│   ├── manifest.webmanifest
│   ├── sw.js               # Service Worker (cache-first)
│   └── icons/
│
├── DESAFIO.txt             # Roadmap de desarrollo (pendientes)
└── PLAN_DESARROLLO.md      # Plan detallado de desarrollo
```

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Motor 3D | Three.js ^0.179.1 |
| Lenguaje | TypeScript ^5.8.3 |
| Build | Vite ^7.1.3 |
| Tests | Vitest ^3.2.1 + jsdom |
| Backend | Express ^4.21.0 (ESM) |
| Base de datos | SQLite (better-sqlite3) |
| Auth | JWT + bcryptjs |
| PWA | Service Worker + Manifest |

---

## Sistema NFT

- **Generación determinista:** Traits derivados del hash FNV-1a del teléfono usando PRNG mulberry32.
- **3 Traits:** Elemento (fuego/agua/tierra/aire/sombra/luz), Rareza (común/raro/épico/legendario), Tipo (humanoide/bestia/espectral/gólem).
- **5 Stats:** ATK, DEF, SPD, HP, Ability.
- **Modelo 3D procedural:** Primitivas de Three.js con colores según elemento/rareza.
- **Nombres:** Sílabas medievales españolas.
- **Nivel:** XP acumulativa, puntos de atributo para distribución manual.

## Combate

- Ataque automático al enemigo más cercano (cooldown 400ms).
- 4 tipos de enemigos: lobos, espíritus, esqueletos, gólems.
- IA enemiga: persecución, rango de ataque, cálculo de daño.
- Botín con tablas de probabilidad.
- Sistema de vida/energía, reaparición al morir.

## Habilidades

- 2 habilidades únicas por elemento (12 total).
- Tipos: daño (simple/AoE), cura, escudo, dash, aturdimiento, robo de vida.
- Cooldowns, costos de energía, proyectiles procedurales.
- Teclas Q/W y botones en pantalla.

## Zonas

5 zonas: Aldea → Bosque → Ruinas → Desierto → Cueva.
- Desbloqueo progresivo por misiones.
- Cada zona: enemigos, recursos, NPCs, estaciones de crafting, portales, arena de jefe.
- Terreno procedural con árboles, rocas, arbustos, edificios.

## Misiones

7 misiones progresivas con objetivos de recolección y asesinato.
- Recompensas: desbloqueo de zonas, XP, recursos.

## Crafting

12 recetas: Ración, Espada, Poción, Escudo, Ungüento, Armadura, Amuleto, Poción Fuerza, Poción Velocidad, Antídoto, Gran Poción, Elixir.
- 5 recursos: trigo, mineral, esencia, madera, hierba.
- Consumibles con buffs temporales.

## Jefes

3 jefes: Guardián de las Ruinas, Gólem Ancestral, Señor del Fuego.
- 4 fases cada uno con umbrales de progresión.
- Habilidades: AoE, invocar esbirros, enfurecerse, embestir, curar.
- Botín exclusivo.

## Logros

20 logros en 5 categorías: exploración, combate, colección, social, crafting.

## Pase de Batalla

30 niveles con requisitos incrementales de XP.
- Recompensas: recursos, objetos crafted, XP.
- Persistencia en localStorage.

## Misiones Diarias

3 misiones aleatorias diarias (matar, recolectar, crafted, explorar).
- Racha de inicio de sesión (ciclo de 7 días).
- Reset a medianoche UTC.

## Tabla de Clasificación

Ranking global por puntuación (nivel, peso de zona, logros).
- 10 NPCs de semilla para demo.
- localStorage con envío de puntuación.

---

## Arquitectura

```
Frontend (Vite + Three.js)  ←→  HTTP API (proxy)  ←→  Backend (Express + SQLite)
       │                                                    │
  Game Loop (rAF)                                       Auth JWT
  Módulos game/                                         Rate Limiting
```

**Flujo de datos:**
1. Auth: Teléfono + password → POST `/api/login` o `/api/register` → JWT → localStorage.
2. NFT: Teléfono → hash FNV-1a → mulberry32 → traits → modelo 3D procedural.
3. Game Loop: Input → Movimiento → IA enemiga → Auto-ataque → Auto-recolección → UI → Render.
4. Persistencia: Auto-guardado cada 30s, en cambios de zona, subidas de nivel.
5. Zonas: Proximidad a portal → `loadZone()` → rebuild del mundo.

**Patrones:** Modular por archivo, clases (Game, InputController, Minimap, AudioManager, VisualEffects), funciones factory (createWorld, createProfile, generateNftFromPhone), PRNG mulberry32 para generación determinista.

---

## API (Backend)

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/register` | POST | Registrar usuario (teléfono + password) |
| `/api/login` | POST | Iniciar sesión, devuelve JWT |
| `/api/profile` | GET | Obtener perfil (requiere JWT) |
| `/api/profile` | PUT | Guardar perfil (requiere JWT) |
| `/api/health` | GET | Health check |
| `/api/stores` | GET | Lista de tiendas activas (con promotion_count) |
| `/api/stores/:id` | GET | Detalle de tienda con promociones y productos |
| `/api/promotions` | GET | Todas las promociones activas |
| `/api/products` | GET | Productos activos (opcional `?store_id=`) |
| `/api/redeem` | POST | Canjear código de factura (requiere JWT) |
| `/api/rewards/history` | GET | Historial de canjes del usuario (requiere JWT) |
| `/api/rewards/pending` | GET | Recompensas pendientes del usuario (requiere JWT) |

---

## Base de Datos (SQLite)

- **WAL mode** con foreign keys.
- Tablas: `users`, `profiles`, `stores`, `promotions`, `products`, `promotion_products`, `invoice_codes`, `reward_history`.
- `stores`: id, name, category, city, description, short_description, lat/lng, hours, active.
- `promotions`: id, store_id, name, start_date, end_date, active, FK → stores.
- `products`: id, store_id, name, price, currency, reward_type/id/rarity/qty, active, FK → stores.
- `promotion_products`: tabla pivote promotion_id + product_id.
- `invoice_codes`: id, code, status (AVAILABLE/REDEEMED/CANCELLED/EXPIRED), reward_type/id/rarity/qty, store_id, promotion_id, product_id, created_at, redeemed_at, redeemed_by (FK → users).
- `reward_history`: id, user_id, code, reward_type/id/rarity/qty, redeemed_at, FK → users.
- Seed data: 5 tiendas, 5 promociones, 5 productos con recompensas variadas, 10 códigos de factura de prueba (RA-2026-000001…000010) + 1 código expirado (RA-EXP-000001).

---

## Seguridad

- Passwords: bcrypt (12 rounds) con migración automática desde FNV-1a legacy.
- JWT: 60 días de expiración, requerido en producción via `JWT_SECRET`.
- Rate limiting: 100 req/min general, 5/min auth.
- Validación: teléfono (6-15 dígitos), password (4-100 chars), validación de zonas/recursos/items/atributos.
- Issues conocidos: CORS abierto, sin Helmet, PUT /api/profile sin sanitización profunda.

---

## CI/CD (GitHub Actions)

Jobs en push/PR a main/master:
1. **Check:** Lint → Format → TypeScript check (`tsc --noEmit`) → Tests (Vitest)
2. **Build:** (depende de check) → Vite build → sube `dist/` como artefacto

---

## Comandos Útiles

```bash
npm run dev        # Inicia frontend + backend en concurrently
npm run build      # Build de producción (Vite)
npm run test       # Vitest (179 tests: nft + profile + characters + navigation + ui + stores + reward-manager + combat + loot + crafting-manager + progress)
npm run lint       # ESLint
npm run format     # Prettier
```

---

## Navegación (v0.7.0)

- **navigation.ts:** Sistema centralizado de pantallas. Soporta `login`, `nft`, `hub`, `characters`, `inventory`, `stores`, `store-detail`, `redeem`, `reward-result`, `game`. Las secciones son elementos `<section>` con clase `hidden` para transiciones CSS suaves. Incluye historial de navegación con `goBack()`.
- **Flujo actual:** `Login → Hub → (Characters | Inventory | Stores → Store Detail | Canjear Factura → Resultado) → Game`
- **Hub Principal (hub-ui.ts):** Tarjeta del personaje activo (nombre, nivel, rareza, stats), botones de navegación (incluye "Canjear Factura"), sección de noticias estáticas.
- **Personajes (characters-ui.ts):** Lista de todos los personajes, cada uno con nombre, nivel, rareza, elemento, tipo, stats. Botón "Seleccionar" en personajes no activos. Al seleccionar se actualiza `CharacterManager`, perfil y servidor.
- **Inventario (inventory-ui.ts):** Categorías: Armas, Armaduras, Consumibles, Materiales, Objetos Especiales, Recompensas Promocionales. Muestra datos reales del perfil (materiales y consumibles).
- **Tiendas Asociadas (stores-ui.ts):** Lista de tiendas obtenidas de `/api/stores`. Cada tienda muestra logo (inicial), nombre, categoría, ciudad, descripción corta y contador de promociones. Al hacer clic, navega a `store-detail` con la tienda seleccionada. Desde el detalle se puede presionar "Canjear Factura" que navega a la pantalla de canje.
- **Detalle de Tienda:** Muestra encabezado con nombre y categoría, descripción, ubicación y horario, y tarjetas de promociones activas con su estado (activa/próximamente/expirada). Cada promoción lista los productos participantes con precio, tipo de recompensa, rareza y cantidad. Botón "Canjear factura" funcional que navega a la pantalla de canje.
- **Canje de Factura (redeem-ui.ts):** Formulario con campo de código (mayúsculas automáticas), botón de envío con estado de carga, mensajes de éxito/error. Sección de historial de canjes cargada desde la API con detalles de recompensa, código y fecha.
- **Resultado de Recompensa (reward-result-ui.ts):** Animación con efecto de pulso, título personalizado (éxito/duplicado), tarjeta de recompensa (nombre, producto, detalle), botón "Continuar" para volver.
- **Carga perezosa:** La lista de tiendas se obtiene al navegar a `stores`. El detalle de tienda se obtiene al seleccionar una tienda específica. El historial de canjes se carga al montar la pantalla de canje.
- **Persistencia:** Al seleccionar personaje se llama a `apiSaveProfile` inmediatamente. Las recompensas obtenidas por canje se persisten en SQLite con transacciones atómicas.

## Sistema de Personajes (`characters.ts`)

- **Character**: Interfaz con id permanente (no depende del teléfono), traits, stats, nivel, XP, upgrades, fuente de desbloqueo, flag `isStarter`.
- **CharacterCollection**: `{ characters: Character[], selectedId: string }`.
- **CharacterManager**: Clase que centraliza toda la lógica: `getActive()`, `selectCharacter()`, `addCharacter()`, `unlockCharacter()`, `addExperience()`, etc.
- **Slime Ancestral**: Personaje inicial (agua, común, nivel 1, stats balanceados 4/4/4/4/4). Nunca puede eliminarse.
- **Migración**: Perfiles antiguos (con `nft`) se convierten automáticamente al nuevo formato `characters` + `selectedCharacter` al cargar el juego.
- **Game.ts**: Eliminadas todas las referencias directas a `this.profile.nft`. Ahora accede al personaje activo mediante `this.characters.getActive()`.
- **Tests**: 25 tests unitarios para CharacterManager, generación, starter, colección.

## Estado Actual (v0.8.0)

**Completado (todo v0.7.0 +):**
- Auth con JWT + bcrypt, rate limiting, migración a SQLite
- README, tests (179), ESLint/Prettier, CI/CD
- Sistema de habilidades (2 por elemento)
- Crafting expandido (12 recetas)
- Zonas Desierto y Cueva
- 20 logros
- Pase de batalla, misiones diarias, tabla de clasificación
- Minimapa, efectos visuales, sistema de audio
- Sistema de recompensas QR
- Sistema de múltiples personajes por cuenta con CharacterManager (v0.4.0)
- Hub Principal con navegación centralizada (v0.5.0)
- Pantalla Mis Personajes con selección y persistencia (v0.5.0)
- Pantalla Inventario con categorías (v0.5.0)
- Tiendas Asociadas con backend SQLite, API REST, frontend stores/promotions/products/stores-ui (v0.6.0)
- Navegación lazy: lista de tiendas al cargar, detalle bajo demanda (v0.6.0)
- Seed data: 5 tiendas, 5 promociones, 5 productos con recompensas (v0.6.0)
- **Sistema de Canje de Facturas (v0.7.0):** Tablas `invoice_codes` y `reward_history` en SQLite, servicio CodeGenerator en backend, 11 códigos de prueba (10 disponibles + 1 expirado), transacciones atómicas para validación/entrega/rede, entrega de recompensas (personajes, items, moneda, cristales), compensación de personajes duplicados con cristales, API REST `POST /api/redeem`, `GET /api/rewards/history`, `GET /api/rewards/pending`, frontend redeem-ui.ts con formulario e historial, reward-result-ui.ts con animación de pulso, botón "Canjear Factura" funcional en hub y detalle de tienda.
- **Extracción CombatManager (v0.8.0):** `combat.ts` creado con `CombatManager` (~760 líneas) conteniendo toda la lógica de combate extraída de `Game` (ataque, enemigos, bosses, habilidades, daño, cooldowns, escudos, stuns, loot, BP, daily quests, respawn). `game.ts` reducido de ~1600 a ~987 líneas. Arquitectura: CombatManager recibe dependencias vía constructor y `CombatServices` callbacks; no recibe la instancia completa de Game. 39 tests unitarios de combate. 0 errores tsc, 0 errores ESLint.
- **Extracción LootManager, ProgressManager, CraftingManager (v0.9.0):** `loot.ts`, `progress.ts`, `crafting-manager.ts` creados. CombatManager desacoplado de loot/BP/daily-quests mediante callbacks `onEnemyKilled`/`onBossKilled`. Game reduce a ~955 líneas como coordinador puro. `crafting.ts` y `recipes.ts` eliminados. 179 tests totales (11 suites). 0 errores tsc, 0 errores ESLint (15 warnings pre-existing).

**Pendiente de alta prioridad:**
- Integración completa de jefes (UI avanzada)
- Arena PVP con matchmaking y ranking ELO
- Sistema de clanes con banco compartido, misiones y guerras

**Pendiente media prioridad:**
- Assets de audio reales (actualmente sonidos procedurales)
- Chat global vía WebSocket
- Mejoras visuales (luces dinámicas, clima, post-processing)

**Pendiente baja prioridad:**
- Mercado NFT, tienda cosmética, sistema de amigos
- Tests de integración, WebSocket para multijugador

---

## Convenciones de Código

- TypeScript estricto, ES2022 modules, sin clases donde funciones sirvan
- Nombres en camelCase (variables/funciones), PascalCase (clases)
- CSS en styles.css (no CSS modules ni frameworks)
- HTML todo en index.html (sin framework de componentes)
- Contenido del juego en español
- Tests junto al archivo que prueban (`*.test.ts`)
- Errores silenciosos con `console.error` (sin notificación al usuario)

---

## Informe Final — Fase 6: Refactor Arquitectónico v0.9.0

### 1. Resumen General
Extracción completa de 3 nuevos managers (LootManager, ProgressManager, CraftingManager) desde la clase Game. CombatManager desacoplado de loot, Battle Pass y daily quests mediante callbacks `onEnemyKilled`/`onBossKilled`. Game reducido a coordinador puro (~955 líneas). `crafting.ts` y `recipes.ts` eliminados.

### 2. Archivos Creados
- `src/game/loot.ts` — LootManager (44 líneas)
- `src/game/progress.ts` — ProgressManager (147 líneas)
- `src/game/crafting-manager.ts` — CraftingManager (70 líneas)
- `src/game/loot.test.ts` — 6 tests
- `src/game/progress.test.ts` — 5 tests
- `src/game/crafting-manager.test.ts` — 9 tests

### 3. Archivos Eliminados
- `src/game/crafting.ts`
- `src/game/recipes.ts`

### 4. Archivos Modificados
- `src/game/combat.ts` — imports de loot/BP/daily-quests removidos; `CombatServices` con `onEnemyKilled`/`onBossKilled`; `attack()`/`useAbility()` sin `dailyQuestData`/`battlePass`
- `src/game/game.ts` — integrados LootManager, ProgressManager, CraftingManager; delegación de XP/achievements vía ProgressManager
- `src/game/combat.test.ts` — `makeServices()` actualizado; `notifyKill` → `onEnemyKilled`

### 5. Líneas Reducidas de Game
- v0.8.0: ~987 líneas → v0.9.0: ~955 líneas

### 6. Nueva Arquitectura
```
Game (coordinador)
├── CombatManager    → combate, daño, enemigos, bosses, estados
│   └── callbacks    → Game.onEnemyKilled → ProgressManager.processEnemyKill()
│                   → Game.onBossKilled  → ProgressManager.processBossKill()
├── LootManager      → tablas de botín, rollLoot, rollBossLoot, applyDrops
├── ProgressManager  → XP, niveles, BP, logros, daily quests, crafting diario
│   ├── LootManager  → applyDrops (loot post-kill)
│   └── daily-quests → trackDailyKill, saveDailyQuests
├── CraftingManager  → recetas, canCraft, craft, daily craft tracking
└── otros (audio, visual, world, etc.)
```

### 7. Responsabilidades
- **CombatManager:** ataques, daño, enemigos, bosses, muerte, estados. NO recompensas/XP/misiones.
- **LootManager:** drops, probabilidades, recompensas. NO inventario/UI.
- **ProgressManager:** XP, niveles, kills, BP, logros, progreso global.
- **CraftingManager:** recetas, materiales, creación de objetos.

### 8. Sistema de Callbacks
```
CombatServices.onEnemyKilled(enemy, profile)
  → Game.onEnemyKilled → ProgressManager.processEnemyKill()
    → LootManager.applyDrops()
    → addBattlePassXp() + saveBattlePass()
    → trackDailyKill() + saveDailyQuests()
    → trackAchievement()
    → trackQuestKill()
```

### 9. Tests Agregados
- `loot.test.ts` — 6 tests (rollEnemyLoot, rollBossLoot, applyDrops)
- `crafting-manager.test.ts` — 9 tests (getRecipe, canCraft, craft)
- `progress.test.ts` — 5 tests (addExperience, trackAchievement, processEnemyKill, processBossKill)

### 10. Resultado Validaciones
| Herramienta | Resultado |
|-------------|-----------|
| tsc | 0 errores |
| ESLint | 0 errores, 15 warnings (pre-existing no-explicit-any) |
| Vitest | 179/179 passed (11 suites) |
| Vite build | OK (42 módulos, 141 KB + 477 KB three.js) |

### 11. Problemas Encontrados
- Game aún importa `saveDailyQuests`/`saveBattlePass` para funcionalidad no-combate (collect, explore, login streak). No se extrajeron por ser coordinación directa de Game.
- 15 warnings de `no-explicit-any` pre-existentes (tests y main.ts). No se intervinieron.

### 12. Decisiones Técnicas
- **Callbacks directos** (CombatServices) por simplicidad y type safety. Migrar a EventEmitter si escala.
- **ProgressServices separado** de CombatServices para efectos visuales/sonoros (levelUpEffects).
- **LootManager inyectado** en ProgressManager como dependencia stateless/pura.
- **CraftingManager independiente:** solo recibe profile + dailyQuestData.

### 13. Recomendaciones Fase 7
1. Completar contenido real de zonas (Desierto, Cueva).
2. Mejorar bosses (UI avanzada, patrones de ataque).
3. Nuevos enemigos por zona.
4. Mejorar generación procedural del mundo.
5. Preparar sistemas sociales (chat, clanes, ranking).
6. No implementar nuevas features sin cerrar documentación y estabilidad de v0.9.0.
