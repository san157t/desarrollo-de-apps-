# Uber Frontend — Ionic + Angular

Este proyecto migra el frontend React/Vite original a Ionic + Angular, conservando las pantallas y los endpoints de autenticación.

## Backend configurado

La API está configurada en `src/app/services/api.service.ts` con esta base:

`http://20.20.1.157:8000/api`

Se conservan estos endpoints:
- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/forgot-password`
- `GET /auth/me`
- `POST /auth/logout`

Si el backend usa una ruta base diferente, cambia `BASE_URL` en ese servicio.

## Instalar y ejecutar

Necesitas Node.js y npm. Desde la carpeta del proyecto ejecuta:

```bash
npm install
npm install -g @ionic/cli
ionic serve
```

La aplicación se abrirá normalmente en `http://localhost:8100`.

## Si no conecta con el backend

1. Abre `http://20.20.1.157:8000` en el navegador del mismo equipo/red para comprobar que el servidor responde.
2. Confirma que el backend está escuchando en la red, no solo en `127.0.0.1`.
3. El backend debe permitir CORS desde el origen de Ionic (por ejemplo `http://localhost:8100`).
4. Si pruebas desde un teléfono, debe estar conectado a la red que alcanza `20.20.1.157`.
5. Si el backend no sirve HTTPS, en una app móvil nativa puede requerirse configurar el tráfico HTTP permitido en Capacitor/Android.

La dirección IP no se puede validar desde el ZIP; depende de que el servidor esté encendido y sea accesible desde tu red.
