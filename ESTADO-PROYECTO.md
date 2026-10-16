# AODASE Pets — Contexto Completo del Proyecto

> Este documento contiene todo el contexto necesario para trabajar con el proyecto.
> Úsalo como referencia en ChatGPT, Copilot, Claude o cualquier herramienta de IA.

---

## 1. Descripción General

**AODASE Pets** (antes Reinos Ancestrales) es un RPG 3D browser-based (Progressive Web App) donde el jugador crea un guerrero único, explora zonas, combate criaturas, recolecta recursos, completa misiones y sube de nivel en un mundo 3D renderizado con Three.js.

- **Nombre**: AODASE Pets
- **URL principal**: https://aodase.reinbor.cloud/
- **Servicio systemd**: `aodase.service` (activo)
- **Puerto de escucha**: 3002 (nginx → 127.0.0.1:3002)
- **Idioma**: Español (toda la UI)
- **Tipo**: PWA instalable con soporte offline

---

## 2. Stack Tecnológico

| Capa | Tecnología | Detalle |
|------|-----------|---------|
| Frontend | Three.js 0.179 + TypeScript 5.8 + Vite 7.x | PWA, WebGL, sin framework (vanilla TS) |
| Backend | Express 4.21 + better-sqlite3 + JWT + bcrypt | Puerto 3002, SQLite WAL mode |
| 3D Engine | Three.js 0.179 | Modelos procedurales, lighting, particles |
| Build | Vite 7.x | Producción: `dist/` |
| Tests | Vitest 3.2 | 179 tests unitarios |
| Lint | ESLint 9 + Prettier | Config en `eslint.config.js` |

---

## 3. Estructura de Carpetas y Archivos

```
/home/aodase/
│
├── index.html                     # SPA entry: TODAS las secciones HTML (HUD, paneles, pantallas)
├── package.json                   # Root: three, vite, vitest, eslint
├── tsconfig.json                  # TypeScript config
├── vite.config.ts                 # Vite: dev proxy /api -> :3000, manual chunks
├── vitest.config.ts               # Vitest config
├── eslint.config.js               # ESLint + Prettier
├── deploy.sh                      # Script de despliegue
├── ESTADO-PROYECTO.md             # Este archivo (contexto del proyecto)
├── PLAN_DESARROLLO.md             # Roadmap de desarrollo
├── DESAFIO.txt                    # Checklist de features
├── README.md                      # Guía de setup
│
├── .github/workflows/ci.yml       # GitHub Actions: lint, format, test, build
│
├── dist/                          # Build de producción
│   ├── index.html
│   ├── sw.js                      # Service worker (PWA)
│   ├── manifest.webmanifest
│   └── assets/
│       ├── index-*.css            # CSS compilado
│       ├── index-*.js             # JS compilado
│       └── three-*.js             # Three.js chunk
│
├── public/                        # Assets PWA (copiados a dist/)
│   ├── manifest.webmanifest
│   ├── sw.js
│   └── icons/
│       ├── icon-192.svg
│       └── icon-512.svg
│
├── server/                        # Backend
│   ├── index.js                   # Express server (1050 líneas)
│   ├── admin.html                 # Panel admin SPA
│   ├── package.json               # bcryptjs, better-sqlite3, cors, express, jwt
│   └── data/
│       ├── game.db                # SQLite (WAL mode, 9 tablas)
│       ├── game.db-shm
│       ├── game.db-wal
│       └── db.json                # Legacy (deprecated)
│
└── src/                           # Frontend TypeScript
    ├── main.ts                    # Entry: login, NFT creation, hub, navigation, LANDING
    ├── styles.css                 # TODOS los estilos (~2800 líneas)
    └── game/
        │
        │  ── CORE ──
        ├── game.ts                # Game class: game loop, combat, camera, zones, UI (955 líneas)
        ├── world.ts               # World generation: zones, enemies, NPCs, resources (1081 líneas)
        ├── zones.ts               # Zone configs, proximity detection (114 líneas)
        ├── input.ts               # Keyboard + touch joystick controller (75 líneas)
        ├── navigation.ts          # SPA screen router (AppScreen type, 11 screens)
        ├── api.ts                 # HTTP client: auth, profile, stores, rewards (177 líneas)
        ├── quality.ts             # Graphics quality auto-detection (31 líneas)
        │
        │  ── PERSONAJES / NFT ──
        ├── nft.ts                 # NFT traits, stats, 3D models, element/rarity (450 líneas)
        ├── characters.ts          # Character collection, manager, generation (348 líneas)
        ├── profile.ts             # Player profile, quests, trades, localStorage (310 líneas)
        │
        │  ── COMBATE ──
        ├── combat.ts              # CombatManager: real-time combat, enemy AI, bosses (682 líneas)
        ├── abilities.ts           # 12 abilities (2 per element), projectiles (225 líneas)
        ├── bosses.ts              # 5 boss definitions, phases, models (833 líneas)
        ├── items.ts               # 8 consumable items, buffs (98 líneas)
        ├── loot.ts                # Loot tables, drop rolls (57 líneas)
        │
        │  ── PROGRESIÓN ──
        ├── progress.ts            # XP, level-up, achievement tracking (144 líneas)
        ├── achievements.ts        # 20 achievements in 5 categories (237 líneas)
        ├── daily-quests.ts        # Daily quest system, streaks (285 líneas)
        ├── battlepass.ts          # Battle pass 30-tier system (157 líneas)
        ├── leaderboard.ts         # Score ranking, NPC entries (109 líneas)
        ├── crafting-manager.ts    # 12 crafting recipes (74 líneas)
        │
        │  ── RECOMPENSAS / COMERCIO ──
        ├── rewards.ts             # QR reward validation (legacy) (118 líneas)
        ├── reward-manager.ts      # Server-side reward redemption (78 líneas)
        ├── qr-scanner.ts          # Camera QR reader (Barcode Detection API) (67 líneas)
        │
        │  ── AUDIO / VISUAL ──
        ├── audio.ts               # Web Audio API: SFX, zone ambient music (328 líneas)
        ├── visual.ts              # Particles, weather, screen flashes (274 líneas)
        ├── minimap.ts             # Canvas minimap with fog of war (218 líneas)
        │
        │  ── UI ──
        ├── game-ui.ts             # In-game HUD updates (415 líneas)
        ├── hub-ui.ts              # Hub/main menu screen (92 líneas)
        ├── characters-ui.ts       # Character collection screen (77 líneas)
        ├── inventory-ui.ts        # Inventory screen (81 líneas)
        ├── stores-ui.ts           # Store list + detail screens (175 líneas)
        ├── redeem-ui.ts           # Invoice code redemption screen (113 líneas)
        ├── reward-result-ui.ts    # Reward result display screen (58 líneas)
        │
        │  ── TIENDAS ──
        ├── stores.ts              # Store/Promotion/Product type definitions (64 líneas)
        ├── products.ts            # Product label formatters (44 líneas)
        ├── promotions.ts          # Promotion status helpers (35 líneas)
        │
        │  ── TESTS ──
        ├── *.test.ts              # Vitest unit tests (179 tests)
        └── navigation.test.ts     # Navigation tests
```

---

## 4. Cómo Funciona el Juego

### 4.1 Flujo del Usuario

```
/ (Landing Page)
  → "Unirse al Mundo"
    → Login / Register (phone + password)
      → Auth Success
        → ¿Tiene personajes? 
          → SÍ: Hub (menú principal)
          → NO: Creación de Slime inicial
            → Hub
              → Entrar al Mundo (juego 3D)
              → Mis Personajes
              → Inventario
              → Tiendas Asociadas
              → Canjear Factura
```

### 4.2 Game Loop (`game.ts`)

```
start() → clock.start() → loop()
  loop():
    1. Skip frame si está oculto o demasiado pronto (calidad: 30/45/60 FPS)
    2. delta = min(clock.getDelta(), 0.05)
    3. update(delta):
       - Leer input (WASD/joystick)
       - Mover jugador (velocidad = 4.2 × spdMul)
       - Drenar/regenerar energía al moverse/reposar
       - Manejar dash timer
       - Clampear jugador a límites del terreno (±42)
       - CombatManager.update() — IA de enemigos, bosses, minions
       - Auto-recolectar recursos a distancia 1.8
       - Verificar proximidad a NPCs, estaciones de crafting, portales
       - Actualizar compás apuntando al portal más cercano
       - Actualizar minimapa
       - Actualizar efectos visuales (partículas, clima, flashes)
       - Actualizar animaciones (bob, attack scale, level-up flash)
       - Actualizar cooldowns de habilidades
       - Actualizar overlay de warning de boss
       - Lerp cámara siguiendo al jugador
       - Actualizar barras HUD (vida, energía, XP)
       - Actualizar target card (enemigo/boss más cercano)
    4. renderer.render(scene, camera)
    5. Auto-guardar perfil en servidor cada 30 segundos
```

### 4.3 Sistema de Combate (`combat.ts`)

- **Ataque del jugador:** Cooldown 400ms, targets enemigo/boss más cercano en rango (4.0-4.5 unidades). Daño = `1 + floor(atk/3) + swordBonus`.
- **IA de enemigos:** Lobos persiguen a 1.3, espíritus a 0.9, esqueletos a 1.1, golems a 0.6. Rango de ataque 2.5-3.2. Cooldown 1300ms. Daño reducido por def del jugador, escudo y escudo crafted.
- **Sistema de Bosses:** 5 bosses (uno por zona) con 4 fases cada uno. Habilidades: AoE slam, summon minions, heal, enrage, charge. Al 25% HP el boss enrage y regenera después de 45s si no se mata.
- **Habilidades:** 2 por elemento (teclas Q/W). Tipos: daño, heal, shield, dash, stun, lifesteal. Costo de energía + cooldown.
- **Muerte:** Respawn en inicio de zona con 65% HP. Enemigos respawnean después de 18s. Bosses después de 120-300s.

### 4.4 Zonas (`zones.ts`, `world.ts`)

| Zona | Tamaño | Niebla | Enemigos | Boss | Clima |
|------|--------|--------|----------|------|-------|
| Aldea | 90×90 | Sky blue | Lobo, Esqueleto | Guardián Ancestral (120 HP) | Ninguno |
| Bosque | 80×80 | Green haze | 2 Lobos, Espíritu, Esqueleto | Señor del Bosque (250 HP) | Lluvia |
| Ruinas | 70×70 | Purple haze | 2 Golems, Espíritu | Rey Golem (400 HP) | Ninguno |
| Desierto | 100×100 | Sandy | Escorpión, Serpiente, Momia | Faranón Olvidado (550 HP) | Tormenta de arena |
| Cueva | 60×60 | Dark | Murciélago, Fantasma, Golem | Señor de las Profundidades (750 HP) | Nieve |

Cada zona tiene: mesh de terreno, iluminación, niebla, recursos (9-11), NPCs (2-3 con diálogo y comercio), estaciones de crafting (2) y portales.

### 4.5 Personajes (`nft.ts`, `characters.ts`)

- **Personaje inicial:** "Slime" — siempre elemento `agua`, rareza `comun`, body type `golem`, stats 4/4/4/4/4.
- **Generación NFT:** Determinista desde hash del teléfono (mulberry32 PRNG). Traits: elemento (6 tipos), rareza (55% comun, 28% raro, 13% epico, 4% legendario), body type (4 tipos). Pool de stats: comun=28, raro=38, epico=52, legendario=72 puntos distribuidos en 5 stats.
- **3D Model:** Geometría procedural de Three.js según body type + colores de elemento + decoraciones de rareza (cuernos, alas, anillo halo para épico/legendario).

### 4.6 Misiones (`profile.ts`, `progress.ts`)

7 misiones lineales que desbloquean zonas progresivamente.

### 4.7 Crafting (`crafting-manager.ts`)

12 recetas: Ración, Espada, Poción, Escudo, Ungüento, Armadura, Amuleto, Poción Fuerza, Poción Velocidad, Antídoto, Gran Poción, Elixir.

---

## 5. Sistema de Navegación (`navigation.ts`)

### Tipo `AppScreen`

```typescript
type AppScreen = 
  | 'landing' | 'login' | 'nft' | 'hub' | 'characters'
  | 'inventory' | 'stores' | 'store-detail' 
  | 'redeem' | 'reward-result' | 'game';
```

### Mecanismo

- `navigate(screen)`: Oculta todas las secciones `*-screen` via clase CSS `hidden`, muestra la target. Toggle del canvas del juego. Push al historial (excepto game/landing). Notifica listeners.
- `goBack()`: Pop del historial y navega silenciosamente.
- `onNavigate(cb)`: Registra listeners para cada navegación.

### Flujo en `main.ts`

1. **Landing:** Personajes animados 3D, botón "Unirse al Mundo" → login
2. **Login:** Formulario phone + password → on success, fetch profile
3. **NFT Creation:** Si no hay personajes, generar slime → preview 3D → "Entrar al reino"
4. **Hub:** Character card, botones de acción
5. **Game:** Gameplay 3D completo con HUD

---

## 6. Comunicación Frontend-Backend

### Capa API (`api.ts`)

- **Base path:** `/api/*` (proxy por Vite en dev, nginx en producción)
- **Auth:** JWT token en `localStorage` como `reinos-auth-token`. Header `Authorization: Bearer <token>`.
- **Retry:** `apiSaveProfile` reintenta hasta 2 veces con backoff de 500ms.
- **401:** Auto-limpia auth y recarga página.
- **429:** Muestra error "Servidor ocupado".

### Endpoints API

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/register` | No | Crear cuenta |
| POST | `/api/login` | No | Iniciar sesión, JWT token |
| GET | `/api/profile` | Sí | Obtener perfil del jugador |
| PUT | `/api/profile` | Sí | Guardar perfil |
| POST | `/api/redeem` | Sí | Canjear código de factura |
| GET | `/api/rewards/history` | Sí | Historial de recompensas |
| GET | `/api/rewards/pending` | Sí | Recompensas pendientes |
| GET | `/api/health` | No | Health check |
| GET | `/api/stores` | No | Listar tiendas |
| GET | `/api/stores/:id` | No | Tienda por ID |
| GET | `/api/promotions` | No | Listar promociones |
| GET | `/api/products` | No | Listar productos |

### Admin API

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/admin/login` | Auth admin (username: ProyectosReinbor) |
| GET | `/api/admin/stats` | Estadísticas generales |
| GET/DELETE | `/api/admin/users` | Gestión de usuarios |
| GET | `/api/admin/invoices` | Gestión de facturas |
| GET/POST/DELETE | `/api/admin/stores` | CRUD de tiendas |
| POST | `/api/admin/stores/:id/invoices` | Generar código de factura |

---

## 7. Backend (`server/index.js`)

- **Server:** Express en puerto 3002, CORS habilitado, JSON body parser (1MB limit)
- **Database:** SQLite via better-sqlite3, WAL mode, foreign keys ON
- **Tablas:** `users`, `profiles`, `stores`, `promotions`, `products`, `promotion_products`, `invoice_codes`, `reward_history`
- **Auth:** JWT con expiración 60 días. Passwords hasheados con bcrypt (12 rounds).
- **Rate limiting:** 100 req/min general, 10 auth attempts/min por IP
- **Validación:** Phone (6-15 dígitos), password (4-100 chars), whitelist de zonas, límites de inventario (0-9999), attribute points (0-100)
- **Reward delivery:** Personajes (con duplicate detection → crystals fallback), items, consumibles, currency, crystals
- **Datos semilla:** 5 tiendas, 5 promociones, 5 productos, 11 códigos de factura

---

## 8. Panel de Administración

- **URL**: `https://aodaseadmin.reinbor.cloud/`
- **Login**: POST `/api/admin/login` con `{username, password}`
- **Username**: `ProyectosReinbor`
- **Password**: `reinbor-2026`
- **Token**: JWT firmado con JWT_SECRET, role=`admin`, vigencia 24h
- **Header auth**: `Authorization: Bearer <token>`
- **Vistas**: Dashboard, Usuarios, Facturas, Tiendas

---

## 9. Despliegue

- **Nginx**: `aodase.reinbor.cloud` sirve `dist/` y hace proxy de `/api` a `127.0.0.1:3002`; `aodaseadmin.reinbor.cloud` hace proxy total al mismo backend
- **HTTPS**: Let's Encrypt válido
- **HTTP/2**: habilitado
- **Service**: `aodase.service` (systemd, auto-restart)
- **Build**: `npm run build` → `dist/`
- **CI/CD**: GitHub Actions (lint, format, test, build)

---

## 10. Comandos Útiles

```bash
# Desarrollo
npm run dev          # Vite dev server (port 5173, proxy /api → :3000)
npm run server       # Express backend (port 3002)
npm run start        # Ambos concurrentemente

# Build & Deploy
npm run build        # tsc --noEmit && vite build
npm run preview      # Preview del build
./deploy.sh          # Deploy a producción

# Code Quality
npm run lint         # ESLint
npm run lint:fix     # ESLint auto-fix
npm run format       # Prettier
npm run format:check # Prettier check
npm run check        # lint + format + tsc + test (TODO)

# Tests
npm test             # Vitest run (179 tests)
npm run test:watch   # Vitest watch
npm run test:coverage # Con cobertura
```

---

## 11. Convenciones del Código

- **Sin framework**: Vanilla TypeScript, sin React/Vue/Angular
- **SPA sin router URL**: Navegación por toggle de clases CSS en `<section>` elements
- **Estilos**: Un solo archivo `styles.css` (~2800 líneas), dark fantasy theme
- **Naming**: kebab-case para archivos, camelCase para variables/functions, PascalCase para clases
- **Exports**: Named exports (no default exports)
- **Types**: TypeScript interfaces para todos los contratos
- **Tests**: Vitest, archivos `*.test.ts` junto al módulo que testean
- **Commit style**: `feat:`, `fix:`, `chore:` (conventional commits)

---

## 12. Base de Datos (SQLite `game.db`)

| Tabla | Filas | Descripción |
|-------|-------|-------------|
| users | 1+ | phone PK, password_hash, created_at |
| profiles | 1+ | phone PK, data JSON (nft, game, characters), updated_at |
| stores | 5 | id PK, name, category, city, active, lat/lng, hours, description |
| promotions | 5 | id PK, store_id, name, description, banner_url |
| products | 5 | relacionado con promotions |
| invoice_codes | 11 | id PK, code, product_id, status, campaign_id |
| reward_history | 0+ | user_phone, invoice_code, reward_type, reward_id |

---

## 13. Archivos Importantes para Modificar

| Qué | Archivo |
|-----|---------|
| Agregar pantalla | `index.html` + `src/main.ts` + `src/game/navigation.ts` + `src/styles.css` |
| Nuevo sistema de juego | `src/game/*.ts` |
| Cambiar estilos | `src/styles.css` |
| Modificar backend | `server/index.js` |
| Cambiar flujo de auth | `src/game/api.ts` + `src/main.ts` |
| Agregar endpoint | `server/index.js` + `src/game/api.ts` |
| Modificar personajes | `src/game/characters.ts` + `src/game/nft.ts` |
| Modificar combate | `src/game/combat.ts` + `src/game/abilities.ts` |
| Agregar zona | `src/game/zones.ts` + `src/game/world.ts` |
| Modificar UI del juego | `src/game/game-ui.ts` |
| Landing page | `src/main.ts` (funciones landing) + `src/styles.css` (.landing-*) |
