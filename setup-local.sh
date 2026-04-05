#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# LEVANTA TODO: BD + Backend + Frontend para TESTEAR LOCALMENTE
# ═══════════════════════════════════════════════════════════════

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "  🚀 Levantando Sistema Completo Para Testing Local"
echo "═══════════════════════════════════════════════════════════════"
echo ""

cd /home/allanb/contratoslucitour-temp

# 1. Verificar PostgreSQL
echo "1️⃣  Verificando PostgreSQL..."
if ! sudo service postgresql status | grep -q "active (exited)"; then
  echo "   Iniciando PostgreSQL..."
  sudo service postgresql start > /dev/null 2>&1
fi
echo "   ✅ PostgreSQL listo"

# 2. Verificar BD
echo ""
echo "2️⃣  Verificando base de datos..."
if ! sudo -u postgres psql -l 2>/dev/null | grep -q "lucitour"; then
  echo "   Creando BD lucitour..."
  sudo -u postgres psql -c "CREATE DATABASE lucitour;" > /dev/null 2>&1
fi
echo "   ✅ BD lista"

# 3. Backend
echo ""
echo "3️⃣  Levantando Backend (API en puerto 3001)..."
cd backend
if ! grep -q "postgresql://postgres:postgres" .env; then
  echo "   Actualizando DATABASE_URL en .env..."
  sed -i 's|DATABASE_URL=.*|DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lucitour?schema=contracts_temp"|g' .env
fi
echo "   ✅ Backend configurado"

# 4. Frontend
echo ""
echo "4️⃣  Preparando Frontend (en puerto 5179)..."
cd ..

# Check if http-server is installed
if ! command -v http-server &> /dev/null; then
  echo "   Instalando http-server..."
  npm install -g http-server > /dev/null 2>&1
fi
echo "   ✅ Frontend configurado"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ SETUP COMPLETADO"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "🚀 Ahora ejecuta en TERMINALES SEPARADAS:"
echo ""
echo "TERMINAL 1 - Backend:"
echo "  cd /home/allanb/contratoslucitour-temp/backend"
echo "  PUPPETEER_DISABLE_SANDBOX=true npm run start:dev"
echo ""
echo "TERMINAL 2 - Frontend:"
echo "  cd /home/allanb/contratoslucitour-temp"
echo "  npx http-server -p 5179 -c-1"
echo ""
echo "Luego abre en tu navegador:"
echo "  🌐 http://localhost:5179"
echo ""
echo "La API estará disponible en:"
echo "  🔌 http://localhost:3001"
echo ""
