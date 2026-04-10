import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    // Contar clientes
    const clientCount = await prisma.client.count();
    console.log(`Total de clientes: ${clientCount}`);

    // Obtener algunos clientes con contratos
    const clients = await prisma.client.findMany({
      take: 5,
      include: {
        contracts: {
          select: {
            id: true,
            contractNumber: true,
            status: true,
            destination: true,
          },
        },
      },
    });

    console.log("\nPrimeros clientes:");
    clients.forEach((client) => {
      console.log(`- ${client.fullName} (${client.email}) - ${client.contracts.length} contratos`);
    });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
