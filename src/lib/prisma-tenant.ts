import { PrismaClient, Prisma } from "@prisma/client";

/**
 * Client de runtime, autenticado como `quitaedu_app` (role SEM BYPASSRLS —
 * ver prisma/migrations/20260821164944_multi_tenant_rls). Toda query feita
 * por este client é filtrada por Row Level Security no Postgres, não só
 * pelo `where` do código — mesmo que uma rota esqueça de filtrar por
 * schoolId, o banco recusa ler/escrever linhas de outra escola.
 *
 * Nunca use este client fora de `withTenantContext`: sem a variável de
 * sessão `app.current_school_id` setada, toda policy RLS é fail-closed
 * (nenhuma linha é visível).
 */
const runtimeDatabaseUrl = process.env.RUNTIME_DATABASE_URL;
if (!runtimeDatabaseUrl) {
  throw new Error(
    "RUNTIME_DATABASE_URL não definido — necessário para queries tenant-scoped (RLS). Ver .env.example.",
  );
}

const globalForTenantPrisma = globalThis as unknown as {
  tenantPrisma: PrismaClient | undefined;
};

const tenantPrisma =
  globalForTenantPrisma.tenantPrisma ??
  new PrismaClient({ datasources: { db: { url: runtimeDatabaseUrl } } });

if (process.env.NODE_ENV !== "production") {
  globalForTenantPrisma.tenantPrisma = tenantPrisma;
}

type TenantTransactionClient = Prisma.TransactionClient;

/**
 * Toda query tenant-scoped (Guardian, Student, Charge, TuitionPlan,
 * BillingRule, AuditLog, SchoolSubaccount, User com schoolId) deve passar
 * por aqui — nunca usar `tenantPrisma` direto fora desta função.
 *
 * schoolId **sempre** vem da sessão autenticada (`auth()`), nunca de
 * parâmetro de rota/body/query — ver contracts/api.md, "Convenções de
 * autorização".
 */
export async function withTenantContext<T>(
  schoolId: string,
  callback: (tx: TenantTransactionClient) => Promise<T>,
): Promise<T> {
  return tenantPrisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolId}, true)`;
    return callback(tx);
  });
}
