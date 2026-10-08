# AODASE Admin

Proyecto web administrativo independiente del juego. `index.html` contiene el panel y `admin-management-ui.js` los formularios de gestión.

Se sirve en http://localhost:3000 junto a la API compartida, mediante `npm --prefix admin run start`. No requiere compilar el juego. Para iniciar ambos proyectos desde la raíz, usar `npm run start`.

El juego usa su propio Vite en http://localhost:5173. En Ubuntu/Nginx, publicar este panel en `aodaseadmin.reinbor.cloud` y el `dist` del juego en `aodase.reinbor.cloud`, conservando `/api` del juego como proxy al backend. No ejecutar dos instancias del backend sobre el mismo puerto.
