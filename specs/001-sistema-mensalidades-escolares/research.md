# Research — Sistema de Gestão de Mensalidades Escolares

Decisões técnicas e de mercado que fundamentam `plan.md`, com o porquê de cada uma. Onde uma decisão ainda depende de validação, isso está marcado explicitamente.

## Decisão: infraestrutura financeira via Asaas (subconta white label), não construída própria

**O que foi decidido**: pagamento (Pix/boleto/cartão), régua de notificação multicanal (WhatsApp/e-mail/SMS/robô de voz) e negativação Serasa usam a infraestrutura nativa do Asaas. Cada escola-cliente é uma subconta white label vinculada à nossa conta raiz.

**Por quê**: o Asaas já resolve, de forma homologada, exatamente os dois problemas que mais atrasariam um MVP — gateway de pagamento (Pix/boleto/cartão) e API oficial de WhatsApp Business (que normalmente exige aprovação de template pela Meta e integração com um BSP). Construir isso do zero era o maior risco técnico e de cronograma do projeto original; delegar ao Asaas elimina esse risco e concentra o desenvolvimento no que é diferencial (modelagem de domínio escolar, UX de secretaria, dashboard).

**Alternativas consideradas e descartadas**: gateway próprio + BSP próprio (Twilio/Z-API) — descartado por custo/risco/cronograma; outros gateways com régua nativa (Iugu, Efí) — não pesquisados a fundo, Asaas foi validado primeiro por já ter documentação pública clara de subconta white label e régua nativa.

## Decisão: banco de dados local é espelho, não fonte de verdade

**O que foi decidido**: PostgreSQL local armazena uma cópia dos dados de cobrança/cliente, sincronizada via webhook + reconciliação periódica. O Asaas é sempre a fonte de verdade financeira.

**Por quê**: performance de dashboard e resiliência a indisponibilidade momentânea da API do Asaas, sem duplicar responsabilidade de "quem manda" sobre o dado financeiro.

## Riscos técnicos abertos — precisam de validação antes de comprometer promessa comercial

| Risco | Por que importa | Status |
|---|---|---|
| Nível de customização da mensagem de WhatsApp do Asaas (marca/tom da escola) | Define se dá pra vender "cobrança com a cara da escola" como diferencial no pitch | **Confirmado, resposta é limitada (2026-08-21, testado em sandbox real — `A-006`)**. Ver seção "A-006 — resultado da validação em sandbox" abaixo para o detalhamento completo. Resumo: **o texto da mensagem não é customizável de jeito nenhum** via API — só canal (WhatsApp/e-mail/SMS/voz) e o dia do lembrete (`scheduleOffset`, e esse último restrito a um conjunto fixo de valores, não livre). O nome que aparece pro pagador (Pix, boleto) é o da conta Asaas titular, não um campo de marca configurável — então "cara da escola" de verdade só existe com uma subconta própria por escola, que por sua vez exige a Quitaedu ter CNPJ (ver linha de subconta abaixo). |
| Conta raiz precisa ser Pessoa Jurídica (CNPJ) para criar subconta | Bloqueia `A-009` (onboarding automatizado) e o modelo white-label inteiro (Constitution, Artigo III) até a Quitaedu ter CNPJ próprio | **Confirmado (2026-08-21, testado em sandbox real)** — `POST /v3/accounts` retorna 403 "Contas de pessoa física (CPF) não podem criar subcontas no Asaas. Apenas contas de pessoa jurídica (CNPJ)..." quando a conta raiz é PF. **Decisão tomada nesta sessão**: seguir implementando A-010 a A-015 usando a conta raiz sandbox (hoje PF) como uma "escola-piloto simulada" única — nenhuma dessas rotinas depende de subconta, só de uma `apiKey` válida (ver `src/lib/asaas.ts`, `resolveAsaasApiKey`). Migrar para subcontas reais por escola quando o CNPJ existir; nenhuma lógica de cobrança/régua/webhook precisa mudar, só a fonte da `apiKey`. |
| Mecanismo de assinatura do webhook do Asaas (HMAC ou token) | Define como implementar `contracts/api.md` → `POST /api/webhooks/asaas` com segurança | **Confirmado (2026-08-21)** — não é HMAC. É um token estático pré-compartilhado, enviado pelo Asaas em todo webhook no header `asaas-access-token`. Configurado na criação do webhook (`POST /v3/webhooks`, campo `authToken`, 32-255 caracteres); se omitido, o Asaas gera um token automaticamente (retornado só uma vez). Validação = comparar o header recebido com o token salvo, não verificar assinatura criptográfica do payload. Fonte: [docs.asaas.com/docs/sobre-os-webhooks](https://docs.asaas.com/docs/sobre-os-webhooks). |
| Prazo típico de verificação/KYC de subconta nova | Define SLA de onboarding que dá pra prometer a uma escola-piloto | **Parcialmente confirmado (2026-08-21)** — análise automática de documentos enviados leva até 48h; se não aprovar automaticamente, cai em fila manual (status `AWAITING_APPROVAL`). Existe também uma janela regulatória de até 60 dias corridos desde a primeira subconta criada, com limites (quantidade/valor/prazo) que, se estourados, bloqueiam automaticamente a criação de novas subcontas e emissão de cobranças até completar o processo de avaliação regulatória — relevante para o SLA de onboarding de múltiplas escolas-piloto em sequência. Fonte: [docs.asaas.com](https://docs.asaas.com/docs/detalhamento-do-fluxo-de-aprova%C3%A7%C3%A3o-de-subcontas). |
| Rate limit da API Asaas em geração de cobrança em lote | Pode causar falha parcial se muitas escolas tiverem o mesmo dia de vencimento | Não testado — confirmar limite e implementar backoff no worker |
| Asaas recusa `dueDate` no passado (`invalid_dueDate`, testado em sandbox real) | O cron mensal (`A-011`) precisa rodar **antes** do menor `dueDay` configurado no mês, senão a geração falha pra quem já passou do vencimento | Confirmado (2026-08-21) — não é bug, é validação correta do Asaas. Rodar o cron logo no início do mês (ex: dia 1) evita o problema; considerar também gerar a cobrança do mês seguinte com antecedência (ex: D-5) em vez de no dia exato. |
| Vercel Cron no plano Hobby só roda no máximo 1x/dia por job (falha no deploy se pedir mais frequente) | Limita a frequência do job de reconciliação (`A-014`) — não dá pra rodar a cada poucas horas de graça | Confirmado (2026-08-21, via documentação/changelog do Vercel) — `vercel.json` configurado com `generate-charges` mensal (dia 1, 06:00 UTC) e `reconcile-charges` diário (12:00 UTC), ambos dentro do limite do Hobby. Upgrade pro plano Pro libera schedules mais frequentes, se necessário mais adiante. |

## A-006 — resultado da validação em sandbox (2026-08-21)

Testado com chamadas reais contra `api-sandbox.asaas.com` (conta raiz Pessoa Física, sem White Label ativado — suporte Asaas não foi contatado ainda para ativar White Label em sandbox, ver risco de subconta acima).

1. **Criação de subconta**: bloqueada por conta raiz ser PF (ver linha da tabela acima). Não testável até existir CNPJ.
2. **Criação de cliente + cobrança direto na conta raiz**: funciona normalmente (`POST /customers`, `POST /payments` com `billingType: "UNDEFINED"` — deixa o pagador escolher Pix/boleto/cartão). QR code Pix (`GET /payments/:id/pixQrCode`) só funciona se a conta tiver chave Pix cadastrada.
3. **Régua de notificação por cliente** (`GET/POST /customers/:id/notifications`, `POST /notifications/:id`): cada cliente novo já nasce com 8 notificações fixas (`PAYMENT_RECEIVED`, `PAYMENT_OVERDUE` ×2, `PAYMENT_DUEDATE_WARNING` ×2, `PAYMENT_CREATED`, `PAYMENT_UPDATED`, `SEND_LINHA_DIGITAVEL`) — **não dá pra criar notificação nova, só alterar as que já existem**. Campos alteráveis: `enabled`, `scheduleOffset`, e um toggle por canal (`whatsappEnabledForCustomer`, `emailEnabledForCustomer`, `smsEnabledForCustomer`, `phoneCallEnabledForCustomer`). **Nenhum campo de texto/template existe** — confirma a documentação pública.
4. **WhatsApp vem desligado por padrão** (`whatsappEnabledForCustomer: false` em todas as notificações de um cliente novo) — precisa ligar explicitamente por cliente.
5. **`scheduleOffset` é restrito, não livre**: testado em um slot de `PAYMENT_DUEDATE_WARNING`, só {5, 10, 15, 30} foram aceitos (0-4, 6-9, 20 foram recusados com "O número de dias informado é inválido"); um slot de `PAYMENT_OVERDUE` testado só aceitou {0}. O conjunto exato não está documentado publicamente e parece variar por slot — **antes de expor um campo livre de "dias antes/depois" na tela de régua (F-011), descobrir empiricamente o conjunto válido de cada slot** (ou abrir chamado com o suporte Asaas pedindo a lista oficial). Recomendação: UI com dropdown de valores conhecidos, não input numérico livre.
6. **Canal de voz tem restrição por evento**: tentativa de ativar `phoneCallEnabledForCustomer` num slot de `PAYMENT_DUEDATE_WARNING` foi recusada com "Evento inválido para ativação da notificação por voz" — sugere que o robô de voz só é válido para certos eventos (ex: atraso), não pré-vencimento.
7. **Nome exibido pro pagador**: o QR code Pix gerado trouxe o nome do titular da conta raiz ("Antonio Airlon da Silva F[ilho]"), não um campo de marca/escola configurável — reforça que a personalização por escola depende de subconta própria, não de configuração dentro de uma conta compartilhada.

**Conclusão para o pitch**: "cobrança com a cara da escola" via texto de mensagem **não é possível** com a API do Asaas, mesmo com subconta — o máximo personalizável é: qual canal dispara, em quais dias (dentro de um menu fixo de opções), e o nome que aparece na fatura/Pix uma vez que cada escola tenha sua própria subconta. O discurso comercial deve ser ajustado para não prometer personalização de texto/tom da mensagem.

## Pesquisa de mercado: concorrência direta no mesmo nicho

Levantamento feito antes de comprometer o roadmap, para calibrar diferenciação.

**isaac** — maior ameaça identificada. Fintech educacional (adquirida pela Arco Educação, listada na Nasdaq), ~R$5 bi transacionados/ano, mirando 10 mil escolas, cobrindo hoje ~2.000 das ~40.000 escolas privadas do Brasil (~5% de penetração). Produto central é "receita garantida": assume o risco de crédito da inadimplência, modelo de fintech/factoring, não um SaaS puro. **Implicação para este projeto**: não competimos no terreno de garantia de recebível (exige capital/estrutura de FIDC); competimos como camada de software mais leve e rápida de lançar, mirando os ~95% do mercado que o isaac ainda não cobre, começando pela ponta pequena/regional (Ceará).

**Escolapay** — concorrente de proposta quase idêntica: nasceu dentro de escolas, régua de cobrança + Pix/boleto/cartão, sem mensalidade fixa (monetiza por taxa de transação). É a validação mais direta de que a tese faz sentido — e o principal benchmark de produto a observar.

**Kolek** — ferramenta horizontal de régua de cobrança (atende também BPOs, contadores, advogados, clínicas, condomínios, academias), com página específica "para escolas". Exige que a escola já tenha um sistema de gestão/planilha por trás — não substitui o registro, só adiciona a régua.

**FlexiBank** — fintech de garantia de recebível para escolas, mais antiga (2003) e menor que o isaac, mesmo modelo de negócio.

**Didatiko** (e ERPs como Sponte/Proesc/Escola Web) — ERPs completos com módulo financeiro. Didatiko em particular tem "Didatiko Finance" como vertical modular ativável separadamente — mais próximo da nossa proposta que Sponte/Proesc, mas ainda embutido em um ecossistema pedagógico maior.

**Conclusão da pesquisa**: o espaço de "SaaS leve, só financeiro, para escola pequena/média, sem assumir risco de crédito" está pouco ocupado — Escolapay é o único concorrente quase idêntico encontrado, e não há evidência de que já domine o mercado.
