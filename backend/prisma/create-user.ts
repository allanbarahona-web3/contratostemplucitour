import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = String(process.env.USER_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.USER_PASSWORD || "");
  const fullName = String(process.env.USER_NAME || "").trim();
  const isActive = String(process.env.USER_ACTIVE || "true").toLowerCase() !== "false";

  if (!email || !password || !fullName) {
    console.error("Faltan variables. Usa USER_EMAIL, USER_PASSWORD, USER_NAME y opcional USER_ACTIVE.");
    process.exit(1);
  }

  if (password.length < 6) {
    console.error("La contrasena debe tener al menos 6 caracteres.");
    process.exit(1);
  }

  const passwordHash = await hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      fullName,
      passwordHash,
      isActive,
    },
    create: {
      email,
      fullName,
      passwordHash,
      isActive,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      isActive: true,
    },
  });

  console.log("Usuario listo:", user);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
