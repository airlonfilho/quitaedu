# Data Model — Sistema de Gestão de Mensalidades Escolares

Extraído de `spec.md` (requisitos) e `plan.md` (contexto técnico). Este é o schema de dados que a Fase 0/Trilha B implementa.



## Schema Prisma (núcleo)

```prisma
// schema.prisma — núcleo do domínio. Convenções: snake_case no banco via @map,
// camelCase no client Prisma. Todo model com dado de tenant carrega schoolId.

model School {
  id            String   @id @default(cuid())
  name          String
  cnpj          String   @unique
  status        SchoolStatus @default(ONBOARDING)
  planTier      PlanTier @default(ESSENCIAL)
  createdAt     DateTime @default(now())

  subaccount    SchoolSubaccount?
  users         User[]
  guardians     Guardian[]
  students      Student[]
  tuitionPlans  TuitionPlan[]
  billingRules  BillingRule[]
  auditLogs     AuditLog[]

  @@map("schools")
}

model SchoolSubaccount {
  id              String   @id @default(cuid())
  schoolId        String   @unique
  school          School   @relation(fields: [schoolId], references: [id])
  asaasAccountId  String   @unique          // id da subconta no Asaas
  walletId        String                    // usado em split de pagamento
  apiKeyEncrypted String                    // NUNCA em texto plano — ver seção 6
  status          SubaccountStatus @default(PENDING_VERIFICATION)
  createdAt       DateTime @default(now())

  @@map("school_subaccounts")
}

model User {
  id           String   @id @default(cuid())
  schoolId     String?                          // null = admin da plataforma
  school       School?  @relation(fields: [schoolId], references: [id])
  email        String   @unique
  passwordHash String                           // bcrypt — login via credenciais (Auth.js), contas provisionadas por admin
  role         UserRole @default(SCHOOL_MANAGER)
  createdAt    DateTime @default(now())

  @@index([schoolId])
  @@map("users")
}

model Guardian {
  id          String   @id @default(cuid())
  schoolId    String
  school      School   @relation(fields: [schoolId], references: [id])
  name        String
  cpf         String
  phone       String                          // usado como identificador WhatsApp
  email       String?
  asaasCustomerId String?                     // id do cliente espelhado no Asaas

  students    StudentGuardian[]
  charges     Charge[]

  @@index([schoolId])
  @@unique([schoolId, cpf])
  @@map("guardians")
}

model Student {
  id          String   @id @default(cuid())
  schoolId    String
  school      School   @relation(fields: [schoolId], references: [id])
  name        String
  className   String?
  status      StudentStatus @default(ACTIVE)

  guardians   StudentGuardian[]
  tuitionPlanId String?
  tuitionPlan TuitionPlan? @relation(fields: [tuitionPlanId], references: [id])
  charges     Charge[]
  billingRuleOverride BillingRule?

  @@index([schoolId])
  @@map("students")
}

model StudentGuardian {
  studentId   String
  student     Student  @relation(fields: [studentId], references: [id])
  guardianId  String
  guardian    Guardian @relation(fields: [guardianId], references: [id])
  isPrimary   Boolean  @default(true)         // responsável financeiro principal

  @@id([studentId, guardianId])
  @@map("student_guardians")
}

model TuitionPlan {
  id          String   @id @default(cuid())
  schoolId    String
  school      School   @relation(fields: [schoolId], references: [id])
  name        String
  baseValue   Decimal  @db.Decimal(10, 2)
  dueDay      Int                              // dia do mês, 1-28
  discountRules Json?                          // ex: desconto por irmãos/pontualidade

  students    Student[]

  @@index([schoolId])
  @@map("tuition_plans")
}

model Charge {
  id              String   @id @default(cuid())
  schoolId        String                        // desnormalizado — evita join em toda query de dashboard
  studentId       String
  student         Student  @relation(fields: [studentId], references: [id])
  guardianId      String
  guardian        Guardian @relation(fields: [guardianId], references: [id])
  competencyMonth Int                            // 1-12
  competencyYear  Int
  value           Decimal  @db.Decimal(10, 2)
  status          ChargeStatus @default(PENDING)
  asaasChargeId   String   @unique
  pixQrCode       String?  @db.Text
  boletoUrl       String?
  paidAt          DateTime?
  createdAt       DateTime @default(now())

  notifications   NotificationLog[]

  @@index([schoolId, status])
  @@index([studentId, competencyYear, competencyMonth])
  @@unique([studentId, competencyYear, competencyMonth])   // uma cobrança por aluno/mês
  @@map("charges")
}

model NotificationLog {
  id          String   @id @default(cuid())
  chargeId    String
  charge      Charge   @relation(fields: [chargeId], references: [id])
  channel     NotificationChannel
  status      String                            // status bruto retornado pelo webhook Asaas
  sentAt      DateTime?
  createdAt   DateTime @default(now())

  @@index([chargeId])
  @@map("notification_logs")
}

model BillingRule {
  id            String   @id @default(cuid())
  schoolId      String
  school        School   @relation(fields: [schoolId], references: [id])
  studentId     String?  @unique               // null = regra padrão da escola; preenchido = override individual
  student       Student? @relation(fields: [studentId], references: [id])
  daysBefore    Int[]    @default([5])          // ex: [5] = lembrete 5 dias antes
  daysAfter     Int[]    @default([1, 7])        // ex: cobrança em atraso em D+1 e D+7
  channels      NotificationChannel[]
  active        Boolean  @default(true)

  @@index([schoolId])
  @@map("billing_rules")
}

model AuditLog {
  id          String   @id @default(cuid())
  schoolId    String
  school      School   @relation(fields: [schoolId], references: [id])
  userId      String
  action      String                            // ex: "charge.created", "billing_rule.updated"
  entityType  String
  entityId    String
  metadata    Json?
  createdAt   DateTime @default(now())

  @@index([schoolId, createdAt])
  @@map("audit_logs")
}

enum SchoolStatus {
  ONBOARDING
  ACTIVE
  SUSPENDED
  CANCELLED
}

enum SubaccountStatus {
  PENDING_VERIFICATION
  ACTIVE
  RESTRICTED
}

enum PlanTier {
  ESSENCIAL
  PROFISSIONAL
  ESCOLA_PLUS
}

enum UserRole {
  PLATFORM_ADMIN
  SCHOOL_MANAGER
}

enum StudentStatus {
  ACTIVE
  INACTIVE
}

enum ChargeStatus {
  PENDING
  PAID
  OVERDUE
  CANCELLED
}

enum NotificationChannel {
  WHATSAPP
  EMAIL
  SMS
  VOICE
}
```

## Decisões de modelagem que merecem justificativa

- **`Charge.schoolId` desnormalizado**: tecnicamente redundante (dá para chegar em `school` via `student`), mas todo filtro de multi-tenancy e todo índice de dashboard passa por `schoolId` — desnormalizar evita join obrigatório em toda query de listagem de cobrança, que é a query mais frequente do sistema.
- **`StudentGuardian` como tabela de junção N:N**: um aluno pode ter mais de um responsável financeiro (pai e mãe separados, por exemplo), e um responsável pode ter mais de um filho na escola (desconto por irmãos depende disso).
- **`BillingRule.studentId` nullable com override**: a régua padrão é por escola; quando um aluno específico precisa de tratamento diferente (renegociação em andamento, por exemplo — ver Artigo VI da Constitution), cria-se uma linha com `studentId` preenchido, que tem prioridade sobre a regra padrão da escola.
- **Sem `MessageTemplate` no schema**: o conteúdo da mensagem é responsabilidade do Asaas (Constitution, Artigo II) — não modelamos template porque não o controlamos até validação técnica (ver seção 7, risco aberto).
- **`User.passwordHash`**: adicionado na implementação de B-003 (autenticação). `plan.md` deixava em aberto NextAuth vs Clerk; optou-se por NextAuth (Auth.js v5) com provider de credenciais (email + senha) e sessão JWT — sem tabelas `Account`/`Session`/`VerificationToken` do adapter padrão, já que não há OAuth nem sessão em banco no MVP. Contas são provisionadas por um admin (sem self-signup), coerente com o modelo B2B do produto.
- **RLS (B-004)**: o role de owner usado pelas migrações (`neondb_owner` no Neon) tem `BYPASSRLS` — por isso a aplicação roda suas queries tenant-scoped com um role de runtime separado (`quitaedu_app`, sem `BYPASSRLS`, criado em `prisma/migrations/20260821164944_multi_tenant_rls`), autenticado via `RUNTIME_DATABASE_URL`. Toda tabela com `schoolId` tem `ENABLE`+`FORCE ROW LEVEL SECURITY` e uma policy `USING/WITH CHECK` contra `current_setting('app.current_school_id')`; `student_guardians` e `notification_logs` (sem `schoolId` direto) usam policy via subquery até a tabela pai. Ver `src/lib/prisma-tenant.ts` (`withTenantContext`) e `src/lib/tenant-context.ts` (extrai `schoolId` da sessão, nunca do payload).
