import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generatePaymentReference(): string {
  let code: string;
  let attempts = 0;

  while (attempts < 100) {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    }

    const hasLetter = /[A-Z]/.test(code);
    const hasNumber = /[0-9]/.test(code);
    
    if (hasLetter && hasNumber) {
      return code;
    }
    attempts++;
  }

  // Fallback: forzar 3 letras + 3 números y mezclar
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const numbers = '23456789';
  const parts = [
    letters.charAt(Math.floor(Math.random() * letters.length)),
    letters.charAt(Math.floor(Math.random() * letters.length)),
    letters.charAt(Math.floor(Math.random() * letters.length)),
    numbers.charAt(Math.floor(Math.random() * numbers.length)),
    numbers.charAt(Math.floor(Math.random() * numbers.length)),
    numbers.charAt(Math.floor(Math.random() * numbers.length)),
  ];
  
  // Mezclar
  for (let i = parts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [parts[i], parts[j]] = [parts[j], parts[i]];
  }
  
  return parts.join('');
}

async function generateUniquePaymentReference(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 50;

  while (attempts < maxAttempts) {
    const code = generatePaymentReference();
    const existing = await prisma.contract.findFirst({
      where: { paymentReference: code },
    });

    if (!existing) {
      return code;
    }

    attempts++;
  }

  throw new Error('No se pudo generar un código único después de 50 intentos');
}

async function main() {
  console.log('🔄 Regenerando códigos inválidos...\n');

  // IDs de contratos con códigos solo-letras
  const invalidContractNumbers = [
    'LUC-20260410-130831939-3D73',
    'LUC-20260417-170837072-DA7C',
    'LUC-20260412-134816286-7370',
    'LUC-20260414-163031703-A09F',
  ];

  for (const contractNumber of invalidContractNumbers) {
    const contract = await prisma.contract.findFirst({
      where: { contractNumber },
      select: { id: true, contractNumber: true, paymentReference: true },
    });

    if (!contract) {
      console.log(`⚠️  No se encontró contrato: ${contractNumber}`);
      continue;
    }

    const oldCode = contract.paymentReference;
    const newCode = await generateUniquePaymentReference();

    await prisma.contract.update({
      where: { id: contract.id },
      data: { paymentReference: newCode },
    });

    console.log(`✅ ${contractNumber}`);
    console.log(`   Anterior: ${oldCode} (solo letras)`);
    console.log(`   Nuevo:    ${newCode} (alfanumérico)`);
    console.log('');
  }

  console.log('✅ Regeneración completada');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
