import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma usa um output customizado (src/generated/prisma) — sem isto, o
  // Next.js não inclui o binário do query engine (.so.node) no bundle da
  // function serverless da Vercel, e toda rota que usa Prisma quebra em
  // produção com PrismaClientInitializationError (engine não encontrada).
  outputFileTracingIncludes: {
    "/*": ["./src/generated/prisma/**/*"],
  },
};

export default nextConfig;
