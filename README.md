# Painel Sintético Concorde

[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-published-6f42c1)](https://registry.modelcontextprotocol.io/v0.1/servers?search=painel-sintetico-concorde)
[![License: MIT](https://img.shields.io/badge/License-MIT-informational)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/runs%20on-Cloudflare%20Workers-f38020)](https://workers.cloudflare.com/)

Servidor MCP remoto que expõe um painel de **787 personas sintéticas do consumidor bancário
brasileiro** para qualquer Claude (Desktop, web, mobile) — para discovery de produtos bank e
fintech. Roda inteiro no free tier da Cloudflare Workers.

**Site e demo:** https://painel.concorde-painel.workers.dev
**Nome no registro oficial de MCP:** `io.github.caio-sartoratto/painel-sintetico-concorde`

## Como instalar / encontrar

O painel é um conector MCP remoto. Não há nada para baixar.

1. No Claude (Desktop, web ou mobile): **Settings → Connectors → Add custom connector**
2. Cole a URL: `https://painel.concorde-painel.workers.dev/mcp`
3. Requer plano pago do Claude (conectores customizados não estão no plano gratuito)

Ele também está publicado no [registro oficial de MCP](https://registry.modelcontextprotocol.io)
como `io.github.caio-sartoratto/painel-sintetico-concorde`, então tende a aparecer em
marketplaces e agregadores de MCP que consomem o registro. A instalação, porém, continua sendo
pela URL acima (estar no registro não adiciona o conector automaticamente ao Claude).

> Os **dados do painel não estão neste repositório** (são proprietários — veja a licença).
> Este repo é o motor: servidor MCP, site, fórum, cotas e telemetria. O serviço público
> roda com o painel completo.

## Por que existe

Pedir a um LLM para "simular 700 pessoas" produz um respondente médio repetido N vezes, com
viés de renda/escolaridade (Santurkar et al. 2023; Bisbee et al. 2024). O caminho que funciona
é condicionar o modelo em atributos sociodemográficos reais (Argyle et al. 2023). Aqui a
heterogeneidade vem da estrutura: cada persona é ligada por **filtro determinístico**
(`campo operador valor`) a fatos estatísticos com fonte, e o LLM só dá voz.

## Validação (backtest contra pesquisa real)

100 personas sorteadas do painel, classificadas com temperatura 0 (reproduzível), comparadas a
pesquisas publicadas.

### idwall 2025 (amostra nacional ponderada por IBGE)

| Pergunta de atitude do consumidor | idwall | Painel | Erro |
|---|--:|--:|--:|
| Pretende manter/aumentar uso de bancos digitais | 84,9% | 86,0% | **1,1 pp** |
| Rapidez do cadastro é o fator nº 1 na abertura de conta | 51,4% | 49,0% | **2,4 pp** |
| A casa é o lugar mais seguro para acessar o banco | 68,5% | 74,0% | **5,5 pp** |

**Erro médio absoluto: 3,0 pp** — as três dentro de 6 pontos percentuais do benchmark.

### Reclame AQUI 2026 (crise de confiança em bancos digitais, n=2.073)

| Atitude do consumidor | Reclame AQUI | Painel | Erro |
|---|--:|--:|--:|
| Medo de a instituição quebrar e perder o dinheiro (liquidez) | 35% | 39% | **4 pp** |

### BCG e Nubank, "Beyond Access" 2023 (população brasileira, n=2.000)

Headline do estudo: mais de 70% dos brasileiros não se sentem seguros nem incluídos
financeiramente. O painel, de forma independente, chega a **78%**.

Sem nenhuma quebra por classe no benchmark, o painel reproduz sozinho o gradiente social da
insegurança (amostra estratificada por classe, temperatura 0):

| Classe | Se sente inseguro | Amostra |
|---|--:|--:|
| A | 5% | n=22 |
| B | 20% | n=30 |
| C | 77% | n=30 |
| D/E | 80% | n=30 |

### Controle: e se for só o LLM?

As mesmas perguntas respondidas direto por modelos de fronteira, sem painel, sem persona, sem
busca na internet, temperatura 0:

| Pergunta | Real | Painel | Gemini 3.1 Pro | GPT-5.6 |
|---|--:|--:|--:|--:|
| Mantém ou aumenta o uso de bancos digitais | 84,9% | 86% | 84% | 85% |
| Rapidez do cadastro é o fator nº 1 | 51,4% | 49% | 18% | 25% |
| A casa é o lugar mais seguro para acessar | 68,5% | 74% | 65% | 90% |
| Medo de a instituição quebrar (liquidez) | 35% | 39% | 45% | 65% |
| **Erro médio absoluto** | | **3,3 pp** | 12,0 pp | 19,5 pp |

O painel erra **3,7x menos que o Gemini** e **6x menos que o GPT** nas mesmas perguntas. No
headline do BCG: painel 78% (dentro do ">70%"), Gemini 55% (fora), GPT 60% (fora). Os números
dos modelos crus ainda contradizem a si mesmos: o Gemini estima 45% "seguros e incluídos" mas só
31% "seguros", e a interseção não pode ser maior que a parte. O painel não produz esse erro
porque cada número vem de contar personas uma a uma.

Transparência: essas são as perguntas de melhor aderência entre as categorias testadas. Itens
de satisfação e incidência auto-reportada divergem mais (viés de calibração conhecido nas
narrativas, em ajuste). **Não substitui pesquisa primária nem teste A/B** — é a etapa barata que
vem antes.

## Exemplos

Transcrições reais rodando no Claude (personas e fatos vêm do painel de verdade):
[`examples/`](examples/) — focus group de conceito, teste com Classe A e checagem de dado.

## Arquitetura

```
vault Obsidian (fonte da verdade: personas + fatos + vozes + instituições)
        │  npm run build-data  (compila markdown → JSON)
        ▼
Cloudflare Worker
 ├─ /mcp        servidor MCP (agents SDK / McpAgent + Durable Object)
 │              9 ferramentas: visao_geral, avaliar_pergunta (fronteira de
 │              confiança), filtrar_personas, sortear_amostra, get_personas,
 │              buscar_fatos, listar_vozes, get_instituicao, get_distribuicoes
 ├─ QuotaDO     cotas por IP (rajada/dia + teto de fichas: anti-extração)
 ├─ /           site estático server-rendered (zero framework)
 ├─ /forum      fórum anônimo sem moderação prévia (ForumDO) — nunca exposto via MCP
 │              (evita prompt injection armazenada em sessões de terceiros)
 └─ StatsDO     telemetria própria (IPs só como hash; dashboard admin)
```

Decisões que valem nota:

- **DSL de filtro própria** (sem eval): `classe_social == 'Classe C' & idade > 30`, mesma
  sintaxe do vault ao servidor.
- **Fatos tipados** (propensão / prevalência / composição / referência) — composição é
  P(público|métrica), o inverso de propensão; o servidor injeta aviso na ficha quando presente.
- **Cotas via Durable Object** por IP: extração em massa do painel é impraticável sem
  autenticação de usuários.
- **Fórum fora do MCP por regra**: conteúdo aberto de terceiros nunca volta por ferramenta,
  eliminando o vetor de injection armazenada.

## Rodando

Pré-requisitos: Node 20+, conta Cloudflare, um vault no formato esperado (veja
`scripts/build-data.mjs` para o schema de frontmatter).

```sh
npm install
VAULT_DIR=/caminho/do/vault npm run build-data   # gera src/data/*.json (não versionado)
npm run dev                                       # local em http://localhost:8787
npx wrangler secret put ADMIN_TOKEN               # kill switch do fórum + dashboard
npx wrangler secret put HASH_SALT                 # sal dos hashes de IP
npm run deploy
```

## Licença

Código sob [MIT](LICENSE). Os **dados do painel** (personas, fatos, vozes, fichas de
instituições e distribuições) são proprietários, não incluídos neste repositório e **não
licenciados** para redistribuição.

## Autor

Caio Sartoratto Prado — [LinkedIn](https://www.linkedin.com/in/caio-sartoratto-prado-078307178/)
· projeto Concorde. Feedback: [fórum do painel](https://painel.concorde-painel.workers.dev/forum).
