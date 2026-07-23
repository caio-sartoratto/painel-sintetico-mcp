// Pulso Concorde — mini-relatório sintético diário (estilo consultoria) sobre bank/fintech.
// Por tema: 3-5 perguntas, N=100 personas. Pipeline no Gemini: fan-out isolado (flash, 1 chamada
// por persona respondendo todas as perguntas) -> redator (pro) -> validador crítico (pro).
// Geração ASSÍNCRONA (background); rascunho aprovado pelo humano em /admin/pulso.
import { DurableObject } from "cloudflare:workers";
import personasData from "./data/personas.json";
import { layout } from "./site";

type Persona = Record<string, any>;
const personas = personasData as Persona[];

const MODELO_FANOUT = "gemini-3.6-flash";
const MODELO_REDATOR = "gemini-3.1-pro-preview";
const MODELO_VALIDADOR = "gemini-3.1-pro-preview";
const N_AMOSTRA = 40; // free tier: limite de 50 subrequests/invocação. Workers Paid → suba p/ 100.
const LOTE = 12; // concorrência do fan-out
const BASE_URL = "https://painel.concorde-painel.workers.dev";

type Pergunta = { id: string; texto: string; opcoes: string[] };
type Tema = { slug: string; tema: string; descricao: string; perguntas: Pergunta[] };

// Rotação de temas — cada um com 3-5 perguntas INFERÍVEIS (preferência/prioridade/objeção).
const ROTACAO: Tema[] = [
  {
    slug: "open-finance", tema: "Open Finance", descricao: "Compartilhamento de dados entre instituições: barreiras, gatilhos e confiança.",
    perguntas: [
      { id: "barreira", texto: "O que mais pesa CONTRA você compartilhar seus dados bancários no Open Finance?", opcoes: ["Medo de vazamento", "Não vejo vantagem", "Não entendo como funciona", "Não tenho receio"] },
      { id: "gatilho", texto: "O que te faria topar compartilhar?", opcoes: ["Crédito com juros menores", "Ver tudo num app só", "Ofertas personalizadas", "Nada me convence"] },
      { id: "confianca", texto: "Em quem você confiaria mais para centralizar seus dados?", opcoes: ["Meu banco principal", "Um banco digital", "Uma fintech nova", "Não confiaria em ninguém"] },
      { id: "prazo", texto: "Se compartilhasse, por quanto tempo deixaria ativo?", opcoes: ["Só enquanto preciso", "Sempre, se for seguro", "Nunca deixaria ligado", "Não sei dizer"] },
    ],
  },
  {
    slug: "pix-automatico", tema: "Pix Automático", descricao: "Débito recorrente via Pix: adesão, medo e controle.",
    perguntas: [
      { id: "adesao", texto: "O que mais pesaria pra você ATIVAR o Pix Automático em contas recorrentes?", opcoes: ["Praticidade de não esquecer", "Confiança no recebedor", "Desconto por usar", "Não ativaria"] },
      { id: "medo", texto: "Qual seu maior receio com o Pix Automático?", opcoes: ["Debitarem valor errado", "Não conseguir cancelar", "Faltar saldo na hora", "Não tenho receio"] },
      { id: "controle", texto: "Qual controle te deixaria mais seguro?", opcoes: ["Cancelar num toque", "Teto de valor por débito", "Aviso antes de cada débito", "Pausar quando quiser"] },
    ],
  },
  {
    slug: "credito-por-ia", tema: "Crédito aprovado por IA", descricao: "Limite e crédito decididos por IA: conforto, transparência e recurso humano.",
    perguntas: [
      { id: "conforto", texto: "O que mais te deixaria confortável com um limite definido por IA?", opcoes: ["Aprovação na hora", "Entender o porquê", "Poder falar com humano", "Nada, não confio"] },
      { id: "objecao", texto: "O que mais te incomodaria numa negativa da IA?", opcoes: ["Não saber o motivo", "Não ter como recorrer", "Achar injusto/enviesado", "Não me incomodaria"] },
      { id: "tradeoff", texto: "Você trocaria mais dados por um limite maior?", opcoes: ["Sim, se render limite melhor", "Só dados básicos", "Não, prefiro privacidade", "Depende do banco"] },
    ],
  },
  {
    slug: "tarifa-vs-beneficio", tema: "Tarifa zero vs. benefícios", descricao: "O que o cliente valoriza entre gratuidade, atendimento e recompensa.",
    perguntas: [
      { id: "preferencia", texto: "Entre tarifa zero e um pacote pago com benefícios, o que te atrai mais?", opcoes: ["Tarifa zero sempre", "Pago por bom atendimento", "Pago por cashback", "Depende do limite"] },
      { id: "cartao", texto: "Num cartão de crédito, o que mais pesa hoje?", opcoes: ["Sem anuidade", "Cashback", "Milhas/pontos", "Limite alto"] },
      { id: "troca", texto: "O que te faria trocar de banco principal?", opcoes: ["Menos tarifa", "App melhor", "Crédito mais fácil", "Atendimento humano"] },
    ],
  },
];

// ---------- Gemini ----------
const S = (props: any, req: string[]) => ({ type: "OBJECT", properties: props, required: req });
async function gemini(model: string, system: string, prompt: string, apiKey: string, schema?: any): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json", ...(schema ? { responseSchema: schema } : {}) },
  };
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Gemini ${model} ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const data: any = await r.json();
  const txt = (data?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
  try { return JSON.parse(txt); } catch { return JSON.parse(txt.replace(/```json\s*|\s*```/g, "").trim()); }
}

// ---------- Amostra ----------
const MINI = ["idade", "classe_social", "genero", "regiao", "profissao", "fonte_renda", "renda_mensal_familiar", "banco_principal", "se_investe", "divida_ativa"];
function mini(p: Persona) { return Object.fromEntries(MINI.map((c) => [c, p[c]])); }
function amostra(n: number, seed: number): Persona[] {
  const pool = [...personas];
  let s = (seed >>> 0) || 1;
  const rand = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, Math.min(n, pool.length));
}
async function emLotes<T, R>(items: T[], tam: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += tam) out.push(...(await Promise.all(items.slice(i, i + tam).map(fn))));
  return out;
}

// ---------- Pipeline ----------
async function fanOut(tema: Tema, amostraP: Persona[], apiKey: string) {
  const sys = "Você RESPONDE como a persona descrita, em 1ª pessoa, fiel aos atributos e ancorado no Grounding (fatos com fonte). Não invente atributos. Se se_investe='Não', não fale como investidora. Para CADA pergunta escolha UMA opção EXATA da lista dela. Dê também 1 verbatim curto (sua fala mais marcante sobre o tema) e a fonte no Grounding. Responda só JSON.";
  const schema = S({
    respostas: S(Object.fromEntries(tema.perguntas.map((q) => [q.id, { type: "STRING" }])), tema.perguntas.map((q) => q.id)),
    verbatim: { type: "STRING" }, fonte: { type: "STRING" },
  }, ["respostas", "verbatim"]);
  const perguntasTxt = tema.perguntas.map((q) => `[${q.id}] ${q.texto} Opções: ${JSON.stringify(q.opcoes)}`).join("\n");
  const res = await emLotes(amostraP, LOTE, async (p) => {
    const prompt = `Atributos: ${JSON.stringify(mini(p))}\nGrounding:\n${(p.grounding ?? "").slice(0, 2200)}\n\nTema: ${tema.tema}\nResponda cada pergunta escolhendo UMA opção exata da lista dela:\n${perguntasTxt}\n\nJSON: {"respostas": {${tema.perguntas.map((q) => `"${q.id}": "<opção exata>"`).join(", ")}}, "verbatim": "1 frase em 1ª pessoa fiel à ficha", "fonte": "id ou estatística do Grounding"}`;
    let a: any = null;
    try { a = await gemini(MODELO_FANOUT, sys, prompt, apiKey, schema); } catch { return null; }
    const respostas: Record<string, string> = {};
    for (const q of tema.perguntas) {
      const val = q.opcoes.find((o) => o.toLowerCase() === String(a?.respostas?.[q.id] ?? "").toLowerCase());
      if (val) respostas[q.id] = val;
    }
    if (Object.keys(respostas).length < tema.perguntas.length) return null;
    return { id: p.id, respostas, verbatim: String(a.verbatim ?? "").slice(0, 320), fonte: String(a.fonte ?? "").slice(0, 160), perfil: `${p.idade}a, ${p.profissao}, ${p.classe_social} (${p.regiao})` };
  });
  return res.filter(Boolean) as any[];
}

function agregaTudo(respostas: any[], perguntas: Pergunta[]) {
  const n = respostas.length;
  return perguntas.map((q) => {
    const cont: Record<string, number> = {}; q.opcoes.forEach((o) => (cont[o] = 0));
    respostas.forEach((r) => { if (cont[r.respostas[q.id]] !== undefined) cont[r.respostas[q.id]]++; });
    const dist = q.opcoes.map((o) => ({ opcao: o, n: cont[o], pct: n ? Math.round((cont[o] / n) * 100) : 0 })).sort((a, b) => b.n - a.n);
    return { id: q.id, texto: q.texto, distribuicao: dist };
  });
}

function pickVerbatims(respostas: any[], k: number) {
  return respostas.filter((r) => r.verbatim).slice(0, k).map((r) => ({ verbatim: r.verbatim, fonte: r.fonte, perfil: r.perfil, id: r.id }));
}

async function redator(tema: Tema, blocos: any[], verbatims: any[], n: number, apiKey: string) {
  const sys = "Você é o redator do Pulso Concorde, especialista em mini-relatórios estilo consultoria (BCG/McKinsey) sobre o consumidor bancário brasileiro, ancorados em dados sintéticos. REGRAS INEGOCIÁVEIS: (1) o painel dá DIREÇÃO, não nível absoluto — NUNCA escreva 'X% dos brasileiros'; use 'na amostra' ou 'o painel projeta'; (2) honesto, sem hype nem promessa; (3) as análises comentam a DISTRIBUIÇÃO (a opção dominante e o que ela sugere) — NÃO cite falas/verbatims, NÃO invente pessoas nem perfis demográficos, NÃO escreva 'Fonte:' nem ids de fatos no texto (as falas dos consumidores aparecem em seção própria, à parte, com as fontes reais); (4) 2-4 frases por análise, sumário executivo denso, recomendação acionável. Responda só JSON.";
  const schema = S({
    titulo: { type: "STRING" }, sumario: { type: "STRING" },
    blocos: { type: "ARRAY", items: S({ id: { type: "STRING" }, analise: { type: "STRING" } }, ["id", "analise"]) },
    leitura: { type: "STRING" },
  }, ["titulo", "sumario", "blocos", "leitura"]);
  const prompt = `Tema: ${tema.tema} — ${tema.descricao}\nAmostra sintética n=${n}\nPerguntas e distribuições: ${JSON.stringify(blocos.map((b) => ({ id: b.id, pergunta: b.texto, distribuicao: b.distribuicao })))}\n\nEscreva um mini-relatório JSON: {"titulo": "manchete do achado principal (sem % absoluto)", "sumario": "2-3 frases de sumário executivo conectando as perguntas", "blocos": [{"id":"<id da pergunta>", "analise":"2-4 frases interpretando a distribuição desta pergunta (a opção dominante e o que sugere), SEM citar falas, pessoas ou fontes"}], "leitura": "1 recomendação acionável para quem constrói produto bank/fintech"}`;
  return await gemini(MODELO_REDATOR, sys, prompt, apiKey, schema);
}

async function validador(rep: any, blocos: any[], verbatims: any[], apiKey: string) {
  const sys = "Você é o editor-crítico rigoroso do Pulso Concorde e guardião da credibilidade. REPROVE se: inventou número ou usou número fora das distribuições; fez claim de nível absoluto ('X% dos brasileiros') sem enquadrar como direção/amostra; tom vendedor/hype; usou verbatim fora da lista; ou tratou alguma pergunta como se medisse estado vivido (satisfação, vitimização). Responda só JSON.";
  const schema = S({ aprovado: { type: "BOOLEAN" }, nota: { type: "NUMBER" }, problemas: { type: "ARRAY", items: { type: "STRING" } } }, ["aprovado"]);
  const prompt = `Distribuições reais: ${JSON.stringify(blocos.map((b) => ({ id: b.id, distribuicao: b.distribuicao })))}\nVerbatims válidos: ${JSON.stringify(verbatims.map((v: any) => v.verbatim))}\nRelatório: ${JSON.stringify(rep)}\n\nResponda JSON: {"aprovado": true/false, "nota": 0-10, "problemas": ["..."]}`;
  return await gemini(MODELO_VALIDADOR, sys, prompt, apiKey, schema);
}

export async function gerarPulso(apiKey: string, itemIndex: number) {
  if (!apiKey) throw new Error("GEMINI_API_KEY ausente (rode: wrangler secret put GEMINI_API_KEY).");
  const tema = ROTACAO[((itemIndex % ROTACAO.length) + ROTACAO.length) % ROTACAO.length];
  const seed = Math.floor(Math.random() * 1e9);
  const respostas = await fanOut(tema, amostra(N_AMOSTRA, seed), apiKey);
  if (respostas.length < 20) throw new Error(`Fan-out fraco (${respostas.length} respostas).`);
  const blocos = agregaTudo(respostas, tema.perguntas);
  const verbatims = pickVerbatims(respostas, 8);
  const rep = await redator(tema, blocos, verbatims, respostas.length, apiKey);
  const val = await validador(rep, blocos, verbatims, apiKey);
  const blocosFinal = blocos.map((b) => ({ ...b, analise: String((rep?.blocos || []).find((x: any) => x.id === b.id)?.analise ?? "") }));
  const data = new Date().toISOString().slice(0, 10);
  return {
    slug: `${data}-${tema.slug}`, data, tema: tema.tema, descricao: tema.descricao, n: respostas.length, seed,
    blocos: blocosFinal, verbatims, titulo: String(rep?.titulo ?? tema.tema), sumario: String(rep?.sumario ?? ""), leitura: String(rep?.leitura ?? ""),
    validacao: val ?? null, status: "rascunho", criado_em: Date.now(),
  };
}

// Roda NO WORKER (código sempre atualizado no deploy); o DO só guarda.
export async function gerarPulsoDoDia(env: any): Promise<string> {
  const doo = env.PULSO.get(env.PULSO.idFromName("global")) as any;
  const ptr = await doo.proximoPtr();
  try {
    const entry = await gerarPulso(env.GEMINI_API_KEY, ptr);
    await doo.salvarRascunho(entry);
    return entry.slug;
  } catch (e: any) {
    await doo.registrarErro(String(e?.message ?? e));
    throw e;
  }
}

// ---------- Storage ----------
export class PulsoDO extends DurableObject {
  private async idx(k: string): Promise<string[]> { return ((await this.ctx.storage.get(k)) as string[] | undefined) ?? []; }
  async proximoPtr(): Promise<number> {
    const ptr = ((await this.ctx.storage.get("rot:ptr")) as number | undefined) ?? 0;
    await this.ctx.storage.put("rot:ptr", ptr + 1);
    return ptr;
  }
  async salvarRascunho(entry: any): Promise<void> {
    await this.ctx.storage.delete("ultimo_erro");
    await this.ctx.storage.put(`e:${entry.slug}`, entry);
    const d = await this.idx("idx:draft");
    if (!d.includes(entry.slug)) { d.unshift(entry.slug); await this.ctx.storage.put("idx:draft", d); }
  }
  async registrarErro(msg: string): Promise<void> { await this.ctx.storage.put("ultimo_erro", `${new Date().toISOString()} — ${msg}`); }
  async pegarErro(): Promise<string | null> { return ((await this.ctx.storage.get("ultimo_erro")) as string | undefined) ?? null; }
  async obter(slug: string): Promise<any> { return (await this.ctx.storage.get(`e:${slug}`)) as any; }
  async listar(status: "publicado" | "rascunho"): Promise<any[]> {
    const ids = await this.idx(status === "publicado" ? "idx:pub" : "idx:draft");
    const out: any[] = [];
    for (const s of ids) { const e = await this.ctx.storage.get(`e:${s}`); if (e) out.push(e); }
    return out;
  }
  async publicar(slug: string, edits: Record<string, string>): Promise<boolean> {
    const e = (await this.ctx.storage.get(`e:${slug}`)) as any; if (!e) return false;
    if (edits.titulo) e.titulo = edits.titulo;
    if (edits.sumario) e.sumario = edits.sumario;
    if (edits.leitura) e.leitura = edits.leitura;
    e.status = "publicado"; e.publicado_em = Date.now();
    await this.ctx.storage.put(`e:${slug}`, e);
    await this.ctx.storage.put("idx:draft", (await this.idx("idx:draft")).filter((x) => x !== slug));
    const pub = await this.idx("idx:pub");
    if (!pub.includes(slug)) { pub.unshift(slug); await this.ctx.storage.put("idx:pub", pub); }
    return true;
  }
  async apagar(slug: string): Promise<void> {
    await this.ctx.storage.delete(`e:${slug}`);
    await this.ctx.storage.put("idx:draft", (await this.idx("idx:draft")).filter((x) => x !== slug));
    await this.ctx.storage.put("idx:pub", (await this.idx("idx:pub")).filter((x) => x !== slug));
  }
  async limparTudo(): Promise<void> { await this.ctx.storage.deleteAll(); }
}

// ---------- Render ----------
function esc(s: string): string { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

const CARIMBO = "Projeção direcional do Painel Sintético Concorde (100 personas sintéticas calibradas com IBGE/Bacen/ABEP). Mede direção e prioridade, não nível absoluto nem intenção real de uso — não é pesquisa de campo.";

const CSS_PULSO = `<style>
.pulso-card{border:1px solid var(--borda);border-radius:12px;padding:26px;margin:22px 0;background:var(--janela)}
.pulso-meta{color:var(--dim);font-size:.82em;margin:0 0 8px}
.pulso-tag{color:var(--roxo);font-weight:600}
.pulso-titulo{margin:.15em 0 .35em;font-size:1.5em;line-height:1.2}
.pulso-titulo a{color:var(--texto)}
.pulso-sumario{color:#d1d1d6;font-size:1.02em;border-left:3px solid var(--roxo);padding-left:14px;margin:14px 0 22px}
.tc-q{font-size:1em;font-weight:600;margin:26px 0 12px;color:var(--texto)}
.tc-chart{margin:6px 0 6px}
.tc-row{display:grid;grid-template-columns:minmax(84px,32%) 1fr auto;align-items:center;gap:12px;margin:7px 0;font-size:.9em}
.tc-cat{text-align:right;color:var(--dim);line-height:1.2}
.tc-track{background:#1c1c20;border-radius:3px;height:22px;overflow:hidden}
.tc-bar{height:100%;background:#3a3a40;border-radius:3px;transition:none}
.tc-row.top .tc-bar{background:var(--roxo)}
.tc-row.top .tc-cat{color:var(--texto);font-weight:600}
.tc-val{font-variant-numeric:tabular-nums;font-weight:700;min-width:42px;text-align:right;color:var(--dim)}
.tc-row.top .tc-val{color:var(--roxo)}
.tc-analise{color:#c7c7cc;margin:10px 0 2px;font-size:.95em;line-height:1.55}
.pulso-leitura{border-left:3px solid var(--verde);padding-left:14px;margin:24px 0}
.pulso-v{border-left:2px solid var(--borda);margin:12px 0;padding:4px 0 4px 14px;color:#d1d1d6}
.pulso-v cite{display:block;margin-top:5px;font-size:.82em;color:var(--dim);font-style:normal}
.pulso-carimbo{margin-top:22px;font-size:.78em;color:var(--dim);border-top:1px solid var(--borda);padding-top:12px}
.pulso-admin form{border:1px dashed var(--borda);border-radius:10px;padding:16px;margin:16px 0}
.pulso-admin input,.pulso-admin textarea{width:100%;background:#111;border:1px solid var(--borda);color:var(--texto);border-radius:6px;padding:8px;font:inherit;font-size:15px;margin:4px 0 12px}
.pulso-admin label{font-size:.85em;color:var(--dim)}
</style>`;

function chartHtml(b: any): string {
  const rows = (b.distribuicao || []).map((d: any, i: number) => `<div class="tc-row ${i === 0 && d.pct > 0 ? "top" : ""}"><span class="tc-cat">${esc(d.opcao)}</span><div class="tc-track"><div class="tc-bar" style="width:${Math.max(2, d.pct)}%"></div></div><span class="tc-val">${d.pct}%</span></div>`).join("");
  return `<h3 class="tc-q">${esc(b.texto)}</h3><div class="tc-chart">${rows}</div>${b.analise ? `<p class="tc-analise">${esc(b.analise)}</p>` : ""}`;
}
function verbatimsHtml(vs: any[]): string {
  return (vs || []).slice(0, 6).map((v) => `<blockquote class="pulso-v">"${esc(v.verbatim)}"<cite>— ${esc(v.perfil)}${v.fonte ? ` · <span class="dim">fonte: ${esc(v.fonte)}</span>` : ""}</cite></blockquote>`).join("");
}
function cardEntry(e: any, linkTitulo: boolean): string {
  const titulo = linkTitulo ? `<a href="/pulso/${esc(e.slug)}">${esc(e.titulo)}</a>` : esc(e.titulo);
  return `<article class="pulso-card">
<p class="pulso-meta"><span class="pulso-tag">${esc(e.tema)}</span> · ${esc(e.data)} · amostra n=${e.n} · ${(e.blocos || []).length} perguntas · seed ${e.seed}</p>
<h2 class="pulso-titulo">${titulo}</h2>
${e.sumario ? `<p class="pulso-sumario">${esc(e.sumario)}</p>` : ""}
${(e.blocos || []).map(chartHtml).join("")}
${e.leitura ? `<p class="pulso-leitura"><b>Leitura:</b> ${esc(e.leitura)}</p>` : ""}
<h3 class="tc-q">Voz do consumidor</h3>
${verbatimsHtml(e.verbatims)}
<p class="pulso-carimbo">${CARIMBO} · Reproduza: seed ${e.seed}.</p>
</article>`;
}

function feedHtml(entries: any[]): string {
  const corpo = `<main style="padding-top:52px"><div class="wrap">
<p class="zsh"><b>concorde@painel</b> ~ % <i>painel --pulso</i></p>
<h1 style="margin-top:8px">Pulso Concorde<span class="cursor"></span></h1>
<p class="sub">Um mini-relatório sintético por dia sobre o que está em alta em bank e fintech. Cada edição roda 3-5 perguntas com 100 personas do painel e mostra a <b>direção</b> do consumidor — prioridades, objeções e a voz por trás dos números, ancorada em dado público. Não é pesquisa de campo.</p>
${entries.length ? entries.map((e) => cardEntry(e, true)).join("") : `<p class="dim" style="margin-top:30px">O primeiro Pulso sai em breve. Enquanto isso, veja <a href="/">como o painel funciona</a>.</p>`}
</div></main>`;
  const jsonld = JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", name: "Pulso Concorde", description: "Mini-relatório sintético diário sobre temas de bank e fintech no Brasil.", url: `${BASE_URL}/pulso`, inLanguage: "pt-BR" });
  return layout("Pulso Concorde — relatório sintético diário de bank/fintech", "pulso", corpo, CSS_PULSO, "/pulso", "Um mini-relatório sintético por dia sobre temas quentes de bank e fintech: prioridades e objeções do consumidor, com falas ancoradas em dados públicos (IBGE, Bacen, ABEP).", jsonld);
}
function entryHtml(e: any): string {
  const corpo = `<main style="padding-top:52px"><div class="wrap">
<p class="zsh"><b>concorde@painel</b> ~ % <i>painel --pulso ${esc(e.slug)}</i></p>
<p style="margin-top:8px"><a href="/pulso">← todos os pulsos</a></p>
${cardEntry(e, false)}
<p class="link-bloco" style="margin-top:24px">Quer rodar um relatório desses com o SEU produto? <a href="/usar#pesquisa">→ veja como</a></p>
</div></main>`;
  const jsonld = JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: e.titulo, datePublished: e.data, inLanguage: "pt-BR", author: { "@type": "Person", name: "Caio Sartoratto Prado" }, publisher: { "@type": "Organization", name: "Painel Sintético Concorde" }, url: `${BASE_URL}/pulso/${e.slug}`, about: e.tema });
  return layout(`${e.titulo} — Pulso Concorde`, "pulso", corpo, CSS_PULSO, `/pulso/${e.slug}`, String(e.sumario || e.leitura || e.tema).slice(0, 180), jsonld);
}
function adminHtml(token: string, drafts: any[], pub: any[], erro: string | null, gerando: boolean): string {
  const t = esc(token);
  const draftForm = (e: any) => `<form method="POST" action="/admin/pulso/publicar?token=${t}">
<p class="pulso-meta"><span class="pulso-tag">${esc(e.tema)}</span> · ${esc(e.data)} · n=${e.n} · ${(e.blocos || []).length} perguntas · validador: nota ${esc(String(e.validacao?.nota ?? "?"))}${e.validacao?.aprovado === false ? ' · <b style="color:var(--ambar)">reprovado</b>' : ""}</p>
${e.validacao?.problemas?.length ? `<p class="dim">Ressalvas: ${esc((e.validacao.problemas || []).join("; "))}</p>` : ""}
<input type="hidden" name="slug" value="${esc(e.slug)}">
<label>Título</label><input name="titulo" value="${esc(e.titulo)}">
<label>Sumário executivo</label><textarea name="sumario" rows="3">${esc(e.sumario)}</textarea>
${(e.blocos || []).map(chartHtml).join("")}
<label>Leitura / recomendação</label><input name="leitura" value="${esc(e.leitura)}">
${verbatimsHtml(e.verbatims)}
<button class="acao" type="submit">Publicar</button>
</form>
<form method="POST" action="/admin/pulso/apagar?token=${t}" style="border:0;padding:0;margin:-6px 0 20px"><input type="hidden" name="slug" value="${esc(e.slug)}"><button class="perigo" type="submit">descartar rascunho</button></form>`;
  const corpo = `<main style="padding-top:52px"><div class="wrap pulso-admin">
<h1>Pulso — revisão</h1>
${gerando ? '<p class="dim" style="color:var(--verde)">Gerando em background (~1 min com N=100). Atualize a página em instantes.</p>' : ""}
${erro ? `<p class="dim" style="color:var(--ambar)">Último erro na geração: ${esc(erro)}</p>` : ""}
<form method="POST" action="/admin/pulso/gerar?token=${t}"><button class="acao" type="submit">Gerar rascunho agora (Gemini · ~1 min)</button></form>
<h2>Rascunhos (${drafts.length})</h2>
${drafts.length ? drafts.map(draftForm).join("") : '<p class="dim">Nenhum rascunho. Clique acima para gerar ou espere o cron da madrugada.</p>'}
<h2>Publicados (${pub.length})</h2>
${pub.map((e) => `<p>· <a href="/pulso/${esc(e.slug)}">${esc(e.titulo)}</a> <span class="dim">(${esc(e.data)})</span> — <a href="/admin/pulso/apagar-pub?token=${t}&slug=${esc(e.slug)}">apagar</a></p>`).join("") || '<p class="dim">Nenhum ainda.</p>'}
</div></main>`;
  return layout("Pulso — admin", "pulso", corpo, CSS_PULSO, "/pulso", "admin", "", '<meta name="robots" content="noindex, nofollow">');
}

// ---------- Rota ----------
export async function rotaPulso(request: Request, env: any, pathname: string, ctx: any): Promise<Response | null> {
  const html = (s: string, extra: Record<string, string> = {}) => new Response(s, { headers: { "Content-Type": "text/html; charset=utf-8", ...extra } });
  const doo = () => env.PULSO.get(env.PULSO.idFromName("global")) as any;

  if (request.method === "GET" && pathname === "/pulso") return html(feedHtml(await doo().listar("publicado")), { "Cache-Control": "public, max-age=300" });
  if (request.method === "GET" && pathname.startsWith("/pulso/")) {
    const e = await doo().obter(decodeURIComponent(pathname.slice("/pulso/".length)));
    if (!e || e.status !== "publicado") return html(feedHtml(await doo().listar("publicado")), { "Cache-Control": "no-store" });
    return html(entryHtml(e), { "Cache-Control": "public, max-age=300" });
  }

  if (pathname === "/admin/pulso" || pathname.startsWith("/admin/pulso/")) {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") ?? "";
    if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) return new Response("negado", { status: 403 });
    const back = () => Response.redirect(`${BASE_URL}/admin/pulso?token=${encodeURIComponent(token)}`, 303);
    if (request.method === "GET" && pathname === "/admin/pulso")
      return html(adminHtml(token, await doo().listar("rascunho"), await doo().listar("publicado"), await doo().pegarErro(), url.searchParams.get("gerando") === "1"), { "Cache-Control": "no-store" });
    if (request.method === "POST" && pathname === "/admin/pulso/gerar") {
      if (!env.GEMINI_API_KEY) return new Response("GEMINI_API_KEY não configurada.", { status: 500 });
      try { await gerarPulsoDoDia(env); } catch (e: any) { return new Response("Erro ao gerar: " + e.message, { status: 500 }); }
      return back();
    }
    if (request.method === "POST" && pathname === "/admin/pulso/publicar") {
      const f = await request.formData();
      await doo().publicar(String(f.get("slug") ?? ""), { titulo: String(f.get("titulo") ?? ""), sumario: String(f.get("sumario") ?? ""), leitura: String(f.get("leitura") ?? "") });
      return back();
    }
    if (request.method === "POST" && pathname === "/admin/pulso/apagar") { await doo().apagar(String((await request.formData()).get("slug") ?? "")); return back(); }
    if (request.method === "GET" && pathname === "/admin/pulso/apagar-pub") { await doo().apagar(url.searchParams.get("slug") ?? ""); return back(); }
    if (request.method === "POST" && pathname === "/admin/pulso/limpar") { await doo().limparTudo(); return back(); }
  }
  return null;
}
