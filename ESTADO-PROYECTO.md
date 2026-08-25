# Reinos Ancestrales — Estado Actual

## Proyecto y URL

- **Nombre**: Reinos Ancestrales
- **URL principal**: https://3daodrag.reinbor.cloud/
- **Servicio systemd**: `reinos.service` (activo, corriendo desde 3 ago 2026)
- **Puerto de escucha**: 3002 (proxy nginx → 127.0.0.1:3002)
- **Entorno**: production, JWT_SECRET=reinbor-3daodrag-secret-2026

## Stack Tecnológico

| Capa | Tecnología | Detalle |
|------|-----------|---------|
| Frontend | Three.js + TypeScript + Vite 7.x | PWA instalable, offline support |
| Backend | Express 4.21 + better-sqlite3 + JWT + bcrypt | Puerto 3002, SQLite con WAL mode |
| 3D Engine | Three.js 0.179 | Renderizado WebGL |
| Build | Vite 7.x | Producción: dist/ (build: 2 ago 2026) |

## Endpoints API Publicas

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/register` | No | Crear cuenta |
| POST | `/api/login` | No | Iniciar sesión, JWT token |
| GET | `/api/profile` | Sí | Obtener perfil del jugador |
| PUT | `/api/profile` | Sí | Guardar perfil |
| GET | `/api/health` | No | Health check ( `{ok:true, time:ms}` ) |
| GET | `/api/stores` | No | Listar tiendas |
| GET | `/api/stores/:id` | No | Obtener tienda por ID |
| GET | `/api/promotions` | No | Listar promociones |
| GET | `/api/products` | No | Listar productos |

## Panel de Administración

### Acceso

- **URL**: `https://3daodrag.reinbor.cloud/admin` (sirve `admin.html` estático)
- **Login**: POST `/api/admin/login` con `{username, password}`
- **Username**: `ProyectosReinbor` (hardcoded en `server/index.js:353`)
- **Password**: `reinbor-2026` (bcrypt hash `.$2b$12$PjnSmnRKbXGoSZ4xvn64dOwEDAbgJmcVX7jP0glRuId4CIdR4HEku`)
- **Token**: JWT firmado con JWT_SECRET, role=`admin`, vigencia 24h, guardado en `localStorage`
- **Header auth**: `Authorization: Bearer <token>` en todas las peticiones admin

### Rutas Admin (`/api/admin/*`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/admin/stats` | Estadísticas generales (usuarios, tiendas, ingresos) |
| GET | `/api/admin/users` | Listar todos los usuarios |
| GET | `/api/admin/users/:phone` | Obtener usuario por teléfono |
| DELETE | `/api/admin/users/:phone` | Eliminar usuario |
| GET | `/api/admin/invoices` | Listar códigos de factura |
| GET | `/api/admin/stores` | Listar tiendas |
| GET | `/api/admin/stores/:id` | Obtener tienda por ID |
| DELETE | `/api/admin/stores/:id` | Eliminar tienda |
| POST | `/api/admin/stores` | Crear tienda |
| POST | `/api/admin/stores/:id/invoices` | Crear código de factura para tienda |
| POST | `/api/admin/login` | Autenticar admin, retornar token |

### Vista del panel (admin.html)

Panel SPA con navegación lateral y vistas:

- **Dashboard**: Resumen de usuarios, tiendas, facturas activas
- **Usuarios**: Lista, búsqueda, eliminación
- **Facturas**: Ver estado (AVAILADO/REDEEMED), códigos RA-2026-XXXXX, productos
- **Tiendas**: Ver/editar 5 tiendas registradas (Madrid, Barcelona, Sevilla, Valencia), categorías comida_rapida/restaurante/postres/cafeteria/panaderia

### Base de datos (SQLite `game.db`)

| Tabla | Filas | Columnas destacadas |
|-------|-------|---------------------|
| users | 1 | phone PK, password_hash, created_at |
| profiles | 1 | phone PK, data JSON (nft, game), updated_at |
| stores | 5 | id PK, name, category, city, active, lat/lng, hours, description |
| promotions | 5 | id PK, store_id, name, description, banner_url |
| products | 5 | (relacionado con promotions) |
| invoice_codes | 11 | id PK, code, product_id, status, campaign_id, created_at, redeemed_at |
| reward_history | 0 | user_phone, invoice_code, reward_type, reward_id, quantity, created_at |

### Estado de la Base de Datos

- **game.db**: SQLite con 9 tablas, modo WAL, foreign keys ON
- **1 usuario activo** (phone: `3228281708`), profile con nft=null, game=null
- **5 tiendas** registradas (Hamburguesas del Reino, Pizzería Imperial, Heladería Dragón Azul, Café Medieval, Panadería del Bosque)
- **11 códigos de factura** generados, todos status AVAILABLE (no redimidos)
- **0 recompensas** canjeadas en reward_history
- **Legacy db.json**: 2 usuarios (1234567890, 3228281708) — no usada en producción actual

### Funcionalidades Implementadas (Frontend)

- Generación determinista de personajes NFT desde hash de teléfono
- 6 elementos: fuego, agua, tierra, aire, sombra, luz
- 3 zonas progresivas: Villa, Bosque, Ruinas
- 7 quests: colección de recursos + eliminación de criaturas
- Crafting: 5 recetas con gestión de recursos
- Sistema QR rewards (QR Scanner + Barcode Detection API)
- Calidad gráfica automática (detectar dispositivo)
- Combat en tiempo real con IA de enemigos
- PWA: instalable, support offline

### Estado de Despliegue

- **Nginx**: proxy a `127.0.0.1:3002` para `3daodrag.reinbor.cloud`
- **HTTPS**: Let's Encrypt válido (fullchain/privkey)
- **HTTP/2**: habilitado
- **Cache headers**: gzip, varied, proxy_cache_bypass por Upgrade
- **Rutas proxy**: `/api/`, `/ws`, y raíz `/` proxy a Express en 3002
- **Admin**: nginx no proxya `/admin`, sirve el `admin.html` directamente desde el server Express

### Próximos pasos / Pendientes

1. **Autenticación frontend**: flujo login/register completo con JWT
2. **Persistencia de perfiles**: NFT y datos de juego en SQLite ya están en producción
3. **Sistema de inventario/crafting**: funcionalidad implementada pero sin UI completa
4. **Ampliar catálogo de tiendas**: actualmente 5, pueden agregarse más
5. **QR reward system**: escáner implementado, validación backend pendiente
6. **Panel admin enhancements**: vistas más detalladas, filtros, exportación

### Git Working Tree (modificaciones sin commitear)

- `index.html`: Texto en sección NFT cambiado ("Tu slime es unico..." en lugar de "Cada slime es unico...")
- `src/main.ts`: Eliminado `nftGenerateBtn` selector (botón de generar NFT removido del flujo)

### Último commit

`779c22b` — "Admin, slimes"