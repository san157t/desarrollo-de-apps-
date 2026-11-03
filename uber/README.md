# Uber – frontend Ionic (Angular standalone)

Frontend para la API Laravel de `API_DOCUMENTATION.md`. Tres roles: cliente, conductor y administrador.

## Instalación

```bash
npm i -g @ionic/cli
ionic start uber-app blank --type=angular-standalone --no-git
cd uber-app
rm -rf src/app/home src/app/app.component.html src/app/app.component.scss
# copia la carpeta src/ de este zip encima de la del proyecto (reemplazando archivos)
npm i leaflet@1.9.4
npm i -D @types/leaflet@1.9
```

## Cambiar la IP de la API

El backend está configurado en `20.20.1.51`. Si cambia, edita solo `API_HOST` en `src/app/config.ts`:

```ts
export const API_HOST = '20.20.1.51';
export const API_URL = `http://${API_HOST}:8000/api`;
```

Con Laravel: `php artisan serve --host=0.0.0.0` y habilita CORS para `http://localhost:8100`.

## Ejecutar

```bash
ionic serve
```

Android/iOS con Capacitor: la API usa `http`, así que en `capacitor.config.ts` agrega
`server: { cleartext: true }` (o usa HTTPS).

## Qué incluye

- Login con selector **Usuario / Conductor / Administrador** (valida que la cuenta sea del tipo elegido), registro (usuario o conductor) y recuperar contraseña.
- Cliente: inicio con tarifas, pedir viaje (mapa, búsqueda de destino, estimación, confirmar),
  seguimiento en vivo (consulta cada 4 s), cancelar, historial paginado y calificación.
- Conductor: conectarse/desconectarse, ver y aceptar solicitudes (maneja el 409),
  llegué / iniciar / finalizar, y envío de GPS cada 5 s.
- Admin: resumen, aprobar/rechazar/suspender conductores, tarifas y viajes con filtros.

## Supuestos

- `POST /client/cancel/{id}` recibe el `id` que devuelve `/client/active` (solicitud o viaje).
- No hay endpoint para recuperar el viaje activo del conductor; se guarda en `localStorage`.
- Reportes y registros de auditoría del admin no se incluyen (la documentación no define su respuesta).
- Mapa: OpenStreetMap/CARTO, búsqueda con Nominatim y rutas con OSRM (sin API keys).

## Mapa

Usa Leaflet 1.9.x con mosaicos de CARTO y, si no cargan, de OpenStreetMap. El dispositivo necesita internet
para los mosaicos, la búsqueda de direcciones (Nominatim) y las rutas (OSRM); si no hay conexión se muestra un aviso.
