#!/bin/bash

set -e

echo "═════════════════════════════════════════════════════════════"
echo "  🚀 SETUP AUTOMÁTICO - Backend Local Testing"
echo "═════════════════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Check Prerequisites
echo -e "${BLUE}📋 Verificando pre-requisitos...${NC}"

if ! command -v docker &> /dev/null; then
  echo -e "${YELLOW}⚠️  Docker no instalado. Usando BD remota solo.${NC}"
  USE_DOCKER=false
else
  echo -e "${GREEN}✅ Docker disponible${NC}"
  USE_DOCKER=true
fi

if ! command -v node &> /dev/null; then
  echo -e "${YELLOW}❌ Node.js no encontrado${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Node.js disponible${NC}"

if [ ! -f "/usr/bin/chromium-browser" ]; then
  echo -e "${YELLOW}⚠️  Chromium no encontrado. Por favor instala:${NC}"
  echo "    sudo apt-get install -y chromium-browser"
  exit 1
fi
echo -e "${GREEN}✅ Chromium disponible${NC}"

# 2. Setup Backend Dependencies
echo ""
echo -e "${BLUE}📦 Instalando dependencias del backend...${NC}"
cd backend
if [ ! -d "node_modules" ]; then
  npm install --silent
else
  echo "    (ya instaladas)"
fi
echo -e "${GREEN}✅ Dependencias listas${NC}"

# 3. Generate Prisma
echo ""
echo -e "${BLUE}🔧 Generando cliente Prisma...${NC}"
npm run prisma:generate > /dev/null 2>&1
echo -e "${GREEN}✅ Prisma generado${NC}"

# 4. Docker Setup (Optional)
if [ "$USE_DOCKER" = true ]; then
  echo ""
  read -p "¿Usar PostgreSQL en Docker? (s/n) " -n 1 -r
  echo ""
  
  if [[ $REPLY =~ ^[Ss]$ ]]; then
    echo -e "${BLUE}🐳 Levantando PostgreSQL en Docker...${NC}"
    
    # Stop existing container
    docker stop postgres-test 2>/dev/null || true
    docker rm postgres-test 2>/dev/null || true
    
    # Start new container
    docker run -d \
      --name postgres-test \
      -e POSTGRES_PASSWORD=test123 \
      -e POSTGRES_DB=lucitour \
      -p 5432:5432 \
      postgres:15 > /dev/null 2>&1
    
    echo "    ⏳ Esperando que PostgreSQL inicie..."
    sleep 5
    
    # Test connection
    if docker exec postgres-test psql -U postgres -d lucitour -c "SELECT 1" > /dev/null 2>&1; then
      echo -e "${GREEN}✅ PostgreSQL listo${NC}"
      
      # Update .env.local
      DATABASE_URL="postgresql://postgres:test123@localhost:5432/lucitour?schema=contracts_temp"
      sed -i "s|# DATABASE_URL=postgresql://postgres|DATABASE_URL=postgresql://postgres|g" .env.local
      sed -i "s|postgresql://postgres:password@localhost|postgresql://postgres:test123@localhost|g" .env.local
      
      echo ""
      echo -e "${BLUE}📊 Ejecutando migraciones...${NC}"
      npm run prisma:migrate -- --skip-generate --skip-seed 2>&1 | tail -5
      echo -e "${GREEN}✅ Migraciones completadas${NC}"
    else
      echo -e "${YELLOW}⚠️  No se pudo conectar a PostgreSQL${NC}"
    fi
  fi
else
  echo -e "${YELLOW}⚠️  Using remote database (sin Docker)${NC}"
fi

# 5. Generate test files
echo ""
echo -e "${BLUE}📄 Preparando archivos de test...${NC}"

# Create test contract JSON
cat > test-contract.json << 'EOF'
{
  "contractNumber": "LUC-TEST-001",
  "contractHtml": "<html><head><style>body{font-family:Arial;padding:40px}</style></head><body><h1>CONTRATO DE PRUEBA LOCAL</h1><p><strong>Cliente:</strong> Juan Pérez García</p><p><strong>Cédula:</strong> 12345678</p><p><strong>Email:</strong> juan@example.com</p><h2>Términos</h2><p>Este es un contrato de prueba local para validar la generación de PDFs.</p><div data-signer-key=\"client\" style=\"border:1px dashed #ccc;padding:20px;margin:30px 0;min-height:80px\"><p><strong>Firma del Cliente</strong></p><p style=\"margin-top:50px;border-top:1px solid #000;padding-top:10px\">Firmado: _______________</p></div><p><em>Generado: test local</em></body></html>",
  "payloadJson": "{\"clientFullName\":\"Juan Pérez García\",\"clientEmail\":\"juan@example.com\"}",
  "clientIdNumber": "12345678",
  "clientFullName": "Juan Pérez García",
  "clientEmail": "juan@example.com"
}
EOF

echo -e "${GREEN}✅ Archivos de test listos${NC}"

# 6. Instructions
echo ""
echo "═════════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ SETUP COMPLETADO${NC}"
echo "═════════════════════════════════════════════════════════════"
echo ""
echo -e "${YELLOW}📋 PRÓXIMOS PASOS:${NC}"
echo ""
echo "1. Levanta el backend:"
echo -e "   ${BLUE}cd backend && npm run start:dev${NC}"
echo ""
echo "2. En otra terminal, obtén un JWT:"
echo -e "   ${BLUE}curl -X POST http://localhost:3001/auth/login \\${NC}"
echo -e "   ${BLUE}  -H 'Content-Type: application/json' \\${NC}"
echo -e "   ${BLUE}  -d '{${NC}"
echo -e "   ${BLUE}    \"email\": \"admin@lucitour.com\",${NC}"
echo -e "   ${BLUE}    \"password\": \"Cambiar123!\"${NC}"
echo -e "   ${BLUE}  }' | jq .access_token${NC}"
echo ""
echo "3. Guarda el token y prueba endpoints:"
echo -e "   ${BLUE}export TOKEN=<your-jwt-token>${NC}"
echo ""
echo "4. Copia y ejecuta los comandos en TESTING.md"
echo ""
echo "📚 Lee: TESTING.md para flujo completo"
echo ""
