# Tasks — Sistema de Gestão de Mensalidades Escolares

## Trilhas de execução

O trabalho se divide em três trilhas. Duas podem começar **imediatamente e em paralelo**; a terceira tem uma dependência de validação prévia, mas essa validação em si não bloqueia as outras duas.

| Trilha | Prefixo | Depende de | Pode começar |
|---|---|---|---|
| **A — Design + Frontend** | `F-xxx` | Contrato de API (`contracts/api.md`) | Imediatamente, contra dados mockados |
| **B — Backend sem integração Asaas** | `B-xxx` | Nada externo | Imediatamente |
| **C — Integração Asaas** | `A-xxx` | Validação em sandbox (A-006) | A validação começa imediatamente; o resto da trilha espera o resultado dela |

**Ponto de convergência**: quando a trilha B tiver CRUD real funcionando, a trilha A substitui os dados mockados pela API real — isso pode acontecer **antes** da trilha C estar pronta. Cadastro de aluno/escola pode funcionar de verdade enquanto cobrança ainda está sendo validada.

**Risco que afeta mais de uma trilha**: se A-006 (validação de customização de WhatsApp) vier negativa, isso muda o design da tela de notificação (Trilha A, tela 4.11 do `../../docs/ui-ux-especificacao.md`) e potencialmente o discurso comercial do pitch. É o item mais barato de resolver primeiro, mesmo rodando em paralelo com o resto.

---

## Trilha A — Design + Frontend

Referência: `../../docs/ui-ux-especificacao.md` (as 19 telas especificadas).

- [ ] F-001 Setup do projeto frontend (Next.js 15 + React 19 + TypeScript + Tailwind), estrutura de rotas
- [ ] F-002 Sistema de design definido pelo sócio (componentes base, tipografia, cores) — ver seção 7 de `../../docs/ui-ux-especificacao.md`, perguntas em aberto de UX
- [ ] F-003 Tela de Login + roteamento por papel (`SCHOOL_MANAGER` / `PLATFORM_ADMIN`)
- [ ] F-004 Dashboard / visão geral do gestor (tela 4.2)
- [ ] F-005 Alunos — lista e cadastro/edição (telas 4.3, 4.4)
- [ ] F-006 Aluno — detalhe com histórico de cobrança (tela 4.5)
- [ ] F-007 Responsáveis financeiros — lista e cadastro/edição (telas 4.6, 4.7)
- [ ] F-008 Planos de mensalidade — lista e cadastro/edição (telas 4.8, 4.9)
- [ ] F-009 Cobranças — lista com filtros (tela 4.10)
- [ ] F-010 Cobrança — detalhe individual (tela 4.11)
- [ ] F-011 Régua de cobrança — configuração da escola e override por aluno (telas 4.12, 4.13)
- [ ] F-012 Relatórios / exportação (tela 4.14)
- [ ] F-013 Configurações da escola, incluindo status da subconta Asaas (tela 4.15)
- [ ] F-014 Área do Admin: lista de escolas, cadastro/onboarding, detalhe (telas 4.16-4.18)
- [ ] F-015 Substituir dados mockados por integração real com a API conforme Trilha B entrega cada endpoint

## Trilha B — Backend sem integração Asaas

Referência: `data-model.md` e `contracts/api.md`.

- [x] B-001 Setup do repositório (Next.js 15 + TypeScript + Prisma + PostgreSQL)
- [x] B-002 Schema Prisma completo (`School`, `SchoolSubaccount`, `User`, `Guardian`, `Student`, `StudentGuardian`, `TuitionPlan`, `Charge`, `NotificationLog`, `BillingRule`, `AuditLog`) — copiar direto de `data-model.md`
- [x] B-003 Autenticação e controle de papéis (`PLATFORM_ADMIN` / `SCHOOL_MANAGER`)
- [x] B-004 Middleware de isolamento multi-tenant (filtro obrigatório por `schoolId` extraído da sessão, nunca do payload) + Row Level Security no Postgres
- [x] B-005 Endpoints CRUD de escola (`POST/GET /api/schools`)
- [x] B-006 Endpoints CRUD de alunos e responsáveis financeiros, incluindo vínculo N:N (`StudentGuardian`)
- [x] B-007 Endpoints CRUD de planos de mensalidade
- [x] B-008 Endpoint de listagem de cobranças com filtros (`GET /api/charges`) — inicialmente sem gerar cobrança real, só a estrutura
- [x] B-009 Endpoint de régua (`POST /api/billing-rules`) — estrutura de dados pronta, sem disparo real ainda
- [x] B-010 Endpoint de dashboard (`GET /api/dashboard/summary`) — indicadores calculados sobre dados que existirem localmente

## Trilha C — Integração Asaas

Referência: `../../docs/arquitetura-completa.md` (seções 2, 4 e 6).

- [x] A-006 **Validar em sandbox**: criação de subconta via API, configuração de régua por cliente, e principalmente quanto dá pra customizar a mensagem de WhatsApp — testado de verdade contra `api-sandbox.asaas.com`; resposta: texto da mensagem não é customizável, criação de subconta bloqueada por conta raiz ser PF (ver `research.md`, seção "A-006 — resultado da validação em sandbox")
- [x] A-007 Confirmar mecanismo de assinatura de webhook do Asaas (HMAC ou token) na documentação oficial — é token estático no header `asaas-access-token`, não HMAC (ver `research.md`)
- [x] A-008 Confirmar prazo típico de verificação/KYC de subconta nova — até 48h para análise automática de documentos, mais uma janela regulatória de até 60 dias com limites (ver `research.md`)
- [ ] A-009 Serviço de criação automática de subconta Asaas no onboarding de escola (armazenar `apiKey` criptografada + `walletId`) — **bloqueado**: exige conta raiz Pessoa Jurídica (CNPJ), que a Quitaedu ainda não tem (ver `research.md`)
- [x] A-010 Serviço de criação de cobrança (Pix + boleto + cartão) via API — implementado usando a conta raiz sandbox como escola-piloto simulada (ver `src/lib/asaas-charges.ts`, `POST /api/charges/generate`), testado com cobrança real gerada e idempotência confirmada
- [x] A-011 Job agendado de geração mensal de cobranças (cron), com verificação de idempotência via constraint única — implementado (`src/lib/asaas-monthly-generation.ts`, `POST /api/cron/generate-charges`) e agendado via `vercel.json` (Vercel Cron nativo, dia 1 às 06:00 UTC — antes do menor `dueDay` típico, ver risco de `dueDate` no passado)
- [x] A-012 Serviço de configuração da régua de notificação por cliente via API — implementado (`src/lib/asaas-billing-rules.ts`), testado contra sandbox real; achado importante: `scheduleOffset` aceita só um conjunto restrito de valores por slot, não é livre (ver `research.md`)
- [x] A-013 Endpoint de webhook (`/api/webhooks/asaas`) com validação de token e processamento idempotente — implementado e testado com payload simulado (token errado → 401, evento mapeado atualiza status, evento/cobrança desconhecidos são aceitos sem efeito)
- [x] A-014 Job de reconciliação periódica (fallback para webhook perdido/atrasado) — implementado (`src/lib/asaas-reconciliation.ts`, `POST /api/cron/reconcile-charges`)
- [x] A-015 Emissão de segunda via sob demanda — implementado (`GET /api/charges/:id/second-copy`), testado retornando link de fatura/boleto/Pix ao vivo do Asaas

---

## Fases seguintes (cruzam as três trilhas)

### Fase — Piloto
- [x] P-001 Ambiente de produção configurado (deploy, monitoramento, alertas) — Trilha B. Deploy no Vercel testado ponta a ponta (login, cobrança real, webhook real do Asaas, cron agendado); monitoramento via Sentry (integração nativa Vercel↔Sentry) — captura automática de erro não tratado em toda rota (`instrumentation.ts`/`onRequestError`) + captura explícita das falhas "silenciosas" dos crons de geração/reconciliação (hoje só voltavam num array de erro no JSON, ninguém via). Alerta por e-mail em issue novo é o padrão do Sentry, não precisou configurar nada extra. Verificado com erro real disparado localmente e confirmado no dashboard.
- [ ] P-002 Onboarding de 1-2 escolas-piloto reais, incluindo verificação de subconta — Trilha C
- [ ] P-003 Ciclo de feedback estruturado, atenção especial ao conteúdo das mensagens de régua — todas as trilhas
- [ ] P-004 Ajustes de UX baseados no piloto — Trilha A

### Fase — Portal do responsável (pós-validação)
- [ ] R-001 Login simplificado para responsável (magic link ou OTP) — Trilhas A + B
- [ ] R-002 Histórico de pagamentos e segunda via self-service — Trilhas A + B + C

### Fase — Comunicação própria (avaliar pós-MVP)
- [ ] X-001 Decisão go/no-go: vale construir camada própria de WhatsApp fora do escopo de cobrança?
- [ ] X-002 Se sim: escopo, BSP e templates dedicados

---

## Dependências-chave

- Trilha A e Trilha B começam no dia 1, em paralelo, sem dependência entre si até F-015.
- A-006 a A-008 (validação/confirmação) começam no dia 1 e não bloqueiam nada além da própria Trilha C.
- A-009 em diante (Trilha C, implementação) só começa depois de A-006 confirmado.
- P-002 (onboarding piloto) depende de A-008 estar mapeado — é o mesmo risco de prazo que antes era "aprovação de template WhatsApp", agora é "verificação de subconta".
- F-015 (integração real) depende de cada endpoint da Trilha B estar pronto — pode ser feito endpoint a endpoint, não precisa esperar a Trilha B inteira.
