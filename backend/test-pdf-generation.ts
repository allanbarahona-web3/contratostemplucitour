/**
 * Test script para validar generación de PDFs y links de firma
 * Ejecutar: npx ts-node test-pdf-generation.ts
 */

import { PdfRenderService } from "./src/contracts/pdf-render.service";

// HTML mínimo para testear
const testHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial; padding: 40px; line-height: 1.6; }
    .signature-box { border: 1px dashed #ccc; padding: 20px; margin: 30px 0; min-height: 80px; }
  </style>
</head>
<body>
  <h1>CONTRATO DE PRUEBA</h1>
  <p>Número: LUC-20260405-001</p>
  
  <h2>Datos del Cliente</h2>
  <p><strong>Nombre:</strong> Juan Pérez García</p>
  <p><strong>Cédula:</strong> 12345678</p>
  <p><strong>Email:</strong> juan@example.com</p>
  
  <h2>Términos y Condiciones</h2>
  <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
  <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
  
  <div class="signature-box" data-signer-key="client">
    <p><strong>Firma del Cliente</strong></p>
    <p style="margin-top: 50px; border-top: 1px solid #000; padding-top: 10px;">Firmado: _______________</p>
  </div>
  
  <p><em>Contrato generado el ${new Date().toLocaleString()}</em></p>
</body>
</html>
`;

async function testPdfGeneration() {
  console.log("🧪 Iniciando test de generación de PDF...\n");
  
  const pdfService = new PdfRenderService();
  
  try {
    console.log("📄 Generando PDF con HTML de prueba...");
    const result = await pdfService.renderContractToBuffer(testHtml);
    
    console.log("✅ PDF generado exitosamente!");
    console.log(`   - Tamaño: ${(result.pdfBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`   - Anchores de firma encontrados: ${Object.keys(result.signatureAnchors).length}`);
    
    if (Object.keys(result.signatureAnchors).length > 0) {
      console.log("\n📍 Detalles de áncores:");
      Object.entries(result.signatureAnchors).forEach(([key, anchor]) => {
        console.log(`   ${key}:`);
        console.log(`     - Página: ${anchor.pageIndex}`);
        console.log(`     - Posición: x=${anchor.box.x}pt, y=${anchor.box.y}pt`);
        console.log(`     - Tamaño: ${anchor.box.width}pt × ${anchor.box.height}pt`);
      });
    }
    
    // Guardar PDF para inspección manual
    const fs = await import("fs");
    const outputPath = "/tmp/test-contract.pdf";
    fs.writeFileSync(outputPath, result.pdfBuffer);
    console.log(`\n💾 PDF guardado en: ${outputPath}`);
    console.log("   Puedes abrirlo para verificar que se generó correctamente.\n");
    
  } catch (error) {
    console.error("❌ Error generando PDF:");
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

// Test de generación de tokens de firma
function generateTestSigningToken() {
  console.log("🔐 Test de generación de token de firma...\n");
  
  const secret = process.env.SIGNING_LINK_SECRET || "test-secret-for-local-testing";
  const contractId = "test-contract-123";
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
  
  const crypto = require("crypto");
  
  const payload = {
    v: 1,
    contractId,
    exp: expiresAt.toISOString(),
    signerKey: "client",
    signerRole: "CLIENTE",
    signerName: "Juan Pérez García",
  };
  
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payloadB64);
  const signatureB64 = hmac.digest("base64url");
  
  const token = `${payloadB64}.${signatureB64}`;
  
  console.log("✅ Token de firma generado:");
  console.log(`   Token (primeros 50 chars): ${token.substring(0, 50)}...`);
  console.log(`   Expira en: ${expiresAt.toLocaleString()}`);
  
  const baseUrl = "http://localhost:5179";
  const signingUrl = `${baseUrl}/sign-contract.html?token=${encodeURIComponent(token)}`;
  
  console.log(`\n🔗 URL de firma para enviar:\n`);
  console.log(`   ${signingUrl}\n`);
  
  return token;
}

async function main() {
  console.log("═".repeat(60));
  console.log("  TEST DE FUNCIONALIDADES LOCALES");
  console.log("═".repeat(60) + "\n");
  
  // Test 1: Validar Chromium
  console.log("🖥️  Validando Chromium...");
  const fs = await import("fs");
  const possiblePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH || "",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/snap/bin/chromium",
  ];
  
  let chromiumPath = "";
  for (const path of possiblePaths) {
    if (path && fs.existsSync(path)) {
      chromiumPath = path;
      break;
    }
  }
  
  if (chromiumPath) {
    console.log(`   ✅ Chromium encontrado en: ${chromiumPath}\n`);
    process.env.PUPPETEER_EXECUTABLE_PATH = chromiumPath;
  } else {
    console.error(`   ❌ Chromium NO encontrado`);
    console.error(`   Por favor instala: sudo apt-get install -y chromium-browser\n`);
    process.exit(1);
  }
  
  // Test 2: Generar PDF
  await testPdfGeneration();
  
  // Test 3: Generar token
  generateTestSigningToken();
  
  console.log("═".repeat(60));
  console.log("  ✅ TODOS LOS TESTS COMPLETADOS");
  console.log("═".repeat(60) + "\n");
  
  console.log("📋 Próximos pasos:");
  console.log("   1. Verifica el PDF en /tmp/test-contract.pdf");
  console.log("   2. Levanta el backend: npm run start:dev");
  console.log("   3. Testea los endpoints con la URL de firma anterior\n");
}

main().catch(console.error);
