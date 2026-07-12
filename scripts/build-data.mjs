// Compila o vault Painel_Sintetico em JSONs embarcados no Worker.
// Uso: node scripts/build-data.mjs [caminho-do-vault]
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";

const VAULT = process.argv[2] ?? process.env.VAULT_DIR;
if (!VAULT) { console.error("Uso: node scripts/build-data.mjs <caminho-do-vault>  (ou defina VAULT_DIR)"); process.exit(1); }
const OUT = new URL("../src/data/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

function walk(dir, filter = () => true) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, filter));
    else if (filter(name)) out.push(p);
  }
  return out;
}

// Parser YAML mínimo para o frontmatter plano do vault (escalares, strings com aspas, listas inline).
function parseFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { fm: {}, body: md };
  const fm = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let [, k, v] = kv;
    v = v.trim();
    if (v === "" || v === "null") fm[k] = null;
    else if (v.startsWith("[")) {
      fm[k] = v
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      v = v.replace(/^["']|["']$/g, "");
      fm[k] = v !== "" && !isNaN(Number(v)) ? Number(v) : v;
    }
  }
  return { fm, body: md.slice(m[0].length) };
}

function section(body, marker) {
  const re = new RegExp(`<!-- ${marker}:START[^>]*-->\\n?([\\s\\S]*?)<!-- ${marker}:END -->`);
  const m = body.match(re);
  return m ? m[1].trim() : null;
}

// --- Personas ---
const personas = [];
for (const classe of ["Classe_A", "Classe_B", "Classe_C", "Classe_D_E"]) {
  for (const file of walk(join(VAULT, classe), (n) => n.startsWith("PERS_"))) {
    const { fm, body } = parseFrontmatter(readFileSync(file, "utf8"));
    personas.push({
      ...fm,
      grounding: section(body, "GROUNDING"),
      historia: section(body, "HISTORIA"),
    });
  }
}
personas.sort((a, b) => String(a.id).localeCompare(String(b.id)));

// --- Fatos ---
const fatos = walk(join(VAULT, "fatos"), (n) => n.startsWith("fato-")).map((file) => {
  const { fm, body } = parseFrontmatter(readFileSync(file, "utf8"));
  return { ...fm, eixo: basename(join(file, "..")), corpo: body.trim() };
});
fatos.sort((a, b) => String(a.id).localeCompare(String(b.id)));

// --- Vozes ---
const vozes = walk(join(VAULT, "vozes"), (n) => n.startsWith("voz-")).map((file) => {
  const { fm, body } = parseFrontmatter(readFileSync(file, "utf8"));
  return { ...fm, corpo: body.trim() };
});

// --- Instituições ---
const instituicoes = walk(join(VAULT, "dados", "instituicoes"), (n) => n.endsWith(".md") && !n.startsWith("_")).map(
  (file) => {
    const { fm, body } = parseFrontmatter(readFileSync(file, "utf8"));
    return { arquivo: basename(file, ".md"), ...fm, corpo: body.trim() };
  }
);

// --- Distribuições (CSVs crus + manifest) ---
const distribuicoes = {};
for (const file of walk(join(VAULT, "dados", "distribuicoes"), (n) => n.endsWith(".csv") || n === "manifest.md")) {
  distribuicoes[basename(file)] = readFileSync(file, "utf8");
}

// --- Calibração ---
let taxas = null;
try {
  taxas = readFileSync(join(VAULT, "dados", "calibracao", "taxas.md"), "utf8");
} catch {}

writeFileSync(join(OUT, "personas.json"), JSON.stringify(personas));
writeFileSync(join(OUT, "fatos.json"), JSON.stringify(fatos));
writeFileSync(join(OUT, "vozes.json"), JSON.stringify(vozes));
writeFileSync(join(OUT, "instituicoes.json"), JSON.stringify(instituicoes));
writeFileSync(join(OUT, "distribuicoes.json"), JSON.stringify(distribuicoes));
writeFileSync(join(OUT, "taxas.json"), JSON.stringify(taxas));

const semFiltro = fatos.filter((f) => !f.publico_alvo_campo);
console.log(
  `personas=${personas.length} fatos=${fatos.length} (sem publico_alvo: ${semFiltro.length}) vozes=${vozes.length} instituicoes=${instituicoes.length} csvs=${Object.keys(distribuicoes).length}`
);
if (semFiltro.length) console.log("fatos sem publico_alvo:", semFiltro.map((f) => f.id).join(", "));
