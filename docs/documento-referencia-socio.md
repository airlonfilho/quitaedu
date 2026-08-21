# Documento de Referência — Sistema de Gestão de Mensalidades Escolares

## 1. Contexto e oportunidade
Escolas particulares pequenas e médias (a maioria fora do raio de ação dos grandes sistemas de gestão escolar tipo Sponte, Positivo ON, Escola Web) ainda tratam cobrança de mensalidade de forma manual: planilha, boleto avulso, cobrança feita "no grupo do WhatsApp" pela secretaria. Isso gera dois problemas recorrentes:
- **Inadimplência alta**, por falta de régua de cobrança consistente.
- **Tempo operacional desperdiçado** da secretaria/financeiro perseguindo pagamentos manualmente.

Existe espaço para um produto focado, que resolve **só** esse problema — sem tentar competir com os sistemas de gestão escolar completos (diário de classe, boletim, portal pedagógico), que são caros, pesados de implantar e não é ali que a dor mais dói.

## 2. Proposta de valor
Sistema de gestão de mensalidades com **cobrança automatizada via WhatsApp**, construído **em cima da infraestrutura financeira do Asaas** — não reconstruindo do zero o que já é resolvido de forma robusta e homologada:
- Cadastro de alunos, responsáveis financeiros e planos de mensalidade.
- Geração automática de cobrança (Pix + boleto + cartão) todo mês, via API do Asaas.
- Régua de lembretes automáticos por WhatsApp, e-mail, SMS e até robô de voz — usando a régua nativa do Asaas, configurada por escola.
- Dashboard de inadimplência em tempo real, com a cara do nosso produto (a escola nunca vê a marca Asaas).
- Conciliação automática (pagamento recebido → cobrança baixada, sem trabalho manual).
- Negativação Serasa disponível para casos de inadimplência persistente, sem integração extra.

**Em uma frase**: a gente entrega a experiência pensada pra escola — cadastro, dashboard, UX de secretaria — e usa o Asaas como motor financeiro por trás, via conta white label (a escola opera 100% dentro do nosso sistema, sem saber que existe um Asaas).

## 3. Diferencial competitivo
| Frente | Sistemas de gestão escolar completos | Nosso produto |
|---|---|---|
| Escopo | Pedagógico + financeiro + comunicação | Só financeiro/cobrança |
| Implantação | Complexa, treinamento longo | Rápida, foco em 1 fluxo |
| Canal de cobrança | E-mail/boleto impresso | WhatsApp, e-mail, SMS, voz — via régua nativa do Asaas |
| Ticket/complexidade | Alto, contrato anual | Mensal, entrada mais fácil |
| Infraestrutura de pagamento/cobrança | Construída/mantida internamente | Delegada ao Asaas (subconta white label) — menos custo de desenvolvimento, menos risco de compliance financeiro |

Não vencemos brigando por feature completa, e também não vencemos tentando reconstruir infraestrutura de pagamento/mensageria que uma fintech já faz bem. Vencemos sendo o sistema **pensado especificamente pra escola** — modelagem de dados, UX de secretaria, dashboard consolidado — rodando sobre uma base financeira sólida e homologada. Isso também acelera nosso time-to-market: o que seria o maior risco técnico do projeto (integração própria de WhatsApp Business, aprovação de templates) deixa de existir como bloqueio.

## 4. Modelo de negócio (proposta inicial para discussão)
Recorrência via assinatura SaaS, com duas opções de precificação a avaliar:
- **Por aluno ativo/mês**: ex. R$3-5 por aluno matriculado no sistema — escala natural com o tamanho da escola.
- **Por faixa de alunos (planos fechados)**: similar ao modelo do Tera Gestão — ex. Essencial (até 150 alunos), Profissional (até 400 alunos), Escola+ (acima disso) — mais previsível para o cliente orçar.

**Custos variáveis reais do Asaas a embutir na precificação** (valores padrão, sujeitos a condições de contrato):
- Pix: R$1,99 por cobrança paga (30 transações grátis/mês), só cobrado se o pagamento acontecer.
- Cartão: R$0,49 por cobrança + 1,99% sobre o valor para assinatura/parcelamento.
- Notificação por WhatsApp: R$0,55 por envio.
- Notificação por e-mail/SMS: R$0,99 por pacote usado a cada transação.
- Robô de voz (cobrança de atraso): R$0,55 por ligação.

Isso muda a lógica de precificação: cada aluno com cobrança mensal + régua completa (ex. 2-3 notificações WhatsApp por ciclo) gera um custo variável direto de poucos reais por mês, que precisa estar embutido na mensalidade cobrada da escola — não é custo zero como seria numa automação própria após o investimento inicial ser pago.

Também vale decidir: cobramos comissão via split de pagamento do Asaas (percentual sobre o que a escola recebe) além ou em vez da assinatura fixa por aluno/faixa.

## 5. Riscos e como mitigamos
- **Dependência de um único fornecedor de infraestrutura financeira**: toda a operação de cobrança, régua e recebimento passa a depender do Asaas. Mitigação: modelagem de dados própria (nosso banco) mantém histórico independente, e a arquitetura não impede trocar de provedor no futuro se necessário — mas é uma dependência estratégica real, vale ter isso claro.
- **Customização da mensagem de cobrança**: ainda não confirmamos se o conteúdo da notificação de WhatsApp aceita a "cara da escola" (marca, tom) ou se é padrão do Asaas — isso pode limitar o quanto vendemos "comunicação personalizada" como diferencial na v1. Precisa validação técnica antes de prometer isso a um cliente.
- **Custo variável por notificação**: diferente de uma automação própria (custo fixo de desenvolvimento, depois quase zero por envio), aqui cada mensagem tem custo direto recorrente — precisa estar corretamente embutido na precificação (ver item 4).
- **Processo de verificação da subconta (KYC)**: onboarding de escola pode depender de aprovação/verificação do Asaas — mapear esse prazo real antes de prometer "ativação em X dias" a um cliente-piloto.
- **LGPD**: dados de menores e dados financeiros de responsáveis exigem tratamento cuidadoso desde a modelagem — vira contrato de tratamento de dados com cada escola-cliente, não só uma checkbox técnica.
- **Concorrência estabelecida**: mitigada por foco de escopo (item 3) — não brigamos de frente com os sistemas completos.

## 6. Escopo do MVP
Cadastro → geração automática de cobrança (Pix/boleto) → régua de lembrete via WhatsApp → dashboard de inadimplência → conciliação automática. Fora do MVP: portal self-service do responsável, diário de classe, matrícula completa, nota fiscal automatizada — tudo isso é roadmap pós-validação, não bloqueia o lançamento.

## 7. Plano de validação
- Rodar com **1-2 escolas-piloto reais** antes de qualquer investimento em vendas.
- Métrica de sucesso: redução mensurável da taxa de inadimplência e do tempo gasto pela secretaria em cobrança manual, em ~3 meses de uso.
- Só depois disso avaliar investimento em aquisição de clientes (tráfego pago, prospecção direta a escolas).

## 8. Pontos em aberto para decidir com o sócio
- Divisão de responsabilidades (dev, comercial/vendas, suporte) e de sociedade no projeto.
- Abertura da conta raiz Asaas e entendimento das condições de contrato para operar subcontas white label em escala (taxas podem variar por volume/negociação).
- Modelo de precificação final (por aluno vs. por faixa), já considerando os custos variáveis de notificação e recebimento do Asaas.
- Se cobramos comissão sobre o valor transacionado (split de pagamento) além da assinatura, ou só assinatura fixa.
- Escolas-piloto: já existe algum contato/relacionamento que facilite a entrada, ou começamos do zero?

## 9. Próximos passos sugeridos
1. Alinhar modelo de negócio e divisão de responsabilidades (este documento como base).
2. Abrir conta Asaas (sandbox) e validar tecnicamente: criação de subconta via API, régua de notificação por cliente, e principalmente o nível de customização da mensagem de WhatsApp.
3. Validar com 2-3 escolas reais se a dor e a disposição a pagar existem antes de codar tudo.
4. Iniciar desenvolvimento do MVP seguindo a spec técnica já estruturada (constitution → spec → plan → tasks).
