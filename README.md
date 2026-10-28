# Ticketera Kenshukan

MVP para venta y control de entradas de torneos de karate, en un único proyecto Next.js.

## Estado actual

Fases 1 a 4 implementadas: base responsive, PostgreSQL/Prisma, autenticación administrativa, roles, panel de torneos y tipos de entrada, gestión de controladores, auditoría, venta pública, reservas y pagos con Mercado Pago Checkout Pro.

Las fases 5 y 6 están implementadas y su migración y pruebas automatizadas fueron confirmadas: entradas numeradas, QR, PDF, correo con reintentos, escáner móvil, búsqueda manual y check-in atómico. La revisión visual de PDF y la prueba de cámara en un teléfono siguen pendientes. La fase 7 agrega métricas, búsqueda de ventas, exportaciones CSV, auditoría y emisión/anulación manual; sus pruebas automatizadas y revisión funcional están pendientes. No requiere migración. Seguí [fase 5](docs/phase-5.md), [fase 6](docs/phase-6.md) y [fase 7](docs/phase-7.md). Para la cámara en teléfonos se necesita HTTPS. El cobro requiere Mercado Pago, APP_URL HTTPS y una clave de entradas válida.

[Requisitos originales](docs/mvp-spec.md) · [Fase 2 y decisiones](docs/phase-2.md) · [Fase 3: órdenes y reservas](docs/phase-3.md) · [Fase 4: pagos y configuración](docs/phase-4.md) · [Fase 5: entradas](docs/phase-5.md) · [Fase 6: control de acceso](docs/phase-6.md) · [Fase 7: reportes y operación](docs/phase-7.md) · [Verificación](docs/verification.md) · [Checklists](docs/checklists.md)

## Instalación local

Requisitos: Node.js >=20.19, pnpm 10 y Docker Desktop iniciado (o PostgreSQL propio).

```sh
pnpm install --frozen-lockfile
pnpm local:setup
docker compose up -d --wait
pnpm db:generate
pnpm db:deploy
pnpm db:seed
pnpm dev
```

Abrir http://localhost:3000. El acceso del equipo está en `/auth/login` y el panel en `/admin`.

`local:setup` genera `.env` con conexiones locales y claves aleatorias; no sobrescribe archivos existentes. Consultar ADMIN_EMAIL y ADMIN_PASSWORD en ese archivo para ingresar. Nunca subir `.env` a Git. El seed es idempotente: no cambia la contraseña ni el rol de una cuenta existente. También crea un torneo de ejemplo en borrador, con entradas inactivas.

PostgreSQL local escucha sólo en 127.0.0.1:54329. `docker compose stop` detiene la base sin borrar el volumen.

Para usar Neon u otro PostgreSQL, copiar `.env.example` a `.env` y completar DATABASE_URL, DIRECT_URL, AUTH_SECRET (aleatorio, mínimo 32 caracteres), APP_URL y las credenciales iniciales del administrador. Mantener TLS verificado. DATABASE_URL puede ser agrupada y DIRECT_URL debe ser directa para migraciones. Usar HTTPS en APP_URL fuera de localhost.

## Comandos de verificación

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

Para pruebas con PostgreSQL local aislado y navegador:

```sh
pnpm test:db
pnpm test
pnpm build
pnpm exec playwright install chromium
```

En PowerShell:

```powershell
$env:E2E_DATABASE = '1'
pnpm test:e2e
```

En shell POSIX: `E2E_DATABASE=1 pnpm test:e2e`.

El preparador crea únicamente `ticketera_test` en el PostgreSQL local; nunca usa datos de producción. Playwright usa esa base y un servidor propio en el puerto 3107. Las pruebas autenticadas cubren los cinco anchos: 360, 390, 768, 1024 y 1440 px. Sin TEST_DATABASE_URL se omiten las pruebas de integración; sin E2E_DATABASE se omiten los recorridos autenticados, indicando el motivo. Ver [detalle de pruebas y cuentas de test](docs/phase-2.md).

## Stack y decisiones

- Next.js App Router, TypeScript estricto, Tailwind 4 y componentes base compatibles con shadcn/ui.
- PostgreSQL, Prisma 7 y adaptador pg; conexión exclusivamente desde servidor.
- Auth.js Credentials v5, versión beta exacta fijada, sesiones cifradas y scrypt para contraseñas.
- Roles ADMIN y CONTROLLER comprobados en páginas y servicios. Desactivación/cambio de contraseña revoca sesiones anteriores.
- Rate limiting atómico en PostgreSQL, CSRF/origen, cookies seguras, CSP con nonce y errores sin información interna.
- Importes enteros en centavos, ARS; fechas UTC con zona IANA por torneo.
- Transacciones serializables, detección de edición obsoleta y auditoría transaccional.
- Stock vendido y reservado separado, con restricción SQL que impide superar disponibilidad.
- Confirmación de pagos con firma, consulta directa al proveedor e idempotencia transaccional. Los datos de tarjetas no pasan por esta aplicación.
- Numeración, tokens y check-ins usan claves, índices y operaciones de servidor; la aceptación real sigue pendiente de validación en base y navegador.

Las reservas sin intento de pago vencen y se liberan al consultar. Las demás requieren conciliación; pagos tardíos sin capacidad quedan en revisión, sin sobreventa. Hay un único pago aplicado por orden, aunque se registran pagos duplicados para revisión manual. Los QR usan hash para búsqueda y token cifrado recuperable para reimpresión, con un único ingreso aceptado por entrada.

## Servicios externos

**Mercado Pago, fase 4:** integración implementada y probada con proveedor simulado. Configurar credenciales, vendedor, modo, webhook HTTPS y conciliación programada según la [guía de pagos](docs/phase-4.md). Realizar el ensayo con cuentas de prueba antes de activar ventas. La página de retorno nunca confirma la venta por sus parámetros.

**Resend, fase 5:** verificar dominio y DNS; configurar `RESEND_API_KEY`, `EMAIL_FROM` y el programador de envíos según la [guía de entradas](docs/phase-5.md). La integración está preparada y pendiente de validación; no se enviaron correos reales.

## Despliegue en Vercel

1. Conectar el repositorio con preset Next.js.
2. Configurar PostgreSQL administrado y variables por ambiente. Previews separados de producción.
3. Ejecutar `pnpm db:deploy` y el seed inicial desde un entorno seguro; no migrar en cada build de preview.
4. Instalación: `pnpm install --frozen-lockfile`. Compilación: `pnpm build`.
5. Configurar APP_URL HTTPS del dominio y AUTH_SECRET aleatorio. Cookies Secure se habilitan con HTTPS.
6. Configurar el webhook y un programador que invoque `/api/payments/reconcile` con CRON_SECRET, según la guía de pagos.
7. Completar entradas, control y el [checklist](docs/checklists.md) antes de publicar como ticketera operativa.

## Pendiente de validación operativa

Fase 7 implementada; lint, tipos, compilación y formato pasan. Ejecutar pruebas unitarias y E2E de regresión y completar los casos manuales de [fase 7](docs/phase-7.md). Revisar visualmente los PDF y probar cámara en teléfono con HTTPS. Antes de ventas reales faltan el ensayo de Mercado Pago con cuentas de prueba, credenciales y webhook productivos, remitente verificado, copias de seguridad y despliegue.

Fuera del MVP: offline, apps nativas, asientos, cupones, facturación, WhatsApp, multiempresa, pagos divididos, productos, inscripción de competidores y reintegros automáticos.
