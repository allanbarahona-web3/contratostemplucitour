import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Genera un código alfanumérico de 6 caracteres único.
 * Formato: mayúsculas y números (uppercase + digits)
 */
function generatePaymentReference(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin I, O, 0, 1 para evitar confusión
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function main() {
  console.log('🔍 Buscando contratos sin paymentReference...');

  const contractsWithoutRef = await prisma.contract.findMany({
    where: {
      paymentReference: null,
    },
    select: {
      id: true,
      contractNumber: true,
    },
  });

  console.log(`✅ Encontrados ${contractsWithoutRef.length} contratos sin código de pago`);

  if (contractsWithoutRef.length === 0) {
    console.log('✨ Todos los contratos ya tienen código de pago');
    return;
  }

  for (const contract of contractsWithoutRef) {
    let paymentRef: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 50;

    // Generar un código único (intentar hasta 50 veces)
    while (!isUnique && attempts < maxAttempts) {
      paymentRef = generatePaymentReference();
      
      // Verificar si ya existe
      const existing = await prisma.contract.findUnique({
        where: { paymentReference: paymentRef },
      });

      if (!existing) {
        isUnique = true;
        
        // Actualizar el contrato
        await prisma.contract.update({
          where: { id: contract.id },
          data: { paymentReference: paymentRef },
        });

        console.log(`  ✓ ${contract.contractNumber} → ${paymentRef}`);
      }
      
      attempts++;
    }

    if (!isUnique) {
      console.error(`  ✗ ERROR: No se pudo generar código único para ${contract.contractNumber} después de ${maxAttempts} intentos`);
    }
  }

  console.log('\n✨ Proceso completado');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
