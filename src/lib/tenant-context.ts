import { auth } from "@/auth";
import { UnauthorizedError, ForbiddenError } from "@/lib/api-errors";

/**
 * Único ponto de onde uma rota de API deve obter o schoolId para filtrar
 * queries tenant-scoped — sempre da sessão autenticada, nunca de
 * parâmetro de rota/body/query do cliente (ver contracts/api.md,
 * "Convenções de autorização").
 *
 * PLATFORM_ADMIN não tem schoolId (opera fora do RLS, via src/lib/prisma.ts) —
 * chamar isso numa rota SCHOOL_MANAGER-only.
 */
export async function requireSchoolContext(): Promise<{
  userId: string;
  schoolId: string;
}> {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role !== "SCHOOL_MANAGER" || !session.user.schoolId) {
    throw new ForbiddenError();
  }
  return { userId: session.user.id, schoolId: session.user.schoolId };
}

/**
 * Para rotas PLATFORM_ADMIN-only (cross-tenant por natureza — gestão de
 * escolas). Essas rotas usam src/lib/prisma.ts diretamente, sem RLS.
 */
export async function requirePlatformAdmin(): Promise<{ userId: string }> {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role !== "PLATFORM_ADMIN") throw new ForbiddenError();
  return { userId: session.user.id };
}
