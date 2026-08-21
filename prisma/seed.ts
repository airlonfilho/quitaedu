import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("senha123", 10);

  await prisma.user.upsert({
    where: { email: "admin@quitaedu.com.br" },
    update: {},
    create: {
      email: "admin@quitaedu.com.br",
      passwordHash,
      role: "PLATFORM_ADMIN",
    },
  });

  const school = await prisma.school.upsert({
    where: { cnpj: "00000000000100" },
    update: {},
    create: {
      name: "Escola Exemplo",
      cnpj: "00000000000100",
      status: "ACTIVE",
    },
  });

  await prisma.user.upsert({
    where: { email: "gestor@escolaexemplo.com.br" },
    update: {},
    create: {
      email: "gestor@escolaexemplo.com.br",
      passwordHash,
      role: "SCHOOL_MANAGER",
      schoolId: school.id,
    },
  });

  console.log("Seed concluído: admin@quitaedu.com.br / gestor@escolaexemplo.com.br (senha: senha123)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
