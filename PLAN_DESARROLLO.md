# PLAN DE DESARROLLO - REINOS ANCESTRALES (3DAODRAG)

> **Fecha de análisis:** 2026-07-30
> **Versión actual:** 0.9.0 (Extracción LootManager, ProgressManager, CraftingManager)
> **Fases completadas:** 1 (Seguridad) + 2 (Infraestructura) + 3 (Gameplay parcial) + 4 (Sistema de Personajes) + 5 (Hub y Navegación) + 6 (Tiendas Asociadas) + 7 (Canje de Facturas) + 3.7 (Extracción CombatManager) + 3.8 (Extracción Loot/Progress/Crafting Managers)
> **Próxima fase:** Boss Battles / World Generation

---

## RESUMEN EJECUTIVO

Reinos Ancestrales es un RPG 3D browser game construido como PWA. Los jugadores crean personajes NFT únicos, exploran zonas, combaten criaturas, recolectan recursos, fabrican items y progresan mediante quests.

**Stack tecnológico:**
- Frontend: Three.js 0.179 + TypeScript 5.8 + Vite 7.1
- Backend: Express 4.21 + JWT + bcrypt + SQLite (better-sqlite3)
- Testing: Vitest 3.2
- CI/CD: GitHub Actions
- PWA: Service Worker + Web App Manifest

**Estado actual:** MVP funcional con autenticación, generación procedural de personajes NFT, 3 zonas, 7 quests, 12 recetas de crafting, 2 habilidades por elemento, sistema de logros, soporte QR. **Nuevo (v0.4.0):** Sistema de múltiples personajes por cuenta. **Nuevo (v0.5.0):** Hub Principal con navegación centralizada. **Nuevo (v0.6.0):** Tiendas Asociadas con backend SQLite, API REST y frontend lazy loading. **Nuevo (v0.7.0):** Sistema de Canje de Facturas con backend SQLite (invoice_codes, reward_history), transacciones atómicas, entrega de recompensas (personajes, items, moneda, cristales), compensación de duplicados, frontend redeem-ui y reward-result-ui con animación de pulso. **Nuevo (v0.8.0):** Extracción de CombatManager (~760 líneas) de Game. game.ts reducido de ~1600 a ~987 líneas. 39 tests de combate. **Nuevo (v0.9.0):** Extracción de LootManager, ProgressManager y CraftingManager. CombatManager desacoplado de loot/BP/daily-quests. game.ts reducido a ~955 líneas. 179 tests totales.

**Cambio arquitectónico clave (v0.4.0):** Se creó `src/game/characters.ts` con el sistema `Character` + `CharacterCollection` + `CharacterManager`. Los perfiles ahora soportan múltiples personajes por cuenta en lugar de un único NFT. Migración automática de perfiles antiguos. `Game.ts` accede al personaje activo mediante `this.characters.getActive()`. 25 tests unitarios nuevos.

**Cambio arquitectónico clave (v0.5.0):** Se crearon `src/game/navigation.ts`, `hub-ui.ts`, `characters-ui.ts`, `inventory-ui.ts`. Nuevo flujo: `Login → Hub → (Characters | Inventory) → Game`. Sistema de pantallas centralizado con `Navigation` class. 18 tests nuevos (navigation + UI).

**Cambio arquitectónico clave (v0.6.0):** Se crearon `src/game/stores.ts`, `promotions.ts`, `products.ts`, `stores-ui.ts`. Backend: tablas SQLite `stores`, `promotions`, `products`, `promotion_products` con seed data. API REST: `/api/stores`, `/api/stores/:id`, `/api/promotions`, `/api/products`. Navegación lazy: lista de tiendas al cargar `stores`, detalle bajo demanda `store-detail`. Botón "Canjear factura" deshabilitado (preparado para Fase 4). 33 tests nuevos (stores, promotions, products).

**Cambio arquitectónico clave (v0.7.0):** Se crearon `src/game/reward-manager.ts`, `redeem-ui.ts`, `reward-result-ui.ts`. Backend: tablas SQLite `invoice_codes` (AVAILABLE/REDEEMED/CANCELLED/EXPIRED) y `reward_history` con seed data de 11 códigos de prueba (RA-2026-000001…000010 + RA-EXP-000001 expirado). Servicio `CodeGenerator` para generación de códigos. API REST: `POST /api/redeem` (transacción atómica: validar código → validar producto → entregar recompensa → guardar perfil → marcar código REDEEMED → insertar historial), `GET /api/rewards/history`, `GET /api/rewards/pending`. Entrega de recompensas con compensación de personajes duplicados en cristales. Frontend redeem-ui.ts con formulario e historial, reward-result-ui.ts con animación de pulso. Botón "Canjear Factura" funcional en hub y detalle de tienda. 8 tests nuevos (reward-manager).

**Cambio arquitectónico clave (v0.8.0):** Se creó `src/game/combat.ts` con la clase `CombatManager` (~760 líneas) que extrae toda la lógica de combate de Game: estado de combate (health, energy, enemies, activeBoss, bossMinions, abilities), métodos de ataque, daño, enemigos, bosses, habilidades, cooldowns, escudos, stuns, loot, Battle Pass, daily quests, respawn. `CombatManager` recibe dependencias vía constructor (player, camera, scene, audio, visuals, characters, ui) y callbacks `CombatServices` (hint, trackAchievement, updateQuest, updateProfilePanel, addExperience, notifyKill, onPlayerDeath). `game.ts` reducido de ~1600 a ~987 líneas. 39 tests de combate. Arquitectura limpia: CombatManager no interactúa con Game directamente, solo a través de callbacks.

**Cambio arquitectónico clave (v0.9.0):** Se crearon tres nuevos managers:
- `src/game/loot.ts` — `LootManager`: tablas de botín, `rollEnemyLoot()`, `rollBossLoot()`, `applyDrops()`
- `src/game/progress.ts` — `ProgressManager`: XP/leveling, Battle Pass, logros, tracking de quests, mazmorras diarias. Callbacks `ProgressServices` para efectos visuales/sonoros de subida de nivel
- `src/game/crafting-manager.ts` — `CraftingManager`: recetas (antes en `recipes.ts`), `canCraft()`, `craft()`, mazmorras diarias de crafting

CombatManager desacoplado de `rollLoot`, `rollBossLoot`, `addBattlePassXp`, `saveBattlePass`, `trackDailyKill`, `saveDailyQuests`. Ahora usa callbacks `onEnemyKilled` y `onBossKilled`. Game inyecta `ProgressManager.processEnemyKill()` y `ProgressManager.processBossKill()` que manejan loot, BP, logros, tracking diario y quests. `crafting.ts` y `recipes.ts` eliminados (reemplazados por `crafting-manager.ts`). `game.ts` reducido a ~955 líneas. 179 tests totales (20 nuevos: 6 loot, 9 crafting-manager, 5 progress).

---

## ARQUITECTURA DEL PROYECTO

### Diagrama de componentes

```
┌─────────────────────────────────────────────────────┐
│                     FRONTEND                        │
│                                                     │
│  main.ts ─── Login/Auth ─── NFT Creation ─── Hub ───── Game   │
│                    │              │            │         │     │
│               api.ts          nft.ts     hub-ui.ts  game.ts    │
│                                        chars-ui     world.ts   │
│                                        inv-ui       zones.ts   │
│                                        stores-ui    input.ts   │
│                                                      abilities │
│                                                   qr-scanner   │
│                                                     rewards    │
│                                                    quality    │
├─────────────────────────────────────────────────────┤
│                     BACKEND                         │
│                                                     │
│  Express Server (server/index.js)                   │
│  ├── JWT Authentication Middleware                   │
│  ├── Rate Limiting (in-memory Map)                  │
│  ├── REST API (register, login, profile, stores*)   │
│  └── SQLite Database (better-sqlite3, WAL mode)     │
└─────────────────────────────────────────────────────┘
```

### Flujo de datos

1. **Autenticación:** Usuario ingresa teléfono + contraseña → Backend valida → JWT emitido → Guardado en localStorage
2. **Creación de NFT:** Teléfono → phoneHash → mulberry32 PRNG → Generación determinística de traits/stats
3. **Game Loop:** `requestAnimationFrame` → Input → Movimiento → Combat → Auto-collect → Interacciones → Render
4. **Persistencia:** Cada 30 segundos se envía profile al backend via `apiSaveProfile` (con retry 2x)
5. **Zonas:** Transiciones por portales → `loadZone()` reconstruye escena completa

### Patrones de diseño identificados

- **Module Pattern:** Cada archivo .ts es un módulo independiente con exports/imports
- **Factory Pattern:** `createWorld()`, `createProfile()`, `createActiveAbilities()`
- **State Machine (implícita):** `interactMode` en Game class
- **Observer Pattern:** Event listeners para input, resize, visibility
- **PRNG Seeded:** mulberry32 para generación determinística de NFTs

### Limitaciones arquitectónicas

1. **Monolito frontend:** La clase `Game` (955 líneas, antes 1600) se ha reducido significativamente extrayendo CombatManager, LootManager, ProgressManager y CraftingManager. Aún concentra UI, interacciones y orquestación.
2. **Sin state management:** Estado disperso en DOM y variables de clase
3. **Sin WebSocket:** No hay soporte para chat, PvP, ni multiplayer
4. **Backend single-file:** `server/index.js` (273 líneas) maneja auth, API, DB, y static serving
5. **Sin tests de integración:** Solo unit tests para nft.ts y profile.ts

---

## ESTADO ACTUAL DEL SISTEMA

### Sistemas implementados y funcionales

| Sistema | Estado | Notas |
|---------|--------|-------|
| Auth (JWT + bcrypt) | ✅ Completo | Migración legacy incluida |
| Rate Limiting | ✅ Completo | 100 req/min general, 5/min auth |
| NFT Generation | ✅ Completo | Determinístico desde teléfono |
| Combat System | ✅ Completo | Auto-attack, loot, respawn |
| 3 Zones | ✅ Completo | Aldea, Bosque, Ruinas |
| 7 Quests | ✅ Completo | Progresión lineal |
| 12 Recipes | ✅ Completo | Crafting + consumibles |
| QR Rewards | ✅ Completo | Demo codes + Barcode API |
| Abilities (Q/W) | ✅ Completo | 2 por elemento, 6 tipos |
| Achievements | ✅ Completo | 20 logros en 5 categorías |
| Quality Settings | ✅ Completo | Low/Medium/High, auto-detect |
| PWA | ✅ Completo | Service Worker + manifest |
| CI/CD | ✅ Completo | Lint + Test + Build |
| NFT Preview 3D | ✅ Completo | Rotación animada en pantalla de creación |
| Trade System | ✅ Completo | NPCs con ofertas de intercambio |
| Crafting Stations | ✅ Completo | 2 por zona |

### Sistemas pendientes (roadmap DESAFIO.txt)

| Sistema | Estado | Prioridad |
|---------|--------|-----------|
| Minigames (Tiendas) | ✅ Completado v0.6.0 | Alta |
| Boss Battles | ✅ Implementado v0.8.0 (CombatManager) | 3 bosses, fases, habilidades, minions |
| PVP Arena | ❌ No implementado | Alta |
| Guilds | ❌ No implementado | Media |
| Audio | ❌ No implementado | Media |
| Minimap | ❌ No implementado | Media |
| Chat Global | ❌ No implementado | Media |
| Visual Improvements | ❌ No implementado | Baja |
| Marketplace NFTs | ❌ No implementado | Baja |
| Battle Pass | ❌ No implementado | Baja |
| Daily Quests | ❌ No implementado | Baja |
| Friends System | ❌ No implementado | Baja |
| Leaderboard | ❌ No implementado | Baja |

---

## INVENTARIO DEL SISTEMA

### Frontend - Archivos fuente

| Archivo | Líneas | Propósito | Dependencias |
|---------|--------|-----------|--------------|
| `src/main.ts` | 334 | Entry point, login, NFT creation, PWA install | game, profile, nft, api, three |
| `src/styles.css` | 2212 | Todos los estilos CSS del juego | Ninguna |
| `src/game/game.ts` | 955 | Core game loop, UI, interacciones, orquestación | input, profile, world, zones, rewards, qr-scanner, quality, nft, api, abilities, progress, crafting-manager |
| `src/game/combat.ts` | 698 | CombatManager: ataque, enemigos, bosses, habilidades, daño (sin loot/BP/dailies) | profile, world, bosses, abilities, characters |
| `src/game/crafting-manager.ts` | 70 | CraftingManager: recetas, canCraft, craft | profile, daily-quests |
| `src/game/loot.ts` | 44 | LootManager: tablas de botín, rollLoot, applyDrops | profile |
| `src/game/progress.ts` | 147 | ProgressManager: XP, niveles, BP, logros, quest tracking | profile, characters, achievements, daily-quests, battlepass, nft, loot, crafting-manager |
| `src/game/world.ts` | 857 | Generación de mundo, enemigos, recursos, NPCs | profile, zones, three |
| `src/game/nft.ts` | 450 | Sistema NFT: generación, traits, modelo 3D | three |
| `src/game/abilities.ts` | 221 | Sistema de habilidades por elemento | nft, world, three |
| `src/game/achievements.ts` | 237 | Sistema de logros (20 achievements) | Ninguna |
| `src/game/profile.ts` | 260 | Perfil jugador, quests, trades | nft, achievements |
| `src/game/rewards.ts` | 118 | Sistema de recompensas QR | nft |
| `src/game/api.ts` | 140 | Cliente HTTP para auth/perfil/stores | profile |
| `src/game/stores.ts` | 64 | Interfaces: Store, Promotion, Product, StoreDetail | Ninguna |
| `src/game/promotions.ts` | 36 | Utilidades de promociones (fechas, estado) | stores |
| `src/game/products.ts` | 42 | Utilidades de productos (recompensas, rareza, precio) | stores |
| `src/game/stores-ui.ts` | 140 | UI de Tiendas Asociadas: listado y detalle | api, stores, promotions, products, navigation |
| `src/game/reward-manager.ts` | 78 | Cliente HTTP para canje de facturas | api |
| `src/game/redeem-ui.ts` | 113 | UI de canje de código de factura | reward-manager |
| `src/game/reward-result-ui.ts` | 58 | UI de animación de entrega de recompensa | reward-manager |
| `src/game/zones.ts` | 112 | Configuración de zonas, detección proximidad | profile, world, three |
| `src/game/input.ts` | 75 | Controlador de entrada (teclado + joystick) | three |
| `src/game/qr-scanner.ts` | 67 | Scanner QR con Barcode Detection API | Ninguna |
| `src/game/quality.ts` | 31 | Detección/configuración de calidad gráfica | Ninguna |
| **Total frontend** | **5,090** | | |

### Backend

| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| `server/index.js` | 603 | Express server: auth, API (stores*, redeem*), DB, static serving |
| `server/data/db.json` | 24 | Legacy JSON database (2 usuarios de prueba) |
| **Total backend** | **499** | |

### Tests

| Archivo | Líneas | Tests | Propósito |
|---------|--------|-------|-----------|
| `src/game/nft.test.ts` | 180 | 24 | PRNG, hash, generación NFT, stats, labels |
| `src/game/profile.test.ts` | 154 | 11 | Perfil, quests, trades |
| `src/game/characters.test.ts` | 274 | 25 | CharacterManager, colección, migración |
| `src/game/navigation.test.ts` | 97 | 11 | Navegación entre pantallas |
| `src/game/ui.test.ts` | 140 | 8 | Hub, Characters UI, Inventory UI |
| `src/game/stores.test.ts` | 200 | 33 | Stores, promotions, products |
| `src/game/combat.test.ts` | 650 | 39 | Sistema de combate: daño, ciclos, enemigos, bosses, habilidades, estados |
| `src/game/loot.test.ts` | 60 | 6 | LootManager: rollEnemyLoot, rollBossLoot, applyDrops |
| `src/game/crafting-manager.test.ts` | 100 | 9 | CraftingManager: getRecipe, canCraft, craft |
| `src/game/progress.test.ts` | 85 | 5 | ProgressManager: addExperience, trackAchievement, processEnemyKill, processBossKill |
| `src/game/reward-manager.test.ts` | 35 | 8 | Reward manager helpers |
| **Total tests** | **2,075** | **179** | |

### Configuración

| Archivo | Propósito |
|---------|-----------|
| `package.json` | Dependencias frontend, scripts |
| `server/package.json` | Dependencias backend |
| `tsconfig.json` | Configuración TypeScript (ES2022, strict, bundler) |
| `vite.config.ts` | Vite: proxy API, manual chunks three.js |
| `vitest.config.ts` | Vitest: jsdom, coverage v8 |
| `eslint.config.js` | ESLint + Prettier rules |
| `.prettierrc` | Formato de código |
| `.github/workflows/ci.yml` | CI: lint, format, test, build |
| `deploy.sh` | Deploy a servidor Linux con systemd |
| `public/sw.js` | Service Worker para PWA offline |
| `public/manifest.webmanifest` | PWA manifest |

### Assets

| Archivo | Propósito |
|---------|-----------|
| `public/icons/icon-192.svg` | Icono PWA 192x192 |
| `public/icons/icon-512.svg` | Icono PWA 512x512 |

---

## PROBLEMAS ENCONTRADOS

### Bugs y Errores Potenciales

#### Críticos

1. **`game.ts:545-578` - Craft recipes hardcodeadas en el método**
   - Las 12 recetas están definidas como literal object dentro de `craft()`
   - Dificultad para agregar nuevas recetas sin modificar game.ts
   - **Gravedad:** Media | **Impacto:** Mantenibilidad

2. **`game.ts:141` - `useConsumable` tipo limitado**
   - El tipo del parámetro solo incluye 3 items originales, pero switch maneja 8
   - El tipo no incluye: `pocion_fuerza`, `pocion_velocidad`, `antidoto`, `gran_pocion`, `elixir`
   - TypeScript debería mostrar error pero no lo hace por el `as` cast
   - **Gravedad:** Media | **Impacto:** Type safety

3. **`game.ts:629-640` - Buffs temporales con `setTimeout` sin tracking**
   - `pocion_fuerza` (+2 ATK por 60s) y `pocion_velocidad` (+3 SPD por 45s) usan `setTimeout`
   - Si el jugador muere o cambia de zona durante el buff, el stat se resta incorrectamente
   - No hay cancelación del timeout al morir o cambiar zona
   - **Gravedad:** Alta | **Impacto:** Game logic integrity

4. **`game.ts:500-506` - `respawnPlayer` siempre respawnea en (0,0,0)**
   - Independientemente de la zona actual, el jugador respawnea en origen
   - Debería usar `zoneConfig(this.currentZone).playerStart`
   - **Gravedad:** Media | **Impacto:** UX

5. **`world.ts:92-100` - Falta soporte para zonas `desierto` y `cueva`**
   - `createWorld()` solo tiene cases para `aldea`, `bosque`, y `ruinas`
   - Las zonas `desierto` y `cueva` están configuradas en `zones.ts` pero sin world generation
   - Si un jugador accede a estas zonas, el mundo estará vacío
   - **Gravedad:** Alta | **Impacto:** Gameplay

6. **`server/index.js:236-238` - `validZones` incompleto**
   - Solo valida `['aldea', 'bosque', 'ruinas']` pero el frontend tiene 5 zonas
   - Las zonas `desierto` y `cueva` serían rechazadas por el servidor
   - **Gravedad:** Media | **Impacto:** Data integrity

#### Menores

7. **`api.ts:99-124` - `showNotification` crea toast pero nunca se usa**
   - La función está exportada pero ningún archivo la importa
   - Código muerto
   - **Gravedad:** Baja | **Impacto:** Code cleanliness

8. **`achievements.ts:209-229` - `updateAchievement` nunca se llama desde game.ts**
   - La función existe pero no hay integración con el game loop
   - Los logros se crean pero nunca se actualizan
   - **Gravedad:** Alta | **Impacto:** Feature incomplete

9. **`game.ts:920-928` - `updateZoneLabel` tiene lista hardcodeada**
   - Repite los labels de zona que ya están en `zones.ts` o `game.ts:921`
   - Duplicación de datos
   - **Gravedad:** Baja | **Impacto:** Mantenibilidad

10. **`nft.ts:446-447` - Pet sphere siempre visible**
    - La esfera "mascota" se agrega a todos los modelos NFT sin importar el body type
    - Posición fija que puede intersectar con otras partes del modelo
    - **Gravedad:** Baja | **Impacto:** Visual

### Seguridad

11. **`server/index.js:12-18` - JWT_SECRET fallback en desarrollo**
    - El fallback `reinos-ancestrales-dev-secret` se usa cuando no hay `.env`
    - Si alguien deploya sin `.env`, el secret es predecible
    - Aunque hay validación para production, el fallback existe
    - **Gravedad:** Media | **Impacto:** Security

12. **`server/index.js:148` - CORS abierto (`app.use(cors())`)**
    - No hay restricción de origins
    - Cualquier sitio puede hacer peticiones a la API
    - **Gravedad:** Media | **Impacto:** CSRF risk

13. **`server/index.js:223-252` - PUT profile sin sanitización profunda**
    - Solo valida `nft`, `attributePoints`, `unlockedZones`, `redeemedRewards`
    - `inventory`, `crafted`, `quest`, `quests`, `loot` se guardan sin validación
    - Un cliente malicioso podría inyectar datos arbitrarios
    - **Gravedad:** Alta | **Impacto:** Data integrity

14. **Sin helmet middleware** - No hay security headers (CSP, X-Frame-Options, etc.)
    - **Gravedad:** Media | **Impacto:** Security headers

15. **`deploy.sh` - Ejecuta como root**
    - `User=root` en el servicio systemd
    - Debería usar un usuario dedicado
    - **Gravedad:** Media | **Impacto:** Server security

### Rendimiento

16. **`world.ts` - Crea nuevo material para cada mesh**
    - `const material = (color) => new MeshLambertMaterial(...)` se llama por cada parte de cada criatura
    - Un lobo tiene ~15 meshes = 15 materiales únicos
    - Debería usar material sharing/pooling
    - **Gravedad:** Media | **Impacto:** GPU memory

17. **`game.ts:158-170` - Game loop requestAnimationFrame overhead**
    - `requestAnimationFrame(this.loop)` se llama incluso cuando `document.hidden`
    - La condición de frame skipping es correcta pero el RAf sigue corriendo
    - **Gravedad:** Baja | **Impacto:** CPU

18. **`game.ts:890-898` - `nearestEnemy()` se calcula en cada frame**
    - Se hace `.filter().sort()[0]` en cada frame
    - Se calcula al menos 3 veces por frame (attack, updateTarget, abilities)
    - Debería cachearse o calcularse una vez por frame
    - **Gravedad:** Media | **Impacto:** CPU

19. **`game.ts:871-879` - `updateHud()` hace querySelector cada frame**
    - `this.element('#health-bar')` etc. se ejecuta 60 veces por segundo
    - Debería cachear referencias DOM en el constructor
    - **Gravedad:** Media | **Impacto:** DOM performance

20. **`game.ts:458-497` - `updateEnemies()` crea Vector3 clone por enemigo**
    - `this.player.position.clone().sub(...)` crea un nuevo Vector3 por enemigo por frame
    - Con 10 enemigos = 10 allocations/frame
    - **Gravedad:** Baja | **Impacto:** GC pressure

### Escalabilidad

21. **`game.ts` - Clase monolítica (1034 líneas)**
    - Maneja: game loop, combat, UI, crafting, abilities, quests, inventory, settings, compass, animations
    - Difícil de mantener, testear, y extender
    - **Gravedad:** Alta | **Impacto:** Maintainability

22. **`world.ts` - Generación procedural completa en cada cambio de zona**
    - `loadZone()` destruye y recrea toda la escena
    - No hay caching de zonas previas
    - **Gravedad:** Media | **Impacto:** Zone transition performance

23. **Sin arquitectura de componentes para UI**
    - Todo el HTML está en `index.html` (137 líneas)
    - La UI se manipula directamente con `textContent` y `hidden`
    - No hay sistema de componentes reutilizables
    - **Gravedad:** Media | **Impacto:** UI maintainability

24. **Backend single-file sin separación de concerns**
    - Auth, routes, DB queries, validation todo en `index.js`
    - **Gravedad:** Media | **Impacto:** Backend maintainability

---

## DEUDA TÉCNICA

| # | Elemento | Gravedad | Impacto | Prioridad | Tiempo Est. |
|---|----------|----------|---------|-----------|-------------|
| 1 | Clase `Game` parcialmente refactorizada (987 líneas, -613) | Media | Alto | Media | 4-6h (extraer UI, crafting) |
| 2 | Crafteo hardcodeado en `game.ts:545` | Media | Alto | Alta | 2-3h |
| 3 | `nearestEnemy()` calculado 3x/frame | Media | Alto | Alta | 1-2h |
| 4 | DOM queries sin cachear en game loop | Media | Alto | Alta | 2-3h |
| 5 | Materiales Three.js no compartidos | Media | Medio | Media | 3-4h |
| 6 | `setTimeout` para buffs sin tracking | Alta | Alto | Alta | 2-3h |
| 7 | Zonas desierto/cueva sin world generation | Alta | Alto | Alta | 4-6h |
| 8 | Achievements nunca se actualizan | Alta | Alto | Alta | 2-3h |
| 9 | PUT profile sin sanitización profunda | Alta | Alto | Alta | 2-3h |
| 10 | showNotification código muerto | Baja | Bajo | Baja | 0.5h |
| 11 | CORS abierto | Media | Medio | Media | 1h |
| 12 | Sin helmet middleware | Media | Medio | Media | 1h |
| 13 | validZones incompleto en backend | Media | Medio | Media | 0.5h |
| 14 | respawnPlayer always (0,0,0) | Media | Medio | Media | 0.5h |
| 15 | Labels zona duplicados | Baja | Bajo | Baja | 0.5h |
| 16 | Vector3 allocations en updateEnemies | Baja | Bajo | Media | 1h |
| 17 | Backend sin separación de concerns | Media | Medio | Media | 4-6h |
| 18 | Sin state management | Media | Medio | Baja | 8-12h |
| 19 | requestAnimationFrame overhead | Baja | Bajo | Baja | 0.5h |

**Total deuda técnica estimada:** ~45-65 horas

---

## RIESGOS

### Riesgos actuales

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Pérdida de datos por PUT profile sin validación | Alta | Alto | Validar todos los campos del profile en servidor |
| Buffs se aplican permanentemente si hay error | Media | Alto | Implementar buff tracking con cleanup |
| Zonas desierto/cueva crashean o están vacías | Alta | Alto | Implementar world generation para estas zonas |
| Memory leak por DOM elements temporales (damage numbers) | Media | Medio | Implementar object pooling |
| JWT sin refresh token (60d expiry) | Media | Medio | Implementar refresh tokens |
| Sin HTTPS enforcement | Media | Alto | Agregar redirect a HTTPS en deploy |
| SQLite sin backup strategy | Media | Alto | Implementar backups periódicos |
| Dependencias con vulnerabilidades | Baja | Alto | `npm audit` regular |
| CORS abierto permite ataques CSRF | Media | Medio | Restringir origins |

### Riesgos de escalabilidad

| Riesgo | Umbral | Impacto |
|--------|--------|---------|
| SQLite write contention | >50 usuarios concurrentes | Profile saves fall |
| Sin WebSocket para multiplayer | PvP/Guilds imposibles | Feature blocker |
| Frontend monolítico | >5000 líneas | Desarrollo lento |
| Sin CDN para assets | >1000 usuarios | Latencia alta |

---

## MEJORAS RECOMENDADAS

### Arquitectura

0. ~~**Sistema de múltiples personajes por cuenta**~~ ✅ **COMPLETADO v0.4.0**
   - Creación de `characters.ts` con `Character`, `CharacterCollection`, `CharacterManager`
   - Migración automática de perfiles NFT únicos a colección de personajes
   - `Game.ts` ahora accede al personaje activo mediante `this.characters.getActive()`
   - 25 tests unitarios, lint/tsc sin errores, 60 tests pasando

1. **Separar `Game` en módulos** - Extraer combat, crafting, UI, abilities a módulos independientes
   - Justificación: Reducir complejidad, mejorar testabilidad
   - **Prioridad:** Alta | **Esfuerzo:** 8-12h

2. **Implementar ECS (Entity Component System)** - Para manejo de entidades del juego
   - Justificación: Escalable, performante, estándar en juegos
   - **Prioridad:** Media | **Esfuerzo:** 20-30h (cambio grande)

3. **State management centralizado** - Store unificado para estado del juego
   - Justificación: Evitar estado disperso, facilitar persistencia
   - **Prioridad:** Media | **Esfuerzo:** 8-12h

4. **Backend modular** - Separar routes, controllers, middleware, DB layer
   - Justificación: Mantenibilidad, testing, escalabilidad
   - **Prioridad:** Media | **Esfuerzo:** 6-8h

### Seguridad

5. **Validación completa de profile en backend** - Validar todos los campos anidados
   - Justificación: Prevenir corrupción de datos
   - **Prioridad:** Alta | **Esfuerzo:** 3-4h

6. **CORS configurado** - Restringir a dominios específicos
   - Justificación: Prevenir ataques CSRF
   - **Prioridad:** Alta | **Esfuerzo:** 1h

7. **Helmet middleware** - Security headers
   - Justificación: Protección contra XSS, clickjacking
   - **Prioridad:** Media | **Esfuerzo:** 0.5h

8. **Refresh tokens** - JWT de corta duración + refresh
   - Justificación: Reducir ventana de ataque
   - **Prioridad:** Media | **Esfuerzo:** 4-6h

### Rendimiento

9. **Material sharing** - Reutilizar materiales Three.js por color
   - Justificación: Reducir uso de GPU memory
   - **Prioridad:** Media | **Esfuerzo:** 3-4h

10. **Object pooling** - Para damage numbers, proyectiles, enemigos
    - Justificación: Reducir GC pressure
    - **Prioridad:** Media | **Esfuerzo:** 4-6h

11. **DOM reference caching** - Cache de elementos DOM en constructor
    - Justificación: Eliminar querySelector del game loop
    - **Prioridad:** Alta | **Esfuerzo:** 2-3h

12. **Frame budget management** - Medir y limitar tiempo por frame
    - Justificación: Mantener framerate estable
    - **Prioridad:** Baja | **Esfuerzo:** 2-3h

### UX

13. **Audio system** - Efectos de sonido + música ambiental
    - Justificación: Inmersión, feedback de acciones
    - **Prioridad:** Media | **Esfuerzo:** 8-12h

14. **Minimap** - Mapa en tiempo real con fog of war
    - Justificación: Orientación, exploración
    - **Prioridad:** Media | **Esfuerzo:** 6-8h

15. **Animaciones mejoradas** - Attack swing, damage flash, death animation
    - Justificación: Feedback visual, pulido
    - **Prioridad:** Media | **Esfuerzo:** 6-10h

16. **Chat global (WebSocket)** - Chat en tiempo real
    - Justificación: Social, retención
    - **Prioridad:** Media | **Esfuerzo:** 10-15h

### DX (Developer Experience)

17. **Tipos compartidos frontend/backend** - Monorepo con types compartidos
    - Justificación: Type safety end-to-end
    - **Prioridad:** Media | **Esfuerzo:** 4-6h

18. **Tests de integración** - Tests para la API del backend
    - Justificación: Confianza en cambios
    - **Prioridad:** Media | **Esfuerzo:** 4-6h

19. **Storybook o documentación de componentes**
    - Justificación: Visualización de UI components
    - **Prioridad:** Baja | **Esfuerzo:** 4-6h

### Observabilidad

20. **Logging estructurado** - Winston o Pino en backend
    - Justificación: Debugging, monitoreo
    - **Prioridad:** Media | **Esfuerzo:** 2-3h

21. **Error tracking** - Sentry o similar
    - Justificación: Captura de errores en producción
    - **Prioridad:** Media | **Esfuerzo:** 2-3h

22. **Métricas de juego** - Tracking de eventos de jugadores
    - Justificación: Analytics, balanceo de juego
    - **Prioridad:** Baja | **Esfuerzo:** 4-6h

---

## ROADMAP COMPLETO

### Dependencias entre tareas

```
Fase 1 (Corrección de bugs críticos)
  └── Fase 2 (Sistema de Personajes ✅)
        └── Fase 3 (Hub + Navegación ✅)
              └── Fase 3.5 (Tiendas Asociadas ✅)
                    └── Fase 3.6 (Canje de Facturas ✅)
                          └── Fase 3.7 (Extracción CombatManager ✅)
                                └── Fase 4 (Refactorización restante)
                                └── Fase 5 (Nuevas funcionalidades gameplay)
                    ├── 5.1 Boss Battles
                    ├── 5.2 PVP Arena
                    ├── 5.3 Guilds + Chat (requiere WebSocket)
                    └── 5.4 Audio + Animaciones
                          └── Fase 6 (UX/UI)
                                └── Fase 7 (Monetización)
                                      └── Fase 8 (Testing)
                                            └── Fase 9 (Optimización final)
```

### Tareas paralelizables

- **En paralelo:** Audio, Minimap, Visual improvements
- **En paralelo:** Tests backend, Logging, Error tracking
- **En paralelo:** CORS fix, Helmet, Security headers
- **Secuencial:** Personajes → Hub/Navegación → Tiendas → Canje de facturas
- **Secuencial:** WebSocket → Chat → PVP → Guilds

---

## PLAN DE DESARROLLO PASO A PASO

### FASE 1: Corrección de Bugs Críticos (PRIORIDAD ALTA)

**Duración estimada:** 2-3 días
**Objetivo:** Estabilizar el sistema actual

| # | Tarea | Archivos | Tiempo | Dificultad |
|---|-------|----------|--------|------------|
| 1.1 | Implementar buff tracking con cleanup en muerte/zona | `game.ts` | 2h | Media |
| 1.2 | Corregir respawnPlayer para usar zoneConfig | `game.ts` | 0.5h | Baja |
| 1.3 | Agregar world generation para desierto y cueva | `world.ts` | 4h | Alta |
| 1.4 | Actualizar validZones en backend | `server/index.js` | 0.5h | Baja |
| 1.5 | Integrar achievements en game loop | `game.ts`, `achievements.ts` | 2h | Media |
| 1.6 | Validar profile completo en PUT endpoint | `server/index.js` | 2h | Media |
| 1.7 | Eliminar showNotification (código muerto) | `api.ts` | 0.5h | Baja |
| 1.8 | Corregir useConsumable type union | `game.ts` | 0.5h | Baja |

**Total Fase 1:** ~12 horas

---

### FASE 2: Sistema de Personajes ✅ (COMPLETADO v0.4.0)

**Duración estimada:** 6-8h
**Objetivo:** Soportar múltiples personajes por cuenta en lugar de un único NFT

| # | Tarea | Archivos | Tiempo | Dificultad |
|---|-------|----------|--------|------------|
| 2.1 | Crear interfaces Character, CharacterCollection, CharacterManager | `characters.ts` | 1.5h | Media |
| 2.2 | Migración automática de perfiles NFT antiguos a colección | `profile.ts` | 1h | Media |
| 2.3 | Integrar CharacterManager en Game.ts | `game.ts` | 1h | Media |
| 2.4 | Actualizar abilities.ts para usar Character | `abilities.ts` | 0.5h | Baja |
| 2.5 | Actualizar main.ts flujo de autenticación | `main.ts` | 1h | Media |
| 2.6 | Tests unitarios (25 tests) | `characters.test.ts`, `profile.test.ts` | 2h | Alta |
| 2.7 | Lint + tsc + verificar 60 tests pasando | - | 0.5h | Baja |

**Resultado:** 0 errores lint, 3 warnings esperados (any casts), TypeScript compila, 60 tests pasan.
---

### FASE 3: Hub + Navegación ✅ (COMPLETADO v0.5.0)

**Duración estimada:** 6-8h
**Objetivo:** Crear Hub Principal, sistema de pantallas, selección de personajes e inventario

| # | Tarea | Archivos | Tiempo | Dificultad |
|---|-------|----------|--------|------------|
| 3.1 | Sistema de pantallas (Navigation) | `navigation.ts` | 1h | Media |
| 3.2 | Hub Principal con bienvenida y personaje activo | `hub-ui.ts` | 1.5h | Media |
| 3.3 | Pantalla Mis Personajes con selección | `characters-ui.ts` | 2h | Alta |
| 3.4 | Pantalla Inventario con categorías | `inventory-ui.ts` | 1.5h | Media |
| 3.5 | Nuevos paneles en index.html | `index.html` | 1h | Baja |
| 3.6 | Estilos responsive para Hub y pantallas | `styles.css` | 1.5h | Media |
| 3.7 | Integrar nueva navegación en main.ts | `main.ts` | 1.5h | Alta |
| 3.8 | Tiendas Asociadas placeholder + Noticias | `hub-ui.ts` | 0.5h | Baja |
| 3.9 | Persistencia al seleccionar personaje | `characters-ui.ts`, `main.ts` | 0.5h | Media |
| 3.10 | Tests (navigation, hub, characters, inventory UI) | `navigation.test.ts`, `ui.test.ts` | 2h | Alta |

**Resultado:** 0 errores lint, 3 warnings esperados, 78 tests pasan (5 test files).

---

### FASE 3.5: Tiendas Asociadas ✅ (COMPLETADO v0.6.0)

**Duración estimada:** 4-6h
**Objetivo:** Crear sistema de tiendas asociadas con backend SQLite, API REST y frontend lazy loading

| # | Tarea | Archivos | Tiempo | Dificultad |
|---|-------|----------|--------|------------|
| 3.5.1 | Interfaces Store, Promotion, Product | `stores.ts` | 0.5h | Baja |
| 3.5.2 | Utilidades promotions (fechas, estado) | `promotions.ts` | 0.5h | Baja |
| 3.5.3 | Utilidades products (recompensas, rareza) | `products.ts` | 0.5h | Baja |
| 3.5.4 | Backend: tablas SQLite + seed data (5 stores, 5 promos, 5 products) | `server/index.js` | 1.5h | Media |
| 3.5.5 | API routes: /api/stores, /api/stores/:id, /api/promotions, /api/products | `server/index.js` | 1h | Media |
| 3.5.6 | UI stores list + store detail | `stores-ui.ts` | 1.5h | Media |
| 3.5.7 | Integración con navigation (lazy loading) | `main.ts`, `navigation.ts` | 0.5h | Media |
| 3.5.8 | Paneles + estilos stores | `index.html`, `styles.css` | 1h | Media |
| 3.5.9 | Tests (33 tests) | `stores.test.ts`, `navigation.test.ts` | 1.5h | Alta |
| 3.5.10 | Lint + tsc + 112 tests | - | 0.5h | Baja |

**Resultado:** 0 errores lint, 3 warnings esperados, 112 tests pasan (6 test files). Backend con 6 tablas SQLite. Frontend con navegación lazy a detalle. Botón "Canjear factura" deshabilitado (preparado para Fase 4).

### FASE 3.6: Canje de Facturas y Entrega de Recompensas ✅ (COMPLETADO v0.7.0)

**Duración estimada:** 6-8h
**Objetivo:** Implementar sistema completo de canje de códigos de factura con transacciones atómicas y entrega de recompensas

| # | Tarea | Archivos | Tiempo | Dificultad |
|---|-------|----------|--------|------------|
| 3.6.1 | Tablas SQLite invoice_codes + reward_history | `server/index.js` | 1h | Media |
| 3.6.2 | Seed codes (10 disponibles + 1 expirado) | `server/index.js` | 0.5h | Baja |
| 3.6.3 | Servicio CodeGenerator | `server/index.js` | 0.5h | Media |
| 3.6.4 | Funciones de entrega de recompensas (character, item, currency, crystals) | `server/index.js` | 1.5h | Alta |
| 3.6.5 | POST /api/redeem con transacción atómica | `server/index.js` | 1.5h | Alta |
| 3.6.6 | GET /api/rewards/history + GET /api/rewards/pending | `server/index.js` | 0.5h | Media |
| 3.6.7 | Cliente reward-manager.ts | `reward-manager.ts` | 0.5h | Baja |
| 3.6.8 | Pantalla de canje redeem-ui.ts | `redeem-ui.ts` | 1.5h | Media |
| 3.6.9 | Pantalla de resultado reward-result-ui.ts | `reward-result-ui.ts` | 1h | Media |
| 3.6.10 | Botón Canjear Factura en hub y store-detail | `hub-ui.ts`, `stores-ui.ts` | 0.5h | Baja |
| 3.6.11 | Estilos CSS para canje y resultado | `styles.css` | 1h | Media |
| 3.6.12 | Tests reward-manager (8 tests) | `reward-manager.test.ts` | 1h | Alta |
| 3.6.13 | Lint + tsc + 120 tests | - | 0.5h | Baja |

**Resultado:** 0 errores lint, 3 warnings esperados, 120 tests pasan (7 test files). Backend con 8 tablas SQLite. Frontend con canje funcional desde hub y tiendas, historial de canjes, animación de recompensa con compensación de duplicados.

### FASE 3.7: Extracción CombatManager ✅ (COMPLETADO v0.8.0)

**Duración estimada:** 4-6h
**Objetivo:** Extraer toda la lógica de combate de Game a un módulo CombatManager independiente

| # | Tarea | Archivos | Tiempo | Dificultad |
|---|-------|----------|--------|------------|
| 3.7.1 | Crear `combat.ts` con interfaz CombatServices y clase CombatManager | `combat.ts` | 2h | Alta |
| 3.7.2 | Mover estado de combate (health, energy, enemies, boss, abilities) | `combat.ts`, `game.ts` | 1h | Media |
| 3.7.3 | Mover métodos de combate (attack, damage, enemies, boss, abilities) | `combat.ts`, `game.ts` | 2h | Alta |
| 3.7.4 | Conectar CombatManager en Game (constructor, update) | `game.ts` | 0.5h | Media |
| 3.7.5 | Eliminar imports/métodos huérfanos de Game | `game.ts` | 0.5h | Baja |
| 3.7.6 | Tests unitarios (39 tests) | `combat.test.ts` | 2h | Alta |
| 3.7.7 | Lint + tsc + 159 tests (v0.8.0) | - | 0.5h | Baja |

**Resultado (v0.8.0):** 0 errores lint, 3 warnings esperados, 159 tests pasan (8 test files). game.ts reducido de ~1600 a ~987 líneas. CombatManager (~760 líneas) maneja todo el combate.

### FASE 3.8: Extracción LootManager, ProgressManager, CraftingManager (COMPLETADA v0.9.0)

**Duración estimada:** 1-2 días  
**Objetivo:** Extraer el sistema de botín, progresión y crafting de Game class, desacoplar CombatManager de loot/BP/dailies

| # | Tarea | Archivos | Tiempo | Dificultad |
|---|-------|----------|--------|------------|
| 3.8.1 | Crear `loot.ts` con LootManager | `loot.ts` | 1h | Media |
| 3.8.2 | Crear `progress.ts` con ProgressManager | `progress.ts` | 2h | Media |
| 3.8.3 | Crear `crafting-manager.ts` con CraftingManager | `crafting-manager.ts` | 1.5h | Media |
| 3.8.4 | Desacoplar CombatManager: remover imports loot/BP/daily-quests | `combat.ts` | 2h | Alta |
| 3.8.5 | Actualizar Game: usar nuevos managers | `game.ts` | 1.5h | Media |
| 3.8.6 | Eliminar `crafting.ts`, `recipes.ts` | - | 0.5h | Baja |
| 3.8.7 | Tests unitarios (20 tests: 6 loot + 9 crafting-manager + 5 progress) | `loot.test.ts`, `crafting-manager.test.ts`, `progress.test.ts` | 2h | Alta |
| 3.8.8 | Actualizar tests de combate | `combat.test.ts` | 1h | Alta |
| 3.8.9 | Lint + tsc + 179 tests | - | 0.5h | Baja |

**Resultado (v0.9.0):** 0 errores lint, 15 warnings (pre-existing no-explicit-any), 179 tests pasan (11 test files). game.ts reducido a ~955 líneas. CombatManager desacoplado de loot/BP/dailies. `crafting.ts` y `recipes.ts` eliminados. Arquitectura: LootManager, ProgressManager, CraftingManager son clases puras con dependencias inyectadas vía constructor. Game actúa como coordinador.

---

### FASE 4: Refactorización (PRIORIDAD ALTA) — COMPLETADA v0.8.0 + v0.9.0

**Duración estimada:** 3-5 días  
**Objetivo:** Mejorar arquitectura para soportar nuevas features

| # | Tarea | Archivos | Tiempo | Dificultad | Estado |
|---|-------|----------|--------|------------|--------|
| 4.1 | Extraer CombatManager de Game class | `game.ts` → `combat.ts` | 4h | Alta | ✅ v0.8.0 |
| 4.2 | Extraer CraftingManager | `game.ts` → `crafting-manager.ts` | 2h | Media | ✅ v0.9.0 |
| 4.3 | Extraer UIManager (HUD, panels, hints) | `game.ts` → `ui.ts` | 4h | Alta | ⬜ Pendiente |
| 4.4 | Cachear DOM references en constructor | `game.ts` | 2h | Baja | ⬜ Pendiente |
| 4.5 | Calcular nearestEnemy una vez por frame | `game.ts` | 1h | Baja | ⬜ Pendiente |
| 4.6 | Mover recetas a archivo dedicado | `recipes.ts` | 1h | Baja | ✅ v0.9.0 (→ crafting-manager.ts, recipes.ts eliminado) |
| 4.7 | Material sharing en world.ts | `world.ts` | 3h | Media | ⬜ Pendiente |
| 4.8 | Modularizar backend (routes, middleware, db) | `server/` | 6h | Alta | ⬜ Pendiente |
| 4.9 | Configurar CORS restrictivo | `server/index.js` | 1h | Baja | ⬜ Pendiente |
| 4.10 | Agregar helmet middleware | `server/index.js` | 0.5h | Baja | ⬜ Pendiente |
| 4.11 | Extraer LootManager | `game.ts` → `loot.ts` | 1h | Media | ✅ v0.9.0 |
| 4.12 | Extraer ProgressManager | `game.ts` → `progress.ts` | 2h | Media | ✅ v0.9.0 |
| 4.13 | Desacoplar CombatManager de loot/BP/dailies | `combat.ts` | 2h | Alta | ✅ v0.9.0 |

**Total completado Fase 4:** 9h / ~24h (37%)
**Próximo sub-fase:** 4.3 UIManager para completar extracción

---

### FASE 5: Gameplay Nuevo (PRIORIDAD MEDIA)

**Duración estimada:** 2-4 semanas
**Objetivo:** Agregar contenido y funcionalidades principales

#### 5.1 Boss Battles (1 semana)

| # | Tarea | Archivos | Tiempo |
|---|-------|----------|--------|
| 5.1.1 | Definir stats y comportamiento de bosses | `bosses.ts` | 3h |
| 5.1.2 | Implementar sistema de fases de boss | `combat.ts` | 4h |
| 5.1.3 | Mecánicas: invocar minions, AoE, enrage | `combat.ts` | 6h |
| 5.1.4 | Loot exclusivo de boss | `loot.ts` | 2h |
| 5.1.5 | UI de boss health bar especial | `ui.ts` | 2h |
| 5.1.6 | Tests para boss mechanics | `bosses.test.ts` | 3h |

**Subtotal:** ~20 horas

#### 5.2 PVP Arena (1 semana)

| # | Tarea | Archivos | Tiempo |
|---|-------|----------|--------|
| 5.2.1 | WebSocket server setup | `server/ws.js` | 4h |
| 5.2.2 | Matchmaking por nivel/rareza | `matchmaking.ts` | 4h |
| 5.2.3 | Combate sincronizado 1v1 | `pvp.ts` | 8h |
| 5.2.4 | Sistema de ranking ELO | `ranking.ts` | 4h |
| 5.2.5 | UI de arena y leaderboard | `ui.ts` | 4h |
| 5.2.6 | Tests para matchmaking y ELO | `pvp.test.ts` | 3h |

**Subtotal:** ~27 horas

#### 5.3 Guilds + Chat (1-2 semanas)

| # | Tarea | Archivos | Tiempo |
|---|-------|----------|--------|
| 5.3.1 | API de guilds (CRUD) | `server/guilds.js` | 4h |
| 5.3.2 | Modelo de guild en DB | `server/db.js` | 2h |
| 5.3.3 | Chat WebSocket (Global, Guild, Party) | `server/ws.js` | 6h |
| 5.3.4 | Guild bank compartido | `guild-bank.ts` | 4h |
| 5.3.5 | Guild quests (misiones grupales) | `guild-quests.ts` | 6h |
| 5.3.6 | UI de guild y chat | `ui.ts` | 6h |
| 5.3.7 | Tests | `guilds.test.ts` | 3h |

**Subtotal:** ~31 horas

#### 5.4 Audio + Animaciones (1 semana)

| # | Tarea | Archivos | Tiempo |
|---|-------|----------|--------|
| 5.4.1 | Sistema de audio (Web Audio API) | `audio.ts` | 4h |
| 5.4.2 | Efectos de sonido (ataque, daño, recolecta) | `audio.ts` | 4h |
| 5.4.3 | Música ambiental por zona | `audio.ts` | 3h |
| 5.4.4 | Animación de ataque (swing) | `animations.ts` | 3h |
| 5.4.5 | Animación de recibir daño (flash rojo) | `animations.ts` | 2h |
| 5.4.6 | Animación de muerte (caída + fade) | `animations.ts` | 3h |
| 5.4.7 | Partículas de habilidades | `particles.ts` | 4h |

**Subtotal:** ~23 horas

**Total Fase 5:** ~101 horas (2.5-4 semanas)

---

### FASE 6: UX/UI Mejorada (PRIORIDAD MEDIA)

**Duración estimada:** 1-2 semanas

| # | Tarea | Archivos | Tiempo |
|---|-------|----------|--------|
| 6.1 | Minimap con fog of war | `minimap.ts`, `ui.ts` | 8h |
| 6.2 | Sistema de mensajes/notificaciones | `notifications.ts` | 4h |
| 6.3 | Iluminación dinámica por zona | `world.ts` | 4h |
| 6.4 | Efectos de clima (lluvia, nieve) | `weather.ts` | 6h |
| 6.5 | Post-processing (bloom, vignette) | `renderer.ts` | 4h |
| 6.6 | LOD para enemigos lejanos | `world.ts` | 3h |
| 6.7 | Mejoras de sombras (shadow maps) | `renderer.ts` | 3h |

**Total Fase 6:** ~32 horas

---

### FASE 7: Monetización y Retención (PRIORIDAD BAJA)

**Duración estimada:** 2-3 semanas

| # | Tarea | Archivos | Tiempo |
|---|-------|----------|--------|
| 7.1 | Marketplace de NFTs | `marketplace.ts`, `server/` | 12h |
| 7.2 | Battle Pass (gratuito + premium) | `battlepass.ts` | 10h |
| 7.3 | Tienda de cosmetics | `cosmetics.ts` | 8h |
| 7.4 | Quests diarias + login streak | `daily-quests.ts` | 6h |
| 7.5 | Eventos de temporada | `events.ts` | 8h |
| 7.6 | Sistema de amigos | `friends.ts` | 8h |
| 7.7 | Leaderboard global | `leaderboard.ts` | 4h |

**Total Fase 7:** ~56 horas

---

### FASE 8: Testing y Calidad (PRIORIDAD MEDIA)

**Duración estimada:** 1 semana

| # | Tarea | Archivos | Tiempo |
|---|-------|----------|--------|
| 8.1 | Tests de integración para API | `server/*.test.js` | 6h |
| 8.2 | Tests para combat system | `combat.test.ts` | 4h |
| 8.3 | Tests para crafting | `crafting.test.ts` | 3h |
| 8.4 | Tests para abilities | `abilities.test.ts` | 3h |
| 8.5 | Tests para boss battles | `bosses.test.ts` | 3h |
| 8.6 | Tests para PVP | `pvp.test.ts` | 4h |
| 8.7 | Tests para guilds | `guilds.test.ts` | 3h |
| 8.8 | E2E tests (Playwright) | `e2e/` | 8h |
| 8.9 | Aumentar coverage a >80% | Various | 4h |

**Total Fase 8:** ~38 horas

---

### FASE 9: Optimización Final (PRIORIDAD BAJA)

**Duración estimada:** 1 semana

| # | Tarea | Archivos | Tiempo |
|---|-------|----------|--------|
| 9.1 | Object pooling (damage nums, projectiles) | `pool.ts` | 4h |
| 9.2 | Frustum culling manual | `renderer.ts` | 3h |
| 9.3 | Compresión de assets | `vite.config.ts` | 2h |
| 9.4 | Lazy loading de zonas | `world.ts` | 4h |
| 9.5 | Profile de rendimiento y profiling | Various | 3h |
| 9.6 | CDN setup para assets estáticos | `deploy.sh` | 2h |
| 9.7 | Backup automático de SQLite | `server/` | 2h |

**Total Fase 9:** ~20 horas

---

## PRIORIZACIÓN

### Crítica (Hacer primero)
- 1.1 Buff tracking cleanup
- 1.3 World generation desierto/cueva
- 1.6 Validar profile completo en backend
- 4.9 CORS restrictivo

### Alta (Hacer después)
- 1.5 Integrar achievements
- 4.1-4.7 Refactorización de Game class
- 4.8 Modularizar backend
- 4.10 Helmet middleware
- 5.1 Boss Battles

### Media (Hacer cuando haya tiempo)
- 5.2 PVP Arena
- 5.3 Guilds + Chat
- 5.4 Audio + Animaciones
- 6.1-6.7 UX/UI mejoras
- 8.1-8.9 Testing

### Baja (Hacer al final)
- 7.1-7.7 Monetización
- 9.1-9.7 Optimización final

---

## ESTIMACIONES TOTALES

| Fase | Horas estimadas | Días (8h/día) | Semanas |
|------|----------------|---------------|---------|
| Fase 1: Bugs críticos | 12h | 1.5 días | - |
| Fase 2: Sistema de Personajes ✅ | 8h | 1 día | - |
| Fase 3: Hub + Navegación ✅ | 8h | 1 día | - |
| Fase 3.5: Tiendas Asociadas ✅ | 8h | 1 día | - |
| Fase 3.6: Canje de Facturas ✅ | 8h | 1 día | - |
| Fase 3.7: Extracción CombatManager ✅ | 6h | 0.75 día | - |
| Fase 4: Refactorización | 18h | 2.25 días | - |
| Fase 5: Gameplay nuevo | 101h | 12.5 días | 2.5-4 semanas |
| Fase 6: UX/UI | 32h | 4 días | 1-2 semanas |
| Fase 7: Monetización | 56h | 7 días | 1.5-2 semanas |
| Fase 8: Testing | 38h | 5 días | 1 semana |
| Fase 9: Optimización | 20h | 2.5 días | 0.5-1 semana |
| **TOTAL** | **~313h** | **~39 días** | **7-9 semanas** |

---

## PRÓXIMOS PASOS INMEDIATOS

1. **Extraer CraftingManager y UI de Game** (Fase 4.2-4.3) - Continuar refactorización
2. **Boss UI avanzada** (Fase 5.1) - Mejorar interfaz de jefes
3. **World generation para desierto y cueva** (Fase 1.3) - Completar zonas faltantes
4. **PVP Arena** (Fase 5.2) - Nueva feature de alto impacto

---

*Documento generado automáticamente por análisis del código fuente. Última actualización: 2026-07-30*
