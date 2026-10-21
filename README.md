# AODASE PETS

**Tu ciudad. Tu Pet. Tu evolución.** Cría criaturas únicas y conecta sus historias con negocios locales de cualquier categoría. Villavicencio, Meta, Colombia es la primera ciudad piloto.

El [GDD técnico vigente](docs/GDD-TECNICO-AODASE-PETS.md) desarrolla el plan urbano. La [guía de implementación](docs/IMPLEMENTACION-AODASE.md) explica el estado actual, la configuración y las pruebas. Los documentos anteriores de Foodie Pets conservan el historial del proyecto.

Estado y prioridades revisados el 20 de octubre de 2026: [estado del proyecto](ESTADO-PROYECTO.md) y [plan de desarrollo](PLAN_DESARROLLO.md). Las guías de entregas anteriores conservan resultados históricos.

## Disponible

- Portada y PWA AODASE PETS, con vista conceptual del universo urbano.
- Registro → huevo gratuito → cuidados → nacimiento → nombre persistente del Pet.
- Hábitat con seis reacciones animadas, colección, catálogo genético y misiones de bienvenida.
- Pets 3D de 14 especies, híbridos anatómicos, pelajes, marcas y colores de ojos combinables.
- Huevos nuevos: nacimiento a los 90 segundos o al tercer cuidado; cada Dar calor aporta +1 a todas las estadísticas.
- Taller experimental 3D: personalización, Random coherente, dados y dardo.
- Campo PvE horizontal con controles táctiles, flechas, Q/W/E/R y consumibles rápidos.
- Catálogo de negocios con 13 categorías, búsqueda y filtros de ciudad/categoría.
- Administración de negocios, productos, ofertas y canje de facturas.
- Conservación de mascotas, IDs, sesiones y QR existentes.

El mundo urbano ya incorpora cartografía de Villavicencio, edificios, misiones, extracción, fabricación y aventura guiada. Las visitas físicas verificadas, la evolución mediante ADN y el portal independiente de cada negocio siguen pendientes. La exploración virtual no acredita presencia física ni afiliación comercial de los lugares.

## Ejecutar

Requiere Node.js compatible con las dependencias instaladas. Desde la raíz:

```powershell
npm install
npm --prefix server install
npm run dev
```

Se inician Express en 3000 y Vite en 5173. Ejecutar sólo Vite provoca errores de proxy si el backend no está disponible. Para iniciarlos por separado, usa `npm run server` y `npm run dev:web` en dos terminales.

## Configuración

Configura las variables en el proceso que inicia el servidor; no hay carga automática de archivos .env en Express.

| Variable | Uso |
|---|---|
| JWT_SECRET | Obligatoria en producción; conservarla mantiene válidas las sesiones |
| PORT | Puerto del backend, 3000 por defecto |
| NODE_ENV | production exige JWT_SECRET; test permite una base aislada |
| AODASE_INCUBATION_MS | Maduración de huevos nuevos: 90000–604800000 ms, 90000 por defecto (90 segundos) |
| SEED_DEMO_DATA | true carga los negocios/facturas originales de demostración; desactivado por defecto |
| VITE_AODASE_WHATSAPP | Teléfono del contacto comercial con indicativo; variable del frontend |

La antigua variable `VITE_FOODIE_WHATSAPP` sigue disponible como alternativa. Los registros demo ya existentes se conservan y aparecen identificados como demostración. Una base nueva empieza sin negocios inventados.

## Verificar

```powershell
npm run build
npm run test
node --test server/foodie-integration.test.js server/guardian-domain.test.js server/guardian-integration.test.js server/urban-businesses.test.js server/aodase-integration.test.js
```

Las pruebas HTTP crean bases temporales y usuarios propios. `npm run test` incluye los contratos compartidos del catálogo urbano, la diversidad genética, la anatomía y el ciclo de animaciones. El historial de comprobaciones está en la guía de implementación. El [diseño de arte, genética y vida](docs/ARTE-GENETICA-Y-VIDA.md) explica esta ampliación.

## Arquitectura

| Carpeta | Responsabilidad |
|---|---|
| src/main.ts | Navegación, cuenta e integración de pantallas |
| src/game/ | Taller, hábitat, mundo 3D, colección y catálogo |
| shared/ | Apariencia, objetos y catálogo territorial compartidos |
| server/ | Express, autenticación, dominio, transacciones y administración |
| server/data/game.db | SQLite persistente, excluido de Git |
| public/ | PWA, iconos e ilustraciones |
| docs/ | GDD vigente, diseño anterior e implementación |

Frontend: TypeScript, Three.js y Vite. Backend: Express, SQLite, JWT y bcrypt. Los nombres internos anteriores permanecen por compatibilidad; no implican una restricción a negocios de comida.

Privado. Todos los derechos reservados.
