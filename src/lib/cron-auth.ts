import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/api-errors";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Autoriza os endpoints /api/cron/* (A-011/A-014): ou o agendador externo
 * (Vercel Cron ou similar) mandando `Authorization: Bearer <CRON_SECRET>`,
 * ou um PLATFORM_ADMIN autenticado disparando manualmente.
 */
export async function requireCronOrPlatformAdmin(request: Request): Promise<void> {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`) return;

  const session = await auth();
  if (session?.user?.role === "PLATFORM_ADMIN") return;

  throw new UnauthorizedError();
}
