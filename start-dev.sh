#!/bin/bash

# Script para levantar Frontend + Backend en desarrollo

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "  🚀 Levantando Frontend + Backend Local"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check if running from the correct directory
if [ ! -d "backend" ]; then
  echo "❌ Error: Ejecuta este script desde la raíz del proyecto"
  exit 1
fi

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Install http-server if not available
if ! command -v http-server &> /dev/null; then
  echo -e "${BLUE}📦 Instalando http-server...${NC}"
  npm install -g http-server > /dev/null 2>&1
fi

echo ""
echo -e "${YELLOW}📋 Configuración:${NC}"
echo -e "  Frontend:  ${GREEN}http://localhost:5179${NC}"
echo -e "  Backend:   ${GREEN}http://localhost:3001${NC}"
echo ""

# Start Backend in background
echo -e "${BLUE}🚀 Iniciando Backend...${NC}"
cd backend
PUPPETEER_DISABLE_SANDBOX=true npm run start:dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✅ Backend iniciado (PID: $BACKEND_PID)${NC}"
cd ..

# Give backend time to start
sleep 3

# Check if backend started successfully
if ! ps -p $BACKEND_PID > /dev/null; then
  echo -e "${YELLOW}⚠️  Backend puede haber fallado. Ver logs:${NC}"
  tail -20 /tmp/backend.log
  exit 1
fi

# Start Frontend
echo -e "${BLUE}🚀 Iniciando Frontend...${NC}"
cd frontend
http-server -p 5179 -c-1

# Cleanup on exit
trap "kill $BACKEND_PID 2>/dev/null" EXIT

echo ""
echo -e "${GREEN}✅ Ambos servidores levantados${NC}"
echo ""
