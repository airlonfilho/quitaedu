# Especificação Funcional do Painel — Para Design de UI/UX

Este documento descreve **o que cada tela precisa fazer**: dados, ações, regras de negócio, estados e fluxos. Não contém nenhuma decisão de UI/UX (layout, cores, tipografia, componentes, wireframe) — isso é trabalho do design, propositalmente deixado em aberto aqui.

Baseado em `../specs/001-sistema-mensalidades-escolares/spec.md` e `arquitetura-completa.md`.

---

## 1. Contexto rápido

O painel é usado por gestores financeiros de escolas particulares (secretaria/financeiro) — perfil que **não é necessariamente técnico**. O produto resolve só cobrança de mensalidade e comunicação relacionada; não é um sistema de gestão escolar completo (sem diário de classe, boletim, etc.).

Duas famílias de usuário usam o painel:

- **Gestor da escola** (`SCHOOL_MANAGER`) — usuário principal, só vê dados da própria escola.
- **Admin da plataforma** (`PLATFORM_ADMIN`) — nós, administra todas as escolas-cliente.

*(Fora do escopo desta fase: portal do responsável financeiro/pai — é uma fase futura, não precisa ser desenhado agora.)*

---

## 2. Papéis e visibilidade de dados

| Papel | O que vê | O que não vê |
|---|---|---|
| `SCHOOL_MANAGER` | Só dados da própria escola (alunos, responsáveis, cobranças, régua) | Dados de qualquer outra escola-cliente; nunca vê o painel do Asaas |
| `PLATFORM_ADMIN` | Todas as escolas-cliente, status de subconta, dados comerciais (plano contratado) | Detalhe operacional do dia a dia de cada escola (não é o foco do admin) |

Essa separação precisa estar clara em qualquer fluxo de navegação — um gestor de escola nunca deve ter uma rota ou ação que alcance dado de outra escola.

---

## 3. Lista de telas necessárias

### Área do Gestor da Escola (`SCHOOL_MANAGER`)
1. Login
2. Dashboard / visão geral
3. Alunos — lista
4. Aluno — cadastro/edição
5. Aluno — detalhe (com histórico de cobrança)
6. Responsáveis financeiros — lista
7. Responsável financeiro — cadastro/edição
8. Planos de mensalidade — lista
9. Plano de mensalidade — cadastro/edição
10. Cobranças — lista com filtros
11. Cobrança — detalhe individual
12. Régua de cobrança — configuração da escola
13. Régua de cobrança — override por aluno
14. Relatórios / exportação
15. Configurações da escola

### Área do Admin da Plataforma (`PLATFORM_ADMIN`)
16. Login (pode ser a mesma tela de login, com roteamento por papel)
17. Escolas-cliente — lista
18. Escola-cliente — cadastro (onboarding)
19. Escola-cliente — detalhe (status da subconta, plano contratado)

---

## 4. Detalhamento por tela

Para cada tela: objetivo, dados que precisam aparecer, ações possíveis, regras de negócio relevantes, estados a prever.

### 4.1 Login
**Objetivo**: autenticar e rotear para a área correta conforme o papel do usuário.
**Regras de negócio**: um usuário pertence a uma única escola (exceto admin da plataforma, que não tem `schoolId`). Depois do login, o sistema já sabe automaticamente qual escola filtrar — o usuário nunca escolhe "qual escola" manualmente.
**Estados a prever**: erro de credencial inválida, conta suspensa/escola inativa (ver 4.15), carregando.

### 4.2 Dashboard / visão geral (Gestor)
**Objetivo**: primeira tela que o gestor vê ao entrar — panorama rápido da saúde financeira da escola.
**Dados que precisam aparecer**:
- Taxa de inadimplência atual (% e valor em R$)
- Total de cobranças do mês: pagas, pendentes, atrasadas
- Evolução da inadimplência ao longo dos últimos meses
- Alertas acionáveis (ex: "12 cobranças vencem nos próximos 5 dias", "3 alunos com régua pausada")
**Ações possíveis**: navegar para a lista de cobranças filtrada a partir de um indicador (ex: clicar em "atrasadas" leva para a lista já filtrada).
**Regras de negócio**: taxa de inadimplência é calculada sobre cobranças com `status=OVERDUE` dividido pelo total de cobranças da competência atual (ver `../specs/001-sistema-mensalidades-escolares/spec.md`, métricas de sucesso).
**Estados a prever**: escola recém-criada sem nenhuma cobrança ainda gerada (estado vazio genuíno, não é erro); subconta Asaas ainda em `PENDING_VERIFICATION` (ver 4.15 — isso precisa ficar visível aqui, porque afeta se cobrança pode ser gerada).

### 4.3 Alunos — lista
**Objetivo**: ver e localizar alunos cadastrados.
**Dados**: nome, turma, status (ativo/inativo), responsável(is) financeiro(s) vinculado(s), status da cobrança do mês corrente (pago/pendente/atrasado) por aluno.
**Ações**: buscar/filtrar por nome ou turma; abrir detalhe do aluno; cadastrar novo aluno; inativar aluno (aluno que saiu da escola).
**Regras de negócio**: aluno inativo não gera cobrança nova a partir do mês seguinte à inativação, mas mantém histórico de cobranças anteriores.
**Estados**: lista vazia (escola nova, nenhum aluno cadastrado ainda); muitos alunos (escola de até 500 — paginação ou scroll é decisão de design, mas o volume precisa ser suportado).

### 4.4 Aluno — cadastro/edição
**Objetivo**: criar ou editar dados de um aluno.
**Dados/campos necessários**: nome, turma, status, plano de mensalidade vinculado, um ou mais responsáveis financeiros vinculados (com indicação de qual é o principal).
**Regras de negócio**: um aluno pode ter mais de um responsável financeiro (pai e mãe separados, por exemplo); pelo menos um responsável precisa ser marcado como principal (é para quem a cobrança é direcionada por padrão); um aluno precisa ter um plano de mensalidade vinculado antes que cobrança possa ser gerada para ele.
**Estados**: validação de campo obrigatório faltando (não dá pra salvar aluno sem responsável financeiro vinculado); confirmação antes de inativar (ação com consequência — para de gerar cobrança).

### 4.5 Aluno — detalhe
**Objetivo**: ver tudo sobre um aluno específico, principalmente o histórico financeiro.
**Dados**: dados cadastrais, plano de mensalidade atual, histórico completo de cobranças (mês a mês, com status), régua de cobrança aplicada (padrão da escola ou override individual — ver 4.13).
**Ações**: editar dados; ver/emitir segunda via de uma cobrança específica; acessar configuração de override de régua para este aluno.
**Regras de negócio**: histórico de cobrança nunca é apagado, mesmo se o aluno for inativado depois.

### 4.6 Responsáveis financeiros — lista
**Objetivo**: ver e localizar responsáveis financeiros cadastrados.
**Dados**: nome, CPF, telefone (WhatsApp), e-mail, aluno(s) vinculado(s).
**Ações**: buscar; abrir detalhe/edição; cadastrar novo.
**Regras de negócio**: CPF é único por escola (não pode cadastrar o mesmo responsável duas vezes na mesma escola); um responsável pode estar vinculado a mais de um aluno (irmãos).

### 4.7 Responsável financeiro — cadastro/edição
**Objetivo**: criar ou editar dados de um responsável.
**Dados/campos**: nome, CPF, telefone (é o número que recebe a cobrança via WhatsApp — precisa ficar claro para quem cadastra que esse campo é crítico), e-mail, vínculo com aluno(s).
**Regras de negócio**: telefone é campo crítico — validação de formato é importante, porque é o canal principal de cobrança.

### 4.8 Planos de mensalidade — lista
**Objetivo**: ver os planos de mensalidade configurados pela escola (ex: "Educação Infantil", "Fundamental I", cada um com valor e regras diferentes).
**Dados**: nome do plano, valor base, dia de vencimento, quantidade de alunos vinculados a cada plano.
**Ações**: criar novo plano; editar plano existente; ver quantos alunos usam cada plano antes de editar/excluir.

### 4.9 Plano de mensalidade — cadastro/edição
**Objetivo**: definir um plano de mensalidade.
**Dados/campos**: nome, valor base, dia de vencimento (1-28, para evitar problema com meses de 28/30/31 dias), regras de desconto (ex: desconto por pontualidade, desconto por irmãos — a lógica exata de cálculo do desconto é regra de negócio a confirmar com a escola-piloto, o campo precisa ser flexível).
**Regras de negócio**: alterar o valor de um plano não altera cobranças já geradas (só afeta cobranças futuras) — isso precisa ficar claro na tela para não gerar confusão ("mudei o valor mas a cobrança de outubro não mudou" é comportamento esperado, não bug).

### 4.10 Cobranças — lista com filtros
**Objetivo**: tela operacional mais usada pelo financeiro no dia a dia — ver o que está pago, pendente e atrasado.
**Dados**: aluno, responsável, competência (mês/ano), valor, status, data de vencimento, data de pagamento (se pago).
**Ações**: filtrar por status/turma/competência/aluno; abrir detalhe de uma cobrança; gerar cobrança manualmente fora do ciclo automático (caso de exceção); exportar lista filtrada.
**Regras de negócio**: uma cobrança é única por combinação aluno + mês + ano (não é possível ter duas cobranças da mesma competência para o mesmo aluno).
**Estados**: lista vazia por filtro sem resultado (diferente de "escola sem nenhuma cobrança ainda") — a mensagem/tratamento desses dois vazios é diferente.

### 4.11 Cobrança — detalhe individual
**Objetivo**: ver tudo sobre uma cobrança específica.
**Dados**: todos os dados da cobrança, QR code Pix / link de boleto (vem do Asaas), histórico de notificações enviadas para essa cobrança (canal, quando, status de entrega — ver `NotificationLog` em `../specs/001-sistema-mensalidades-escolares/data-model.md`).
**Ações**: reenviar cobrança manualmente; emitir segunda via; marcar como cancelada (caso excepcional, ex: aluno saiu no meio do mês).
**Regras de negócio**: status da cobrança reflete o que vem do Asaas via webhook — não é editável diretamente pelo usuário (exceto cancelamento, que é uma ação explícita, não uma edição de status livre).

### 4.12 Régua de cobrança — configuração da escola
**Objetivo**: definir a régua padrão que se aplica a todos os alunos da escola.
**Dados/campos**: quantos dias antes do vencimento avisar, quantos dias depois do vencimento insistir, quais canais usar (WhatsApp/e-mail/SMS/robô de voz).
**Regras de negócio**: essa é a configuração padrão — alunos sem override individual (ver 4.13) usam exatamente essa regra. Mudar a régua da escola não altera cobranças já com notificação programada/enviada, só afeta daqui para frente.

### 4.13 Régua de cobrança — override por aluno
**Objetivo**: pausar ou customizar a régua para um aluno específico (ex: acordo de renegociação em andamento — ver Artigo VI da `../.specify/memory/constitution.md`, "automação com humano no loop").
**Dados/campos**: mesmos campos da régua padrão, mas aplicados só a este aluno; opção de pausar completamente a régua automática.
**Regras de negócio**: quando existe override, ele tem prioridade total sobre a régua padrão da escola — a tela precisa deixar isso visualmente óbvio (que aquele aluno está "fora do padrão"), para não confundir o gestor.

### 4.14 Relatórios / exportação
**Objetivo**: exportar dados para uso fora do sistema (planilha para contabilidade, por exemplo).
**Dados**: lista de cobranças filtrável, no formato CSV/PDF.
**Regras de negócio**: exportação respeita os mesmos filtros da tela de cobranças (não precisa ser uma tela separada de configuração de relatório, pode reaproveisar o filtro já aplicado).

### 4.15 Configurações da escola
**Objetivo**: dados cadastrais da escola e status da integração financeira.
**Dados**: nome, CNPJ, plano contratado (Essencial/Profissional/Escola+), **status da subconta Asaas** (pendente de verificação / ativa / restrita — ver `arquitetura-completa.md`, seção 4.1).
**Regras de negócio**: enquanto a subconta estiver em `PENDING_VERIFICATION`, a geração de cobrança pode estar bloqueada ou limitada — isso precisa aparecer aqui de forma clara, com explicação do que fazer (ou de que está em processamento).
**Estados**: status da subconta é um dos poucos lugares do painel que expõe (em linguagem simples, sem citar "Asaas" necessariamente) que existe uma dependência de verificação externa.

### 4.16 Escolas-cliente — lista (Admin)
**Objetivo**: visão do admin da plataforma sobre todas as escolas-cliente.
**Dados**: nome da escola, plano contratado, status (onboarding/ativa/suspensa/cancelada), status da subconta Asaas, data de entrada.
**Ações**: buscar; abrir detalhe; iniciar onboarding de nova escola.

### 4.17 Escola-cliente — cadastro (Admin, onboarding)
**Objetivo**: cadastrar uma nova escola-cliente, disparando a criação da subconta Asaas.
**Dados/campos**: nome, CNPJ, plano comercial contratado, dados de contato do gestor responsável (para criar o primeiro usuário `SCHOOL_MANAGER`).
**Regras de negócio**: ao salvar, o sistema dispara a criação da subconta Asaas (fluxo assíncrono — ver `arquitetura-completa.md`, seção 4.1) — a tela precisa comunicar que isso não é instantâneo.

### 4.18 Escola-cliente — detalhe (Admin)
**Objetivo**: ver e acompanhar uma escola-cliente específica.
**Dados**: tudo da lista, mais indicadores agregados (quantos alunos, quantas cobranças no mês, taxa de inadimplência) — visão de saúde da conta, não operação do dia a dia.
**Ações**: alterar plano contratado; suspender/reativar escola.

---

## 5. Fluxos que atravessam mais de uma tela

Vale desenhar esses fluxos completos, não só telas isoladas:

- **Onboarding completo de escola** (admin cadastra → subconta é criada → gestor recebe acesso → gestor cadastra primeiro aluno/plano → primeira cobrança é gerada).
- **Ciclo mensal de cobrança** (cobrança gerada automaticamente → aparece na lista → régua dispara notificações → pagamento acontece → dashboard atualiza).
- **Tratamento de exceção/renegociação** (gestor identifica aluno com atraso recorrente → aplica override de régua → acompanha na tela de detalhe do aluno).

---

## 6. Fora do escopo desta especificação

- Portal do responsável financeiro (pai/mãe) — fase futura, não faz parte deste painel.
- Qualquer tela de comunicação institucional (avisos gerais, matrícula) — fora do escopo do produto por enquanto (ver `../.specify/memory/constitution.md`, Artigo I).
- Definição de qual biblioteca de componentes, grid, paleta de cores, tipografia ou qualquer decisão visual — **isso é trabalho do design, este documento propositalmente não entra nesse mérito.**

---

## 7. Perguntas em aberto para o design decidir

Estas ficam explicitamente para você definir, não para o produto ditar:

- Como comunicar visualmente o estado "subconta pendente de verificação" sem assustar o usuário nem esconder que existe uma limitação temporária.
- Como diferenciar visualmente um aluno com override de régua ativo dos demais, na lista de alunos e na tela de detalhe.
- Como lidar com volume alto de linhas nas listas (alunos, cobranças) — paginação, scroll infinito, virtualização — considerando que uma escola pode ter até ~500 alunos.
- Nível de simplicidade visual necessário para um público não-técnico (secretaria escolar) — isso provavelmente pesa mais aqui do que em produtos B2B tradicionais.
- Se o dashboard (4.2) é a tela inicial para todo `SCHOOL_MANAGER` ou se varia por preferência/uso.
