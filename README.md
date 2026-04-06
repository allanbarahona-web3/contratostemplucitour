# Contratos Lucitour

Sistema de gestión y firma de contratos.

## Estructura
```
frontend/    # App web estática (HTML/CSS/JS)
backend/     # API NestJS + PostgreSQL
```

## 🚀 Desarrollo Local

**Opción 1 - Automático:**
```bash
./start-dev.sh
```

**Opción 2 - Manual:**
```bash
# Terminal 1 - Backend
cd backend && npm run start:dev

# Terminal 2 - Frontend  
cd frontend && npx http-server -p 5179 -c-1
```

URLs:
- Frontend: http://localhost:5179
- Backend API: http://localhost:3001

## 🌐 Producción

**Frontend (Vercel):**
- https://contratos.lucitour.com
- Config: `vercel.json` apunta a `/frontend`

**Backend (DigitalOcean App):**
- https://contratostempapi-h5ppc.ondigitalocean.app
- **IMPORTANTE**: Configurar "Root Directory" = `backend` en DO App Console

## ⚙️ Setup Backend

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

Ver `backend/.env.example` para variables requeridas.
