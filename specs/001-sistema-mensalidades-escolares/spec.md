# Spec — Sistema de Gestão de Mensalidades Escolares

## Visão geral
Sistema SaaS multi-tenant para escolas particulares gerenciarem mensalidades de alunos, automatizarem a cobrança recorrente (Pix/boleto/cartão) e reduzirem inadimplência através de régua automática de comunicação via WhatsApp.

## Personas
- **Gestor financeiro da escola** — cadastra alunos, planos e acompanha inadimplência. Usuário principal do painel.
- **Responsável financeiro (pai/mãe/tutor)** — recebe cobranças e lembretes, paga via Pix/boleto/cartão, eventualmente acessa portal de segunda via.
- **Administrador da plataforma (você/sócio)** — gerencia escolas-cliente, planos comerciais, monitora saúde do sistema.

## Cenários de usuário (user stories)

### US-01 — Cadastro de estrutura escolar
Como gestor financeiro, quero cadastrar alunos, responsáveis financeiros e planos de mensalidade (valor, dia de vencimento, descontos por pontualidade/irmãos), para que o sistema saiba o que e quando cobrar.

### US-02 — Geração automática de cobranças
Como sistema, preciso gerar automaticamente as cobranças do mês (Pix + boleto) para cada aluno ativo, na data configurada, sem intervenção manual do gestor.

### US-03 — Régua de cobrança via WhatsApp
Como responsável financeiro, quero receber lembretes via WhatsApp antes do vencimento, no vencimento e em caso de atraso, com link de pagamento direto, para não esquecer ou perder prazo. (Implementado via configuração da régua nativa do Asaas por subconta/cliente — não é motor de mensageria próprio.)

### US-04 — Pagamento facilitado
Como responsável financeiro, quero pagar via Pix (QR code ou copia-e-cola) direto pelo link recebido no WhatsApp, sem precisar baixar app ou fazer login. (Cobrança gerada via API do Asaas na subconta da escola.)

### US-09 — Onboarding financeiro da escola
Como administrador da plataforma, quero que o cadastro de uma nova escola crie automaticamente a subconta Asaas correspondente (white label), para que a escola comece a operar sem precisar criar conta própria no Asaas nem entender que o Asaas existe por trás.

### US-05 — Dashboard de inadimplência
Como gestor financeiro, quero ver em tempo real quem pagou, quem está pendente e quem está em atraso, com filtros por turma/série, para agir proativamente.

### US-06 — Conciliação financeira
Como gestor financeiro, quero que pagamentos recebidos sejam automaticamente conciliados com as cobranças geradas, sem trabalho manual de bater planilha com extrato.

### US-07 — Controle da automação
Como gestor financeiro, quero poder pausar ou editar a régua de cobrança de um aluno específico (ex: acordo de renegociação em andamento), para que a automação não gere atrito desnecessário.

### US-08 — Portal do responsável (v2)
Como responsável financeiro, quero acessar um portal simples (sem app) para ver histórico de pagamentos e emitir segunda via, sem depender de falar com a secretaria.

## Requisitos funcionais
- **FR-001**: Sistema deve suportar múltiplas escolas isoladas (multi-tenant).
- **FR-002**: Sistema deve permitir CRUD de alunos, responsáveis financeiros e planos de mensalidade.
- **FR-003**: Sistema deve gerar cobranças recorrentes automaticamente via API do Asaas, na subconta da respectiva escola.
- **FR-004**: Sistema deve configurar, via API do Asaas, a régua de notificação (WhatsApp/e-mail/SMS) por cliente (responsável financeiro), com os prazos definidos pela escola (pré-vencimento, vencimento, atraso). Não há motor de disparo de mensagens próprio no MVP.
- **FR-005**: Sistema deve consumir os webhooks do Asaas para refletir localmente o status de cada cobrança (pendente/pago/atrasado/cancelado) e, quando disponível, o status de entrega de notificações.
- **FR-006**: Sistema deve conciliar automaticamente pagamentos recebidos via webhook do Asaas com as cobranças em aberto no banco local.
- **FR-011**: Sistema deve criar e configurar automaticamente uma subconta Asaas white label ao cadastrar uma nova escola (onboarding financeiro automatizado).
- **FR-012**: Sistema deve espelhar localmente (cache/sync) os dados de cobrança e cliente do Asaas, para que dashboard e relatórios funcionem sem depender de chamada síncrona à API a cada consulta.
- **FR-007**: Sistema deve fornecer dashboard com indicadores de inadimplência (taxa geral, por turma, evolução mensal).
- **FR-008**: Sistema deve permitir pausar/customizar a régua de cobrança por aluno individualmente.
- **FR-009**: Sistema deve emitir segunda via de cobrança sob demanda.
- **FR-010**: Sistema deve manter trilha de auditoria de alterações em planos e cobranças (quem alterou, quando, o quê).

## Requisitos não-funcionais
- **NFR-001 (LGPD)**: Dados pessoais e financeiros de responsáveis e alunos armazenados com criptografia em repouso; acesso restrito por tenant e por papel (role).
- **NFR-002 (Confiabilidade)**: Falha ou atraso na sincronização com webhooks do Asaas não pode bloquear a operação do painel — o sistema deve tolerar inconsistência temporária entre o status local e o status real no Asaas, com reconciliação periódica de segurança (poll de fallback, não só webhook).
- **NFR-003 (Auditabilidade)**: Todo envio automático de cobrança deve ser rastreável (quem/quando/quê foi enviado a quem).
- **NFR-004 (Disponibilidade)**: Geração de cobranças e webhooks de pagamento são operações críticas — devem ter monitoramento e alerta em caso de falha.

## Fora de escopo (explicitamente)
- Diário de classe, boletim, frequência, comunicação pedagógica.
- Matrícula/rematrícula completa (pode ser considerado em fase futura).
- Folha de pagamento de professores/funcionários.
- Emissão de nota fiscal de serviço automatizada (pode ser integração futura, não MVP).

## Métricas de sucesso
- Redução da taxa de inadimplência da escola-piloto em X pontos percentuais após 3 meses de uso.
- Tempo do gestor financeiro gasto em cobrança manual reduzido em pelo menos 70%.
- Taxa de entrega das mensagens de WhatsApp acima de 95%.
