# API Contracts — Sistema de Gestão de Mensalidades Escolares

Contratos da API interna (nosso backend, consumida pelo painel) — não confundir com a API do Asaas, que é externa e documentada pelo próprio provedor. Convenção REST sobre Next.js Route Handlers.

| Método | Rota | Descrição | Autorização |
|---|---|---|---|
| `POST` | `/api/schools` | Cria escola + dispara criação de subconta Asaas | `PLATFORM_ADMIN` |
| `GET` | `/api/schools/:id` | Detalhe da escola | `PLATFORM_ADMIN`, `SCHOOL_MANAGER` (própria escola) |
| `POST` | `/api/guardians` | Cadastra responsável financeiro | `SCHOOL_MANAGER` |
| `GET` | `/api/guardians?search=` | Lista responsáveis (nome/CPF) | `SCHOOL_MANAGER` |
| `GET` | `/api/guardians/:id` | Detalhe do responsável | `SCHOOL_MANAGER` (própria escola) |
| `PATCH` | `/api/guardians/:id` | Atualiza nome/telefone/e-mail | `SCHOOL_MANAGER` (própria escola) |
| `POST` | `/api/students` | Cadastra aluno | `SCHOOL_MANAGER` |
| `GET` | `/api/students?status=&className=` | Lista alunos com filtros | `SCHOOL_MANAGER` |
| `GET` | `/api/students/:id` | Detalhe do aluno (com plano e responsáveis) | `SCHOOL_MANAGER` (própria escola) |
| `PATCH` | `/api/students/:id` | Atualiza aluno (nome, turma, plano, status) | `SCHOOL_MANAGER` (própria escola) |
| `POST` | `/api/students/:id/guardians` | Vincula responsável ao aluno (`StudentGuardian`) | `SCHOOL_MANAGER` (própria escola) |
| `DELETE` | `/api/students/:id/guardians/:guardianId` | Desvincula responsável do aluno | `SCHOOL_MANAGER` (própria escola) |
| `POST` | `/api/tuition-plans` | Cria plano de mensalidade | `SCHOOL_MANAGER` |
| `GET` | `/api/tuition-plans` | Lista planos de mensalidade | `SCHOOL_MANAGER` |
| `GET` | `/api/tuition-plans/:id` | Detalhe do plano | `SCHOOL_MANAGER` (própria escola) |
| `PATCH` | `/api/tuition-plans/:id` | Atualiza plano (valor, dia de vencimento, descontos) | `SCHOOL_MANAGER` (própria escola) |
| `POST` | `/api/charges/generate` | Dispara geração manual de cobrança (fora do cron) | `SCHOOL_MANAGER` |
| `GET` | `/api/charges?status=&studentId=&competency=` | Lista cobranças com filtros | `SCHOOL_MANAGER` |
| `POST` | `/api/billing-rules` | Cria/atualiza régua (escola ou override de aluno) — idempotente | `SCHOOL_MANAGER` |
| `GET` | `/api/billing-rules?studentId=` | Lista réguas da escola (ou o override de um aluno) | `SCHOOL_MANAGER` |
| `POST` | `/api/webhooks/asaas` | Recebe eventos do Asaas | Validação HMAC (não sessão de usuário) |
| `GET` | `/api/dashboard/summary?competency=` | Indicadores agregados de inadimplência (própria escola, competência opcional, default mês atual) | `SCHOOL_MANAGER` |


## Convenções de autorização

- Toda rota autenticada de `SCHOOL_MANAGER` aplica filtro por `schoolId` extraído da sessão — **nunca** do payload da requisição (impede um gestor de uma escola consultar dado de outra só trocando um parâmetro). A versão anterior deste contrato listava `GET /api/dashboard/summary?schoolId=`; corrigido na implementação de B-010 para não aceitar `schoolId` como parâmetro, por violar esta mesma regra.
- `POST /api/webhooks/asaas` é a única rota sem sessão de usuário — autenticada por validação de assinatura (mecanismo exato a confirmar, ver `research.md`, riscos abertos).

## Erros e formato de resposta

Decidido na implementação de B-005 (`src/lib/api-errors.ts`). Sucesso retorna o recurso (ou lista) direto como JSON, sem envelope. Erro sempre no formato:

```json
{ "error": { "message": "..." } }
```

| Situação | Status |
|---|---|
| Sem sessão | 401 |
| Sessão válida, mas sem permissão para o recurso (papel errado ou escola de outro tenant) | 403 |
| Corpo/parâmetros inválidos | 400 |
| Recurso não encontrado (ou não pertence ao tenant — não vaza existência) | 404 |
| Conflito (ex: CNPJ já cadastrado) | 409 |
| Erro inesperado | 500 (logado no servidor, mensagem genérica no corpo) |
