# Fase 2: autenticación y administración

## Alcance implementado

- Auth.js v5, versión exacta `5.0.0-beta.32` (el canal v5 sigue siendo beta).
- Login mediante email y contraseña, cierre de sesión y redirección según rol.
- Contraseñas scrypt: N=131072, r=8, p=1, sal aleatoria de 16 bytes y clave de 64 bytes.
- Sesión cifrada de Auth.js, expiración absoluta de ocho horas y comprobación del usuario vigente en PostgreSQL.
- Desactivar un controlador o cambiar su contraseña incrementa su versión de sesión y revoca accesos anteriores.
- Cookies HttpOnly y SameSite=Lax de Auth.js; Secure con HTTPS. Sólo se admite HTTP para localhost. En producción configurar APP_URL con HTTPS.
- CSRF de Auth.js/Server Actions y comprobación adicional de Origin contra APP_URL en mutaciones.
- Rate limiting atómico en PostgreSQL: login global, por email y por IP de plataforma cuando se ejecuta en Vercel; escrituras administrativas por usuario. No se confía en headers de IP arbitrarios.
- Panel responsive con torneos y controladores, paginación de veinte registros y estados claros.
- Crear y editar torneos, publicar, pausar ventas y finalizar. Un torneo finalizado no vuelve a editarse.
- Tipos de entrada: precio en ARS, stock, máximo por compra, período de venta y estado activo.
- Auditoría de cambios en la misma transacción. Control de formularios obsoletos y reintentos de transacciones serializables.
- Zona horaria IANA por torneo: formularios en hora local y almacenamiento en UTC. Se rechazan horas ambiguas/inexistentes de cambios horarios.

El escáner sigue siendo una pantalla protegida de preparación. No se implementan todavía compras, pagos, emisión de entradas, métricas comerciales ni exportaciones.

## Desarrollo local

Docker Desktop debe estar iniciado. Si todavía no existe `.env`:

```sh
pnpm local:setup
docker compose up -d --wait
pnpm db:deploy
pnpm db:seed
pnpm dev
```

`local:setup` genera claves aleatorias y no sobrescribe un `.env` existente. El administrador local se configura con ADMIN_EMAIL y ADMIN_PASSWORD en ese archivo. El seed crea la cuenta únicamente si no existe; no cambia la contraseña en ejecuciones posteriores ni convierte un controlador en administrador. No subir `.env` al repositorio.

PostgreSQL sólo escucha en 127.0.0.1:54329. El volumen `ticketera_postgres` conserva los datos al detener el contenedor. `docker compose stop` detiene el servicio sin borrar datos.

Para Neon, configurar DATABASE_URL y DIRECT_URL propios, AUTH_SECRET aleatorio de al menos 32 caracteres, APP_URL HTTPS y las credenciales iniciales del administrador. No ejecutar el preparador de bases locales contra Neon.

## Pruebas

```sh
pnpm test:db
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

`test:db` crea/migra exclusivamente `ticketera_test` en PostgreSQL local; requiere TEST_DATABASE_URL y rechaza que coincida con la base principal. Crea dos cuentas de prueba y revoca sus sesiones anteriores. El script borra únicamente los contadores de rate limiting de la base de prueba para aislar ejecuciones.

Para los flujos autenticados de Playwright, en PowerShell:

```powershell
$env:E2E_DATABASE = '1'
pnpm test:e2e
```

En shell POSIX: `E2E_DATABASE=1 pnpm test:e2e`. Playwright levanta su propio servidor en el puerto 3107 con la base de pruebas; no reutiliza el de desarrollo. Las cookies de prueba se guardan en `tests/.auth`, excluido de Git. Sin E2E_DATABASE, los recorridos autenticados se omiten explícitamente. Las pruebas de integración se omiten si no está configurado TEST_DATABASE_URL.

Las cuentas y contraseñas públicas dentro de las pruebas son exclusivas de `ticketera_test`; nunca se usan para la base principal. Los tests agregan registros identificables con nombres/UUID de prueba para no borrar registros ajenos.

## Decisiones

- Auth.js con Credentials requiere estrategia JWT; no se agregan tablas de sesiones OAuth innecesarias.
- Las páginas privadas y los servicios verifican permisos por separado. Ocultar enlaces no se utiliza como medida de autorización.
- El stock nunca puede bajar de vendido + reservado. La restricción SQL permanece como última defensa.
- Los cambios de precio sólo actualizan el tipo de entrada: las órdenes futuras deberán copiar el precio del servidor y las existentes conservarán su valor histórico.
- No se permite cambiar enlace, sigla o año UTC del torneo cuando ya existen entradas emitidas.
- Antes de publicar se exige al menos una entrada activa con stock y venta no vencida. Publicar en esta fase no habilita cobros: la venta pública llega en fase 3.
- Las contraseñas de los controladores se entregan manualmente por un canal privado. Recuperación automática de contraseñas no forma parte de esta fase.

Referencias: [Credentials de Auth.js](https://authjs.dev/getting-started/authentication/credentials), [autenticación en Next.js](https://nextjs.org/docs/app/guides/authentication).
