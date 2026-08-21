# Constitution — Sistema de Gestão de Mensalidades Escolares

> Princípios não-negociáveis do projeto. Toda decisão de spec, plano ou implementação deve ser validada contra estes artigos. Se um 
requisito conflitar com um artigo, o requisito muda — não o artigo.

## Artigo I — Escopo cirúrgico: só financeiro
O produto resolve **cobrança e inadimplência**, não gestão escolar completa. Não competimos com Sponte/Escola Web/Class App em 
diário de classe, boletim, comunicação pedagógica ou portal do aluno. Qualquer feature fora do eixo (cadastro → cobrança → 
recebimento → conciliação) exige justificativa explícita antes de entrar no roadmap.

## Artigo II — Cobrança e régua via infraestrutura Asaas, não construídas do zero
Pagamento (Pix/boleto/cartão) e a régua de notificação multicanal (WhatsApp, SMS, e-mail, robô de voz, negativação Serasa) usam a 
infraestrutura nativa do Asaas. Não construímos BSP de WhatsApp próprio, não construímos motor de régua de cobrança próprio, e não 
construímos gateway de pagamento próprio no MVP. Isso é uma escolha deliberada de escopo: o Asaas já resolve esse problema de forma 
robusta e homologada, e reconstruí-lo não gera diferencial — gera custo e risco.

## Artigo III — Cada escola é uma subconta Asaas
O modelo de infraestrutura é: uma conta raiz (nossa plataforma) + uma subconta Asaas por escola-cliente, no modelo white label. A 
escola nunca acessa o painel do Asaas diretamente — toda a operação financeira acontece dentro do nosso produto, com a marca e a UX 
do nosso produto, enquanto o Asaas processa por trás. Onboarding de nova escola inclui, como etapa obrigatória, a criação e 
configuração da subconta.

## Artigo IV — Multi-tenant desde o dia 1
O sistema é uma escola SaaS multi-cliente. Isolamento de dados entre escolas é um requisito de arquitetura, não um "depois a gente 
separa". Toda tabela sensível carrega `school_id`, e toda query passa por esse filtro.

## Artigo V — LGPD by design
Dados de responsáveis financeiros e de menores são sensíveis por padrão. Consentimento, finalidade de uso e retenção de dados são 
decisões tomadas na modelagem, não corrigidas depois de um incidente. Contrato de tratamento de dados (DPA) com cada escola-cliente 
é requisito comercial, não só jurídico.

## Artigo VI — Automação com humano no loop
Cobrança automática não pode gerar constrangimento ou erro silencioso. Toda régua de cobrança automática (lembrete, segunda via, 
notificação de atraso) precisa de um painel onde o gestor da escola vê o que foi enviado e pode pausar/intervir por aluno.

## Artigo VII — Simplicidade antes de escala
MVP prioriza fazer bem o ciclo cadastro → cobrança → lembrete → pagamento → conciliação para poucas escolas-piloto, antes de 
otimizar para milhares de tenants. Performance e escala entram como requisito explícito só depois de validação comercial.

## Artigo VIII — O diferencial é a camada de nicho, não a infraestrutura financeira
Nosso valor não está em processar pagamento ou disparar WhatsApp — isso é commodity que o Asaas já entrega. Nosso valor está em: 
modelagem de dados pensada para o contexto escolar (turma, aluno, responsável financeiro, plano com desconto por 
irmãos/pontualidade), um dashboard consolidado feito para o gestor financeiro de escola (não um painel financeiro genérico), UX de 
onboarding simples para secretarias que não são técnicas, e — se fizer sentido no roadmap — comunicação além de cobrança (matrícula, 
rematrícula, avisos) usando a mesma base de contato. Toda decisão de produto deve ser avaliada contra essa pergunta: isso é camada 
de nicho (constrói diferencial) ou é infraestrutura financeira (o Asaas já faz)?
