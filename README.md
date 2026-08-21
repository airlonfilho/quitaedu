# Sistema de Gestão de Mensalidades Escolares

Repositório de especificação no padrão [GitHub Spec Kit](https://github.com/github/spec-kit) — Spec-Driven Development. Este README é o ponto de entrada para qualquer agente de código (Claude Code incluso) ou pessoa nova no projeto.

## Estrutura (convenção padrão do Spec Kit)

```
.specify/
└── memory/
    └── constitution.md          # princípios não-negociáveis do projeto

specs/
└── 001-sistema-mensalidades-escolares/
    ├── spec.md                    # requisitos: personas, user stories, FR/NFR, fora de escopo
    ├── plan.md                    # contexto técnico, stack, constitution check
    ├── research.md                # decisões técnicas (por quê), riscos abertos, pesquisa de concorrência
    ├── data-model.md              # entidades e schema Prisma
    ├── contracts/
    │   └── api.md                   # contratos da API interna
    ├── quickstart.md              # cenário de validação ponta a ponta
    └── tasks.md                   # tarefas executáveis, em 3 trilhas paralelas

docs/                              # apoio — fora da convenção padrão do Spec Kit, mas necessário ao projeto
├── arquitetura-completa.md          # diagramas de sequência, segurança, deploy
├── ui-ux-especificacao.md            # as 19 telas do painel (funcional, sem decisão visual)
├── documento-referencia-socio.md      # contexto de negócio para conversa societária
└── pitch-sistema-mensalidades-escolares.md  # pitch com dados de mercado
```

## Ordem de leitura recomendada

Para implementar (Claude Code ou qualquer agente):

1. `.specify/memory/constitution.md` — os princípios que nenhuma decisão de código pode violar.
2. `specs/001-sistema-mensalidades-escolares/spec.md` — o quê e por quê.
3. `specs/001-sistema-mensalidades-escolares/plan.md` — stack e abordagem técnica.
4. `specs/001-sistema-mensalidades-escolares/research.md` — decisões já tomadas e riscos ainda abertos.
5. `specs/001-sistema-mensalidades-escolares/data-model.md` + `contracts/api.md` — o contrato de implementação.
6. `docs/ui-ux-especificacao.md` — as telas, se estiver trabalhando na Trilha A.
7. `specs/001-sistema-mensalidades-escolares/quickstart.md` — como saber se está funcionando.
8. `specs/001-sistema-mensalidades-escolares/tasks.md` — **comece a trabalhar por aqui**, voltando aos documentos acima conforme cada tarefa pedir.

Para contexto de negócio (não necessário para codar): `docs/documento-referencia-socio.md` e `docs/pitch-sistema-mensalidades-escolares.md`.

## Trilhas de execução

Três trilhas paralelizáveis, detalhadas em `tasks.md`:

| Trilha | Prefixo de tarefa | Bloqueio |
|---|---|---|
| Design + Frontend | `F-xxx` | Nenhum — começa contra dados mockados |
| Backend sem integração Asaas | `B-xxx` | Nenhum |
| Integração Asaas | `A-xxx` | Validação em sandbox (`A-006`) antes da implementação (`A-009` em diante) |

## Regras que atravessam todo o código

- Todo model do Prisma com dado de escola carrega `schoolId` (Constitution, Artigo IV) — sem exceção.
- Nenhuma chamada ao Asaas é feita direto do frontend — sempre server-side; a `apiKey` da subconta nunca é exposta ao cliente.
- Não construir motor de envio de WhatsApp, gateway de pagamento, ou régua de cobrança própria (Constitution, Artigo II) — isso é delegado ao Asaas. Se o código estiver reimplementando algo que o Asaas já faz, é sinal de que o escopo saiu do combinado.
- Todo endpoint que filtra por `schoolId` extrai da sessão autenticada, nunca aceita como parâmetro do cliente.

## Nota sobre como este repositório foi gerado

Num fluxo padrão do Spec Kit, `constitution.md`, `spec.md`, `plan.md` e `tasks.md` nascem dos comandos `/speckit.constitution`, `/speckit.specify`, `/speckit.plan` e `/speckit.tasks` dentro de um agente configurado com o toolkit. Neste projeto, esses artefatos foram construídos manualmente em conversa com Claude, seguindo a mesma estrutura e o mesmo propósito de cada arquivo — o conteúdo é equivalente ao que o fluxo de comandos geraria, mas não foi executado via CLI `specify`.
