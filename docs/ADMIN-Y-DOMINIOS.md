# Administración y dominios

El administrador se almacena en `admin_accounts` de SQLite con bcrypt. La contraseña no se incluye en el código ni en la configuración pública. Las páginas se mantienen separadas: juego en la raíz del proyecto y panel en `admin/`. El acceso local es http://localhost:3000/.

El panel existente incluye usuarios, negocios, facturas y recompensas. La sección de gestión permite cambiar contraseñas de jugadores, editar nombre, descripción, horario, ubicación y actividad de negocios, consultar equipo y entregar o retirar ítems de inventarios. Retirar un ítem también lo desequipa. Estos cambios de cuenta e inventario quedan en `admin_audit`. No se ofrecen consultas SQL arbitrarias ni edición de estadísticas del catálogo desde el navegador.

## Publicación pendiente de acceso al alojamiento

Preparados los dominios `aodase.reinbor.cloud` y `aodaseadmin.reinbor.cloud`. `deploy/nginx-aodase.conf` separa ambos, bloquea rutas administrativas en la web pública y sirve el dist del juego como sitio estático y envía la API y el panel al proceso de Node local. En producción el servidor también identifica el dominio administrativo y sirve allí el login en `/`.

Para publicar se requiere confirmar proveedor, servidor y DNS. Crear los registros A/AAAA correctos, instalar dependencias raíz y servidor, generar `dist` con `npm run build`, cargar las variables de `deploy/production.env.example` y ejecutar Node mediante el gestor de procesos del alojamiento. El puerto 3000 debe quedar interno. La configuración de Nginx incluye dos sitios separados por dominio. Antes de exponerlos, instalar certificados TLS y habilitar HTTPS en ambos; no usar el acceso administrativo público por HTTP. El despliegue definitivo se hará después en el VPS de Hostinger con Ubuntu. Ambos sitios comparten el backend y SQLite, pero el dominio administrativo no sirve la página del juego.

Usar un secreto JWT propio y un directorio de datos persistente. La base local no se copia automáticamente al alojamiento. Para crear el administrador allí, cargar temporalmente `ADMIN_USERNAME` y `ADMIN_PASSWORD` en el entorno y ejecutar `node server/provision-admin.js`; retirar después la variable de contraseña. La misma herramienta permite cambiar el acceso administrador. Conservar copias de seguridad de SQLite antes de migrar.

## Prueba local

Ejecutar `npm run start` una sola vez y mantener abierta la terminal. Web: http://localhost:5173. Panel: http://localhost:3000/. Reiniciar el proceso cuando cambie código del servidor. La prueba aislada de permisos e inventario se ejecuta con `node --test server/admin-management.test.js`; utiliza una base en memoria y cuentas ficticias.

## Edición y eliminación

Los listados de Usuarios, Facturas y Tiendas incluyen Editar y Eliminar. Usuarios: contraseña opcional, nombres de mascotas y monedas del mundo; el teléfono de acceso se conserva como identificador. Tiendas: nombre, categoría, descripciones, horario, coordenadas y actividad. Facturas: campaña, nota administrativa y estado; no se convierte manualmente una factura en canjeada ni se reabre un canje.

Eliminar una factura la oculta y conserva un registro cancelado o canjeado para impedir reutilización; no revierte premios. Eliminar una cuenta borra sus datos dependientes y conserva consumidos los códigos ya canjeados. Eliminar una tienda limpia sus referencias de compra antes de borrar sus productos y facturas dependientes. Las nuevas operaciones de usuarios, facturas y eliminación de tiendas tienen auditoría. Las pruebas utilizan SQLite en memoria y no eliminan registros reales.
