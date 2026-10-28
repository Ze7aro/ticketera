# Fase 3 — Venta pública y órdenes pendientes

Este documento describe el cierre de la fase 3. La integración y las reglas actuales de pagos están en [fase 4](phase-4.md).

## Implementado

- Agenda pública con torneos publicados/pausados y fecha futura; los borradores no se exponen.
- Página `/eventos/[slug]` con fecha, zona horaria, lugar, condiciones y tipos de entrada activos.
- Selección de cantidades y formulario de nombre, apellido, DNI, email y teléfono, sin cuenta de comprador.
- Validación Zod en servidor: selección no vacía, sin tipos duplicados, cantidades enteras positivas, máximo por tipo y máximo total de 100 entradas por orden.
- Precios siempre leídos de PostgreSQL. La cotización del navegador sólo detecta cambios de precio y nunca fija el importe de la orden.
- Copia de nombre y precio del tipo en cada ítem para preservar el valor histórico.
- Creación PENDING y reserva de stock dentro de una transacción Serializable, protegida también por la restricción SQL de stock.
- Reintentos idempotentes mediante token de formulario aleatorio firmado y huella de los datos normalizados. Reutilizar el formulario con otros datos devuelve error.
- Resumen privado `/checkout/[token]`, con sólo hash del token en PostgreSQL. No muestra DNI, email ni teléfono. Sin indexación, sin analítica externa y con Referrer-Policy: no-referrer.
- CSRF/origen y límites persistentes de frecuencia en creación de órdenes; consultas de estado también limitadas.

## Reservas y expiración

La reserva vence a los 15 minutos, o antes si cierra la venta de alguna entrada o comienza el torneo. `sold` no aumenta todavía: sólo se incrementa `reserved`.

Las reservas vencidas sin preferencia de Mercado Pago se liberan al abrir el torneo, iniciar otra orden o consultar el resumen. La operación cambia el estado a EXPIRED y decrementa reserved en la misma transacción; las llamadas concurrentes no liberan dos veces. No hay cron ni cola: si nadie consulta, la limpieza se pospone hasta el siguiente acceso. Cada invocación procesa hasta 1.000 órdenes vencidas en lotes de 100; en un atraso mayor, la disponibilidad puede ser conservadora hasta la siguiente consulta, nunca superar el stock.

Las órdenes que ya tengan una preferencia de pago no se liberan por este mecanismo. **La fase 4 deberá conciliar las preferencias vencidas/pagos tardíos antes de liberar ese stock.** No habilitar cobros sin implementar esa regla.

Los formularios firmados caducan a los 30 minutos. La firma se liga al torneo y usa AUTH_SECRET; el token público de orden es aleatorio de 256 bits y su hash no depende de la rotación de esa clave. Los enlaces de orden son credenciales: no deben incluirse en registros de acceso, analítica o mensajes públicos al desplegar infraestructura adicional.

## Límite deliberado de esta fase

El formulario dice “Crear orden pendiente” y aclara que el pago online aún no está disponible. No hay botón que simule un cobro, webhook, confirmación PAID ni emisión de entradas. Los parámetros de retorno del navegador se ignoran como evidencia de pago.

## Verificación

Pruebas de integración contra `ticketera_test`: cálculo de total, stock reservado, precios/nombres históricos, lectura privada, reenvíos simultáneos, última entrada disputada, expiración concurrente, exclusión de preferencias no conciliadas, cambio de precio, máximos, tipos de otro evento, venta cerrada y ocultamiento de borradores.

Pruebas de navegador para móvil y escritorio: selección, datos del comprador, orden pendiente, ausencia de datos personales en el resumen, token desconocido y retorno falso `status=approved` que no confirma el pago.

Ejecutar `pnpm test:db`, `pnpm test`, `pnpm build` y `E2E_DATABASE=1 pnpm test:e2e` (en PowerShell: `$env:E2E_DATABASE='1'`). El fixture público existe únicamente en la base aislada de pruebas; no se publican torneos ficticios en la base de desarrollo.
