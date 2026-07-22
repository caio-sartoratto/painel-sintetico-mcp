// Pulso Concorde — pesquisa sintética diária sobre temas quentes de bank/fintech.
// Pipeline 100% no Gemini (tokens baratos): fan-out isolado por persona (flash) ->
// redator especialista (flash) -> validador crítico (pro). Gera RASCUNHO; o humano
// aprova em /admin/pulso (semi-auto). A chave vem do secret env.GEMINI_API_KEY.
import { DurableObject } from "cloudflare:workers";
import personasData from "./data/personas.json";
import { layout } from "./site";

type Persona = Record<string, any>;
const personas = personasData as Persona[];

const MODELO_FANOUT = "gemini-3.6-flash"; // pesado: 1 chamada por persona
const MODELO_REDATOR = "gemini-3.1-pro"; // redação do card
const MODELO_VALIDADOR = "gemini-3.1-pro"; // revisão/validação crítica
const N_AMOSTRA = 16;
const BASE_URL = "https://painel.concorde-painel.workers.dev";

// Fila de temas — banda INFERÍVEL apenas (preferência/prioridade/objeção; nunca estado vivido).
const ROTACAO: Array<{ slug: string; tema: string; pergunta: string; opcoes: string[] }> = [
  { slug: "pix-automatico", tema: "Pix Automático", pergunta: "O que mais pesaria na sua decisão de ativar (ou não) o Pix Automático para contas recorrentes?", opcoes: ["Praticidade de não esquecer", "Medo de debitarem errado", "Poder cancelar num toque", "Não confio em débito automático"] },
  { slug: "drex-real-digital", tema: "Drex (real digital)", pergunta: "Se o seu banco oferecesse o Drex hoje, o que pesaria mais na decisão de usar?", opcoes: ["Mais segurança que o Pix", "Não entendo pra que serve", "Se for aceito no comércio", "Desconfio de rastreamento"] },
  { slug: "open-finance", tema: "Open Finance", pergunta: "O que mais te faria (ou não) compartilhar seus dados bancários entre instituições?", opcoes: ["Ofertas de crédito melhores", "Medo de vazamento", "Ver tudo num app só", "Não vejo vantagem pra mim"] },
  { slug: "tarifa-zero", tema: "Tarifa zero", pergunta: "Entre um banco de tarifa zero e um pacote pago com benefícios, o que te atrai mais?", opcoes: ["Tarifa zero, sempre", "Pago se tiver bom atendimento", "Pago por cashback/benefício", "Depende do limite de crédito"] },
  { slug: "credito-por-ia", tema: "Crédito aprovado por IA", pergunta: "O que mais te deixaria confortável com um limite de crédito definido por IA?", opcoes: ["Aprovação na hora", "Saber por que fui aprovado/negado", "Poder falar com humano", "Não confio em IA decidindo isso"] },
  { slug: "seguranca-golpe", tema: "Segurança contra golpe", pergunta: "Qual recurso te deixaria mais seguro para usar o banco no dia a dia?", opcoes: ["Confirmar transferência grande por biometria", "Limite de valor por horário", "Bloqueio de tudo num toque", "Alerta de golpe em tempo real"] },
  { slug: "super-app", tema: "Super app bancário", pergunta: "Um app do banco que também vende celular, viagem e seguro: como você reage?", opcoes: ["Prático, tudo num lugar", "Vira bagunça, quero só banco", "Uso se for mais barato", "Desconfio da mistura"] },
  { slug: "investir-no-app", tema: "Investir pelo app do banco", pergunta: "O que mais te faria investir pelo app do próprio banco em vez de uma corretora?", opcoes: ["Praticidade de ter tudo junto", "Confio mais no meu banco", "Corretora rende mais", "Não invisto"] },
  { slug: "cartao-beneficio", tema: "Cartão: o que vale", pergunta: "Num cartão de crédito, o que mais pesa pra você hoje?", opcoes: ["Sem anuidade", "Cashback", "Milhas/pontos", "Limite alto"] },
  { slug: "digital-vs-agencia", tema: "Digital vs. agência", pergunta: "O que ainda te faria querer uma agência física em vez de um banco 100% digital?", opcoes: ["Resolver problema sério cara a cara", "Sacar/depositar dinheiro", "Não faz falta, resolvo no app", "Confiança de ter um lugar físico"] },
  { slug: "antecipa-salario", tema: "Antecipação de salário", pergunta: "O que mais pesaria em usar (ou não) a antecipação de salário do app?", opcoes: ["Socorro quando aperta", "A taxa cobrada", "Medo de virar dependência", "Prefiro não dever ao banco"] },
  { slug: "assistente-ia-app", tema: "Assistente de IA no app", pergunta: "Um assistente de IA dentro do app do banco: pra que você mais usaria?", opcoes: ["Entender pra onde vai meu dinheiro", "Resolver problema sem fila", "Dicas de como economizar", "Não usaria, prefiro fazer eu mesmo"] },
];

// ---------- Gemini ----------
async function gemini(model: string, system: string, prompt: string, apiKey: string): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json" },
  };
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Gemini ${model} ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const data: any = await r.json();
  const txt = (data?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
  try { return JSON.parse(txt); } catch { return JSON.parse(txt.replace(/```json\s*|\s*```/g, "").trim()); }
}

// ---------- Amostra / persona ----------
const MINI = ["idade", "classe_social", "genero", "regiao", "profissao", "fonte_renda", "renda_mensal_familiar", "banco_principal", "se_investe", "divida_ativa"];
function mini(p: Persona) { return Object.fromEntries(MINI.map((c) => [c, p[c]])); }

function amostra(n: number, seed: number): Persona[] {
  const pool = [...personas];
  let s = (seed >>> 0) || 1;
  const rand = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, Math.min(n, pool.length));
}

// ---------- Pipeline ----------
async function fanOut(pergunta: string, opcoes: string[], amostraP: Persona[], apiKey: string) {
  const sys = "Você RESPONDE como a persona descrita, em 1ª pessoa, curto, fiel aos atributos e ancorado no Grounding (fatos com fonte). Não invente atributos. Se se_investe='Não', não fale como investidora. Escolha UMA das opções exatas. Responda só JSON.";
  const res = await Promise.all(amostraP.map(async (p) => {
    const prompt = `Atributos: ${JSON.stringify(mini(p))}\nGrounding:\n${(p.grounding ?? "").slice(0, 2500)}\n\nPergunta: "${pergunta}"\nOpções: ${JSON.stringify(opcoes)}\nResponda JSON: {"escolha": "<uma opção EXATA da lista>", "verbatim": "1 frase em 1ª pessoa fiel à ficha", "fonte": "id ou estatística do Grounding que embasa"}`;
    try {
      const a = await gemini(MODELO_FANOUT, sys, prompt, apiKey);
      const escolha = opcoes.find((o) => o.toLowerCase() === String(a.escolha ?? "").toLowerCase()) ?? null;
      if (!escolha) return null;
      return { id: p.id, escolha, verbatim: String(a.verbatim ?? "").slice(0, 320), fonte: String(a.fonte ?? "").slice(0, 160), perfil: `${p.idade}a, ${p.profissao}, ${p.classe_social} (${p.regiao})` };
    } catch { return null; }
  }));
  return res.filter(Boolean) as any[];
}

function agrega(respostas: any[], opcoes: string[]) {
  const cont: Record<string, number> = {}; opcoes.forEach((o) => (cont[o] = 0));
  respostas.forEach((r) => { if (cont[r.escolha] !== undefined) cont[r.escolha]++; });
  const n = respostas.length;
  const dist = opcoes.map((o) => ({ opcao: o, n: cont[o], pct: n ? Math.round((cont[o] / n) * 100) : 0 })).sort((a, b) => b.n - a.n);
  return { n, dist };
}

async function redator(tema: string, pergunta: string, agg: any, verbatims: any[], apiKey: string, ajuste = "") {
  const sys = "Você é o redator do Pulso Concorde, especialista em cards curtos e afiados sobre a opinião do consumidor bancário brasileiro, ancorados em dados sintéticos. REGRAS INEGOCIÁVEIS: (1) o painel dá DIREÇÃO, não nível absoluto — NUNCA escreva 'X% dos brasileiros'; escreva 'na amostra' ou 'o painel projeta'; (2) sempre honesto, sem hype nem promessa; (3) use só os verbatims fornecidos e cite a fonte deles; (4) corpo com 2 a 3 parágrafos em <p>...</p>, mais uma leitura de 1 frase. Responda só JSON.";
  const prompt = `Tema: ${tema}\nPergunta: ${pergunta}\nDistribuição (amostra sintética n=${agg.n}): ${JSON.stringify(agg.dist)}\nVerbatims disponíveis: ${JSON.stringify(verbatims)}\n${ajuste ? "AJUSTE PEDIDO PELO EDITOR: " + ajuste + "\n" : ""}\nEscreva JSON: {"titulo": "manchete curta e específica (sem % absoluto)", "corpo": "2-3 parágrafos <p>...</p> analisando a direção e citando 1-2 verbatims com a fonte", "leitura": "1 frase: o que isso sugere para quem constrói produto bank/fintech"}`;
  return await gemini(MODELO_REDATOR, sys, prompt, apiKey);
}

async function validador(rascunho: any, agg: any, verbatims: any[], pergunta: string, apiKey: string) {
  const sys = "Você é o editor-crítico rigoroso do Pulso Concorde e o guardião da credibilidade. REPROVE se o rascunho: inventou número ou usou número fora da distribuição; fez claim de nível absoluto ('X% dos brasileiros') sem enquadrar como direção/amostra; tem tom vendedor/hype/promessa; usa verbatim que não está na lista; ou trata a pergunta como se medisse estado vivido (satisfação, vitimização). Responda só JSON.";
  const prompt = `Pergunta: ${pergunta}\nDistribuição real: ${JSON.stringify(agg.dist)}\nVerbatims válidos: ${JSON.stringify(verbatims.map((v) => v.verbatim))}\nRascunho: ${JSON.stringify(rascunho)}\n\nResponda JSON: {"aprovado": true, "nota": 0-10, "problemas": ["..."], "correcao": "instrução curta pro redator se reprovado, senão string vazia"}`;
  return await gemini(MODELO_VALIDADOR, sys, prompt, apiKey);
}

export async function gerarPulso(apiKey: string, itemIndex: number) {
  if (!apiKey) throw new Error("GEMINI_API_KEY ausente (rode: wrangler secret put GEMINI_API_KEY).");
  const item = ROTACAO[((itemIndex % ROTACAO.length) + ROTACAO.length) % ROTACAO.length];
  const seed = Math.floor(Math.random() * 1e9);
  const respostas = await fanOut(item.pergunta, item.opcoes, amostra(N_AMOSTRA, seed), apiKey);
  if (respostas.length < 5) throw new Error(`Fan-out fraco (${respostas.length} respostas).`);
  const agg = agrega(respostas, item.opcoes);
  const verbatims = respostas.map((r) => ({ verbatim: r.verbatim, fonte: r.fonte, perfil: r.perfil, id: r.id })).slice(0, 8);
  let rascunho = await redator(item.tema, item.pergunta, agg, verbatims, apiKey);
  let val = await validador(rascunho, agg, verbatims, item.pergunta, apiKey);
  if (val && val.aprovado === false && val.correcao) {
    rascunho = await redator(item.tema, item.pergunta, agg, verbatims, apiKey, val.correcao);
    val = await validador(rascunho, agg, verbatims, item.pergunta, apiKey);
  }
  const data = new Date().toISOString().slice(0, 10);
  return {
    slug: `${data}-${item.slug}`, data, tema: item.tema, pergunta: item.pergunta, opcoes: item.opcoes,
    distribuicao: agg.dist, n: agg.n, seed, verbatims,
    titulo: String(rascunho?.titulo ?? item.tema), corpo: String(rascunho?.corpo ?? ""), leitura: String(rascunho?.leitura ?? ""),
    validacao: val ?? null, status: "rascunho", criado_em: Date.now(),
  };
}

// ---------- Storage (Durable Object) ----------
export class PulsoDO extends DurableObject {
  private async idx(k: string): Promise<string[]> { return ((await this.ctx.storage.get(k)) as string[] | undefined) ?? []; }
  async gerarESalvar(apiKey: string): Promise<string> {
    const ptr = ((await this.ctx.storage.get("rot:ptr")) as number | undefined) ?? 0;
    const entry: any = await gerarPulso(apiKey, ptr);
    await this.ctx.storage.put(`e:${entry.slug}`, entry);
    const d = await this.idx("idx:draft");
    if (!d.includes(entry.slug)) { d.unshift(entry.slug); await this.ctx.storage.put("idx:draft", d); }
    await this.ctx.storage.put("rot:ptr", ptr + 1);
    return entry.slug;
  }
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
    if (edits.corpo) e.corpo = edits.corpo;
    if (edits.leitura) e.leitura = edits.leitura;
    e.status = "publicado"; e.publicado_em = Date.now();
    await this.ctx.storage.put(`e:${slug}`, e);
    await this.ctx.storage.put("idx:draft", (await this.idx("idx:draft")).filter((x) => x !== slug));
    const pub = await this.idx("idx:pub");
    if (!pub.includes(slug)) { pub.unshift(slug); await this.ctx.storage.put("idx:pub", pub); }
    return true;
  }
  async descartar(slug: string): Promise<void> {
    await this.ctx.storage.delete(`e:${slug}`);
    await this.ctx.storage.put("idx:draft", (await this.idx("idx:draft")).filter((x) => x !== slug));
  }
}

// ---------- Render ----------
function esc(s: string): string { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function limpaCorpo(html: string): string { return String(html ?? "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/ on\w+="[^"]*"/gi, ""); }

const CARIMBO = "Projeção direcional do Painel Sintético Concorde (amostra de personas sintéticas calibradas com IBGE/Bacen/ABEP). Mede direção e prioridade, não nível absoluto nem intenção real de uso — não é pesquisa de campo.";

function barras(dist: any[]): string {
  const max = Math.max(1, ...dist.map((d) => d.n));
  return `<div class="pulso-dist">${dist.map((d) => `<div class="pulso-linha"><span class="pulso-op">${esc(d.opcao)}</span><span class="pulso-bar" style="width:${Math.max(4, Math.round((d.n / max) * 100))}%"></span><span class="pulso-pct">${d.pct}%</span></div>`).join("")}</div>`;
}

function verbatimsHtml(vs: any[]): string {
  return vs.slice(0, 6).map((v) => `<blockquote class="pulso-v">"${esc(v.verbatim)}"<cite>— ${esc(v.perfil)}${v.fonte ? ` · <span class="dim">fonte: ${esc(v.fonte)}</span>` : ""}</cite></blockquote>`).join("");
}

function cardEntry(e: any, linkTitulo: boolean): string {
  const titulo = linkTitulo ? `<a href="/pulso/${esc(e.slug)}">${esc(e.titulo)}</a>` : esc(e.titulo);
  return `<article class="pulso-card">
<p class="pulso-meta"><span class="pulso-tag">${esc(e.tema)}</span> · ${esc(e.data)} · amostra n=${e.n} · seed ${e.seed}</p>
<h2 class="pulso-titulo">${titulo}</h2>
<p class="pulso-pergunta">${esc(e.pergunta)}</p>
${barras(e.distribuicao || [])}
<div class="pulso-corpo">${limpaCorpo(e.corpo)}</div>
${e.leitura ? `<p class="pulso-leitura"><b>Leitura:</b> ${esc(e.leitura)}</p>` : ""}
${verbatimsHtml(e.verbatims || [])}
<p class="pulso-carimbo">${CARIMBO} · Reproduza: seed ${e.seed}.</p>
</article>`;
}

const CSS_PULSO = `<style>
.pulso-card{border:1px solid var(--borda);border-radius:12px;padding:22px;margin:22px 0;background:var(--janela)}
.pulso-meta{color:var(--dim);font-size:.82em;margin:0 0 6px}
.pulso-tag{color:var(--roxo);font-weight:600}
.pulso-titulo{margin:.2em 0 .3em;font-size:1.35em}
.pulso-titulo a{color:var(--texto)}
.pulso-pergunta{color:var(--dim);margin:0 0 16px}
.pulso-dist{margin:14px 0}
.pulso-linha{display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px;margin:7px 0}
.pulso-op{font-size:.92em}
.pulso-bar{grid-column:1/2;grid-row:2;height:10px;border-radius:5px;background:var(--roxo);min-width:4px}
.pulso-op{grid-column:1/2;grid-row:1}
.pulso-pct{grid-column:2;grid-row:1/3;color:var(--dim);font-variant-numeric:tabular-nums}
.pulso-corpo{margin:16px 0}
.pulso-leitura{border-left:3px solid var(--roxo);padding-left:12px;margin:16px 0}
.pulso-v{border-left:2px solid var(--borda);margin:10px 0;padding:4px 0 4px 12px;color:#d1d1d6}
.pulso-v cite{display:block;margin-top:4px;font-size:.82em;color:var(--dim);font-style:normal}
.pulso-carimbo{margin-top:16px;font-size:.78em;color:var(--dim);border-top:1px solid var(--borda);padding-top:10px}
.pulso-admin form{border:1px dashed var(--borda);border-radius:10px;padding:14px;margin:14px 0}
.pulso-admin input,.pulso-admin textarea{width:100%;background:#111;border:1px solid var(--borda);color:var(--texto);border-radius:6px;padding:8px;font:inherit;font-size:15px;margin:4px 0}
</style>`;

function feedHtml(entries: any[]): string {
  const corpo = `<main style="padding-top:52px"><div class="wrap">
<p class="zsh"><b>concorde@painel</b> ~ % <i>painel --pulso</i></p>
<h1 style="margin-top:8px">Pulso Concorde<span class="cursor"></span></h1>
<p class="sub">Uma pesquisa sintética por dia sobre o que está em alta em bank e fintech no Brasil. Cada card é uma projeção <b>direcional</b> do painel de 787 personas — o que o consumidor prioriza e por quê, com as falas ancoradas em dado público. Não é pesquisa de campo.</p>
${entries.length ? entries.map((e) => cardEntry(e, true)).join("") : `<p class="dim" style="margin-top:30px">O primeiro Pulso sai em breve. Enquanto isso, veja <a href="/">como o painel funciona</a>.</p>`}
</div></main>`;
  const jsonld = JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", name: "Pulso Concorde", description: "Pesquisa sintética diária sobre temas de bank e fintech no Brasil.", url: `${BASE_URL}/pulso`, inLanguage: "pt-BR" });
  return layout("Pulso Concorde — pesquisa sintética diária de bank/fintech", "pulso", corpo, CSS_PULSO, "/pulso", "Uma pesquisa sintética por dia sobre temas quentes de bank e fintech no Brasil: o que o consumidor prioriza, com falas ancoradas em dados públicos (IBGE, Bacen, ABEP).", jsonld);
}

function entryHtml(e: any): string {
  const corpo = `<main style="padding-top:52px"><div class="wrap">
<p class="zsh"><b>concorde@painel</b> ~ % <i>painel --pulso ${esc(e.slug)}</i></p>
<p style="margin-top:8px"><a href="/pulso">← todos os pulsos</a></p>
${cardEntry(e, false)}
<p class="link-bloco" style="margin-top:24px">Quer rodar uma pesquisa dessas com o SEU produto? <a href="/usar#pesquisa">→ veja como</a></p>
</div></main>`;
  const jsonld = JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: e.titulo, datePublished: e.data, inLanguage: "pt-BR", author: { "@type": "Person", name: "Caio Sartoratto Prado" }, publisher: { "@type": "Organization", name: "Painel Sintético Concorde" }, url: `${BASE_URL}/pulso/${e.slug}`, about: e.tema });
  return layout(`${e.titulo} — Pulso Concorde`, "pulso", corpo, CSS_PULSO, `/pulso/${e.slug}`, String(e.leitura || e.pergunta).slice(0, 180), jsonld);
}

function adminHtml(token: string, drafts: any[], pub: any[]): string {
  const t = esc(token);
  const draftForm = (e: any) => `<form method="POST" action="/admin/pulso/publicar?token=${t}">
<p class="pulso-meta"><span class="pulso-tag">${esc(e.tema)}</span> · ${esc(e.data)} · n=${e.n} · validador: nota ${esc(String(e.validacao?.nota ?? "?"))}${e.validacao?.aprovado === false ? " · <b style=\"color:var(--ambar)\">reprovado</b>" : ""}</p>
${e.validacao?.problemas?.length ? `<p class="dim">Ressalvas do validador: ${esc((e.validacao.problemas || []).join("; "))}</p>` : ""}
<input type="hidden" name="slug" value="${esc(e.slug)}">
<label>Título<input name="titulo" value="${esc(e.titulo)}"></label>
<label>Corpo (HTML)<textarea name="corpo" rows="6">${esc(e.corpo)}</textarea></label>
<label>Leitura<input name="leitura" value="${esc(e.leitura)}"></label>
${barras(e.distribuicao || [])}
${verbatimsHtml(e.verbatims || [])}
<button class="acao" type="submit">Publicar</button>
</form>`;
  const corpo = `<main style="padding-top:52px"><div class="wrap pulso-admin">
<h1>Pulso — revisão</h1>
<form method="POST" action="/admin/pulso/gerar?token=${t}"><button class="acao" type="submit">Gerar rascunho agora (Gemini)</button></form>
<h2>Rascunhos (${drafts.length})</h2>
${drafts.length ? drafts.map(draftForm).join("") : '<p class="dim">Nenhum rascunho. Clique acima para gerar ou espere o cron da madrugada.</p>'}
<h2>Publicados (${pub.length})</h2>
${pub.map((e) => `<p>· <a href="/pulso/${esc(e.slug)}">${esc(e.titulo)}</a> <span class="dim">(${esc(e.data)})</span></p>`).join("") || '<p class="dim">Nenhum ainda.</p>'}
</div></main>`;
  return layout("Pulso — admin", "pulso", corpo, CSS_PULSO, "/pulso", "admin", "", '<meta name="robots" content="noindex, nofollow">');
}

// ---------- Rota ----------
export async function rotaPulso(request: Request, env: any, pathname: string): Promise<Response | null> {
  const html = (s: string, extra: Record<string, string> = {}) => new Response(s, { headers: { "Content-Type": "text/html; charset=utf-8", ...extra } });
  const doo = () => env.PULSO.get(env.PULSO.idFromName("global")) as any;

  if (request.method === "GET" && pathname === "/pulso") {
    const entries = await doo().listar("publicado");
    return html(feedHtml(entries), { "Cache-Control": "public, max-age=300" });
  }
  if (request.method === "GET" && pathname.startsWith("/pulso/")) {
    const slug = decodeURIComponent(pathname.slice("/pulso/".length));
    const e = await doo().obter(slug);
    if (!e || e.status !== "publicado") return html(feedHtml(await doo().listar("publicado")), { "Cache-Control": "no-store" });
    return html(entryHtml(e), { "Cache-Control": "public, max-age=300" });
  }

  // Admin (protegido por ADMIN_TOKEN)
  if (pathname === "/admin/pulso" || pathname.startsWith("/admin/pulso/")) {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") ?? "";
    if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) return new Response("negado", { status: 403 });
    if (request.method === "GET" && pathname === "/admin/pulso") {
      return html(adminHtml(token, await doo().listar("rascunho"), await doo().listar("publicado")), { "Cache-Control": "no-store" });
    }
    if (request.method === "POST" && pathname === "/admin/pulso/gerar") {
      try { await doo().gerarESalvar(env.GEMINI_API_KEY); } catch (e: any) { return new Response("Erro ao gerar: " + e.message, { status: 500 }); }
      return Response.redirect(`${BASE_URL}/admin/pulso?token=${encodeURIComponent(token)}`, 303);
    }
    if (request.method === "POST" && pathname === "/admin/pulso/publicar") {
      const f = await request.formData();
      await doo().publicar(String(f.get("slug") ?? ""), { titulo: String(f.get("titulo") ?? ""), corpo: String(f.get("corpo") ?? ""), leitura: String(f.get("leitura") ?? "") });
      return Response.redirect(`${BASE_URL}/admin/pulso?token=${encodeURIComponent(token)}`, 303);
    }
  }
  return null;
}
