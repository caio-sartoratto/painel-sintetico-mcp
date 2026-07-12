// Telemetria própria + dashboard admin (/admin/stats?token=...).
// Privacidade por construção: IPs viram hash irreversível (sal próprio) e só servem para
// contagem de únicos; nenhum conteúdo de conversa existe aqui (o servidor nunca o vê).
import { DurableObject } from "cloudflare:workers";
import { paginaForum } from "./site";

const RETENCAO_DIAS = 30;

export class StatsDO extends DurableObject {
  // incrementos: chaves parciais -> quantidade; marcadores: chaves de presença (únicos)
  async registrar(dia: string, incrementos: Record<string, number>, marcadores: string[]): Promise<void> {
    for (const [k, n] of Object.entries(incrementos)) {
      const chave = `v:${dia}:${k}`;
      const atual = ((await this.ctx.storage.get(chave)) as number | undefined) ?? 0;
      await this.ctx.storage.put(chave, atual + n);
    }
    for (const m of marcadores) await this.ctx.storage.put(`v:${dia}:${m}`, 1);
    if ((await this.ctx.storage.getAlarm()) === null) {
      const meiaNoite = new Date();
      meiaNoite.setUTCHours(24, 10, 0, 0);
      await this.ctx.storage.setAlarm(meiaNoite.getTime());
    }
  }

  // Agrega os dias pedidos: contagens por prefixo + únicos por prefixo de marcador
  async resumo(dias: string[]): Promise<Record<string, Record<string, number>>> {
    const agg: Record<string, Record<string, number>> = {};
    for (const dia of dias) {
      const m = (await this.ctx.storage.list({ prefix: `v:${dia}:` })) as Map<string, number>;
      for (const [chave, valor] of m) {
        const resto = chave.slice(`v:${dia}:`.length); // ex.: "pg:/instalar" | "uip:ab12..."
        const sep = resto.indexOf(":");
        const grupo = resto.slice(0, sep);
        const item = resto.slice(sep + 1);
        agg[grupo] ??= {};
        // marcadores (uip/muip) contam presença; contadores somam
        agg[grupo][item] = (agg[grupo][item] ?? 0) + (grupo === "uip" || grupo === "muip" ? 1 : valor);
      }
    }
    return agg;
  }

  async alarm(): Promise<void> {
    const limite = new Date(Date.now() - RETENCAO_DIAS * 86400e3).toISOString().slice(0, 10);
    const tudo = await this.ctx.storage.list({ prefix: "v:" });
    const apagar: string[] = [];
    for (const chave of tudo.keys()) {
      const dia = String(chave).slice(2, 12);
      if (dia < limite) apagar.push(String(chave));
    }
    for (let i = 0; i < apagar.length; i += 128) await this.ctx.storage.delete(apagar.slice(i, i + 128));
    const meiaNoite = new Date();
    meiaNoite.setUTCHours(24, 10, 0, 0);
    await this.ctx.storage.setAlarm(meiaNoite.getTime());
  }
}

async function ipHash(ip: string, sal: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sal + "|stats|" + ip));
  return [...new Uint8Array(buf)].slice(0, 6).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

// --- registro (chamado do worker com ctx.waitUntil; nunca bloqueia a resposta) ---

export async function registraPagina(env: any, ip: string, path: string): Promise<void> {
  try {
    const stats = env.STATS.get(env.STATS.idFromName("global")) as StatsDO;
    await stats.registrar(hoje(), { [`pg:${path}`]: 1 }, [`uip:${await ipHash(ip, env.HASH_SALT ?? "dev-sal")}`]);
  } catch {}
}

export async function registraMcp(env: any, ip: string, chamadas: any[]): Promise<void> {
  try {
    const inc: Record<string, number> = {};
    for (const c of chamadas) {
      const nome = c.params?.name ?? "desconhecida";
      inc[`tool:${nome}`] = (inc[`tool:${nome}`] ?? 0) + 1;
      if (nome === "get_personas" && Array.isArray(c.params?.arguments?.ids))
        for (const id of c.params.arguments.ids.slice(0, 10))
          inc[`persona:${String(id).toUpperCase().slice(0, 12)}`] = (inc[`persona:${String(id).toUpperCase().slice(0, 12)}`] ?? 0) + 1;
    }
    const stats = env.STATS.get(env.STATS.idFromName("global")) as StatsDO;
    await stats.registrar(hoje(), inc, [`muip:${await ipHash(ip, env.HASH_SALT ?? "dev-sal")}`]);
  } catch {}
}

// --- dashboard ---

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function tabela(titulo: string, dados: Record<string, number> | undefined, maxLinhas = 15): string {
  const linhas = Object.entries(dados ?? {}).sort((a, b) => b[1] - a[1]).slice(0, maxLinhas);
  if (!linhas.length) return `<h3>${titulo}</h3><p class="dim">sem dados no período</p>`;
  const max = linhas[0][1];
  return `<h3>${titulo}</h3><table>${linhas
    .map(
      ([k, v]) =>
        `<tr><td>${esc(k)}</td><td class="num">${v}</td><td style="border:0;min-width:120px"><div style="background:var(--roxo);height:10px;border-radius:5px;width:${Math.max(3, Math.round((v / max) * 100))}%"></div></td></tr>`
    )
    .join("")}</table>`;
}

function cartoes(agg: Record<string, Record<string, number>>): string {
  const soma = (g?: Record<string, number>) => Object.values(g ?? {}).reduce((a, b) => a + b, 0);
  const chamadasMcp = soma(agg.tool);
  const c = (n: string | number, l: string) => `<div class="card"><b style="font-size:1.5em">${n}</b><span>${l}</span></div>`;
  return `<div class="grade">
${c(soma(agg.uip), "visitantes únicos do site (IPs)")}
${c(soma(agg.pg), "pageviews")}
${c(soma(agg.muip), "usuários únicos do MCP (IPs)")}
${c(chamadasMcp, "chamadas de ferramenta")}
</div>`;
}

export async function rotaStats(request: Request, env: any, pathname: string): Promise<Response | null> {
  if (pathname !== "/admin/stats") return null;
  const url = new URL(request.url);
  if (!env.ADMIN_TOKEN || url.searchParams.get("token") !== env.ADMIN_TOKEN)
    return new Response("negado", { status: 403 });
  const periodo = url.searchParams.get("periodo") === "30" ? 30 : url.searchParams.get("periodo") === "1" ? 1 : 7;
  const dias = Array.from({ length: periodo }, (_, i) => new Date(Date.now() - i * 86400e3).toISOString().slice(0, 10));
  const stats = env.STATS.get(env.STATS.idFromName("global")) as StatsDO;
  const agg = await stats.resumo(dias);
  const token = esc(url.searchParams.get("token") ?? "");
  const aba = (n: number, rot: string) =>
    `<a href="/admin/stats?token=${token}&periodo=${n}"${periodo === n ? ' style="color:var(--texto);font-weight:700"' : ""}>${rot}</a>`;
  const corpo = `<main style="padding-top:52px"><div class="wrap">
<p class="zsh"><b>concorde@painel</b> ~ % <i>painel --stats</i></p>
<h1 style="margin-top:8px">Uso do painel<span class="cursor"></span></h1>
<p class="sub">Período: ${aba(1, "hoje")} · ${aba(7, "7 dias")} · ${aba(30, "30 dias")} — retenção de ${RETENCAO_DIAS} dias, IPs armazenados só como hash.</p>
${cartoes(agg)}
${tabela("páginas mais vistas", agg.pg, 12)}
${tabela("ferramentas MCP mais chamadas", agg.tool, 10)}
${tabela("personas mais consultadas (fichas completas)", agg.persona, 15)}
<p class="dim" style="margin-top:24px">Infra (CPU, erros, requisições brutas): painel da Cloudflare → Workers → painel → Metrics.</p>
</div></main>`;
  return new Response(paginaForum("Stats — Painel Sintético Concorde", corpo), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "frame-ancestors 'none'",
    },
  });
}
