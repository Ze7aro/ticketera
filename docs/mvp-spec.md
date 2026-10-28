# Desarrollo MVP — Sistema de venta de entradas para torneos de karate

Actúa como arquitecto de software y desarrollador full stack senior. Debes diseñar e implementar un MVP funcional para vender y controlar entradas de torneos de karate.

El sistema debe priorizar:

- Metodología KISS: soluciones simples, claras y mantenibles.
- Componentes reutilizables.
- Diseño responsive como requisito fundamental.
- Seguridad desde el diseño.
- Código limpio y tipado.
- Alcance cerrado de MVP.
- Facilidad de despliegue y mantenimiento.

No agregues funcionalidades fuera del alcance sin autorización. Si existe una alternativa sencilla y otra más sofisticada, utiliza la sencilla siempre que cumpla los requisitos de seguridad y negocio.

---

## 1. Stack tecnológico

Utiliza:

- Next.js con App Router.
- TypeScript en modo estricto.
- Tailwind CSS.
- shadcn/ui para componentes base.
- PostgreSQL.
- Prisma ORM.
- Auth.js para autenticación administrativa.
- Mercado Pago Checkout Pro.
- React Email y Resend para emails.
- Librería `qrcode` para generar códigos QR.
- Librería compatible con navegador para escanear QR.
- Zod para validaciones.
- Vitest para pruebas unitarias.
- Playwright para pruebas del flujo principal.
- Vercel para despliegue.
- PostgreSQL administrado, preferentemente Neon.

Mantén frontend, backend y panel administrativo dentro de un único proyecto Next.js.

---

## 2. Alcance del MVP

El sistema será utilizado inicialmente por una única organización, pero debe permitir crear múltiples torneos.

Debe incluir:

1. Página pública del torneo.
2. Selección de tipo y cantidad de entradas.
3. Formulario de datos del comprador.
4. Pago mediante Mercado Pago.
5. Confirmación automática mediante webhook.
6. Generación de entradas numeradas.
7. Un QR individual por asistente.
8. Descarga de la entrada.
9. Envío por email.
10. Panel administrativo.
11. Escáner web responsive para controlar el ingreso.
12. Exportación de ventas y asistentes a CSV.

El comprador no necesita crear una cuenta.

---

## 3. Roles

Implementa únicamente estos roles:

### Administrador

Puede:

- Crear y editar torneos.
- Activar o desactivar ventas.
- Crear tipos de entrada.
- Configurar precio, stock y fechas de venta.
- Consultar órdenes, pagos y entradas.
- Buscar entradas.
- Reenviar una entrada.
- Emitir entradas manuales.
- Anular entradas.
- Exportar información.
- Consultar estadísticas básicas.
- Administrar usuarios controladores.

### Controlador

Puede:

- Acceder al escáner.
- Validar entradas.
- Buscar manualmente una entrada.
- Consultar el resultado de una validación.

No puede modificar eventos, precios, ventas ni usuarios.

---

## 4. Flujo de compra

Implementa el siguiente flujo:

1. El comprador abre la página pública del torneo.
2. Selecciona el tipo y cantidad de entradas.
3. El sistema comprueba disponibilidad.
4. El comprador completa:
   - Nombre.
   - Apellido.
   - DNI.
   - Email.
   - Teléfono.
5. Se crea una orden en estado `PENDING`.
6. El backend crea una preferencia de Mercado Pago.
7. El comprador es redirigido a Checkout Pro.
8. Mercado Pago notifica el resultado mediante webhook.
9. El backend verifica la notificación directamente con Mercado Pago.
10. Si el pago está aprobado:
    - Cambia la orden a `PAID`.
    - Genera una entrada por cada asistente.
    - Descuenta el stock de forma transaccional.
    - Envía el email.
11. El comprador accede a una pantalla de confirmación y descarga.

La generación de entradas debe ser idempotente. Un webhook repetido nunca debe generar entradas duplicadas ni descontar stock nuevamente.

No confirmes una compra basándote únicamente en parámetros recibidos desde el navegador.

---

## 5. Entrada digital

Cada entrada debe incluir:

- Nombre del torneo.
- Fecha y horario.
- Lugar.
- Nombre del asistente o comprador.
- Tipo de entrada.
- Número visible.
- Código QR.
- Estado de la entrada.
- Condiciones básicas de acceso.

Formato sugerido para el número visible:

`SIGLA-AÑO-000001`

Ejemplo:

`KEN-2026-000482`

El número visible no debe utilizarse como credencial de seguridad.

El QR debe contener una URL o token criptográficamente impredecible. No debe contener DNI, email, teléfono, precio ni otros datos personales.

La entrada debe poder:

- Visualizarse desde el navegador.
- Descargarse como PDF o imprimirse correctamente.
- Abrirse desde un celular.
- Reenviarse por email desde el panel.

---

## 6. Validación mediante QR

Crear una pantalla específica `/scanner`, optimizada para celulares.

El proceso será:

1. El controlador inicia sesión.
2. Selecciona el torneo.
3. Autoriza el uso de la cámara.
4. Escanea el QR.
5. El backend valida la entrada.
6. Se muestra un resultado visual claro.

Estados posibles:

- Verde: entrada válida e ingreso registrado.
- Amarillo: entrada utilizada anteriormente.
- Rojo: entrada inexistente, anulada o inválida.
- Naranja: error de conexión o validación no completada.

Cuando una entrada sea válida, registrar:

- Fecha y hora.
- Usuario controlador.
- Torneo.
- Entrada.
- Resultado.
- Identificador opcional del dispositivo o puesto.

El check-in debe realizarse con una operación atómica para impedir que dos dispositivos validen la misma entrada simultáneamente.

La primera versión requiere conexión a internet. No implementar validación offline.

---

## 7. Panel administrativo

Crear un panel responsive con las siguientes secciones:

### Resumen

Mostrar:

- Entradas vendidas.
- Entradas disponibles.
- Recaudación aprobada.
- Pagos pendientes.
- Entradas utilizadas.
- Porcentaje de asistentes ingresados.

### Torneos

Permitir:

- Crear.
- Editar.
- Publicar.
- Pausar ventas.
- Finalizar.
- Configurar datos generales.

### Tipos de entradas

Permitir configurar:

- Nombre.
- Precio.
- Stock.
- Máximo por compra.
- Inicio y cierre de venta.
- Estado activo o inactivo.

### Ventas

Permitir:

- Buscar por nombre, DNI, email, orden o entrada.
- Filtrar por estado.
- Abrir el detalle de una orden.
- Consultar el identificador de Mercado Pago.
- Reenviar entradas.

### Entradas

Permitir:

- Consultar estado.
- Anular.
- Emitir manualmente.
- Descargar.
- Ver historial de validación.

### Exportación

Generar CSV de:

- Compradores.
- Órdenes.
- Entradas.
- Ingresos registrados.

---

## 8. Componentes reutilizables

No dupliques estructuras visuales o lógica.

Crear componentes reutilizables para:

- Botones.
- Inputs.
- Selectores.
- Formularios.
- Tablas responsive.
- Paginación.
- Filtros.
- Tarjetas de métricas.
- Estados y badges.
- Diálogos de confirmación.
- Alertas.
- Skeletons.
- Estados vacíos.
- Manejo de errores.
- Selector de cantidad.
- Tarjeta de tipo de entrada.
- Visualización de entrada.
- Resultado del escaneo.

Separar lógica de dominio en módulos:

- `events`
- `ticket-types`
- `orders`
- `payments`
- `tickets`
- `check-ins`
- `users`
- `notifications`

Evita crear abstracciones genéricas antes de tener al menos dos usos reales. Reutilización sí; ingeniería aeroespacial para vender entradas, no.

---

## 9. Responsive y accesibilidad

El sistema debe diseñarse primero para móvil.

Resoluciones mínimas a verificar:

- 360 px.
- 390 px.
- 768 px.
- 1024 px.
- 1440 px.

Requisitos:

- Ninguna pantalla debe producir scroll horizontal accidental.
- Botones táctiles de al menos 44 × 44 px.
- Formularios utilizables con una mano.
- Tablas convertidas en tarjetas o vistas compactas en móvil.
- Contraste suficiente.
- Estados que no dependan únicamente del color.
- Labels asociados a los campos.
- Navegación mediante teclado.
- Mensajes de error claros.
- Indicadores de carga durante pagos y validaciones.
- Confirmación antes de anular una entrada.

El escáner y la entrada digital deben funcionar especialmente bien en Android y iPhone.

---

## 10. Modelo de datos mínimo

Crear modelos equivalentes a:

- `User`
- `Event`
- `TicketType`
- `Order`
- `OrderItem`
- `Payment`
- `Ticket`
- `CheckIn`
- `AuditLog`

Estados sugeridos:

### Evento

- `DRAFT`
- `PUBLISHED`
- `SALES_PAUSED`
- `FINISHED`

### Orden

- `PENDING`
- `PAID`
- `REJECTED`
- `CANCELLED`
- `EXPIRED`

### Entrada

- `VALID`
- `USED`
- `CANCELLED`

### Pago

- `PENDING`
- `APPROVED`
- `REJECTED`
- `REFUNDED`

Utiliza claves únicas, relaciones, índices y restricciones de base de datos. Los estados críticos no deben depender solamente de validaciones del frontend.

---

## 11. Seguridad obligatoria

Implementa como mínimo:

- TypeScript estricto.
- Validación de todas las entradas con Zod.
- Autorización en backend para cada acción administrativa.
- Roles con principio de mínimo privilegio.
- Contraseñas procesadas por una solución segura de autenticación.
- Cookies `HttpOnly`, `Secure` y `SameSite`.
- Protección CSRF donde corresponda.
- Rate limiting en login, compra, búsqueda y validación.
- Verificación de origen cuando corresponda.
- Cabeceras de seguridad.
- Content Security Policy compatible con Mercado Pago.
- Variables sensibles únicamente en el servidor.
- Sanitización de datos visibles.
- Consultas parametrizadas mediante Prisma.
- Tokens QR aleatorios y no predecibles.
- Almacenamiento del hash del token si no se necesita recuperar el valor original.
- Expiración o rotación de sesiones.
- Logs sin datos financieros ni secretos.
- Auditoría de anulaciones, emisiones manuales y cambios importantes.
- Validación de firma del webhook si Mercado Pago la proporciona.
- Consulta del pago a Mercado Pago antes de aprobar una orden.
- Idempotencia en webhooks.
- Restricciones y transacciones para proteger stock e ingresos.
- Mensajes de error que no revelen información interna.

Nunca:

- Guardes datos de tarjetas.
- Confíes en el precio enviado por el navegador.
- Expongas credenciales de Mercado Pago.
- Incluyas datos personales dentro del QR.
- Confirmes una orden desde la página de retorno.
- Permitas cambiar el estado de una entrada únicamente desde el frontend.
- Registres secretos o payloads sensibles completos en logs.

---

## 12. Reglas de negocio

- Los precios se leen siempre desde la base de datos.
- El backend recalcula el total de la orden.
- No permitir cantidades negativas o superiores al máximo.
- No vender entradas fuera del periodo habilitado.
- No superar el stock.
- Cada pago aprobado debe corresponder a una única orden.
- Cada entrada debe tener un número y token únicos.
- Una entrada anulada no puede validarse.
- Una entrada utilizada no puede ingresar nuevamente.
- La emisión manual debe registrar administrador y motivo.
- La anulación debe registrar administrador, fecha y motivo.
- Utilizar zona horaria configurable para el torneo.
- Guardar fechas internamente en UTC.

---

## 13. Estructura sugerida

```text
src/
├── app/
│   ├── (public)/
│   │   ├── eventos/[slug]/
│   │   ├── checkout/
│   │   └── entrada/[token]/
│   ├── admin/
│   ├── scanner/
│   ├── auth/
│   └── api/
│       ├── payments/
│       ├── tickets/
│       └── check-ins/
├── components/
│   ├── ui/
│   ├── forms/
│   ├── tables/
│   └── tickets/
├── modules/
│   ├── events/
│   ├── orders/
│   ├── payments/
│   ├── tickets/
│   ├── check-ins/
│   └── users/
├── lib/
├── emails/
├── validations/
└── types/

prisma/
├── schema.prisma
└── seed.ts
```

La estructura puede ajustarse si existe una opción más simple, pero debe mantener separada la lógica de negocio de los componentes visuales.

---

## 14. Fases de implementación

### Fase 1 — Base del proyecto

- Crear proyecto.
- Configurar TypeScript, Tailwind y componentes.
- Configurar PostgreSQL y Prisma.
- Crear variables de entorno.
- Implementar layout responsive.
- Añadir linting, formateo y manejo centralizado de errores.

### Fase 2 — Autenticación y administración

- Implementar Auth.js.
- Crear roles.
- Proteger rutas y operaciones.
- Crear panel base.
- Implementar administración de torneos y tipos de entrada.

### Fase 3 — Venta pública

- Crear página pública del torneo.
- Implementar selección de entradas.
- Crear formulario del comprador.
- Validar stock y precios en servidor.
- Crear órdenes pendientes.

### Fase 4 — Pagos

- Integrar Mercado Pago Checkout Pro.
- Crear preferencia.
- Implementar retorno del comprador.
- Implementar webhook seguro e idempotente.
- Consultar y conciliar el pago.
- Confirmar la orden mediante transacción.

### Fase 5 — Entradas

- Generar numeración.
- Crear tokens QR.
- Generar vista imprimible y PDF.
- Crear pantalla de descarga.
- Enviar entradas por email.

### Fase 6 — Control de acceso

- Crear pantalla del escáner.
- Implementar validación atómica.
- Registrar check-in.
- Mostrar resultados claros.
- Añadir búsqueda manual como respaldo.

### Fase 7 — Reportes y cierre

- Crear métricas básicas.
- Implementar búsquedas y filtros.
- Exportar CSV.
- Añadir auditoría.
- Completar pruebas.
- Documentar y desplegar.

Después de cada fase:

1. Ejecuta lint.
2. Ejecuta verificación de tipos.
3. Ejecuta pruebas existentes.
4. Corrige errores antes de continuar.
5. Informa qué se completó y qué falta.

---

## 15. Pruebas obligatorias

Crear pruebas para:

- Cálculo del total en servidor.
- Límites de cantidad.
- Control de stock.
- Generación de números únicos.
- Generación y validación del token QR.
- Webhook repetido.
- Pago rechazado.
- Pago aprobado.
- Entrada anulada.
- Doble escaneo.
- Dos escaneos simultáneos.
- Acceso de controlador a rutas administrativas.
- Compra completa en viewport móvil.
- Compra completa en escritorio.
- Inicio de sesión administrativo.
- Exportación de información.

Utiliza mocks para integraciones externas en pruebas automatizadas.

---

## 16. Criterios de aceptación

El MVP se considera terminado cuando:

- Un administrador puede crear y publicar un torneo.
- Puede definir entradas, precios y stock.
- Un comprador puede comprar desde un celular.
- Mercado Pago puede confirmar el pago.
- El webhook repetido no duplica entradas.
- Se genera un QR individual por entrada.
- El comprador recibe y descarga sus entradas.
- Un controlador puede escanearlas desde un celular.
- La misma entrada no puede utilizarse dos veces.
- El administrador puede buscar, anular y exportar entradas.
- Las rutas están protegidas según el rol.
- No existen errores de TypeScript, lint o compilación.
- Los flujos críticos tienen pruebas.
- El proyecto puede desplegarse siguiendo el README.

---

## 17. Fuera del MVP

No implementar todavía:

- Aplicaciones móviles nativas.
- Funcionamiento offline.
- Asientos numerados.
- Cupones o promociones.
- Facturación electrónica.
- WhatsApp automático.
- Múltiples organizaciones o multi-tenancy.
- División automática de pagos.
- Programa de afiliados.
- Venta de productos.
- Inscripción de competidores.
- Gestión de categorías deportivas.
- Reintegros automáticos.
- Personalización visual avanzada por torneo.
- Microservicios.
- Redis, colas o caché distribuida salvo necesidad demostrable.

Diseña el código para que pueda evolucionar, pero no implementes anticipadamente estas funciones.

---

## 18. Entregables

Entregar:

- Código fuente completo.
- Migraciones de Prisma.
- Datos iniciales mediante seed.
- Archivo `.env.example` sin secretos.
- README con instalación, ejecución y despliegue.
- Instrucciones para configurar Mercado Pago.
- Instrucciones para configurar emails.
- Usuario administrador inicial configurable.
- Pruebas automatizadas.
- Checklist de seguridad.
- Checklist de publicación.
- Descripción breve de decisiones técnicas.
- Lista de funcionalidades pendientes para una futura versión.

Antes de comenzar a programar:

1. Inspecciona el repositorio existente.
2. Identifica configuraciones o código reutilizable.
3. Presenta un plan corto dividido por fases.
4. Enumera las decisiones que realmente necesiten confirmación.
5. No bloquees el trabajo por decisiones menores: adopta valores razonables y documéntalos.
6. Implementa una fase por vez.
7. No amplíes el alcance del MVP sin autorización.
