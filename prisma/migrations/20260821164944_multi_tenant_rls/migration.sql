-- ============================================================================
-- B-004: Isolamento multi-tenant via Row Level Security (Postgres)
--
-- O role usado pelas migrações (neondb_owner, no Neon) tem BYPASSRLS — RLS
-- não teria nenhum efeito se a aplicação rodasse suas queries com esse
-- mesmo role. Este migration cria um role de runtime separado, SEM
-- BYPASSRLS, que a aplicação usa para toda query tenant-scoped
-- (ver src/lib/prisma-tenant.ts). O role de owner continua sendo usado só
-- para migrações, seed e operações legitimamente cross-tenant — login
-- (busca de usuário por e-mail, antes de saber o schoolId) e o painel do
-- PLATFORM_ADMIN (ver src/lib/prisma.ts).
--
-- O isolamento por schoolId funciona via uma variável de sessão Postgres
-- (`app.current_school_id`), setada por requisição com `SET LOCAL` dentro
-- de uma transação (ver withTenantContext em src/lib/prisma-tenant.ts).
-- Sem essa variável setada, current_setting(...) retorna NULL e a policy
-- não casa com nenhuma linha — fail-closed por padrão, não fail-open.
-- ============================================================================

-- Role de runtime, sem senha ainda: LOGIN sem senha definida = autenticação
-- por senha sempre falha. A senha é definida fora do controle de versão —
-- ver prisma/set-runtime-role-password.ts (rodar uma vez, manualmente).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'quitaedu_app') THEN
    CREATE ROLE quitaedu_app WITH LOGIN NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO quitaedu_app;

-- "schools" é a raiz do tenant, não uma tabela filha — sem RLS aqui.
-- Acesso cross-tenant (listar todas as escolas) é papel do PLATFORM_ADMIN
-- via src/lib/prisma.ts; acesso à própria escola (SCHOOL_MANAGER) é feito
-- por lookup direto de id na sessão, não por filtro RLS.
GRANT SELECT ON schools TO quitaedu_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  school_subaccounts,
  users,
  guardians,
  students,
  student_guardians,
  tuition_plans,
  charges,
  notification_logs,
  billing_rules,
  audit_logs
TO quitaedu_app;

-- Cobre tabelas de tenant criadas em migrações futuras.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO quitaedu_app;

-- ---------------------------------------------------------------------------
-- Tabelas com schoolId direto: policy de igualdade simples.
-- ---------------------------------------------------------------------------

ALTER TABLE school_subaccounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_subaccounts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON school_subaccounts
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON users
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardians FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON guardians
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE students FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON students
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE tuition_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE tuition_plans FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tuition_plans
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE charges FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON charges
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE billing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON billing_rules
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit_logs
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

-- ---------------------------------------------------------------------------
-- Tabelas sem schoolId direto: isolamento via subquery até a tabela pai
-- protegida (student_guardians -> students, notification_logs -> charges).
-- ---------------------------------------------------------------------------

ALTER TABLE student_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_guardians FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON student_guardians
  USING (EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = student_guardians."studentId"
      AND s."schoolId" = current_setting('app.current_school_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = student_guardians."studentId"
      AND s."schoolId" = current_setting('app.current_school_id', true)
  ));

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON notification_logs
  USING (EXISTS (
    SELECT 1 FROM charges c
    WHERE c.id = notification_logs."chargeId"
      AND c."schoolId" = current_setting('app.current_school_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM charges c
    WHERE c.id = notification_logs."chargeId"
      AND c."schoolId" = current_setting('app.current_school_id', true)
  ));
