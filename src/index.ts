import { McpAgent } from "agents/mcp";
import { DurableObject } from "cloudflare:workers";
import { PAGINAS, EXTRAS } from "./site";
import { rotaForum } from "./forum";
export { ForumDO } from "./forum";
import { rotaStats, registraPagina, registraMcp } from "./stats";
export { StatsDO } from "./stats";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import personasData from "./data/personas.json";
import fatosData from "./data/fatos.json";
import vozesData from "./data/vozes.json";
import instituicoesData from "./data/instituicoes.json";
import distribuicoesData from "./data/distribuicoes.json";
import taxasData from "./data/taxas.json";

type Persona = Record<string, any>;
type Fato = Record<string, any>;

const personas = personasData as Persona[];
const fatos = fatosData as Fato[];
const vozes = vozesData as Record<string, any>[];
const instituicoes = instituicoesData as Record<string, any>[];
const distribuicoes = distribuicoesData as Record<string, string>;
const taxas = taxasData as string | null;

// ---------- DSL de filtro (mesma do vault): "campo OP valor & campo OP valor" ----------
// Operadores: == != > < >= <= in entre. Listas: ['A'; 'B'].

function parseValor(raw: string): any {
  raw = raw.trim();
  if (raw.startsWith("[")) {
    return raw
      .slice(1, -1)
      .split(";")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter((s) => s !== "")
      .map((s) => (!isNaN(Number(s)) ? Number(s) : s));
  }
  const clean = raw.replace(/^["']|["']$/g, "");
  return clean !== "" && !isNaN(Number(clean)) ? Number(clean) : clean;
}

function condMatch(p: Persona, campo: string, op: string, valor: any): boolean {
  const v = p[campo];
  if (v === undefined || v === null) return false;
  const num = typeof v === "number" ? v : Number(v);
  switch (op) {
    case "==": case "igual":
      return String(v).toLowerCase() === String(valor).toLowerCase();
    case "!=": case "diferente":
      return String(v).toLowerCase() !== String(valor).toLowerCase();
    case ">": case "maior_que": return num > Number(valor);
    case "<": case "menor_que": return num < Number(valor);
    case ">=": return num >= Number(valor);
    case "<=": return num <= Number(valor);
    case "in": case "um_de": {
      const lista = Array.isArray(valor) ? valor : [valor];
      return lista.some((x) => String(x).toLowerCase() === String(v).toLowerCase());
    }
    case "entre": {
      const [min, max] = Array.isArray(valor) ? valor : String(valor).split(";").map(Number);
      return num >= Number(min) && num <= Number(max);
    }
    default:
      throw new Error(`Operador desconhecido: ${op}`);
  }
}

function filtrar(expr: string | undefined | null): Persona[] {
  if (!expr || expr.trim() === "" || expr.trim() === "todos") return personas;
  if (expr.length > 500) throw new Error("Filtro longo demais (máx. 500 caracteres). Use menos condições.");
  const conds = expr.split("&").map((c) => {
    const m = c.trim().match(/^(\w+)\s*(==|!=|>=|<=|>|<|in|entre)\s*(.+)$/);
    if (!m) throw new Error(`Condição inválida: "${c.trim()}". Formato: campo OP valor (OP: == != > < >= <= in entre)`);
    return { campo: m[1], op: m[2], valor: parseValor(m[3]) };
  });
  return personas.filter((p) => conds.every((c) => condMatch(p, c.campo, c.op, c.valor)));
}

// Fato → persona usando publico_alvo_* do frontmatter
function fatoCasa(f: Fato, p: Persona): boolean {
  const campo = f.publico_alvo_campo;
  if (!campo || campo === "populacao" || f.publico_alvo_operador === "todos") return true;
  if (campo === "composto") {
    if (!f.condicoes) return false;
    try { return filtrarUma(p, f.condicoes); } catch { return false; }
  }
  try { return condMatch(p, campo, f.publico_alvo_operador, f.publico_alvo_valor); } catch { return false; }
}

function filtrarUma(p: Persona, expr: string): boolean {
  return expr.split("&").every((c) => {
    const m = c.trim().match(/^(\w+)\s*(==|!=|>=|<=|>|<|in|entre)\s*(.+)$/);
    if (!m) throw new Error("cond inválida");
    return condMatch(p, m[1], m[2], parseValor(m[3]));
  });
}

// ---------- Formatação ----------
const MINI_CAMPOS = [
  "id", "classe_social", "faixa_etaria", "idade", "genero", "regiao", "profissao",
  "fonte_renda", "renda_mensal_familiar", "banco_principal", "se_investe", "divida_ativa",
];

function mini(p: Persona) {
  return Object.fromEntries(MINI_CAMPOS.map((c) => [c, p[c]]));
}

function fichaCompleta(p: Persona): string {
  const attrs = Object.entries(p)
    .filter(([k]) => !["grounding", "historia"].includes(k))
    .map(([k, v]) => `- **${k}**: ${Array.isArray(v) ? v.join(", ") : v}`)
    .join("\n");
  let grounding = p.grounding ?? "";
  if (grounding.includes("_composicao_"))
    grounding +=
      "\n\n> ⚠️ **Atenção aos fatos marcados _composicao_ acima:** o percentual é P(público | métrica) — a fatia que este segmento representa DENTRO do universo da métrica. NÃO leia como propensão da persona (P(métrica | persona)). Ex.: \"representa 53% das vítimas do golpe X\" ≠ \"tem 53% de chance de cair no golpe X\". Fatos _referencia_ também não são proporção de pessoas.";
  return [
    `# ${p.id}`,
    attrs,
    grounding ? `\n${grounding}` : "",
    p.historia ? `\n## História\n${p.historia}` : "",
  ].join("\n");
}

function fatoResumo(f: Fato) {
  return {
    id: f.id, percentual: f.percentual, tipo_percentual: f.tipo_percentual,
    metrica: f.metrica, publico_legivel: f.publico_legivel, filtro_persona: f.filtro_persona,
    fonte: f.fonte, data: f.data, eixo: f.eixo,
  };
}

// Computado uma vez por isolate (visao_geral é a primeira chamada de toda sessão)
const CAMPOS_FILTRAVEIS: Record<string, unknown[]> = Object.fromEntries(
  ["classe_social", "faixa_etaria", "genero", "regiao", "fonte_renda", "escolaridade", "se_investe", "tipo_investidor", "divida_ativa", "banco_principal"].map(
    (c) => [c, [...new Set(personas.map((p) => p[c]))].sort()]
  )
);

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}

// ---------- Fronteira de confiança (triagem de discovery) ----------
// O painel é forte onde a resposta se infere do contexto de segmento (prioridade, objeção,
// atrito de onboarding, compreensão de conceito, linguagem, tradeoff) e fraco onde exige
// estado vivido (satisfação, incidência, dano, comportamento passado real, intensidade
// emocional, confiança após experiência). Esta triagem é heurística e determinística: sinaliza
// perguntas prováveis de estado-vivido para o operador não confundir inferência com experiência.
const FRAMEWORK_CONFIANCA = {
  inferivel: {
    rotulo: "Seguro para pressão direcional de conceito.",
    exemplos: ["prioridades prováveis", "objeções prováveis", "atrito de onboarding", "compreensão de conceito", "linguagem que pode ou não colar", "tradeoffs a testar com humanos"],
  },
  arriscado: {
    rotulo: "Use com cautela e marque para validação humana.",
    exemplos: ["frequência/hábito auto-reportado", "valores gastos declarados", "incidência leve"],
  },
  humano: {
    rotulo: "Não pergunte a uma persona sintética. Exige estado vivido, valide com gente real.",
    exemplos: ["satisfação", "incidência (já foi vítima/aconteceu)", "trauma ou dano", "comportamento passado real", "intensidade emocional", "confiança após uma experiência real"],
  },
};

const FLAGS_HUMANO: Array<[RegExp, string]> = [
  [/satisfa|satisfeit|quão feliz|felicidade|gost(ou|aram|a) d|contente|nps\b|csat/i, "satisfação / sentimento vivido"],
  [/vítim|golpe|fraud|trauma|sofreu|prejuíz|perde(u|ram) (dinheiro|grana|tudo)|humilha|vergonh/i, "dano ou experiência sensível"],
  [/j[áa] (foi|aconteceu|passou|caiu|sofreu|teve|deixou)|quantas vezes|no [úu]ltimo (m[êe]s|ano|dia)|hist[óo]rico de|o que voc[êe] fez quando|voc[êe] chegou a|alguma vez voc[êe]/i, "incidência ou comportamento passado real"],
  [/confia (mais|menos|depois)|o quanto voc[êe] confia|qu[ãa]o (irritad|brav|com raiva|com medo|frustrad)|intensidade emocional/i, "confiança ou emoção após experiência real"],
  [/como (voc[êe] )?se sentiu|o que voc[êe] sentiu|como foi (passar|viver|quando)|o que passou pela sua cabe[çc]a quando/i, "emoção recordada de um evento vivido"],
];
const FLAGS_ARRISCADO: Array<[RegExp, string]> = [
  [/com que frequ[êe]ncia|quantas vezes por|quanto tempo por dia|costuma usar quant|hábito de/i, "frequência/hábito auto-reportado"],
  [/quanto voc[êe] (gasta|paga|investe|guarda)|qual seu (gasto|or[çc]amento|sal[áa]rio)/i, "valor auto-reportado"],
];

function avaliarPergunta(pergunta: string) {
  const q = pergunta ?? "";
  const humano = FLAGS_HUMANO.filter(([re]) => re.test(q)).map(([, d]) => d);
  if (humano.length)
    return {
      pergunta,
      banda: "humano",
      confie: false,
      sinais_detectados: [...new Set(humano)],
      recomendacao: FRAMEWORK_CONFIANCA.humano.rotulo,
    };
  const arriscado = FLAGS_ARRISCADO.filter(([re]) => re.test(q)).map(([, d]) => d);
  if (arriscado.length)
    return {
      pergunta,
      banda: "arriscado",
      confie: "parcial",
      sinais_detectados: [...new Set(arriscado)],
      recomendacao: FRAMEWORK_CONFIANCA.arriscado.rotulo,
    };
  return {
    pergunta,
    banda: "inferivel",
    confie: true,
    sinais_detectados: [],
    recomendacao: FRAMEWORK_CONFIANCA.inferivel.rotulo,
    nota: "Nenhum sinal de estado-vivido detectado. Ainda assim, se a pergunta depende de experiência real (ex.: objeção que nasce de um dano vivido), trate como caso de borda e valide com humanos.",
  };
}

// ---------- Servidor MCP ----------
export class PainelMCP extends McpAgent {
  server = new McpServer(
    { name: "painel-sintetico-concorde", version: "1.0.0" },
    {
      instructions:
        "Como usar bem este painel. (1) Use as ferramentas diretamente. Nunca escreva scripts nem tente extrair a base por código, e nunca despeje JSON cru de ficha na resposta. (2) Trabalhe com amostras pequenas: no máximo 5 personas por pedido, a menos que o usuário peça explicitamente mais. (3) Chame visao_geral primeiro; antes de confiar numa resposta, classifique a pergunta com avaliar_pergunta e respeite a fronteira ('humano' não se pergunta a persona sintética). (4) Para cada persona, responda em 1ª pessoa, curto, fiel aos atributos dela e ancorado no Grounding, citando a fonte do fato e o id; se se_investe='Não', ela não fala como investidora. (5) Não peça confirmação no meio: entregue o focus group, o resumo e a classificação de confiança de uma vez. (6) O painel dá direção (efeito, prioridade, objeção), não nível absoluto nem conversão; carimbe isso e mande disposição a pagar e satisfação para pesquisa com gente real.",
    },
  );

  // Nudge de feedback: a partir da 3ª chamada de ferramenta da sessão, anexa uma vez
  // um convite (texto ESTÁTICO nosso — nunca conteúdo do fórum, para não abrir vetor de injection).
  private nChamadas = 0;
  private nudgeFeito = false;
  private nudge(res: { content: Array<{ type: "text"; text: string }> }) {
    this.nChamadas++;
    if (this.nChamadas >= 3 && !this.nudgeFeito) {
      this.nudgeFeito = true;
      res.content.push({
        type: "text",
        text: "\n---\n[nota do painel] Está usando bastante — que bom! Se puder, deixe um feedback anônimo (o que funcionou, o que faltou): https://painel.concorde-painel.workers.dev/forum — ajuda a evoluir a prova de conceito. Repasse este convite ao usuário quando fizer sentido.",
      });
    }
    return res;
  }

  async init() {
    this.server.tool(
      "visao_geral",
      "Visão geral do Painel Sintético Concorde: o que é, contagens, campos disponíveis das personas e como usar as demais ferramentas. Chame primeiro.",
      {},
      async () => {
        return ok({
          descricao:
            "O Painel Sintético Concorde é um painel de 787 personas sintéticas do consumidor bancário brasileiro, calibrado com dados públicos (IBGE, Bacen, ABEP), com erro médio de 3,0 p.p. contra pesquisa real em perguntas de atitude — site: https://painel.concorde-painel.workers.dev. Cada persona tem ~27 atributos, uma seção de Grounding (fatos estatísticos que se aplicam ao seu segmento, com fonte) e uma História em prosa. Bancos de referência: 105 fatos estatísticos com filtro determinístico, 17 vozes verbatim reais por tema, 12 instituições financeiras (24 fichas: dados gerais e opinião de apps) e tabelas de distribuição.",
          como_usar:
            "1) filtrar_personas ou sortear_amostra para montar um recorte; 2) get_personas para as fichas completas (use o Grounding para ancorar respostas em dados reais); 3) buscar_fatos/listar_vozes/get_instituicao para contexto adicional. Filtros usam a DSL: \"campo OP valor & campo OP valor\" com OP em == != > < >= <= in entre; listas como ['Classe A'; 'Classe B'].",
          atencao_tipos_de_percentual: {
            propensao: "P(métrica | público) — use direto na persona",
            prevalencia: "taxa base populacional — vale para todas",
            composicao: "P(público | métrica) — o INVERSO da propensão, não leia como propensão",
            referencia: "valor comparativo, não é proporção de pessoas",
          },
          fronteira_de_confianca:
            "Este painel é uma triagem de discovery pré-campo, não um substituto de pesquisa. Antes de confiar numa resposta, classifique a PERGUNTA (use a ferramenta avaliar_pergunta): 'inferivel' = seguro para pressão direcional de conceito (prioridade, objeção, atrito de onboarding, compreensão, linguagem, tradeoff); 'humano' = exige estado vivido e NÃO deve ser perguntado a persona sintética (satisfação, incidência/vitimização, dano, comportamento passado real, intensidade emocional, confiança após experiência). Não confunda preferência inferida com realidade vivida. O valor do painel é saber o que perguntar a gente de verdade antes de gastar com campo.",
          termos_de_uso:
            "Serviço gratuito de consulta (prova de conceito, projeto Concorde). Os dados do painel são propriedade do autor; uso para consultas e simulações é livre, extração em massa ou redistribuição da base não é autorizada. Há cotas por IP (rajada e diária).",
          contagens: { personas: personas.length, fatos: fatos.length, vozes: vozes.length, instituicoes: instituicoes.length },
          campos_filtraveis_e_valores: CAMPOS_FILTRAVEIS,
          campos_numericos: ["idade", "renda_mensal_individual", "renda_mensal_familiar", "patrimonio_financeiro", "patrimonio_bens", "valor_divida_ativa"],
        });
      }
    );

    this.server.tool(
      "avaliar_pergunta",
      "Fronteira de confiança: classifica uma pergunta de pesquisa em 'inferivel' (seguro para persona sintética — direcional), 'arriscado' (validar) ou 'humano' (exige estado vivido, NÃO pergunte a persona sintética). Use antes de rodar um focus group para separar o que o painel pode responder do que precisa de gente real. Triagem heurística determinística; casos de borda devem ir para validação humana.",
      { pergunta: z.string().describe("A pergunta de pesquisa a classificar. Ex.: 'quão satisfeito você está com seu banco?'") },
      async ({ pergunta }) => ok(avaliarPergunta(pergunta)),
    );

    this.server.tool(
      "filtrar_personas",
      "Filtra as 787 personas pela DSL determinística do painel. Ex.: \"classe_social == 'Classe C' & divida_ativa == 'Sim' & regiao == 'Nordeste'\". Vazio retorna todas. Retorna contagem e mini-perfis (até `limite`).",
      {
        filtro: z.string().optional().describe("Expressão DSL: campo OP valor & ... (OP: == != > < >= <= in entre)"),
        limite: z.number().int().min(1).max(100).default(30).describe("Máximo de mini-perfis retornados"),
      },
      async ({ filtro, limite }) => {
        let res: Persona[];
        try {
          res = filtrar(filtro);
        } catch (e: any) {
          return ok({ erro: e.message, dica: "Exemplo válido: classe_social == 'Classe C' & regiao in ['Nordeste'; 'Norte'] & idade > 30" });
        }
        return this.nudge(ok({ filtro: filtro ?? "todos", total: res.length, personas: res.slice(0, limite).map(mini) }));
      }
    );

    this.server.tool(
      "sortear_amostra",
      "Sorteia uma amostra aleatória de personas (opcionalmente dentro de um filtro DSL). O painel já reflete as distribuições reais, então a amostra uniforme é representativa do recorte.",
      {
        n: z.number().int().min(1).max(50).describe("Tamanho da amostra"),
        filtro: z.string().optional().describe("Filtro DSL opcional"),
        seed: z.number().int().optional().describe("Semente para reprodutibilidade"),
      },
      async ({ n, filtro, seed }) => {
        let pool: Persona[];
        try {
          pool = [...filtrar(filtro)];
        } catch (e: any) {
          return ok({ erro: e.message, dica: "Exemplo válido: classe_social == 'Classe C' & divida_ativa == 'Sim'" });
        }
        const seedUsada = seed ?? Math.floor(Math.random() * 1e9);
        // LCG em uint32 (imul evita estouro de float64; >>>0 normaliza seeds negativas)
        let s = (seedUsada >>> 0) || 1;
        const rand = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const amostra = pool.slice(0, n);
        return this.nudge(ok({ filtro: filtro ?? "todos", pool: pool.length, seed: seedUsada, amostra: amostra.map(mini) }));
      }
    );

    this.server.tool(
      "get_personas",
      "Fichas completas de até 10 personas por id (atributos + Grounding com fatos/fontes + História). Use para dar voz às personas com ancoragem nos dados. IMPORTANTE: fatos marcados _composicao_ são P(público | métrica), o inverso de propensão — não os leia como probabilidade da persona; fatos _referencia_ não são proporção de pessoas.",
      { ids: z.array(z.string()).min(1).max(10).describe("Ex.: ['PERS_023', 'PERS_041']") },
      async ({ ids }) => {
        const found = ids.map((id) => {
          const p = personas.find((x) => String(x.id).toUpperCase() === id.toUpperCase());
          return p ? fichaCompleta(p) : `# ${id}\n(não encontrada)`;
        });
        return this.nudge(ok(found.join("\n\n---\n\n")));
      }
    );

    this.server.tool(
      "buscar_fatos",
      "Busca nos 105 fatos estatísticos. Modos: texto livre (busca em métrica/fonte/corpo), por eixo (por-classe, por-regiao, por-genero, por-investidor, por-divida, por-idade, por-fonte-renda, por-renda, por-composto, populacional), ou por persona_id (fatos cujo filtro casa com a persona).",
      {
        texto: z.string().optional().describe("Busca textual livre"),
        eixo: z.string().optional().describe("Eixo de segmentação"),
        persona_id: z.string().optional().describe("Retorna fatos aplicáveis a esta persona"),
        incluir_corpo: z.boolean().default(false).describe("Incluir o corpo markdown completo dos fatos"),
      },
      async ({ texto, eixo, persona_id, incluir_corpo }) => {
        let res = fatos;
        if (eixo) res = res.filter((f) => f.eixo === eixo);
        if (texto) {
          const t = texto.toLowerCase();
          res = res.filter((f) => [f.id ?? "", f.metrica ?? "", f.fonte ?? "", f.corpo ?? ""].join(" ").toLowerCase().includes(t));
        }
        if (persona_id) {
          const p = personas.find((x) => String(x.id).toUpperCase() === persona_id.toUpperCase());
          if (!p) return ok({ erro: `Persona ${persona_id} não encontrada` });
          res = res.filter((f) => fatoCasa(f, p));
        }
        const corte = incluir_corpo ? 15 : 60;
        return this.nudge(ok({ total: res.length, fatos: res.slice(0, corte).map((f) => (incluir_corpo ? { ...fatoResumo(f), corpo: f.corpo } : fatoResumo(f))) }));
      }
    );

    this.server.tool(
      "listar_vozes",
      "Vozes verbatim REAIS (reviews, relatos) por tema: credito-divida, canais-tecnologia, tarifas-cobranca, golpes-seguranca, gestao-financeira. Sem tema, lista todas. Representatividade não-populacional — use como ilustração de linguagem, não como estatística.",
      { tema: z.string().optional().describe("Filtro por tema/id"), completo: z.boolean().default(true).describe("Incluir texto completo") },
      async ({ tema, completo }) => {
        let res = vozes;
        if (tema) {
          const t = tema.toLowerCase();
          res = res.filter((v) => [v.id, v.tema].join(" ").toLowerCase().includes(t));
        }
        return ok({ total: res.length, vozes: res.map((v) => (completo ? v : { id: v.id, tema: v.tema, fonte: v.fonte })) });
      }
    );

    this.server.tool(
      "get_instituicao",
      "Ficha de uma instituição financeira (cadastro, volumetria, reputação, reviews). 12 bancos tradicionais e digitais. Sem nome, lista as disponíveis.",
      { nome: z.string().optional().describe("Ex.: 'santander', 'nubank'") },
      async ({ nome }) => {
        if (!nome) return ok({ instituicoes: instituicoes.map((i) => i.arquivo) });
        const t = nome.toLowerCase();
        const res = instituicoes.filter((i) => JSON.stringify([i.arquivo, i.nome ?? ""]).toLowerCase().includes(t));
        if (!res.length) return ok({ erro: `Nenhuma ficha para "${nome}"`, disponiveis: instituicoes.map((i) => i.arquivo) });
        return ok(res.map((i) => `# ${i.arquivo}\n${i.corpo}`).join("\n\n---\n\n"));
      }
    );

    this.server.tool(
      "get_distribuicoes",
      "Tabelas de calibração do painel: CSVs de distribuição (pesos do sorteio original) e registro de taxas. Sem nome, lista os arquivos.",
      { arquivo: z.string().optional().describe("Nome do CSV, 'manifest.md' ou 'taxas'") },
      async ({ arquivo }) => {
        if (!arquivo) return ok({ arquivos: [...Object.keys(distribuicoes), "taxas"] });
        if (arquivo === "taxas") return ok(taxas ?? "(sem registro de taxas)");
        const key = Object.keys(distribuicoes).find((k) => k.toLowerCase().includes(arquivo.toLowerCase()));
        return ok(key ? distribuicoes[key] : `Arquivo não encontrado. Disponíveis: ${Object.keys(distribuicoes).join(", ")}`);
      }
    );
  }
}

// ---------- Cota por IP (anti-extração em massa) ----------
// Uso legítimo (focus groups) fica muito abaixo destes tetos; raspagem do painel inteiro não.
const LIMITES: Record<string, number> = {
  chamadas_min: 120, // rajada: chamadas de ferramenta por minuto
  chamadas_dia: 1000, // chamadas de ferramenta por dia
  personas_dia: 100, // fichas completas servidas por dia (787 no painel) — a proteção real do produto
  forum_threads_dia: 2, // novas discussões no fórum por dia
  forum_respostas_dia: 10, // respostas no fórum por dia
  forum_posts_min: 3, // rajada do fórum
};

export class QuotaDO extends DurableObject {
  // Retorna null se permitido, ou o nome do limite estourado. Incrementa só quando permite.
  async take(consumo: Record<string, number>): Promise<string | null> {
    const agora = new Date();
    const chaves: Record<string, string> = {};
    for (const k of Object.keys(consumo)) {
      chaves[k] = k.endsWith("_min")
        ? `${k}:${Math.floor(agora.getTime() / 60000)}`
        : `${k}:${agora.toISOString().slice(0, 10)}`;
    }
    const atuais: Record<string, number> = {};
    for (const [k, amt] of Object.entries(consumo)) {
      atuais[k] = ((await this.ctx.storage.get(chaves[k])) as number | undefined) ?? 0;
      if (atuais[k] + amt > (LIMITES[k] ?? 0)) return k;
    }
    for (const [k, amt] of Object.entries(consumo)) await this.ctx.storage.put(chaves[k], atuais[k] + amt);
    if ((await this.ctx.storage.getAlarm()) === null) {
      // Limpeza na próxima meia-noite UTC: contadores diários nunca são zerados no meio do dia
      const meiaNoite = new Date();
      meiaNoite.setUTCHours(24, 5, 0, 0);
      await this.ctx.storage.setAlarm(meiaNoite.getTime());
    }
    return null;
  }
  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}

async function verificaCota(corpo: string, request: Request, env: any): Promise<Response | null> {
  let msg: any;
  try {
    msg = JSON.parse(corpo);
  } catch {
    return null;
  }
  // Batch JSON-RPC (protocolo 2025-03-26) chega como array — contar cada tools/call
  const chamadas = (Array.isArray(msg) ? msg : [msg]).filter((m: any) => m?.method === "tools/call");
  if (!chamadas.length) return null;
  const consumo: Record<string, number> = { chamadas_min: chamadas.length, chamadas_dia: chamadas.length };
  for (const c of chamadas) {
    if (c.params?.name === "get_personas")
      consumo.personas_dia =
        (consumo.personas_dia ?? 0) + (Array.isArray(c.params?.arguments?.ids) ? c.params.arguments.ids.length : 10);
  }
  const ip = request.headers.get("cf-connecting-ip") ?? "desconhecido";
  const estourado = await env.QUOTA.get(env.QUOTA.idFromName(ip)).take(consumo);
  if (!estourado) return null;
  const detalhe =
    estourado === "personas_dia"
      ? "limite diário de fichas completas de personas atingido para este IP"
      : estourado === "chamadas_min"
        ? "muitas chamadas por minuto"
        : "limite diário de chamadas atingido para este IP";
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: (Array.isArray(msg) ? msg[0]?.id : msg.id) ?? null,
      error: {
        code: -32000,
        message: `Cota de uso gratuito excedida (${detalhe}). O Painel Sintético é aberto para consulta moderada; os limites voltam a zerar em até 24h. Trabalhe com amostras (sortear_amostra/filtrar_personas) em vez de buscar muitas fichas completas.`,
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

export const HEADERS_SEGURANCA = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": "frame-ancestors 'none'",
} as const;

export default {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    const { pathname } = new URL(request.url);
    if (request.method === "POST" && (pathname === "/sse" || pathname === "/sse/message" || pathname === "/mcp")) {
      // Lê o body uma única vez (clone/tee trava o fechamento do stream SSE do DO)
      const corpo = await request.text();
      const bloqueio = await verificaCota(corpo, request, env);
      if (bloqueio) return bloqueio;
      // telemetria (não bloqueia a resposta)
      try {
        const msg = JSON.parse(corpo);
        const chamadas = (Array.isArray(msg) ? msg : [msg]).filter((m: any) => m?.method === "tools/call");
        if (chamadas.length)
          ctx.waitUntil(registraMcp(env, request.headers.get("cf-connecting-ip") ?? "desconhecido", chamadas));
      } catch {}
      request = new Request(request, { body: corpo });
    }
    if (pathname === "/sse" || pathname === "/sse/message")
      return PainelMCP.serveSSE("/sse").fetch(request, env as any, ctx);
    if (pathname === "/mcp")
      return PainelMCP.serve("/mcp").fetch(request, env as any, ctx);
    const respStats = await rotaStats(request, env, pathname);
    if (respStats) return respStats;
    const respForum = await rotaForum(request, env, pathname);
    if (respForum) return respForum;
    const leitura = request.method === "GET" || request.method === "HEAD";
    if (leitura && PAGINAS[pathname]) {
      if (request.method === "GET")
        ctx.waitUntil(registraPagina(env, request.headers.get("cf-connecting-ip") ?? "desconhecido", pathname));
      return new Response(PAGINAS[pathname], {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300", ...HEADERS_SEGURANCA },
      });
    }
    if (leitura && EXTRAS[pathname])
      return new Response(EXTRAS[pathname].corpo, {
        headers: { "Content-Type": `${EXTRAS[pathname].tipo}; charset=utf-8`, "Cache-Control": "public, max-age=3600", ...HEADERS_SEGURANCA },
      });
    return new Response("404 — rotas: / /persona-sintetica /instalar /usar /forum /privacidade /porque /mcp", { status: 404 });
  },
};
