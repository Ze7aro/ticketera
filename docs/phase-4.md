# Fase 4 — Mercado Pago Checkout Pro

## Implementación

La orden pendiente ofrece **Pagar con Mercado Pago** cuando la configuración está completa. El servidor crea una preferencia con los precios históricos de la orden, ARS, referencia de orden, vencimiento y retorno al resumen privado. No se reciben datos de tarjetas en esta aplicación. Se usa redirección externa, sin SDK de navegador ni ampliación de scripts en la CSP.

Un marcador persistente impide crear dos preferencias simultáneamente. Si la respuesta se pierde, no se repite el POST: se conserva la reserva hasta conciliar. Un enlace ya guardado se reutiliza mientras la reserva sigue vigente. Las órdenes de importe cero no admiten cobro mediante este flujo.

El webhook verifica HMAC-SHA256, identificador de la URL, request ID y timestamp (segundos o milisegundos, tolerancia de cinco minutos). Consulta `/v1/payments/{id}` con el Access Token antes de modificar datos. Comprueba cuenta vendedora, ambiente, referencia, moneda e importe. No usa el cuerpo de la notificación ni los parámetros del retorno como prueba de pago.

La confirmación actualiza pago, orden y stock dentro de una transacción Serializable. La clave única del proveedor y un índice parcial de pago aplicado por orden evitan duplicar ventas. Se pueden registrar dos pagos realmente aprobados, pero sólo uno se acredita; el segundo queda identificado para devolución manual. Las actualizaciones antiguas del proveedor no reemplazan estados más recientes.

## Reservas y situaciones excepcionales

- Sin intento de pago: liberación habitual al consultar, cuando vence la reserva.
- Con intento de pago: consultar primero Mercado Pago. Se conserva la reserva mientras exista un pago pendiente, en proceso o en revisión, o falle la consulta.
- Sin pagos activos: después del vencimiento más cinco minutos de margen, una conciliación completa puede liberar la reserva. Una búsqueda vacía no garantiza que nunca aparecerá un pago tardío.
- Aprobación tardía tras liberar: se comprueba nuevamente el stock en una transacción; sólo se confirma si hay capacidad y el torneo no comenzó. Si no, pasa a `PAYMENT_REVIEW`, sin sobreventa, para resolución/devolución manual.
- Reembolsos, contracargos, disputas e inconsistencias requieren revisión. No se devuelve stock vendido automáticamente. Si ya existieran entradas válidas, se anulan al revertirse el pago aplicado. No se implementan reintegros automáticos.
- Una orden en revisión no se regulariza automáticamente aunque llegue otra notificación: la organización debe investigar el caso. La fase actual permite consultar y detectar incidencias, no alterar manualmente estados financieros.

## Configuración

Configurar sólo en el servidor, sin compartir los valores en chats o repositorios:

```dotenv
APP_URL="https://entradas.tu-dominio.com"
MERCADOPAGO_ACCESS_TOKEN=""
MERCADOPAGO_WEBHOOK_SECRET=""
MERCADOPAGO_COLLECTOR_ID=""
MERCADOPAGO_MODE="test"
CRON_SECRET=""
```

`MERCADOPAGO_COLLECTOR_ID` es el identificador numérico de la cuenta vendedora correspondiente al token. `MERCADOPAGO_MODE` debe ser explícitamente `test` o `live`; se valida también `live_mode` en los pagos. `CRON_SECRET` debe ser aleatorio y tener al menos 32 caracteres. APP_URL debe ser un origen HTTPS público sin rutas; localhost no habilita cobros.

1. Crear/configurar la aplicación Checkout Pro en Mercado Pago y sus cuentas de prueba.
2. Registrar la URL HTTPS `/api/payments/webhook` para notificaciones de **pagos**, y copiar la clave secreta de ese ambiente al servidor.
3. Configurar el token y el ID del vendedor del mismo ambiente. Reiniciar el servidor después de cambiar variables.
4. Hacer una compra con cuentas y medios de prueba: verificar el retorno, la notificación y la consulta del pago. Comprobar también rechazo, repetición y vencimiento. Las pruebas automatizadas usan un proveedor simulado; no sustituyen este ensayo externo.
5. Completar la emisión de entradas (fase 5) y el checklist antes de habilitar ventas reales. Cambiar a credenciales y modo `live` sólo al activar la operación productiva.

## Conciliación y operación

El comprador puede usar **Consultar pago en Mercado Pago**. El administrador dispone de `/admin/pagos`, con las últimas 50 órdenes con pago iniciado, IDs de pago, incidencias y consulta al proveedor. No se exponen datos personales en el resumen público.

Un programador externo puede invocar `GET /api/payments/reconcile` con `Authorization: Bearer <CRON_SECRET>`. Configurarlo cada minuto antes de activar ventas; este repositorio no instala ni publica un cron automáticamente. Procesa hasta diez órdenes por llamada, rotando por última consulta, y responde 503 si alguna falla para permitir alertas/reintentos. Revisa órdenes pendientes, pagadas y en revisión, además de otras cuya reserva venció durante los últimos siete días. Los webhooks siguen siendo la vía principal; el volumen del lote debe alcanzar el ritmo de órdenes antes de abrir ventas.

Si se pierde una notificación y no se ejecuta el programador, el estado y la liberación pueden quedar demorados hasta una consulta manual. Un webhook válido fuera de la ventana de cinco minutos será rechazado; la conciliación recupera su estado directamente del proveedor. No registrar tokens de orden, secretos, cuerpos de pagos ni URLs privadas en logs de infraestructura.

## Alcance y verificación

Esta fase confirma órdenes y contabiliza stock vendido. La numeración, QR, PDF y email pertenecen a la fase 5; la pantalla de pago aprobado lo aclara y no se presenta como entrada.

Pruebas con PostgreSQL aislado y API simulada cubren firmas, concurrencia, preferencia única, respuesta perdida, pago aprobado/rechazado, discrepancias, ambiente/cuenta incorrectos, reintentos, pagos tardíos con y sin capacidad, segunda aprobación, estados antiguos y reembolso. Se conservan las pruebas de fases anteriores.

Fuentes oficiales consultadas: [crear preferencia](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro-preferences/create-preference/post), [webhooks](https://www.mercadopago.com.mx/developers/en/docs/checkout-pro-preferences/additional-content/notifications/webhooks), [consulta de pagos](https://www.mercadopago.com.ar/developers/es/reference/online-payments/subscriptions/get-payment/get) y [búsqueda para conciliación](https://www.mercadopago.com.ar/developers/pt/reference/online-payments/checkout-pro-preferences/search-payments/get).
