# Verificación de implementación y estado de fases

Última revisión: 2026-09-30.

Las fases 5 y 6 están implementadas; el usuario confirmó que la migración y los comandos automatizados (`test:db`, lint, typecheck, test, build, format y E2E) pasaron antes de iniciar fase 7. La revisión visual de PDF y la prueba de cámara física siguen pendientes. La fase 7 también está implementada, sin migración nueva. Lint, typecheck, build y format se volvieron a ejecutar tras los cambios de esta fase; sus pruebas unitarias/E2E de regresión y la revisión manual todavía deben ejecutarse. Los resultados detallados de la línea base que siguen describen las fases 1 a 4.

- Prisma 7.10: esquema válido y cliente generado.
- La migración de entradas de fase 5 aplicada a PostgreSQL local y las migraciones desplegadas correctamente, según ejecución confirmada por el usuario.
- Seed ejecutado más de una vez sin duplicar ni cambiar el administrador existente.
- Lint sin errores ni advertencias; TypeScript estricto y compilación de producción correctos.
- Vitest: 66 pruebas verificadas, con integración real con PostgreSQL: 46 de las fases anteriores y 20 de pagos. La pasada completa inicial de 64 casos pasó; después de agregar dos protecciones adicionales se repitió la suite de pagos y pasaron sus 20 casos.
- Playwright: 55 recorridos verificados a 360, 390, 768, 1024 y 1440 px: 40 existentes y 15 de estados de pago y permisos. La pasada completa tuvo 54 aprobados y una espera agotada durante el hash de contraseña del alta de controlador; se ajustó esa espera a 20 segundos y el recorrido restante pasó al repetirlo.
- Inspección visual de formularios administrativos y compra pública en móvil y escritorio durante las fases anteriores; revisión visual móvil del nuevo panel de pagos y de la pantalla de pago en revisión.
- Las pruebas E2E mantienen los cinco anchos de pantalla, corren con un worker para no competir por PostgreSQL local y esperan hasta 15 segundos por actualizaciones de interfaz. Las transacciones esperan hasta 10 segundos para comenzar. No se redujo la seguridad del hash de contraseñas ni se relajaron las comprobaciones de negocio.

## Cobertura

Errores públicos sin secretos, importes, zonas horarias, scrypt, validaciones, roles, expiración y revocación de sesiones, stock comprometido y restricciones SQL, auditoría, ediciones simultáneas, rate limiting concurrente y origen de solicitudes.

Órdenes: cálculo de precios en el servidor, reenvíos idempotentes, concurrencia sobre la última entrada, liberación de reservas vencidas, firmas y expiración del formulario, cambios de precio, límites de cantidad, torneos no disponibles y privacidad del resumen. Las reservas con intento de pago se liberan únicamente después de conciliar con el proveedor.

Pagos: preferencia única aun con concurrencia, respuesta perdida, firma HMAC y ventana temporal, consulta autenticada al proveedor, notificación repetida/concurrente, aprobación, rechazo, importe/moneda/cuenta/ambiente diferentes, fallos de consulta, pagos tardíos con y sin stock, segundo pago aprobado, notificaciones antiguas, reembolso y devolución de un duplicado sin revocar el pago original. La conciliación consulta por ID los intentos conocidos que no aparecen en la búsqueda. Las llamadas externas están simuladas; no se realizaron cargos reales.

Navegador: login de administrador y controlador, cookies HttpOnly/SameSite, rutas privadas, bloqueo del panel al controlador, repetición de una solicitud administrativa con credenciales de controlador, creación/edición/publicación/pausa/finalización de torneos, tipos de entrada, alta/desactivación de controladores y rechazo de su sesión previamente iniciada tras la desactivación. También se conservan los controles de la portada, navegación por teclado, desbordamiento horizontal y CSP.

Compra pública sin cuenta: selección de entradas, datos del comprador, creación y resumen de una orden pendiente, ausencia de datos personales en ese resumen y rechazo de una confirmación simulada mediante parámetros de URL. Un token desconocido muestra la página de no encontrada, sin resumen privado y con bloqueo de indexación; por el streaming, el estado HTTP inicial puede ser 200.

## Pendiente del MVP

La fase 7 requiere todavía pruebas unitarias/E2E de regresión y revisión funcional de exportaciones, emisión y anulación manual. También falta revisión visual de PDF y prueba de cámara física HTTPS. El cobro permanece pendiente de ensayo con cuentas de Mercado Pago de prueba, credenciales y APP_URL HTTPS público; además, falta configurar un programador que llame al endpoint de conciliación. Ver [fase 4](phase-4.md) y [fase 7](phase-7.md). No se desplegó ni se activó un programador externo.

Docker/PostgreSQL debe estar iniciado para ejecutar las operaciones administrativas. Las pruebas autenticadas usan exclusivamente `ticketera_test`; el servidor de Playwright usa el puerto 3107.
