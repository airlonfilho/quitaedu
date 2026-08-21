# Documento Arquitetural — Sistema de Gestão de Mensalidades Escolares

Versão 1.0 · Documento de apoio complementar a `../specs/001-sistema-mensalidades-escolares/` — traz diagramas de sequência, segurança e deploy que não fazem parte da convenção padrão do Spec Kit. O schema de dados vive em `../specs/001-sistema-mensalidades-escolares/data-model.md` e os contratos de API em `../specs/001-sistema-mensalidades-escolares/contracts/api.md`; este documento não duplica o conteúdo deles, só referencia.

---

## 1. Visão geral e princípios arquiteturais

Sistema SaaS multi-tenant onde cada escola-cliente opera de forma isolada, mas toda a infraestrutura financeira (pagamento, régua de cobrança, negativação) é delegada ao **Asaas via subconta white label**. O backend próprio não processa pagamento nem dispara mensagem — ele **orquestra** o Asaas e mantém um **espelho local** dos dados para dashboard, regras de negócio e continuidade de serviço.

Três princípios guiam toda decisão técnica abaixo (herdados da Constitution):

1. **Não reconstruir o que o Asaas já resolve** (Artigo II) — sem gateway próprio, sem motor de WhatsApp próprio.
2. **Isolamento de tenant é inegociável** (Artigo IV) — todo dado sensível carrega `school_id`, sem exceção.
3. **O espelho local nunca é a fonte de verdade financeira** — o Asaas é. O banco local existe para performance e resiliência, não para substituir a API.

---

## 2. Arquitetura de componentes

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Painel Web (Next.js)                        │
│   Gestor da escola  │  Admin da plataforma  │  (v2: Portal do resp.)│
└───────────────────────────────┬───────────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  API Layer               │
                    │  (Route Handlers/Server   │
                    │   Actions, Next.js)       │
                    └──────┬───────────┬───────┘
                            │           │
              ┌─────────────▼──┐   ┌───▼─────────────────┐
              │  PostgreSQL      │   │  Fila (BullMQ/Redis) │
              │  (espelho local) │   │  jobs assíncronos    │
              └─────────────┬──┘   └───┬─────────────────┘
                            │           │
                            │      ┌────▼─────────────────────┐
                            │      │  Workers                  │
                            │      │  - criar subconta          │
                            │      │  - criar cobrança (cron)   │
                            │      │  - processar webhook       │
                            │      │  - reconciliação periódica │
                            │      └────┬─────────────────────┘
                            │           │
                            │      ┌────▼─────────────────────────────┐
                            └──────►  API Asaas (conta raiz)            │
                                   │  ┌──────────────┐ ┌──────────────┐ │
                                   │  │ Subconta      │ │ Subconta      │ │
                                   │  │ Escola A       │ │ Escola B       │ │
                                   │  │ (cobrança,     │ │ (cobrança,     │ │
                                   │  │  régua, Serasa)│ │  régua, Serasa)│ │
                                   │  └──────┬───────┘ └──────┬───────┘ │
                                   └─────────┼──────────────────┼───────┘
                                             │  Webhooks         │
                                   ┌─────────▼──────────────────▼───────┐
                                   │  Endpoint de webhook (idempotente)   │
                                   │  atualiza espelho local + auditoria  │
                                   └───────────────────────────────────────┘
```

**Fluxo de dados**: toda escrita financeira (criar cobrança, configurar régua) sai do painel → API layer → chamada síncrona ou enfileirada para o Asaas → resposta atualiza o espelho local imediatamente (otimista) → webhook confirma/corrige o estado real posteriormente.

---

## 3. Modelo de dados

### 3.1 Schema Prisma (núcleo)

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
  id        String   @id @default(cuid())
  schoolId  String?                          // null = admin da plataforma
  school    School?  @relation(fields: [schoolId], references: [id])
  email     String   @unique
  role      UserRole @default(SCHOOL_MANAGER)
  createdAt DateTime @default(now())

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

### 3.2 Decisões de modelagem que merecem justificativa

- **`Charge.schoolId` desnormalizado**: tecnicamente redundante (dá para chegar em `school` via `student`), mas todo filtro de multi-tenancy e todo índice de dashboard passa por `schoolId` — desnormalizar evita join obrigatório em toda query de listagem de cobrança, que é a query mais frequente do sistema.
- **`StudentGuardian` como tabela de junção N:N**: um aluno pode ter mais de um responsável financeiro (pai e mãe separados, por exemplo), e um responsável pode ter mais de um filho na escola (desconto por irmãos depende disso).
- **`BillingRule.studentId` nullable com override**: a régua padrão é por escola; quando um aluno específico precisa de tratamento diferente (renegociação em andamento, por exemplo — ver Artigo VI da Constitution), cria-se uma linha com `studentId` preenchido, que tem prioridade sobre a regra padrão da escola.
- **Sem `MessageTemplate` no schema**: o conteúdo da mensagem é responsabilidade do Asaas (Constitution, Artigo II) — não modelamos template porque não o controlamos até validação técnica (ver seção 7, risco aberto).

---

## 4. Fluxos principais (sequência)

### 4.1 Onboarding de nova escola

```
Admin plataforma      Painel/API           Asaas API           PostgreSQL
      │                    │                    │                   │
      │ cria escola         │                    │                   │
      ├───────────────────►│                     │                   │
      │                    │ INSERT School        │                   │
      │                    ├─────────────────────────────────────────►│
      │                    │ POST /accounts        │                   │
      │                    │ (dados da escola)      │                   │
      │                    ├───────────────────►│                   │
      │                    │  { accountId,          │                   │
      │                    │    apiKey, walletId }  │                   │
      │                    │◄───────────────────┤                   │
      │                    │ criptografa apiKey       │                   │
      │                    │ INSERT SchoolSubaccount   │                   │
      │                    │ (status=PENDING_VERIFICATION)             │
      │                    ├─────────────────────────────────────────►│
      │  escola criada,     │                    │                   │
      │  aguardando          │                    │                   │
      │  verificação Asaas   │                    │                   │
      │◄───────────────────┤                     │                   │
```

Ponto de atenção: a subconta pode nascer em `PENDING_VERIFICATION` — o sistema precisa lidar com esse estado no painel (ex: bloquear geração de cobrança até `ACTIVE`), não assumir que a subconta está pronta para uso imediatamente após a criação.

### 4.2 Geração mensal de cobrança + régua

```
Cron (dia configurado)   Worker              Asaas API (subconta)   PostgreSQL
        │                   │                       │                  │
        │ dispara job        │                       │                  │
        ├──────────────────►│                        │                  │
        │                   │ SELECT students ACTIVE   │                  │
        │                   │ WHERE school.status=ACTIVE│                  │
        │                   ├──────────────────────────────────────────►│
        │                   │  lista de alunos           │                  │
        │                   │◄──────────────────────────────────────────┤
        │                   │ para cada aluno:             │                  │
        │                   │  POST /payments               │                  │
        │                   │  (valor, vencimento, cliente)  │                  │
        │                   ├───────────────────────►│                  │
        │                   │   { id, pixQrCode,         │                  │
        │                   │     boletoUrl, status }    │                  │
        │                   │◄───────────────────────┤                  │
        │                   │ INSERT Charge                │                  │
        │                   ├──────────────────────────────────────────►│
        │                   │ PUT /billing-rules            │                  │
        │                   │ (régua configurada p/ cliente) │                  │
        │                   ├───────────────────────►│                  │
```

Idempotência: antes de criar a cobrança, o worker verifica a constraint única `(studentId, competencyYear, competencyMonth)` — se o job rodar duas vezes (retry de infraestrutura, por exemplo), a segunda tentativa não duplica cobrança.

### 4.3 Webhook de pagamento confirmado

```
Asaas                Endpoint webhook        PostgreSQL          Dashboard (SSE/polling)
  │                        │                      │                      │
  │ POST /webhooks/asaas    │                      │                      │
  │ { event: PAYMENT_RECEIVED,                     │                      │
  │   payment: {...} }      │                      │                      │
  ├───────────────────────►│                       │                      │
  │                        │ valida assinatura       │                      │
  │                        │ webhook (HMAC)           │                      │
  │                        │ verifica idempotência    │                      │
  │                        │ (event id já processado?)│                      │
  │                        ├─────────────────────────►│                      │
  │                        │  não processado           │                      │
  │                        │◄─────────────────────────┤                      │
  │                        │ UPDATE Charge SET           │                      │
  │                        │  status=PAID, paidAt=now()  │                      │
  │                        ├─────────────────────────►│                      │
  │                        │ INSERT AuditLog               │                      │
  │                        ├─────────────────────────►│                      │
  │  200 OK                │                          │                      │
  │◄───────────────────────┤                          │                      │
  │                        │                          │  dashboard atualiza    │
  │                        │                          │  taxa de inadimplência │
  │                        │                          │◄─────────────────────┤
```

Todo webhook responde `200 OK` rapidamente e processa de forma assíncrona (enfileirado) — nunca faz o Asaas esperar por processamento pesado, sob risco de o provedor considerar o endpoint indisponível e desativar o webhook.

### 4.4 Reconciliação de segurança (fallback de webhook perdido)

```
Cron (a cada N horas)   Worker                  Asaas API              PostgreSQL
        │                  │                        │                     │
        │ dispara job        │                        │                     │
        ├─────────────────►│                         │                     │
        │                  │ SELECT charges WHERE       │                     │
        │                  │ status=PENDING AND          │                     │
        │                  │ createdAt < (agora - X dias) │                     │
        │                  ├───────────────────────────────────────────────►│
        │                  │  lista de cobranças suspeitas  │                     │
        │                  │◄───────────────────────────────────────────────┤
        │                  │ para cada uma:                   │                     │
        │                  │  GET /payments/{id}                │                     │
        │                  ├────────────────────────►│                     │
        │                  │   status real no Asaas       │                     │
        │                  │◄────────────────────────┤                     │
        │                  │ se divergente: corrige local +     │                     │
        │                  │ registra em AuditLog (webhook_missed)│                     │
        │                  ├───────────────────────────────────────────────►│
```

---

## 5. Contratos de API (interno)

Endpoints do próprio backend consumidos pelo painel (não confundir com a API do Asaas). Convenção REST sobre Next.js Route Handlers.

| Método | Rota | Descrição | Autorização |
|---|---|---|---|
| `POST` | `/api/schools` | Cria escola + dispara criação de subconta Asaas | `PLATFORM_ADMIN` |
| `GET` | `/api/schools/:id` | Detalhe da escola | `PLATFORM_ADMIN`, `SCHOOL_MANAGER` (própria escola) |
| `POST` | `/api/students` | Cadastra aluno | `SCHOOL_MANAGER` |
| `POST` | `/api/tuition-plans` | Cria plano de mensalidade | `SCHOOL_MANAGER` |
| `POST` | `/api/charges/generate` | Dispara geração manual de cobrança (fora do cron) | `SCHOOL_MANAGER` |
| `GET` | `/api/charges?status=&studentId=&competency=` | Lista cobranças com filtros | `SCHOOL_MANAGER` |
| `POST` | `/api/billing-rules` | Cria/atualiza régua (escola ou override de aluno) | `SCHOOL_MANAGER` |
| `POST` | `/api/webhooks/asaas` | Recebe eventos do Asaas | Validação HMAC (não sessão de usuário) |
| `GET` | `/api/dashboard/summary?schoolId=` | Indicadores agregados de inadimplência | `SCHOOL_MANAGER` |

Toda rota autenticada de `SCHOOL_MANAGER` aplica filtro por `schoolId` extraído da sessão — nunca do payload da requisição (impede um gestor de uma escola consultar dado de outra só trocando um parâmetro).

---

## 6. Segurança e multi-tenancy

- **Isolamento por `school_id`**: todo model com dado de tenant carrega a coluna. Camada de aplicação (middleware do Prisma ou wrapper de query) injeta o filtro automaticamente — não fica a critério de cada endpoint lembrar de filtrar.
- **Row Level Security (RLS) no PostgreSQL** como segunda camada, independente da aplicação: mesmo um bug na camada de aplicação não vaza dado entre tenants, porque o banco recusa a query.
- **Credenciais de subconta (`apiKeyEncrypted`)**: nunca armazenadas em texto plano. Criptografadas em repouso (ex: `pgcrypto` ou KMS externo) e nunca retornadas em nenhuma resposta de API ao frontend — usadas só server-side, na chamada direta ao Asaas.
- **Webhook do Asaas**: validado por assinatura (verificar na documentação do Asaas o mecanismo exato — HMAC ou token estático por endpoint) antes de qualquer processamento. Sem validação de origem, o endpoint de webhook é uma porta aberta para injeção de eventos falsos de pagamento.
- **LGPD**: dados de responsável financeiro (CPF, telefone) e de aluno menor são tratados como sensíveis por padrão — acesso restrito a `SCHOOL_MANAGER` da própria escola e `PLATFORM_ADMIN`, nunca expostos em log de aplicação, e `AuditLog` registra quem acessou/alterou o quê.

---

## 7. Riscos técnicos abertos (herdados do plan.md, detalhados aqui)

| Risco | Impacto se não mitigado | Ação antes de comprometer roadmap |
|---|---|---|
| Nível de customização da mensagem de WhatsApp do Asaas ainda não confirmado | Promessa comercial de "cobrança com a cara da escola" pode não ser tecnicamente entregável | Testar em sandbox Asaas antes de vender isso como diferencial (T013 do tasks.md) |
| Mecanismo exato de assinatura de webhook do Asaas não detalhado neste documento | Endpoint de webhook vulnerável a eventos falsificados | Confirmar na documentação oficial do Asaas antes de implementar `/api/webhooks/asaas` |
| Prazo de verificação/KYC de subconta nova | Onboarding de escola-piloto pode travar em `PENDING_VERIFICATION` por tempo indefinido | Mapear prazo real com o Asaas antes de prometer SLA de ativação a um cliente |
| Rate limit da API Asaas em geração de cobrança em lote (dia de vencimento concentrado) | Job de geração mensal pode falhar parcialmente se muitas escolas tiverem o mesmo dia de vencimento | Confirmar limites de requisição por segundo/minuto da API e implementar backoff no worker |

---

## 8. Deploy e ambientes

- **Ambientes**: `sandbox` (Asaas sandbox + banco de dev), `staging` (Asaas produção com escola de teste interna), `production`.
- **Hospedagem sugerida**: Vercel para o Next.js (aproveitando Vercel Cron para os jobs agendados simples); worker de fila (BullMQ) em processo separado — Railway ou Fly.io — já que jobs de fila de longa duração não se encaixam bem no modelo serverless da Vercel.
- **Banco de dados**: PostgreSQL gerenciado (ex: Neon, Supabase ou RDS) com backup automático — é o único armazenamento de estado do sistema fora do Asaas, perda de dados aqui é crítica.
- **Observabilidade mínima para produção**: alerta quando o endpoint de webhook falhar consecutivamente, alerta quando o job de reconciliação encontrar divergência acima de um limiar, log estruturado de toda chamada à API do Asaas (sem logar `apiKey`).

---

## 9. O que este documento não cobre (fica para depois)

- Design de UI/UX do painel (fica para documento de design/wireframe separado).
- Portal do responsável financeiro (Fase 4 do plan.md — arquitetura só quando a Fase 4 entrar em desenvolvimento).
- Estratégia de comunicação própria via WhatsApp fora do escopo de cobrança (Fase 5, condicional).
