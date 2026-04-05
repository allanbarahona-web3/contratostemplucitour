# 🧪 GUÍA DE TESTING LOCAL - Generación de PDFs y Links de Firma

## ✅ Pre-requisitos Validados

- ✅ **Chromium**: `/usr/bin/chromium-browser` 
- ✅ **Node.js**: Disponible
- ✅ **Prisma**: Generado
- ✅ **PDF Generation**: Testeado exitosamente
- ✅ **Signing Links**: Generados correctamente

---

## 🚀 OPCIÓN A: Testing con Base de Datos Remota (DigitalOcean)

Si tienes conectividad VPN a DigitalOcean:

### 1. Asegúrate que tienes conectividad a la BD remota:
```bash
cd backend
# Usa la DATABASE_URL de .env.local
psql "$DATABASE_URL" -c "SELECT version();"
```

### 2. Ejecuta migraciones:
```bash
npm run prisma:migrate -- --skip-generate --skip-seed
```

### 3. Crea usuario admin (opcional):
```bash
npm run user:create
```

### 4. Levanta el backend:
```bash
npm run start:dev
```

---

## 🐳 OPCIÓN B: Testing con BD Local en Docker (RECOMENDADO)

Más rápido y sin dependencia de conectividad remota.

### 1. **Levanta PostgreSQL en Docker:**
```bash
docker run -d \
  --name postgres-test \
  -e POSTGRES_PASSWORD=test123 \
  -e POSTGRES_DB=lucitour \
  -p 5432:5432 \
  postgres:15
```

### 2. **Espera 5 segundos y verifica::**
```bash
sleep 5
docker exec postgres-test psql -U postgres -d lucitour -c "SELECT 1"
```

### 3. **Copia `.env.local` y actualiza `DATABASE_URL`:**
```bash
cd backend
# Descomenta/actualiza la línea SQL local en .env.local:
# DATABASE_URL=postgresql://postgres:test123@localhost:5432/lucitour?schema=contracts_temp
```

### 4. **Ejecuta migraciones:**
```bash
npm run prisma:migrate -- --skip-generate --skip-seed
```

### 5. **Crea usuario de test (opcional):**
```bash
npx tsx prisma/create-user.ts
# Aparecerá un prompt interactivo
# Email: admin@test.local
# Password: TestPassword123!
```

### 6. **Levanta el backend:**
```bash
npm run start:dev
```

Deberías ver:
```
[Nest] PORT 3001, Server running
```

---

## 📡 TESTING DE ENDPOINTS

### Con curl o Postman:

#### **1. Autenticación (GET TOKEN JWT)**
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.local",
    "password": "TestPassword123!"
  }'
```

Respuesta esperada:
```json
{
  "access_token": "eyJhbGc..."
}
```

Guarda el token para los siguientes pasos.

---

#### **2. Reservar Número de Contrato**
```bash
# Reemplaza TOKEN con el valor anterior
curl -X POST http://localhost:3001/contracts/next-number \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json"
```

Respuesta esperada:
```json
{
  "nextNumber": "LUC-20260405-003451789-AB"
}
```

---

#### **3. Generar PDF y Archivarlo**

Crea un archivo `test-contract.json`:
```json
{
  "contractNumber": "LUC-20260405-003451789-AB",
  "contractHtml": "<html><body><h1>Contrato de Prueba</h1><p>Cliente: Juan Pérez</p><div data-signer-key=\"client\">FIRMA</div></body></html>",
  "payloadJson": "{\"clientFullName\": \"Juan Pérez García\", \"clientEmail\": \"juan@example.com\"}",
  "clientIdNumber": "12345678",
  "clientFullName": "Juan Pérez García",
  "clientEmail": "juan@example.com"
}
```

```bash
# Genera un PDF mínimo con HTML real
curl -X POST http://localhost:3001/contracts/archive \
  -H "Authorization: Bearer TOKEN" \
  -F "data=@test-contract.json" \
  -F "documents=" \
  | jq .
```

Respuesta esperada:
```json
{
  "contractId": "async-id-123",
  "contractNumber": "LUC-20260405-003451789-AB",
  "status": "PENDING_SIGNATURE",
  "pdfStorageKey": "contracts/LUC-20260405...pdf",
  "documentCount": 0
}
```

---

#### **4. Generar Link de Firma**
```bash
# Reemplaza CONTRACT_ID con el id de arriba
curl -X POST http://localhost:3001/contracts/CONTRACT_ID/signing-link \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ttlMinutes": 1440
  }'
```

Respuesta esperada:
```json
{
  "contractId": "...",
  "contractNumber": "LUC-20260405...",
  "signingUrl": "http://localhost:5179/sign-contract.html?token=eyJ2IjoxLCJjb250cmFjdElkIjoi...",
  "expiresAt": "2026-04-06T15:18:00.000Z"
}
```

**El `signingUrl` es lo que enviarías por email al cliente.**

---

#### **5. Verificar Sesión Pública (sin autenticación)**

Usa el `token` del `signingUrl`:
```bash
curl "http://localhost:3001/contracts/public/signing-session?token=TOKEN_AQUI" \
  | jq .
```

Respuesta:
```json
{
  "contractId": "...",
  "contractNumber": "LUC-20260405...",
  "signerName": "Juan Pérez García",
  "signerEmail": "juan@example.com",
  "signerRole": "CLIENTE",
  "expiresAt": "2026-04-06T15:18:00.000Z",
  "pdfUrl": "https://sfo3.digitaloceanspaces.com/..."
}
```

---

## 🐛 TROUBLESHOOTING

### "Chromium not found"
```bash
which chromium-browser
# Debe retornar: /usr/bin/chromium-browser
```

### "Cannot reach database"
```bash
# Si usas Docker:
docker ps | grep postgres-test

# Si usas remoto, verifica VPN:
psql "postgresql://..." -c "SELECT 1"
```

### "PUPPETEER_DISABLE_SANDBOX is false"
```bash
# Asegúrate de que .env tiene:
# PUPPETEER_DISABLE_SANDBOX=true

# O pasa explícitamente:
PUPPETEER_DISABLE_SANDBOX=true npm run start:dev
```

### PDFs no se generan o son vacíos
```bash
# Verifica los logs:
npm run start:dev 2>&1 | grep -i "pdf\|error"
```

---

## 📊 Lo que hemos testeado

| Feature | Status | Details |
|---------|--------|---------|
| PDF Generation | ✅ Funcionando | 27.65 KB PDF generado |
| Signature Anchors | ✅ Detectados | 1 ancla en página 0 |
| Signing Tokens | ✅ Válidos | HMAC-SHA256, con expiración |
| Chromium/Puppeteer | ✅ Listo | `/usr/bin/chromium-browser` |
| Email Sending | ⏳ No testeado | Requiere RESEND_API_KEY |
| Storage (S3/Spaces) | ✅ Configurado | Credenciales reales en .env |

---

## 🔄 Flujo Completo de Testing

```
1. Backend corriendo (/contracts/next-number)
   ↓
2. Generar número de contrato
   ↓
3. Preparar HTML del contrato + datos cliente
   ↓
4. POST /contracts/archive (genera PDF)
   ↓
5. PDF se almacena en DO Spaces ✅
   ↓
6. POST /contracts/:id/signing-link
   ↓
7. Link de firma generado ✅
   ↓
8. Link listo para enviar vía email (sin necesidad de email real)
   ↓
9. Cliente abre link → ve PDF → firma
   ↓
10. POST /contracts/public/finalize-signature
   ↓
11. Contrato marcado como SIGNED ✅
```

---

## ✅ Próximos Pasos

**Fase 1 (AHORA):**
- [ ] Levanta backend local
- [ ] Testea endpoints manualmente
- [ ] Verifica que PDFs se generan correctamente

**Fase 2 (TODO):**
- [ ] Testear envío de emails (necesita RESEND_API_KEY activa)
- [ ] Implementar frontend de firma electrónica
- [ ] Testear flujo completo end-to-end

---

## 📞 Notas Importantes

- Los PDFs se guardan en **DO Spaces** (real, no local)
- Los links de firma son **válidos 24 horas** por default
- La BD puede ser local (Docker) o remota (DigitalOcean)
- **No necesitas email real** para testear la generación de PDFs y links
