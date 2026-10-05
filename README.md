# Foodie Pets

Colecciona personajes únicos y mejóralos con compras verificadas en restaurantes. Incluye portada, ruleta de elementos, nombre personalizado, dardo inicial, colección y canje de facturas. El mundo 3D original permanece como actividad secundaria.

Consulta [DESARROLLO-FOODIE-PETS.md](DESARROLLO-FOODIE-PETS.md) para conocer el avance, ejecutar la versión local y revisar lo pendiente. La documentación del RPG que sigue corresponde al sistema heredado.

## Tech Stack

- **Frontend**: Three.js + TypeScript + Vite
- **Backend**: Express + JWT + bcrypt
- **Build**: Vite 7.x, TypeScript 5.x
- **3D Engine**: Three.js 0.179

## Quick Start

```bash
# Install dependencies
npm install
cd server && npm install && cd ..

# Start development (frontend + backend)
npm run dev     # Frontend (5173) + backend (3000)
# npm run start does the same

# Or start separately, in two terminals
npm run dev:web  # Frontend only (port 5173)
npm run server   # Backend only (port 3000)
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend and backend together |
| `npm run dev:web` | Start Vite only (requires a running backend) |
| `npm run server` | Start Express backend |
| `npm run start` | Same as `npm run dev` |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Preview production build |

## Environment Variables

Create `.env` in the server directory:

```env
JWT_SECRET=your-secret-key-here
PORT=3000
NODE_ENV=production
```

## Project Structure

```
3daodrag/
├── src/                    # Frontend TypeScript
│   ├── main.ts            # App entry, login, NFT creation
│   ├── styles.css         # All CSS styles
│   └── game/
│       ├── game.ts        # Core game loop, combat, UI
│       ├── world.ts       # Zone generation, enemies, NPCs
│       ├── nft.ts         # NFT character system
│       ├── profile.ts     # Player profile, inventory, quests
│       ├── input.ts       # Keyboard + touch joystick
│       ├── api.ts         # HTTP client for auth
│       ├── zones.ts       # Zone config, proximity detection
│       ├── rewards.ts     # QR reward system
│       ├── qr-scanner.ts  # Camera QR scanner
│       └── quality.ts     # Graphics quality settings
├── server/
│   ├── index.js           # Express server
│   └── data/db.json       # JSON database
├── public/                # PWA assets
├── dist/                  # Production build
└── DESAFIO.txt            # Development roadmap
```

## Game Features

- **NFT Characters**: Deterministic generation from phone hash
- **Combat**: Real-time action with enemy AI
- **3 Zones**: Village, Forest, Ruins (progressive unlock)
- **7 Quests**: Resource collection + creature kills
- **Crafting**: 5 recipes with resource management
- **QR Rewards**: Bridge between physical commerce and game
- **PWA**: Installable, offline support

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/register` | No | Create account |
| POST | `/api/login` | No | Login |
| GET | `/api/profile` | Yes | Get profile |
| PUT | `/api/profile` | Yes | Save profile |
| GET | `/api/health` | No | Health check |

## License

Private - All rights reserved.
