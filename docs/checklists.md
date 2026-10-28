# Checklist de seguridad y publicación

## Base

- [x] TypeScript estricto y validación con Zod disponible.
- [x] Prisma sólo en servidor; secretos sin prefijo público.
- [x] Errores públicos sin detalles internos.
- [x] CSP con nonce, anti-framing, nosniff, referrer y permisos de cámara.
- [x] Moneda en centavos, índices únicos y restricciones SQL.
- [x] Migraciones aplicadas y verificadas contra PostgreSQL real local.

## Obligatorio antes de ventas

- [x] Auth.js con hash de contraseña, sesiones con expiración/revocación y cookies seguras.
- [x] Roles verificados en operaciones administrativas implementadas; extender al resto de fases.
- [ ] CSRF/origen y límites de frecuencia persistentes en login, compra, búsqueda de ventas y escaneo.
- [x] Compra transaccional con reservas, expiración y tratamiento de pagos tardíos.
- [x] Webhook con firma verificada y consulta directa a Mercado Pago (API simulada en pruebas).
- [x] Verificación de moneda, importe, cuenta, ambiente y asociación única del pago.
- [x] Idempotencia probada con webhooks repetidos y concurrentes.
- [ ] Ensayo externo con cuentas de Mercado Pago de prueba y conciliación programada activa.
- [x] QR aleatorio, hash, cifrado autenticado y ausencia de datos personales (pruebas automatizadas de fases 5/6 confirmadas).
- [x] Check-in atómico, registro de intentos y estados inválidos implementados (pruebas automatizadas confirmadas; cámara física pendiente).
- [x] Auditoría de modificaciones, emisión manual y anulaciones (fase 7; pruebas de regresión pendientes).
- [x] CSV protegido contra inyección de fórmulas (fase 7; prueba funcional pendiente).
- [ ] Emails verificados, reenvíos y fallos manejados.
- [ ] Flujos móviles y escritorio, roles y exportaciones de fase 7 probados.
- [ ] Cámara probada en Android/iPhone mediante HTTPS.
- [ ] Secretos de producción, backup/restauración y políticas de retención definidos.
- [x] Lint, tipos, formato y compilación de producción exitosos.
- [ ] Pruebas unitarias y E2E ejecutadas después de la fase 7.
- [ ] Dominio, webhook productivo y remitente verificado.
- [ ] Aprobación final del MVP y despliegue.
