# Painel Sintético Concorde

Servidor MCP remoto que expõe um painel de **787 personas sintéticas do consumidor bancário
brasileiro** para qualquer Claude (Desktop, web, mobile) — para discovery de produtos bank e
fintech. Roda inteiro no free tier da Cloudflare Workers.

**Site e demo:** https://painel.concorde-painel.workers.dev
**Conector (Claude → Settings → Connectors → Add custom connector):**
`https://painel.concorde-painel.workers.dev/mcp`

> Os **dados do painel não estão neste repositório** (são proprietários — veja a licença).
> Este repo é o motor: servidor MCP, site, fórum, cotas e telemetria. O serviço público
> roda com o painel completo.

## Por que existe

Pedir a um LLM para "simular 700 pessoas" produz um respondente médio repetido N vezes, com
viés de renda/escolaridade (Santurkar et al. 2023; Bisbee et al. 2024). O caminho que funciona
é condicionar o modelo em atributos sociodemográficos reais (Argyle et al. 2023). Aqui a
heterogeneidade vem da estrutura: cada persona é ligada por **filtro determinístico**
(`campo operador valor`) a fatos estatísticos com fonte, e o LLM só dá voz. Validação por
backtest contra o Estudo idwall 2025: erro médio de 6,3 p.p. em perguntas de atitude do
consumidor (detalhes e limitações no site).

## Arquitetura

```
vault Obsidian (fonte da verdade: personas + fatos + vozes + instituições)
        │  npm run build-data  (compila markdown → JSON)
        ▼
Cloudflare Worker
 ├─ /mcp        servidor MCP (agents SDK / McpAgent + Durable Object)
 │              8 ferramentas: visao_geral, filtrar_personas, sortear_amostra,
 │              get_personas, buscar_fatos, listar_vozes, get_instituicao,
 │              get_distribuicoes
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
