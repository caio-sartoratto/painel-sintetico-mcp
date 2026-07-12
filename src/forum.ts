// Fórum aberto (estilo TabNews mínimo): threads e respostas anônimas (@user-xxxx por IP),
// sem moderação prévia. Freios: rate limit por IP, limites de tamanho, HTML sempre escapado,
// links nunca renderizados como <a>, noindex, e kill switch por token (remoção pós-fato).
// REGRA DE OURO: nada daqui volta por ferramenta MCP (evita prompt injection armazenada
// nas sessões de outros usuários).
import { DurableObject } from "cloudflare:workers";
import { paginaForum } from "./site";

type Resposta = { autor: string; texto: string; ts: number };
type Thread = { id: string; titulo: string; autor: string; texto: string; ts: number; respostas: Resposta[] };
// Índice leve para a listagem: evita carregar todas as threads inteiras (com respostas)
// a cada GET /forum — no pior caso isso estouraria a memória do DO.
export type Resumo = { id: string; titulo: string; autor: string; ts: number; nRespostas: number; ultimoTs: number };

const MAX_TITULO = 90;
const MAX_TEXTO = 1200;
const MAX_THREADS_LISTA = 100;
const MAX_THREADS_TOTAL = 500;
const MAX_RESPOSTAS = 200;

export class ForumDO extends DurableObject {
  private resumoDe(t: Thread): Resumo {
    return { id: t.id, titulo: t.titulo, autor: t.autor, ts: t.ts, nRespostas: t.respostas.length, ultimoTs: ultimaAtividade(t) };
  }
  // Migração única: threads criadas antes do índice ganham resumo na primeira listagem
  private async migrarResumos(): Promise<void> {
    const threads = (await this.ctx.storage.list({ prefix: "thread:" })) as Map<string, Thread>;
    for (const t of threads.values()) await this.ctx.storage.put("resumo:" + t.id, this.resumoDe(t));
  }
  async criarThread(titulo: string, texto: string, autor: string): Promise<string | null> {
    const resumos = await this.ctx.storage.list({ prefix: "resumo:", limit: MAX_THREADS_TOTAL });
    if (resumos.size >= MAX_THREADS_TOTAL) return null;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const t: Thread = { id, titulo, autor, texto, ts: Date.now(), respostas: [] };
    await this.ctx.storage.put("thread:" + id, t);
    await this.ctx.storage.put("resumo:" + id, this.resumoDe(t));
    return id;
  }
  async responder(id: string, texto: string, autor: string): Promise<"ok" | "cheia" | "inexistente"> {
    const t = (await this.ctx.storage.get("thread:" + id)) as Thread | undefined;
    if (!t) return "inexistente";
    if (t.respostas.length >= MAX_RESPOSTAS) return "cheia";
    t.respostas.push({ autor, texto, ts: Date.now() });
    await this.ctx.storage.put("thread:" + id, t);
    await this.ctx.storage.put("resumo:" + id, this.resumoDe(t));
    return "ok";
  }
  async listar(): Promise<Resumo[]> {
    let m = (await this.ctx.storage.list({ prefix: "resumo:" })) as Map<string, Resumo>;
    if (m.size === 0) {
      const temThreads = await this.ctx.storage.list({ prefix: "thread:", limit: 1 });
      if (temThreads.size > 0) {
        await this.migrarResumos();
        m = (await this.ctx.storage.list({ prefix: "resumo:" })) as Map<string, Resumo>;
      }
    }
    return [...m.values()].sort((a, b) => b.ultimoTs - a.ultimoTs).slice(0, MAX_THREADS_LISTA);
  }
  async getThread(id: string): Promise<Thread | undefined> {
    return (await this.ctx.storage.get("thread:" + id)) as Thread | undefined;
  }
  async apagarThread(id: string): Promise<void> {
    await this.ctx.storage.delete("thread:" + id);
    await this.ctx.storage.delete("resumo:" + id);
  }
  async apagarResposta(id: string, idx: number): Promise<void> {
    const t = (await this.ctx.storage.get("thread:" + id)) as Thread | undefined;
    if (!t || !Number.isInteger(idx) || idx < 0 || idx >= t.respostas.length) return;
    t.respostas.splice(idx, 1);
    await this.ctx.storage.put("thread:" + id, t);
    await this.ctx.storage.put("resumo:" + id, this.resumoDe(t));
  }
}

function ultimaAtividade(t: Thread): number {
  return t.respostas.length ? t.respostas[t.respostas.length - 1].ts : t.ts;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function quando(ts: number): string {
  const d = Date.now() - ts;
  if (d < 3600e3) return Math.max(1, Math.round(d / 60e3)) + " min atrás";
  if (d < 86400e3) return Math.round(d / 3600e3) + " h atrás";
  return new Date(ts).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

async function apelido(ip: string, sal: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sal + "|forum|" + ip));
  return "@user-" + [...new Uint8Array(buf)].slice(0, 2).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function limpa(s: unknown, max: number): string {
  return String(s ?? "").replace(/\r/g, "").trim().slice(0, max);
}

function redirect(local: string): Response {
  return new Response(null, { status: 303, headers: { Location: local } });
}

function paginaErro(msg: string): Response {
  return new Response(
    paginaForum("Fórum — Painel Sintético Concorde", `<main style="padding-top:52px"><div class="wrap">
<h1>Opa<span class="cursor"></span></h1><p>${esc(msg)}</p>
<p><a href="/forum">← voltar ao fórum</a></p></div></main>`),
    {
      status: 429,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "frame-ancestors 'none'",
      },
    }
  );
}

function formApagar(admin: string, threadId: string, resposta?: number): string {
  if (!admin) return "";
  return `<form method="post" action="/forum/apagar" style="display:inline;margin-left:8px">
<input type="hidden" name="token" value="${esc(admin)}"><input type="hidden" name="thread" value="${esc(threadId)}">
${resposta !== undefined ? `<input type="hidden" name="resposta" value="${resposta}">` : ""}
<button class="perigo">apagar</button></form>`;
}

export async function rotaForum(request: Request, env: any, pathname: string): Promise<Response | null> {
  if (!pathname.startsWith("/forum")) return null;
  const forum = env.FORUM.get(env.FORUM.idFromName("global")) as ForumDO;
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  const url = new URL(request.url);
  // Anti-CSRF: POSTs só do próprio site (navegadores mandam Origin em POST de formulário)
  if (request.method === "POST") {
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== url.host) return new Response("origem inválida", { status: 403 });
  }
  const adminParam = url.searchParams.get("admin") ?? "";
  const admin = env.ADMIN_TOKEN && adminParam === env.ADMIN_TOKEN ? adminParam : "";
  const html = (corpo: string, status = 200) =>
    new Response(paginaForum("Feedback e discussão — Painel Sintético Concorde", corpo), {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Content-Security-Policy": "frame-ancestors 'none'",
      },
    });

  // POST: apagar (kill switch)
  if (request.method === "POST" && pathname === "/forum/apagar") {
    const f = await request.formData();
    if (!env.ADMIN_TOKEN || f.get("token") !== env.ADMIN_TOKEN) return new Response("negado", { status: 403 });
    const tid = String(f.get("thread") ?? "");
    const resp = f.get("resposta");
    if (resp !== null) await forum.apagarResposta(tid, Number(resp));
    else await forum.apagarThread(tid);
    return redirect(resp !== null ? `/forum/${tid}?admin=${f.get("token")}` : `/forum?admin=${f.get("token")}`);
  }

  // POST: nova thread
  if (request.method === "POST" && pathname === "/forum/nova") {
    const excedido = await env.QUOTA.get(env.QUOTA.idFromName(ip)).take({ forum_threads_dia: 1, forum_posts_min: 1 });
    if (excedido) return paginaErro("Limite de novas discussões atingido por hoje. Volte amanhã — ou responda numa thread existente.");
    const f = await request.formData();
    const titulo = limpa(f.get("titulo"), MAX_TITULO);
    const texto = limpa(f.get("texto"), MAX_TEXTO);
    if (titulo.length < 4 || texto.length < 4) return redirect("/forum");
    const id = await forum.criarThread(titulo, texto, await apelido(ip, env.HASH_SALT ?? 'dev-sal'));
    if (!id) return paginaErro("O fórum atingiu o número máximo de discussões. Responda numa thread existente.");
    return redirect(`/forum/${id}`);
  }

  // POST: responder
  const mResp = pathname.match(/^\/forum\/([a-z0-9]+)\/responder$/);
  if (request.method === "POST" && mResp) {
    const excedido = await env.QUOTA.get(env.QUOTA.idFromName(ip)).take({ forum_respostas_dia: 1, forum_posts_min: 1 });
    if (excedido) return paginaErro("Limite de respostas atingido por hoje. Volte amanhã.");
    const f = await request.formData();
    const texto = limpa(f.get("texto"), MAX_TEXTO);
    if (texto.length >= 2) {
      const r = await forum.responder(mResp[1], texto, await apelido(ip, env.HASH_SALT ?? 'dev-sal'));
      if (r === "cheia") return paginaErro("Esta thread atingiu o limite de respostas. Abra uma nova discussão.");
    }
    return redirect(`/forum/${mResp[1]}`);
  }

  if (request.method !== "GET" && request.method !== "HEAD") return new Response("método não suportado", { status: 405 });

  // GET: thread individual
  const mThread = pathname.match(/^\/forum\/([a-z0-9]+)$/);
  if (mThread) {
    const t = await forum.getThread(mThread[1]);
    if (!t) return html(`<main style="padding-top:52px"><div class="wrap"><h1>Thread não encontrada</h1><p><a href="/forum">← voltar</a></p></div></main>`, 404);
    const respostas = t.respostas
      .map(
        (r, i) => `<div class="post"><span class="autor">${esc(r.autor)}</span><span class="quando">${quando(r.ts)}</span>${formApagar(admin, t.id, i)}
<div class="texto">${esc(r.texto)}</div></div>`
      )
      .join("");
    return html(`<main style="padding-top:52px"><div class="wrap">
<p><a href="/forum">← todas as discussões</a></p>
<h1 style="margin-top:8px">${esc(t.titulo)}</h1>
<div class="post"><span class="autor">${esc(t.autor)}</span><span class="quando">${quando(t.ts)}</span>${formApagar(admin, t.id)}
<div class="texto">${esc(t.texto)}</div></div>
${respostas}
<h2>responder</h2>
<form method="post" action="/forum/${esc(t.id)}/responder">
<textarea name="texto" maxlength="${MAX_TEXTO}" placeholder="Sua resposta (anônima, aparece como o seu @user)…" required></textarea>
<button class="acao">publicar resposta</button>
</form>
<p class="aviso-forum">Anônimo e sem moderação prévia — publique com responsabilidade. Não inclua dados
pessoais. Links não são clicáveis por segurança. Conteúdo ofensivo ou ilegal é removido quando notificado.</p>
</div></main>`);
  }

  // GET: lista
  if (pathname === "/forum" || pathname === "/forum/") {
    const threads = await forum.listar();
    const lista = threads.length
      ? threads
          .map(
            (t) => `<div class="thread-item"><a class="titulo" href="/forum/${esc(t.id)}${admin ? "?admin=" + esc(admin) : ""}">${esc(t.titulo)}</a>${formApagar(admin, t.id)}
<div class="thread-meta">${esc(t.autor)} · ${t.nRespostas} resposta${t.nRespostas === 1 ? "" : "s"} · ${quando(t.ultimoTs)}</div></div>`
          )
          .join("")
      : `<p class="dim">Nenhuma discussão ainda — abra a primeira.</p>`;
    return html(`<main style="padding-top:52px"><div class="wrap">
<p class="zsh"><b>concorde@painel</b> ~ % <i>painel --feedback</i></p>
<h1 style="margin-top:8px">Feedback e discussão<span class="cursor"></span></h1>
<p class="sub">Usou o painel? Conte o que funcionou, o que quebrou e o que você faria diferente.
Aberto, anônimo (@user gerado automaticamente) e sem moderação prévia.</p>
<h2>abrir uma discussão</h2>
<form method="post" action="/forum/nova">
<input type="text" name="titulo" maxlength="${MAX_TITULO}" placeholder="Título (ex.: Testei com personas Classe A e…)" required>
<textarea name="texto" maxlength="${MAX_TEXTO}" placeholder="Seu feedback ou pergunta…" required></textarea>
<button class="acao">publicar</button>
</form>
<p class="aviso-forum">Anônimo e sem moderação prévia — publique com responsabilidade. Não inclua dados
pessoais. Links não são clicáveis por segurança. Conteúdo ofensivo ou ilegal é removido quando notificado.
Este fórum não é indexado por buscadores nem lido pelas ferramentas do conector.</p>
<h2>discussões</h2>
${lista}
</div></main>`);
  }

  return null;
}
