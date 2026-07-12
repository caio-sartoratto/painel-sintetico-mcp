# Checagem de dado: Pix e golpes, por segmento

O painel não serve só para "conversar com personas" — é também uma base de estatística
**rastreável até a fonte**, com os tipos de percentual separados corretamente.

---

**Prompt:**

> No Painel Sintético Concorde, o que existe de fatos sobre Pix e golpes? Separe o que é
> prevalência populacional do que é propensão de segmento, com as fontes, e diga quais segmentos
> são mais afetados.

---

**O Claude chama:** `buscar_fatos(texto="pix")` → 8 fatos retornados.

## Prevalência (base populacional — vale para todos)

| métrica | % | fonte |
|---|---|---|
| usa Pix (início 2026) | 80% | Banco Central do Brasil |
| transações bancárias via smartphone | 78% | Febraban / Deloitte 2025 |
| já foi alvo de tentativa de golpe financeiro | 39% | Radar Febraban IPESPE 2025 |

## Propensão (por segmento — P(métrica \| segmento))

Adoção de Pix escala com a classe social — um gradiente que só aparece porque cada fato tem
filtro de segmento:

| segmento | usa Pix | fonte |
|---|---|---|
| Classe A | 98% | TIC Domicílios 2025 |
| Classe C | 86% | Cetic.br 2024 |
| Classe B | 82% | Cetic.br 2024 |
| Classe D/E | 60% | TIC Domicílios 2025 |

## Composição — cuidado com a leitura (P(segmento \| métrica))

| métrica | % | fonte |
|---|---|---|
| vítimas do golpe da "Taxa sobre Pix" que têm 50+ anos | 53% | Receita Federal, jan/2025 |

**O que isso NÃO diz:** que 53% das pessoas 50+ caíram no golpe. Diz que, **entre as vítimas**,
53% eram 50+. É P(idade 50+ | foi vítima), não P(foi vítima | idade 50+). O painel marca esse
fato como `composicao` e injeta um aviso na ficha de qualquer persona que o receba, justamente
para o modelo não inverter a probabilidade condicional.

## Por que isso é diferente de perguntar direto pro LLM

Cada número acima veio com **filtro determinístico**, **tipo de percentual** e **fonte** — não da
memória do modelo. É auditável: você clica na fonte e confere. Um LLM respondendo de cabeça
misturaria prevalência com propensão e chutaria as porcentagens.
