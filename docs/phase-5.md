# Fase 5 — Entradas digitales y correo

Estado: implementación preparada; pendiente de aplicar la quinta migración, ejecutar las pruebas con PostgreSQL y navegador y revisar los PDF generados. No se enviaron correos reales.

## Emisión

La confirmación del pago genera una entrada por unidad, dentro de la misma transacción que confirma la orden y el stock. Número, hash, token cifrado y registro de envío inicial quedan persistidos juntos. La marca de emisión y la unicidad de orden/ítem/ordinal impiden duplicaciones. También se pueden completar órdenes confirmadas en fases anteriores al consultar su resumen o conciliar de nuevo su pago, siempre que exista un pago aplicado y aprobado.

La numeración es `SIGLA-AÑO-000001`. El año usa la zona horaria del torneo y la serie se comparte entre torneos con la misma sigla/año. El prefijo se conserva desde la primera emisión, aunque luego cambien datos del torneo. No se reutilizan números de entradas anuladas.

Cada QR contiene únicamente una URL con un token aleatorio de 256 bits. No contiene nombre, DNI, email, teléfono ni importe. PostgreSQL guarda su hash para buscarlo y una copia cifrada con AES-256-GCM para reimpresión y reenvío; el cifrado está ligado al ID de la entrada.

## Acceso y descarga

- Resumen privado de la orden: enlaces individuales de las entradas emitidas.
- `/entrada/[token]`: torneo, fecha, lugar, titular de la compra, tipo, número, condiciones y QR.
- `/api/tickets/[token]/pdf`: PDF descargable, sin caché y sin indexación. Rechaza entradas anuladas, utilizadas o de órdenes cuyo pago ya no está confirmado.
- Vista imprimible: oculta navegación y botones. Las condiciones largas continúan en páginas adicionales en el PDF, sin truncarlas.
- La página pública muestra el estado actual; un QR guardado anteriormente no demuestra validez. El escaneo y el check-in atómico están en la fase 6 y deben validarse antes de operar.

El PDF usa Noto Sans latino embebido, de licencia abierta. Cubre español y caracteres latinos del archivo de fuente; los caracteres fuera de ese repertorio se representan con `?` en el PDF. La vista web conserva el texto original. Revisar nombres que requieran otros alfabetos antes de usar esta versión en ese contexto.

## Clave de entradas

Para la instalación existente:

```powershell
pnpm tickets:setup
```

El comando crea `TICKET_ENCRYPTION_KEY` en `.env` sin imprimirla y conserva una clave válida existente. Para nuevas instalaciones, `local:setup` la genera junto con las demás claves. Es independiente de AUTH_SECRET.

**Respaldar la clave junto con la base de datos.** No reemplazarla: las entradas y los emails ya cifrados dependen de ella. Esta fase no implementa rotación con recifrado. La configuración de pagos requiere una clave válida antes de permitir nuevos cobros.

## Emails

Se usa React Email para HTML y texto, y la API de Resend desde el servidor. El correo incluye enlaces privados a cada entrada; los PDF se descargan desde esos enlaces. No contiene datos de tarjetas ni DNI.

Configurar `RESEND_API_KEY`, `EMAIL_FROM` (email simple de un dominio verificado) y APP_URL HTTPS. Sin configuración no se llama al proveedor y los registros de envío permanecen pendientes. La compra y sus entradas siguen disponibles para descargar.

Los envíos se registran en PostgreSQL, sin Redis ni una cola externa. Un bloqueo temporal impide procesar simultáneamente el mismo envío. El contenido se congela y se guarda cifrado al primer intento, con una clave de idempotencia estable en Resend. Cambiar el nombre del torneo o el remitente no cambia un reintento ya iniciado.

Se reintenta con espera creciente hasta cinco intentos. Después de 23 horas desde el primer intento, un envío incierto pasa a revisión: Resend conserva las claves de idempotencia por 24 horas, por lo que reintentar automáticamente fuera de ese plazo podría duplicar el correo. Una respuesta aceptada por Resend se muestra como **Aceptado por el proveedor**, no como entrega confirmada en la bandeja del comprador.

El administrador tiene `/admin/entradas` y el detalle por orden. Puede abrir las mismas entradas, consultar los últimos envíos y solicitar un reenvío al email original del comprador, con confirmación, límites de frecuencia y auditoría. El reenvío crea otra solicitud de correo; no cambia números ni QR. Antes de reenviar un caso incierto, comprobarlo en Resend. No se implementa cambio de destinatario ni envío a direcciones arbitrarias.

## Recuperación y tareas periódicas

Configurar un programador externo para llamar cada minuto a `GET /api/notifications/dispatch` con `Authorization: Bearer <CRON_SECRET>`. Procesa hasta diez registros por llamada; revisar su capacidad y sus respuestas antes de activar ventas. No se instaló un programador automáticamente.

El webhook de pagos intenta entregar el correo después de confirmar la transacción. Un error de correo no revierte ni oculta el pago. Si el proceso se interrumpe, el registro pendiente permite recuperarlo mediante el programador o un reenvío administrativo. Los pagos conciliados también crean su registro de correo, que procesa el programador.

## Validación local pendiente

Con Docker Desktop iniciado y desde la raíz del proyecto:

```powershell
pnpm tickets:setup
docker compose up -d --wait
pnpm db:generate
pnpm db:deploy
pnpm test:db
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
$env:E2E_DATABASE = '1'
pnpm test:e2e
```

Detenerse ante un error y conservar su salida. La base de pruebas debe ser `ticketera_test`, separada de desarrollo. Playwright deshabilita expresamente Resend y usa una clave de cifrado exclusiva de prueba. Las integraciones externas se simulan: estos comandos no realizan cobros ni envían emails reales.

Vitest genera `tmp/pdfs/ticket-sample.pdf` y `tmp/pdfs/ticket-long-sample.pdf` para inspección visual. Playwright genera capturas de pantalla y PDF en los cinco anchos configurados. Las muestras de Vitest se conservan fuera de la carpeta que Playwright limpia al comenzar.

Antes de producción faltan el ensayo de entrega con dominio verificado, revisar visualmente los PDF, validar el escáner y cerrar el checklist general. No confundir la existencia del QR con un control de acceso operativo.

Fuentes: [idempotencia de Resend](https://resend.com/docs/dashboard/emails/idempotency-keys), [render de React Email](https://react.email/docs/utilities/render), [PDF-LIB](https://pdf-lib.js.org/).
