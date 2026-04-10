import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        createdAt: true,
      },
    });

    console.log(`Total de usuarios: ${users.length}\n`);
    users.forEach((user) => {
      console.log(`- ${user.fullName} <${user.email}>`);
    });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
