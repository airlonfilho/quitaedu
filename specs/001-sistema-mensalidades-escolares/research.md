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
| Nível de customização da mensagem de WhatsApp do Asaas (marca/tom da escola) | Define se dá pra vender "cobrança com a cara da escola" como diferencial no pitch | **Não validado** — testar em sandbox antes de prometer a um cliente (tarefa `A-006` em `tasks.md`) |
| Mecanismo de assinatura do webhook do Asaas (HMAC ou token) | Define como implementar `contracts/api.md` → `POST /api/webhooks/asaas` com segurança | **Não confirmado** — checar documentação oficial (tarefa `A-007`) |
| Prazo típico de verificação/KYC de subconta nova | Define SLA de onboarding que dá pra prometer a uma escola-piloto | **Não confirmado** (tarefa `A-008`) |
| Rate limit da API Asaas em geração de cobrança em lote | Pode causar falha parcial se muitas escolas tiverem o mesmo dia de vencimento | Não testado — confirmar limite e implementar backoff no worker |

## Pesquisa de mercado: concorrência direta no mesmo nicho

Levantamento feito antes de comprometer o roadmap, para calibrar diferenciação.

**isaac** — maior ameaça identificada. Fintech educacional (adquirida pela Arco Educação, listada na Nasdaq), ~R$5 bi transacionados/ano, mirando 10 mil escolas, cobrindo hoje ~2.000 das ~40.000 escolas privadas do Brasil (~5% de penetração). Produto central é "receita garantida": assume o risco de crédito da inadimplência, modelo de fintech/factoring, não um SaaS puro. **Implicação para este projeto**: não competimos no terreno de garantia de recebível (exige capital/estrutura de FIDC); competimos como camada de software mais leve e rápida de lançar, mirando os ~95% do mercado que o isaac ainda não cobre, começando pela ponta pequena/regional (Ceará).

**Escolapay** — concorrente de proposta quase idêntica: nasceu dentro de escolas, régua de cobrança + Pix/boleto/cartão, sem mensalidade fixa (monetiza por taxa de transação). É a validação mais direta de que a tese faz sentido — e o principal benchmark de produto a observar.

**Kolek** — ferramenta horizontal de régua de cobrança (atende também BPOs, contadores, advogados, clínicas, condomínios, academias), com página específica "para escolas". Exige que a escola já tenha um sistema de gestão/planilha por trás — não substitui o registro, só adiciona a régua.

**FlexiBank** — fintech de garantia de recebível para escolas, mais antiga (2003) e menor que o isaac, mesmo modelo de negócio.

**Didatiko** (e ERPs como Sponte/Proesc/Escola Web) — ERPs completos com módulo financeiro. Didatiko em particular tem "Didatiko Finance" como vertical modular ativável separadamente — mais próximo da nossa proposta que Sponte/Proesc, mas ainda embutido em um ecossistema pedagógico maior.

**Conclusão da pesquisa**: o espaço de "SaaS leve, só financeiro, para escola pequena/média, sem assumir risco de crédito" está pouco ocupado — Escolapay é o único concorrente quase idêntico encontrado, e não há evidência de que já domine o mercado.
