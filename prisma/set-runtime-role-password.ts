/**
 * Roda uma vez (manualmente) depois da migration `multi_tenant_rls`, para
 * definir a senha do role `quitaedu_app` sem commitar segredo em migration.sql.
 *
 * Uso: npx tsx prisma/set-runtime-role-password.ts
 * Gera uma senha aleatória, aplica via ALTER ROLE (usando DATABASE_URL, que
 * tem privilégio de owner) e imprime a RUNTIME_DATABASE_URL pronta para
 * colar no .env. Rodar de novo troca a senha (idempotente).
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL não definido no .env");
  }

  const password = randomBytes(24).toString("hex");
  const prisma = new PrismaClient();

  await prisma.$executeRawUnsafe(
    `ALTER ROLE quitaedu_app WITH PASSWORD '${password}'`,
  );
  await prisma.$disconnect();

  const url = new URL(databaseUrl);
  url.username = "quitaedu_app";
  url.password = password;

  console.log("Senha do role quitaedu_app atualizada.");
  console.log("Cole isto no .env:\n");
  console.log(`RUNTIME_DATABASE_URL='${url.toString()}'`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
