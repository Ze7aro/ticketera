# Fase 6 — Control de acceso

Estado: implementación preparada; pendiente ejecutar validaciones y probar la cámara en un teléfono mediante HTTPS. Usa el modelo `CheckIn` que ya existe en la migración inicial, así que esta fase no agrega una migración.

## Escaneo y búsqueda

- `/scanner` está protegido para ADMIN y CONTROLLER. El selector sólo muestra torneos publicados, pausados o finalizados.
- La cámara usa `getUserMedia` y `jsQR` en el navegador. Los cuadros de cámara se procesan localmente; al detectar un QR se envía sólo el contenido leído al servidor.
- Se puede pegar el QR como URL o token si el navegador no permite usar la cámara.
- La búsqueda manual encuentra por número visible o nombre del asistente, limitada a diez resultados. No muestra DNI, email ni teléfono. Sólo considera entradas de órdenes pagadas o emisiones manuales.
- Las Server Actions comprueban sesión activa y rol, origen y rate limit persistente por usuario. El servicio vuelve a comprobar que el torneo esté habilitado.

## Check-in

El servidor obtiene la entrada por el hash del token QR y registra todos los resultados en `CheckIn`. La operación serializable cambia el estado de `VALID` a `USED` de forma condicional; una entrada sólo admite una aceptación, incluso ante dos lecturas simultáneas. La clave parcial de PostgreSQL que limita a una aceptación por entrada añade una segunda barrera.

Resultados visibles y anunciados para lectores de pantalla: ingreso registrado, ya utilizada, no válida, anulada o perteneciente a otro torneo. El resultado incluye número y nombre sólo después de una lectura/búsqueda, no en el token QR. Los reintentos también quedan registrados con su controlador.

## Validación que debe ejecutar el operador

Desde PowerShell en la raíz del proyecto, una vez completada la fase 5:

```powershell
pnpm db:generate
pnpm db:deploy
pnpm lint
pnpm typecheck
pnpm test:db
pnpm test
pnpm build
pnpm format:check
$env:E2E_DATABASE = '1'
pnpm test:e2e
```

Los comandos automatizados son locales y no realizan cobros ni envían correos reales. Después, iniciar el sitio con `pnpm dev`, iniciar sesión como controlador y revisar `/scanner`:

1. Escanear una entrada válida: debe registrarse el ingreso y la entrada debe cambiar a utilizada.
2. Escanearla otra vez o buscar su número y comprobarla: debe indicarse que ya fue utilizada.
3. Probar un QR inválido, uno anulado y uno de otro torneo; ninguno debe permitir el ingreso.
4. Buscar por nombre y registrar la entrada desde el resultado.
5. Abrir dos sesiones/dispositivos y leer simultáneamente la misma entrada: sólo uno debe recibir aceptación.
6. Confirmar que un controlador no puede abrir `/admin` y que la pantalla sigue usable en 360 px sin desbordamiento horizontal.
7. En Android/iPhone, abrir la URL HTTPS, conceder acceso a la cámara y escanear. `localhost` en el equipo de desarrollo no prueba permisos de cámara en otro dispositivo.

Si una comprobación falla, conservar la salida y no activar el control en el evento. No se realizaron pruebas de esta fase en esta entrega.
