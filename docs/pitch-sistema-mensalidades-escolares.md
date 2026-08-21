# Pitch — Sistema de Gestão de Mensalidades Escolares

*Cobrança automatizada via WhatsApp, construída sobre a infraestrutura financeira do Asaas, para escolas particulares de pequeno e médio porte.*

---

## Em uma frase

A escola cadastra os alunos uma vez; o sistema cobra, lembra e concilia sozinho — e a secretaria para de perder tempo e dinheiro perseguindo mensalidade atrasada.

---

## 1. A dor

Inadimplência escolar não é exceção, é a regra — e ela é crônica no país inteiro:

- A taxa de inadimplência nas escolas particulares do Brasil fechou 2025 em **19,62%** (queda frente aos 20,36% de 2024, mas ainda acima do patamar pré-pandemia de 17,57% em 2019).
- No **Nordeste**, o índice sobe para **23,76%** (2024).
- No **Ceará**, o índice bateu **32,16% em 2025 — o maior do país.** Não é força de expressão: é o estado com a pior taxa de inadimplência escolar privada do Brasil inteiro.
- Especialistas em finanças escolares consideram até 5% de inadimplência "gerenciável" e acima de 10% "situação crítica". Pela métrica do próprio setor, a esmagadora maioria das escolas brasileiras — e praticamente todas no Ceará — opera em estado crítico permanente.
- Entre gestores de escolas particulares, **61% apontam inadimplência e baixo capital de giro como o principal problema da gestão financeira** da instituição.

E o motivo não é só "as famílias não têm dinheiro" — é também **processo manual e frágil**: planilha, boleto avulso emitido um por um, cobrança feita "no grupo do WhatsApp" pela secretaria, sem régua consistente, sem lembrete automático, sem visibilidade de quem está prestes a atrasar antes de atrasar. A escola descobre o problema quando ele já é problema — não antes.

**Estamos sediados no Ceará. Isso não é market research distante — é o mercado batendo na porta.**

---

## 2. A solução

Sistema de gestão de mensalidades focado, **não um ERP escolar completo**:

- Cadastro de alunos, responsáveis financeiros e planos de mensalidade.
- Geração automática de cobrança (Pix, boleto, cartão) todo mês.
- Régua de lembrete automática por WhatsApp, e-mail, SMS e robô de voz — antes do vencimento, no vencimento, em atraso.
- Dashboard de inadimplência em tempo real, com a identidade visual da escola.
- Conciliação automática — pagamento recebido baixa a cobrança sozinho.
- Negativação Serasa disponível para casos persistentes.

**A decisão de arquitetura que muda o jogo**: em vez de construir gateway de pagamento e motor de WhatsApp do zero, o produto roda sobre a infraestrutura financeira do **Asaas**, via subconta white label por escola. A escola nunca vê a marca Asaas — só vê o nosso produto. Isso elimina o maior risco técnico e de cronograma do projeto (aprovação de API de WhatsApp, compliance de gateway de pagamento) e concentra nosso esforço de desenvolvimento onde está o diferencial real: a experiência pensada para o contexto escolar.

---

## 3. Por que agora, por que a gente

- **Infraestrutura madura disponível**: o Asaas já resolve cobrança + régua multicanal + negativação de forma homologada — o trabalho de construir isso do zero, que inviabilizaria um MVP rápido há poucos anos, hoje é uma integração.
- **Conhecimento técnico já validado**: a mesma stack (Next.js/Prisma/PostgreSQL) já está em produção no Tera Gestão, outro SaaS B2B que já rodamos. Não é a primeira vez construindo esse tipo de produto.
- **Timing do mercado**: Pix já é o meio de pagamento mais usado pelo brasileiro (46,1% de participação, segundo o Banco Central), o que reduz a fricção de adoção pelas famílias — a régua de cobrança não depende mais de convencer ninguém a usar um método de pagamento novo.

---

## 4. Tamanho do mercado

**Fonte: Censo Escolar/INEP 2025.**

- Brasil tem **41.746 escolas privadas em atividade**.
- **67% delas (27.988 escolas) têm até 200 alunos** — pequeno e médio porte, exatamente o segmento que este produto mira (não competimos com ERPs completos voltados a redes grandes).
- Somando a distribuição por faixa (até 50 / 51-100 / 101-200 alunos) com os planos de preço já modelados (R$15, R$13,50 e R$13,50/aluno respectivamente), a receita potencial teórica desse segmento, a 100% de penetração, seria de **~R$33,8 milhões/mês (~R$405 milhões/ano)**. Isso é o teto teórico do SAM, não uma meta — serve só para dimensionar a oportunidade.
- Receita média projetada por escola nesse segmento: **~R$1.206/mês**.

**Recorte regional — o ponto de entrada (Ceará):**

- O Ceará tem 7.622 escolas de educação básica. Aplicando a proporção nacional de escolas privadas (~22,7% do total), a estimativa é de **~1.700 escolas particulares no estado** — número aproximado, não é contagem oficial por rede.
- Aplicando a mesma distribuição de porte (67% pequeno/médio), isso dá **~1.150 escolas particulares de pequeno/médio porte no Ceará** — o SOM realista de curto/médio prazo.

| Cenário de penetração | Escolas conquistadas | Receita mensal | Receita anual |
|---|---|---|---|
| Conservador (1%) | ~12 escolas | ~R$14.000/mês | ~R$168.000/ano |
| Moderado (3%) | ~35 escolas | ~R$42.000/mês | ~R$503.000/ano |
| Otimista (5%) | ~58 escolas | ~R$70.000/mês | ~R$838.000/ano |

Mesmo no cenário conservador, 12 escolas já validam o modelo de negócio e geram caixa recorrente suficiente para reinvestir em crescimento — sem depender de rodada de investimento externo.

---

## 5. O que atacar primeiro

Não vamos atrás do mercado inteiro de uma vez. A ordem de ataque:

1. **Porte**: escolas de até 200 alunos — onde estão 67% das escolas privadas do Brasil e onde o processo manual dói mais (não têm equipe/orçamento para um ERP completo, mas sofrem tanto quanto uma escola grande com inadimplência).
2. **Geografia**: Ceará primeiro — não por conveniência, mas porque é literalmente o estado com a pior inadimplência escolar do país. A dor é mais aguda aqui do que em qualquer outro lugar do Brasil.
3. **Perfil de decisão**: escolas onde o dono/diretor também acumula a função financeira (comum em escolas pequenas) — ciclo de venda mais curto, decisão concentrada em uma pessoa, sem comitê de compras.

**Fora do foco inicial, deliberadamente**: redes grandes (>200 alunos) que já usam ou negociam ERPs completos (Sponte, Escola Web) — ali competimos por feature, não por dor específica, e perdemos.

---

## 6. Como atacar

- **Piloto pago ou gratuito com 1-2 escolas reais** antes de qualquer investimento em aquisição — validar taxa de inadimplência real, tempo economizado pela secretaria, e principalmente se a régua nativa do Asaas entrega a experiência de marca que estamos prometendo.
- **Venda direta e relacional no início**: dado o ciclo de decisão curto em escola pequena, prospecção ativa (visita, indicação, rede de contato local) tende a converter mais rápido que tráfego pago nesta fase.
- **Prova social regional**: primeiro cliente satisfeito no Ceará vira referência para o próximo — mercado de escola é de reputação local, gestores se conhecem, se indicam e se desconfiam de fornecedor sem histórico.
- **Preço como ferramenta de entrada, não de maximização**: nos primeiros contratos, considerar desconto de lançamento ou o plano "Pequeno Porte" facilitado — o objetivo do primeiro trimestre é validação e caso de sucesso, não margem máxima.
- **Expansão geográfica só depois de validação**: replicar o playbook regional (Ceará → outros estados do Nordeste com inadimplência alta, ex. índices similares na região) antes de tentar cobrir o Brasil inteiro.

---

## 7. Diferencial competitivo

| Frente | ERPs escolares completos | Nós |
|---|---|---|
| Escopo | Pedagógico + financeiro + comunicação | Só financeiro/cobrança |
| Implantação | Complexa, treinamento longo | Rápida, foco em 1 fluxo |
| Infraestrutura de pagamento | Construída/mantida internamente | Delegada ao Asaas — menos custo, menos risco |
| Ciclo de venda | Longo, decisão em comitê | Curto, decisão do dono/diretor |
| Ticket | Alto, contrato anual | Mensal, entrada facilitada |

Não vencemos brigando por feature completa. Vencemos sendo o sistema **pensado para a dor específica que mais incomoda a escola pequena/média**, com adoção rápida e preço acessível.

---

## 8. Riscos — de olho aberto, não escondidos

- **Dependência de um único fornecedor de infraestrutura financeira** (Asaas) — mitigado por manter histórico e modelagem próprios, mas é uma dependência estratégica real.
- **Nível de customização da mensagem de WhatsApp** ainda não confirmado tecnicamente — pode limitar quanto prometemos de "comunicação com a cara da escola" na v1.
- **Processo de verificação/KYC de subconta** pode adicionar tempo ao onboarding — mapear prazo real antes de prometer SLA a cliente.
- **Inadimplência alta é a dor que vendemos resolver, mas também é risco para o próprio negócio da escola-cliente** — se a escola cliente parar de existir, perdemos a assinatura. Reforça por que o produto precisa entregar resultado rápido e mensurável.

---

## 9. O pedido

Para sair do papel:

1. **Decisão conjunta** sobre divisão de responsabilidades (dev, comercial, suporte) e formato da sociedade no projeto.
2. **Validação técnica de 1-2 semanas**: abrir conta Asaas sandbox, testar subconta white label e nível real de customização da régua de WhatsApp antes de comprometer o roadmap todo.
3. **2-3 conversas reais com escolas do Ceará** (mesmo antes de ter produto pronto) para confirmar que a dor de inadimplência e o processo manual atual são exatamente como os dados sugerem — e descobrir objeções que só uma conversa real revela.
4. **Início do desenvolvimento do MVP** seguindo a spec técnica já estruturada (constitution → spec → plan → tasks), com meta de piloto funcional em [prazo a definir juntos].

O mercado está claramente maior do que uma dor "de nicho" — 67% das escolas privadas do Brasil se encaixam no nosso porte-alvo, e estamos fisicamente no estado com a pior inadimplência escolar do país. A pergunta não é se existe demanda. É se a gente executa antes de outro alguém perceber a mesma coisa.
