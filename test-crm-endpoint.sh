#!/bin/bash

# Este script prueba el endpoint CRM después de autenticarse

# Primero obtener el token
echo "Obteniendo token de autenticación..."
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "abarahonag@barmentech.com",
    "password": "prueba123"
  }')

echo "Respuesta de login: $TOKEN_RESPONSE"

# Extraer el accessToken (usando jq si está disponible, sino buscar manualmente)
if command -v jq &> /dev/null; then
  TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.accessToken')
else
  TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | sed 's/"accessToken":"\(.*\)"/\1/')
fi

echo "Token: $TOKEN"
echo ""
echo "Probando endpoint /contracts/crm/clients..."
echo ""

# Probar el endpoint CRM
curl -s -X GET http://localhost:3001/contracts/crm/clients \
  -H "Authorization: Bearer $TOKEN" | jq '.' || curl -s -X GET http://localhost:3001/contracts/crm/clients \
  -H "Authorization: Bearer $TOKEN"
