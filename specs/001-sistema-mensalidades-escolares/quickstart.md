# Quickstart — Cenário de Validação Ponta a Ponta

Este é o fluxo mínimo que precisa funcionar de ponta a ponta para considerar o MVP funcional. Serve como roteiro de teste manual (e, depois, como base para um teste de integração automatizado). Baseado nos fluxos de sequência descritos em `../../docs/arquitetura-completa.md` (seção 4).

## Pré-requisitos

- Conta Asaas sandbox configurada (conta raiz).
- Banco de dados local rodando com o schema de `data-model.md` aplicado.
- Worker de fila (BullMQ) rodando.

## Cenário

1. **Onboarding de escola** — como `PLATFORM_ADMIN`, cadastrar uma escola de teste.
   - Resultado esperado: registro em `School` com `status=ONBOARDING`; subconta Asaas criada (assíncrono); registro em `SchoolSubaccount` com `status=PENDING_VERIFICATION`.
2. **Ativação da subconta** — simular (ou aguardar, em sandbox) a verificação da subconta.
   - Resultado esperado: `SchoolSubaccount.status` muda para `ACTIVE`.
3. **Cadastro de estrutura escolar** — como `SCHOOL_MANAGER`, cadastrar: um plano de mensalidade, um responsável financeiro, um aluno vinculado ao responsável e ao plano.
   - Resultado esperado: registros criados, todos com o `schoolId` correto.
4. **Geração de cobrança** — disparar manualmente (`POST /api/charges/generate`) em vez de esperar o cron.
   - Resultado esperado: cobrança criada via API do Asaas na subconta da escola; registro local em `Charge` com `status=PENDING`, `pixQrCode` preenchido.
5. **Configuração de régua** — configurar a régua padrão da escola (ex: lembrete 5 dias antes).
   - Resultado esperado: régua refletida via API na subconta Asaas.
6. **Simulação de pagamento** — em sandbox, simular o pagamento da cobrança gerada no passo 4.
   - Resultado esperado: webhook `PAYMENT_RECEIVED` chega em `POST /api/webhooks/asaas`; `Charge.status` muda para `PAID`; `AuditLog` registra o evento.
7. **Verificação no dashboard** — como `SCHOOL_MANAGER`, abrir o dashboard (tela 4.2 de `../../docs/ui-ux-especificacao.md`).
   - Resultado esperado: taxa de inadimplência reflete a cobrança paga; nenhuma pendência mostrada para esse aluno.
8. **Teste de reconciliação** — simular um webhook perdido (não disparar o evento) e rodar o job de reconciliação manualmente.
   - Resultado esperado: o job detecta a divergência entre o status local e o status real no Asaas, corrige, e registra em `AuditLog` como `webhook_missed`.

## Critério de "MVP funcional"

Se os 8 passos acima completam sem intervenção manual fora do previsto (exceto os pontos explicitamente marcados como "simular"), o núcleo do produto (Fases 0-2 / Trilhas A+B+C convergidas) está validado o suficiente para entrar em piloto real (ver Fase 3 em `tasks.md`).

## Fora deste quickstart

Portal do responsável, comunicação própria fora de cobrança, e qualquer fluxo de renegociação manual não fazem parte deste cenário mínimo — são validados separadamente quando essas fases entrarem em desenvolvimento.
