# Implementation Plan — Sistema de Gestão de Mensalidades Escolares

**Branch**: `001-sistema-mensalidades-escolares` | **Spec**: [spec.md](./spec.md) | **Constitution**: [constitution.md](../../.specify/memory/constitution.md)

## Resumo

Sistema SaaS multi-tenant para escolas particulares gerenciarem mensalidades e automatizarem cobrança via WhatsApp. A decisão de arquitetura central — detalhada em `research.md` — é delegar toda a infraestrutura financeira (pagamento, régua de notificação, negativação) ao Asaas via subconta white label, em vez de construir gateway de pagamento e motor de mensageria próprios.

## Contexto técnico

| Item | Decisão |
|---|---|
| **Linguagem/Runtime** | TypeScript, Node.js 20 |
| **Framework** | Next.js 15 (App Router), React 19 |
| **Persistência** | PostgreSQL + Prisma 6 (espelho local — não é a fonte de verdade financeira, ver Constitution Artigo III) |
| **Fila/jobs assíncronos** | BullMQ + Redis |
| **Infraestrutura financeira** | Asaas — subconta white label por escola (ver `research.md`) |
| **Auth** | NextAuth ou Clerk, com papéis `PLATFORM_ADMIN` / `SCHOOL_MANAGER` |
| **Hospedagem** | Vercel (app Next.js + cron simples) + Railway/Fly.io (worker de fila) |
| **Testes de integração alvo** | Fluxo completo descrito em `quickstart.md` |
| **Escala alvo** | Poucas escolas-piloto no MVP; até ~500 alunos por escola (ver distribuição de porte em `pitch-sistema-mensalidades-escolares.md`, em `../../docs/`) |

## Constitution Check

Antes de aprovar este plano, cada artigo da constitution foi confrontado com a abordagem escolhida:

- **Artigo I (escopo só financeiro)**: ✅ nenhum requisito deste plano toca módulo pedagógico.
- **Artigo II (não reconstruir o que o Asaas resolve)**: ✅ nenhuma tarefa deste plano inclui gateway ou BSP próprio.
- **Artigo III (cada escola é subconta Asaas)**: ✅ modelagem de dados (`data-model.md`) inclui `SchoolSubaccount` como entidade de primeira classe.
- **Artigo IV (isolamento multi-tenant)**: ✅ todo model sensível carrega `schoolId` (`data-model.md`).
- **Artigo V (LGPD by design)**: ✅ decisão de criptografia de credenciais e RLS documentada em `data-model.md`/`contracts/api.md`.
- **Artigo VI (humano no loop)**: ✅ `BillingRule` com override por aluno é requisito de primeira classe, não add-on.
- **Artigo VII (simplicidade antes de escala)**: ✅ ver `quickstart.md` — o MVP valida um fluxo simples antes de qualquer otimização de performance.
- **Artigo VIII (diferencial é a camada de nicho)**: ✅ nenhuma tarefa deste plano reimplementa cobrança/mensageria — só orquestra e modela o domínio escolar.

Nenhuma violação — não há necessidade de seção "Complexity Tracking".

## Estrutura de artefatos gerados

```
specs/001-sistema-mensalidades-escolares/
├── spec.md          # requisitos funcionais e não-funcionais
├── plan.md           # este arquivo
├── research.md       # decisões técnicas e por quê (Asaas, riscos abertos, concorrência)
├── data-model.md      # entidades e schema Prisma
├── contracts/
│   └── api.md          # contratos de API interna
├── quickstart.md      # fluxo de validação ponta a ponta
└── tasks.md           # tarefas executáveis, divididas em 3 trilhas
```

## Fases de entrega (visão de alto nível)

Execução real dividida em três trilhas paralelas — ver `tasks.md`. Como fases sequenciais de referência:

1. **Fase 0 — Fundação**: setup, auth, modelagem multi-tenant, CRUD básico.
2. **Fase 1 — Integração Asaas**: subconta, cobrança, régua nativa, webhook, reconciliação.
3. **Fase 2 — Dashboard**: indicadores de inadimplência, filtros, exportação.
4. **Fase 3 — Piloto**: 1-2 escolas reais, validação da régua na prática.
5. **Fase 4 — Portal do responsável** (pós-validação comercial).
6. **Fase 5 — Comunicação própria** (avaliar só se pós-MVP justificar).
