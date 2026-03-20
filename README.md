# Contratos Temp Lucitour

Repositorio independiente para la mini app de contratos y su backend de autenticacion.

## Estructura
- Frontend estatico: raiz del repo (`index.html`, `app.js`, `styles.css`).
- Backend NestJS + PostgreSQL: `backend/`.

## Frontend local
```bash
cd /home/allanb/contratostemplucitour
python3 -m http.server 5179
```

Abrir: `http://localhost:5179`

## Backend local (Nest + PostgreSQL)
1. Configurar variables de entorno:
```bash
cd /home/allanb/contratostemplucitour/backend
cp .env.example .env
```

2. Instalar dependencias:
```bash
npm install
```

3. Crear esquema en PostgreSQL:
```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
```

4. Crear usuario admin inicial:
```bash
npm run prisma:seed
```

5. Levantar API:
```bash
npm run start:dev
```

API por defecto: `http://localhost:3001`

## Login rapido
- El frontend solicita correo/contrasena contra `POST /auth/login`.
- Guarda JWT en `localStorage` y valida sesion con `GET /auth/me`.

## Deploy en Vercel (solo frontend)
1. Importar este repo en Vercel.
2. `Root Directory`: `./`
3. `Framework Preset`: `Other`
4. Deploy.

## Deploy del backend
El backend Nest puede desplegarse en Railway/Render/Fly, y el frontend debe apuntar al dominio del backend en la clave `contractsApiBase` del `localStorage`.
