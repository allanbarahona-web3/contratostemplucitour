import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Valida que todos los códigos de pago existentes sean alfanuméricos mixtos.
 * Si encuentra alguno que no cumpla, lo reporta.
 */
async function main() {
  console.log('🔍 Validando códigos de pago existentes...\n');

  const contracts = await prisma.contract.findMany({
    select: {
      id: true,
      contractNumber: true,
      paymentReference: true,
    },
  });

  console.log(`✅ Encontrados ${contracts.length} contratos con código de pago\n`);

  const invalid: Array<{ contractNumber: string; paymentReference: string; reason: string }> = [];
  const valid: Array<{ contractNumber: string; paymentReference: string }> = [];

  for (const contract of contracts) {
    const code = contract.paymentReference || '';
    const hasLetter = /[A-Z]/.test(code);
    const hasNumber = /[0-9]/.test(code);
    const isLength6 = code.length === 6;
    const isAlphanumeric = /^[A-Z0-9]+$/.test(code);

    if (!isLength6) {
      invalid.push({
        contractNumber: contract.contractNumber,
        paymentReference: code,
        reason: `Longitud incorrecta: ${code.length} (debe ser 6)`,
      });
    } else if (!isAlphanumeric) {
      invalid.push({
        contractNumber: contract.contractNumber,
        paymentReference: code,
        reason: 'Contiene caracteres no permitidos',
      });
    } else if (!hasLetter) {
      invalid.push({
        contractNumber: contract.contractNumber,
        paymentReference: code,
        reason: 'Solo números (debe tener al menos 1 letra)',
      });
    } else if (!hasNumber) {
      invalid.push({
        contractNumber: contract.contractNumber,
        paymentReference: code,
        reason: 'Solo letras (debe tener al menos 1 número)',
      });
    } else {
      valid.push({
        contractNumber: contract.contractNumber,
        paymentReference: code,
      });
    }
  }

  console.log(`✅ Códigos válidos (alfanuméricos mixtos): ${valid.length}`);
  console.log(`❌ Códigos inválidos: ${invalid.length}\n`);

  if (invalid.length > 0) {
    console.log('⚠️  CÓDIGOS INVÁLIDOS ENCONTRADOS:\n');
    invalid.forEach((item) => {
      console.log(`  ❌ ${item.contractNumber} → "${item.paymentReference}"`);
      console.log(`     Razón: ${item.reason}\n`);
    });
    console.log('💡 Estos códigos deben regenerarse manualmente.\n');
  } else {
    console.log('✨ Todos los códigos cumplen con el formato alfanumérico mixto.\n');
  }

  // Mostrar algunos ejemplos de códigos válidos
  if (valid.length > 0) {
    console.log('📋 Ejemplos de códigos válidos generados:');
    valid.slice(0, 10).forEach((item) => {
      const letters = (item.paymentReference.match(/[A-Z]/g) || []).length;
      const numbers = (item.paymentReference.match(/[0-9]/g) || []).length;
      console.log(`  ✓ ${item.contractNumber} → ${item.paymentReference} (${letters}L + ${numbers}N)`);
    });
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
