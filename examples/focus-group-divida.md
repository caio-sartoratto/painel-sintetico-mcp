# Focus group: app de renegociação de dívidas

Conceito testado com 3 personas Classe C com dívida ativa. Amostra reprodutível (`seed 42`).

---

**Prompt (cole no Claude com o conector instalado):**

> Monte um focus group com o Painel Sintético Concorde. Sorteie 3 personas Classe C com dívida
> ativa (seed 42), busque as fichas completas e apresente a elas este conceito: "um app que
> renegocia suas dívidas automaticamente — você conecta seus bancos, ele negocia descontos com
> os credores e você paga R$ 19,90/mês". Cada persona responde em 1ª pessoa, ancorada no
> Grounding dela (cite o dado com % e fonte). Feche com padrões, objeções e próximo passo.

---

**O Claude chama:** `sortear_amostra(n=3, filtro="classe_social == 'Classe C' & divida_ativa == 'Sim'", seed=42)` → pool de 137 personas → depois `get_personas` das 3 sorteadas.

## As 3 personas (dados reais do painel)

| id | quem | perfil |
|---|---|---|
| PERS_407 | aposentado, 69, Sudeste | Caixa, renda familiar R$ 8.134, não investe |
| PERS_132 | Thiago, vendedor CLT, 32, Recife | Caixa + Nubank, dívida R$ 6.873, Android de entrada |
| PERS_191 | desempregado, 34, Norte | benefício social, dívida ativa |

## Respostas

**Thiago (PERS_132), 32, vendedor em Recife:**

> "Renegociar de graça o Serasa já me oferece toda semana. O que eu pagaria é pra dívida não
> voltar — eu limpo o nome e em seis meses estou no rotativo de novo. Se o app só junta boleto,
> não vale R$ 19,90. Se segurar meu limite quando o mês aperta, aí conversa. E tem que funcionar
> no meu celular, que já vive sem espaço."
>
> _ancorado em: 42% dos negativados estão no ciclo há 10+ anos (Serasa) · 85,1% do segmento com
> dívida no cartão (CNC) · dispositivo Android de entrada (ficha)_

**Aposentado (PERS_407), 69, Sudeste:**

> "Mensalidade pra mim é mais uma conta fixa, e no fim do mês toda conta fixa pesa. Prefiro
> negociar uma vez, olho no olho na agência, do que assinar uma coisa que debita todo mês sem eu
> ver. Se meu neto configurar e eu entender o que está sendo cobrado, tudo bem. Sozinho, não
> mexo."
>
> _ancorado em: perfil 65+ · aposentadoria como fonte de renda (ficha)_

**Desempregado (PERS_191), 34, Norte:**

> "R$ 19,90 sem renda fixa é dinheiro que eu não tenho. Só faz sentido se eu pagar quando a
> dívida for resolvida, não antes. Cobrar mensalidade de quem já está no vermelho é pedir pra
> cancelar no primeiro mês."
>
> _ancorado em: fonte de renda Desempregado/Benefício Social (ficha) · segmento de baixa renda_

## Síntese do Claude

- **Padrão:** os três rejeitam a **mensalidade recorrente** — para o endividado, é mais uma
  conta fixa. O modelo de cobrança é o maior atrito, não a proposta.
- **Objeção mais forte:** renegociação já é commodity (o próprio Serasa oferece de graça). O
  valor tem que estar em **prevenir a recaída**, não em juntar boletos.
- **Divergência por idade/renda:** o jovem topa se houver controle de limite; o idoso quer
  atendimento humano; o desempregado só aceita cobrança **após** o resultado (modelo de sucesso).
- **Próximo passo sugerido:** testar precificação por êxito (% da economia) em vez de assinatura,
  e validar com pesquisa real se "evitar recaída" é uma dor pela qual esse público pagaria.
