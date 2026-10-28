# Fase 7 — Reportes y cierre

Estado: funcionalidad implementada; lint, tipos, compilación y formato pasan. La suite automatizada debe volver a ejecutarse después de estos cambios; quedan comprobaciones manuales de exportación y administración. Esta fase no requiere migración.

## Resumen

El inicio del panel permite filtrar por torneo y muestra entradas activas, disponibilidad de tipos activos en torneos publicados, recaudación de pagos aprobados, órdenes con pago iniciado, ingresos registrados y porcentaje de asistencia. Los importes se agregan en centavos y la asistencia excluye entradas anuladas.

## Ventas y búsqueda

`/admin/ventas` permite buscar por nombre, apellido, DNI, email, referencia de orden o número de entrada, y filtrar por torneo y estado. Conserva los filtros al cambiar de página. La búsqueda requiere ADMIN, valida los filtros y aplica rate limit persistente.

## Exportaciones

`/admin/reportes` ofrece CSV de órdenes/compradores, entradas y validaciones. Se puede exportar un torneo o todos. La descarga sólo está disponible para ADMIN, aplica rate limit, se registra en auditoría y lleva `no-store`. Los archivos se transmiten en lotes para no cargar el conjunto completo en memoria.

Las celdas se escapan como CSV y se neutralizan los valores de texto que podrían iniciar fórmulas de hoja de cálculo. El archivo de órdenes contiene DNI, email y teléfono; tratá esos datos como información personal.

## Emisión manual, anulación y auditoría

Un administrador puede emitir una entrada de boletería durante el período habilitado de un torneo publicado. Se usa la misma serie de numeración, se descuenta stock en la transacción y se requiere motivo. La entrada se puede abrir desde el panel y validar como cualquier otra. El pago presencial se registra fuera de la plataforma.

Sólo se pueden anular entradas válidas y aún no utilizadas; se requiere motivo, confirmación y se deja una acción de auditoría. La anulación bloquea el acceso y no procesa una devolución ni libera automáticamente la unidad de stock. Una entrada usada no se puede anular desde esta herramienta.

`/admin/auditoria` muestra acciones administrativas recientes. El historial individual de escaneos está en el detalle de la orden y en el CSV de ingresos.

## Validación para ejecutar

Desde PowerShell, en la raíz del proyecto:

```powershell
pnpm test:db
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
$env:E2E_DATABASE = '1'
pnpm test:e2e
```

No hay migración nueva en esta fase. Después, revisar manualmente:

1. Comparar el tablero global y el de un torneo con ventas, reservas, pagos aprobados e ingresos; confirmar que reembolsos/anulaciones no se cuenten como ingresos o asistencia.
2. Buscar una orden por email, DNI y número de entrada; combinar torneo y estado, y cambiar de página sin perder los filtros.
3. Descargar los tres CSV, con y sin filtro de torneo. Abrirlos en una hoja de cálculo y revisar tildes, fechas y columnas. Para probar inyección de fórmulas se necesita un registro de prueba cuyo texto comience con `=`, `+`, `-` o `@`; debe mostrarse como texto.
4. Emitir una entrada de prueba en boletería. Comprobar número, decremento de disponibilidad, enlace, check-in y auditoría. Probar también tipo vencido, torneo pausado y stock agotado; deben rechazarse.
5. Anular una entrada vigente con motivo, intentar validarla y comprobar el registro de auditoría. Una entrada ya utilizada debe rechazarse. Confirmar que el mensaje deja claro que la devolución se tramita fuera del sistema.
6. Iniciar sesión como controlador e intentar abrir ventas, reportes, auditoría y exportaciones; todos deben denegar acceso.
7. Revisar 360 px y escritorio, sin desbordamiento horizontal.

Las pruebas automatizadas usan la base aislada `ticketera_test` y no ejecutan cobros ni envían correo real. E2E recorre los cinco anchos configurados en serie para evitar saturar PostgreSQL local; puede tardar más que la ejecución con varios workers.
