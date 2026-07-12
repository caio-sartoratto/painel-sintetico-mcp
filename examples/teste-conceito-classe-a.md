# Reação de investidor Classe A a benefícios premium

Um único perfil de alta renda reagindo à reformulação de benefícios de um banco premium — mostra
como o Grounding evita ler estatística ao contrário (composição × propensão).

---

**Prompt:**

> Usando o Painel Sintético Concorde, pegue a ficha de um investidor Classe A multi-banco e me
> diga como ele reagiria a esta reformulação de benefícios premium: "cashback de 1%, salas VIP
> em aeroportos e gerente dedicado". Responda em 1ª pessoa, ancorado no Grounding, e respeite os
> tipos de percentual (composição não é propensão).

---

**O Claude chama:** `get_personas(["PERS_199"])`

## A persona (dados reais do painel)

**PERS_199 · Ricardo** — 38 anos, perito engenheiro sócio, Porto Alegre/Sul
Renda familiar R$ 31.734 · patrimônio financeiro R$ 3,0 mi · Itaú Personnalité + 3 bancos
(BB Estilo, Nubank, BTG Pactual) · investidor moderado

## Resposta

**Ricardo, 38, engenheiro sócio em Porto Alegre:**

> "Cashback de 1% não paga o meu tempo. Eu pago caro justamente pra resolver rápido — e hoje
> espero na fila do telefone como todo mundo. O que me segura de verdade: gerente que responde em
> minutos e segurança que funcione, porque fraude eu já vi de perto. Faz isso e eu concentro aqui
> o que hoje está no BTG. Sala VIP é bônus, não é o motivo de eu ficar."
>
> _ancorado em: 47% da classe A/B já passou por situação de fraude, acima da média (raio-x classe
> AB) · perfil multi-banco com 4 relacionamentos (ficha) · investidor moderado_

## O detalhe metodológico (por que isso importa)

A ficha do Ricardo traz fatos do tipo **composição**, como _"representa 95% dos compradores de
carro importado"_. O Claude é instruído — pela descrição da ferramenta e por um aviso injetado na
ficha — a **não** ler isso como propensão:

> ⚠️ "representa 95% dos compradores de carro importado" (P(classe A/B | comprou carro importado))
> **não** significa "95% da classe A/B compra carro importado" (P(comprou | classe A/B)).

Por isso a resposta do Ricardo se apoia em fatos de **propensão** (o que *ele* provavelmente faz),
não nos de composição (a fatia que a classe dele representa dentro de um mercado). É a diferença
entre uma persona crível e uma caricatura estatística.
