import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@lucitour.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "Cambiar123!";
  const fullName = process.env.SEED_ADMIN_NAME || "Administrador Lucitour";

  const passwordHash = await hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: {
      fullName,
      passwordHash,
      isActive: true,
    },
    create: {
      email,
      fullName,
      passwordHash,
      isActive: true,
    },
  });

  console.log(`Usuario admin listo: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
