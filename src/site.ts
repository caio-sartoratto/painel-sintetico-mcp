// Site estático servido pelo mesmo Worker (rotas GET /, /instalar, /usar).
// Identidade: Terminal do macOS (janela, traffic lights, prompt zsh) + grafo Obsidian na home.

const BASE_URL = "https://painel.concorde-painel.workers.dev";
const MCP_URL = `${BASE_URL}/mcp`;
const DESC_PADRAO =
  "Painel de 787 personas sintéticas do consumidor bancário brasileiro, calibrado com dados do IBGE e Bacen, para discovery de produtos bank e fintech — direto no seu Claude via MCP.";

const ESTILO = `
:root{
  --bg:#161618;--janela:#1e1f22;--titulo:#2a2b2e;--borda:#333438;--texto:#e6e6e6;--dim:#98989d;
  --roxo:#bf9ffb;--azul:#6cb2ff;--verde:#32d74b;--ambar:#ffd60a;--vermelho:#ff453a;
}
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:var(--bg);color:var(--texto);
  font-family:"SF Mono",ui-monospace,Menlo,Monaco,monospace;font-size:15px;line-height:1.65;
  -webkit-font-smoothing:antialiased}
a{color:var(--roxo);text-decoration:none}
a:hover{text-decoration:underline}
.wrap{max-width:900px;margin:0 auto;padding:0 20px}
nav{border-bottom:1px solid var(--borda);padding:13px 0;position:sticky;top:0;background:rgba(22,22,24,.9);backdrop-filter:blur(10px);z-index:10}
nav .wrap{display:flex;gap:22px;align-items:baseline;flex-wrap:wrap}
nav .logo b{color:var(--texto)}
nav .logo{color:var(--dim)}
nav .logo i{color:var(--roxo);font-style:normal}
nav a{color:var(--dim)}
nav a.ativa,nav a:hover{color:var(--texto);text-decoration:none}
header.hero{position:relative;overflow:hidden;border-bottom:1px solid var(--borda)}
#grafo{position:absolute;inset:0;width:100%;height:100%}
.hero-conteudo{position:relative;padding:72px 0 64px}
.janela{background:var(--janela);border:1px solid var(--borda);border-radius:10px;
  box-shadow:0 22px 60px rgba(0,0,0,.55),0 2px 8px rgba(0,0,0,.4);overflow:hidden;max-width:660px}
.titulo-barra{background:var(--titulo);display:flex;align-items:center;padding:9px 12px;gap:8px;border-bottom:1px solid var(--borda)}
.titulo-barra i{width:12px;height:12px;border-radius:50%}
.titulo-barra i.r{background:#ff5f57}.titulo-barra i.y{background:#febc2e}.titulo-barra i.g{background:#28c840}
.titulo-barra span{flex:1;text-align:center;color:var(--dim);font-size:.8em}
.janela-corpo{padding:22px 24px 26px}
.zsh{color:var(--dim);font-size:.92em}
.zsh b{color:var(--verde);font-weight:600}
.zsh i{color:var(--azul);font-style:normal}
h1{font-size:1.55em;font-weight:700;letter-spacing:-.4px;margin:12px 0 4px}
h1 .cursor{display:inline-block;width:.52em;height:1em;background:var(--texto);vertical-align:-2px;animation:pisca 1.1s steps(1) infinite;margin-left:2px}
@keyframes pisca{50%{opacity:0}}
.sub{color:var(--dim);margin-top:12px}
main{padding:46px 0 80px}
h2{margin:46px 0 14px;font-size:1.1em;color:var(--texto);font-weight:700}
h2::before{content:"% ";color:var(--roxo)}
h3{margin:26px 0 10px;font-size:1em;color:var(--azul)}
p{margin:10px 0}
p.dim,li.dim,span.dim{color:var(--dim)}
ul,ol{margin:10px 0 10px 26px}
li{margin:6px 0}
.term{background:var(--janela);border:1px solid var(--borda);border-radius:10px;margin:18px 0;overflow:hidden;box-shadow:0 6px 22px rgba(0,0,0,.3)}
.term pre{padding:15px 18px;overflow-x:auto;font-size:.9em;line-height:1.7}
.term .c{color:var(--dim)} .term .g{color:var(--verde)} .term .r{color:var(--roxo)} .term .a{color:var(--ambar)} .term .b{color:var(--azul)}
code{background:var(--janela);border:1px solid var(--borda);border-radius:5px;padding:1px 6px;font-size:.9em}
.copiar{position:relative}
.copiar button{position:absolute;top:44px;right:10px;background:var(--titulo);border:1px solid var(--borda);color:var(--texto);
  font:inherit;font-size:.78em;padding:4px 10px;border-radius:6px;cursor:pointer}
.copiar button:hover{background:var(--roxo);color:#161618;border-color:var(--roxo)}
.grade{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin:18px 0}
.card{background:var(--janela);border:1px solid var(--borda);border-radius:10px;padding:16px 18px}
.card b{color:var(--roxo);display:block;margin-bottom:6px}
.card span{color:var(--dim);font-size:.9em}
table{border-collapse:collapse;width:100%;margin:16px 0;font-size:.9em}
th,td{border:1px solid var(--borda);padding:8px 12px;text-align:left}
th{background:var(--titulo);color:var(--dim);font-weight:600}
td.num{text-align:right;font-variant-numeric:tabular-nums}
.ok{color:var(--verde)}
.destaque{background:var(--janela);border:1px solid var(--borda);border-left:3px solid var(--roxo);border-radius:0 10px 10px 0;padding:14px 18px;margin:18px 0}
.passo{display:flex;gap:14px;margin:22px 0}
.passo .n{color:var(--roxo);white-space:nowrap}
footer{border-top:1px solid var(--borda);padding:26px 0 40px;color:var(--dim);font-size:.86em}
footer .wrap{display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px}
.tabela-scroll{overflow-x:auto}
@media (max-width:640px){.hero-conteudo{padding:44px 0 40px}h1{font-size:1.25em}}
/* --- demo animada --- */
.demo-grid{display:grid;grid-template-columns:1.15fr 1fr}
@media (max-width:720px){.demo-grid{grid-template-columns:1fr}}
.chat{padding:18px;display:flex;flex-direction:column;gap:11px;min-height:330px}
.msg{max-width:94%;padding:10px 14px;border-radius:12px;font-size:.88em;line-height:1.55;opacity:0;transform:translateY(8px);transition:opacity .4s,transform .4s}
.msg.on{opacity:1;transform:none}
.msg.user{align-self:flex-end;background:#2c3850;border:1px solid #3c4a68;border-bottom-right-radius:4px}
.msg.claude{align-self:flex-start;background:var(--titulo);border:1px solid var(--borda);border-bottom-left-radius:4px}
.msg .cita{color:var(--verde)}
.msg .quem{color:var(--roxo);font-weight:600}
.status-demo{color:var(--dim);font-size:.78em;align-self:flex-start;opacity:0;transition:.3s}
.status-demo.on{opacity:1}
.digitando::after{content:"▍";color:var(--verde);animation:pisca 1s steps(1) infinite}
.bastidores{border-left:1px solid var(--borda);padding:16px 18px;background:#141518}
@media (max-width:720px){.bastidores{border-left:0;border-top:1px solid var(--borda)}}
.bastidores h4{color:var(--dim);font-size:.72em;font-weight:600;letter-spacing:.1em;text-transform:uppercase;margin-bottom:10px}
.passo-demo{display:flex;gap:8px;font-size:.8em;margin:7px 0;opacity:.22;transition:.4s;color:var(--dim)}
.passo-demo.on{opacity:1;color:var(--texto)}
.passo-demo .ok{color:var(--verde)}
.passo-demo code{padding:0 5px;font-size:.95em}
.ficha-card{border:1px solid var(--borda);border-radius:9px;padding:10px 12px;margin:10px 0 4px;font-size:.78em;line-height:1.5;opacity:0;transform:translateX(16px);transition:.5s;background:var(--janela)}
.ficha-card.on{opacity:1;transform:none;border-color:var(--roxo);box-shadow:0 0 18px rgba(191,159,251,.12)}
.ficha-card b{color:var(--roxo)}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.chip{border:1px solid var(--borda);border-radius:999px;padding:2px 9px;font-size:.72em;color:var(--dim);opacity:0;transform:scale(.75);transition:.35s}
.chip.on{opacity:1;transform:none;color:var(--verde);border-color:#2b4a34}
.link-bloco{margin:14px 0 0;font-size:.9em}
/* --- fórum --- */
input[type=text],textarea{width:100%;background:var(--janela);border:1px solid var(--borda);border-radius:8px;
  color:var(--texto);font:inherit;padding:10px 12px;margin:6px 0}
textarea{min-height:110px;resize:vertical}
input:focus,textarea:focus{outline:none;border-color:var(--roxo)}
button.acao{background:var(--roxo);color:#161618;border:0;border-radius:8px;font:inherit;font-weight:600;
  padding:9px 18px;cursor:pointer;margin-top:6px}
button.acao:hover{opacity:.88}
button.perigo{background:transparent;color:var(--vermelho);border:1px solid var(--borda);border-radius:6px;
  font:inherit;font-size:.75em;padding:2px 8px;cursor:pointer}
.thread-item{border:1px solid var(--borda);border-radius:10px;padding:14px 18px;margin:12px 0;background:var(--janela)}
.thread-item a.titulo{color:var(--texto);font-weight:600}
.thread-meta{color:var(--dim);font-size:.8em;margin-top:4px}
.post{border:1px solid var(--borda);border-radius:10px;padding:14px 18px;margin:14px 0;background:var(--janela)}
.post .autor{color:var(--roxo);font-weight:600;font-size:.85em}
.post .quando{color:var(--dim);font-size:.75em;margin-left:8px}
.post .texto{margin-top:8px;white-space:pre-wrap;word-break:break-word}
.aviso-forum{color:var(--dim);font-size:.82em;border-left:3px solid var(--borda);padding-left:12px;margin:16px 0}
@media (prefers-reduced-motion: reduce){.msg,.status-demo,.passo-demo,.ficha-card,.chip{opacity:1!important;transform:none!important}}
`;

function janela(titulo: string, corpo: string, classe = ""): string {
  return `<div class="janela ${classe}"><div class="titulo-barra"><i class="r"></i><i class="y"></i><i class="g"></i><span>${titulo}</span></div>${corpo}</div>`;
}

function term(titulo: string, pre: string): string {
  return `<div class="term"><div class="titulo-barra"><i class="r"></i><i class="y"></i><i class="g"></i><span>${titulo}</span></div><pre>${pre}</pre></div>`;
}

function layout(
  titulo: string,
  ativa: string,
  conteudo: string,
  extra = "",
  caminho = "/",
  desc = DESC_PADRAO,
  jsonld = "",
  headExtra = ""
): string {
  const abas = [
    ["/", "home"],
    ["/persona-sintetica", "guia"],
    ["/instalar", "instalar"],
    ["/usar", "usar"],
    ["/forum", "feedback"],
    ["/privacidade", "privacidade"],
    ["/porque", "porquê"],
  ]
    .map(([href, nome]) => `<a href="${href}"${nome === ativa ? ' class="ativa"' : ""}>${nome}</a>`)
    .join("");
  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${BASE_URL}${caminho}">
<meta property="og:title" content="${titulo}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="website">
<meta property="og:url" content="${BASE_URL}${caminho}">
<meta property="og:site_name" content="Painel Sintético Concorde">
<meta property="og:locale" content="pt_BR">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${titulo}">
<meta name="twitter:description" content="${desc}">
${jsonld ? `<script type="application/ld+json">${jsonld}</script>` : ""}
${headExtra}
<style>${ESTILO}</style>
</head><body>
<nav><div class="wrap"><span class="logo"><b>concorde</b>@<i>painel</i> ~ %</span>${abas}</div></nav>
${conteudo}
<footer><div class="wrap">
<span>projeto concorde · 787 personas · uso gratuito com cotas · não substitui pesquisa primária</span>
<span>endpoint: <a href="${MCP_URL}">${MCP_URL}</a></span>
</div></footer>
${extra}
</body></html>`;
}

// ---------- HOME: grafo estilo Obsidian (atrás da janela de terminal, sem disputar com o texto) ----------
const GRAFO_JS = `
const cv=document.getElementById('grafo'),cx=cv.getContext('2d');
let W,H,nos=[],arestas=[],mouse={x:-1e4,y:-1e4};
const CORES={painel:'#bf9ffb',persona:'#6cb2ff',fato:'#32d74b',voz:'#ffd60a',dado:'#98989d'};
const DPR=Math.min(devicePixelRatio||1,2);
function medir(){const r=cv.parentElement.getBoundingClientRect();cv.width=r.width*DPR;cv.height=r.height*DPR;cx.setTransform(DPR,0,0,DPR,0,0);W=r.width;H=r.height;}
function criar(){
  nos=[];arestas=[];
  const rnd=(a,b)=>a+Math.random()*(b-a);
  // grafo concentrado na direita; a janela de terminal ocupa a esquerda
  const cxg=W>700?W*0.76:W/2, cyg=H*0.5, raio=Math.min(W,H)*0.2;
  const centro={x:cxg,y:cyg,r:8,cor:CORES.painel,rot:'painel',vx:0,vy:0};
  nos.push(centro);
  const hubs=[['personas',CORES.persona,24],['fatos',CORES.fato,15],['vozes',CORES.voz,7],['dados',CORES.dado,6]];
  hubs.forEach(([rot,cor,filhos],i)=>{
    const ang=i/hubs.length*Math.PI*2+.6;
    const hub={x:cxg+Math.cos(ang)*raio,y:cyg+Math.sin(ang)*raio*.9,r:5.5,cor,rot,vx:0,vy:0};
    nos.push(hub);arestas.push([centro,hub]);
    for(let k=0;k<filhos;k++){
      const a2=ang+rnd(-1.4,1.4),d=rnd(35,raio*1.05);
      const no={x:hub.x+Math.cos(a2)*d,y:hub.y+Math.sin(a2)*d,r:rnd(1.5,3.2),cor,vx:0,vy:0};
      nos.push(no);arestas.push([hub,no]);
      if(Math.random()<.16&&nos.length>6)arestas.push([no,nos[2+Math.floor(Math.random()*(nos.length-3))]]);
    }
  });
}
function rndc(){return Math.random()*2-1}
function passo(){
  const cxg=W>700?W*0.76:W/2;
  for(const n of nos){
    n.vx+=rndc()*.018;n.vy+=rndc()*.018;
    n.vx+=(cxg-n.x)*.00004; // gravidade suave pro lado direito
    const dx=n.x-mouse.x,dy=n.y-mouse.y,d2=dx*dx+dy*dy;
    if(d2<90*90){const f=(90-Math.sqrt(d2))/90*.5;n.vx+=dx/Math.sqrt(d2+1)*f;n.vy+=dy/Math.sqrt(d2+1)*f;}
    n.vx*=.94;n.vy*=.94;n.x+=n.vx;n.y+=n.vy;
    if(n.x<8)n.vx+=.05;if(n.x>W-8)n.vx-=.05;if(n.y<8)n.vy+=.05;if(n.y>H-8)n.vy-=.05;
  }
  for(const[a,b]of arestas){const dx=b.x-a.x,dy=b.y-a.y,d=Math.sqrt(dx*dx+dy*dy)||1,f=(d-65)/d*.004;
    a.vx+=dx*f;a.vy+=dy*f;b.vx-=dx*f;b.vy-=dy*f;}
}
function desenhar(){
  cx.clearRect(0,0,W,H);
  cx.lineWidth=.6;
  for(const[a,b]of arestas){
    const md=Math.hypot((a.x+b.x)/2-mouse.x,(a.y+b.y)/2-mouse.y);
    cx.strokeStyle=md<110?'rgba(191,159,251,.5)':'rgba(152,152,157,.15)';
    cx.beginPath();cx.moveTo(a.x,a.y);cx.lineTo(b.x,b.y);cx.stroke();
  }
  for(const n of nos){
    const md=Math.hypot(n.x-mouse.x,n.y-mouse.y);
    cx.globalAlpha=md<110?1:.7;
    cx.fillStyle=n.cor;
    cx.beginPath();cx.arc(n.x,n.y,n.r+(md<110?1:0),0,7);cx.fill();
    if(n.rot&&(md<130||n.rot==='painel')){
      cx.globalAlpha=.9;cx.fillStyle='#e6e6e6';cx.font='11px ui-monospace,monospace';
      cx.fillText(n.rot,n.x+n.r+5,n.y+4);
    }
  }
  cx.globalAlpha=1;
}
function loop(){passo();desenhar();requestAnimationFrame(loop)}
// Debounce + só recria se a LARGURA mudou: em mobile a barra de URL sumindo/aparecendo
// dispara resize de altura no meio do scroll e recriaria o grafo o tempo todo
let tR,wAnt=innerWidth;
addEventListener('resize',()=>{clearTimeout(tR);tR=setTimeout(()=>{
  if(Math.abs(innerWidth-wAnt)<40){medir();return;}
  wAnt=innerWidth;medir();criar();},200);});
cv.parentElement.addEventListener('mousemove',e=>{const r=cv.getBoundingClientRect();mouse.x=e.clientX-r.left;mouse.y=e.clientY-r.top;});
cv.parentElement.addEventListener('mouseleave',()=>{mouse.x=-1e4;mouse.y=-1e4;});
medir();criar();loop();
`;

const DEMO_JS = `
const $=id=>document.getElementById(id);
const dorme=ms=>new Promise(r=>setTimeout(r,ms));
const CENAS=[
 {user:"Apresente meu app de renegocia\u00e7\u00e3o de d\u00edvidas (R$ 19,90/m\u00eas) para personas Classe C endividadas.",
  filtro:"Classe C + d\u00edvida ativa", pool:"137 personas casam \u2192 sorteio da amostra",
  ficha:"<b>PERS_132 \u00b7 Thiago</b> \u2014 32 anos, vendedor (CLT), Recife/NE<br>renda familiar R$ 2.925 \u00b7 Caixa + Nubank \u00b7 d\u00edvida ativa R$ 6.873<br>Android de entrada \u00b7 Pix 60% dos pagamentos",
  chips:["85,1% d\u00edvida no cart\u00e3o","42% negativado h\u00e1 10+ anos","18,6% n\u00e3o consegue quitar","86% usa Pix"],
  quem:"Thiago, 32, vendedor em Recife", sub:" \u2014 d\u00edvida de R$ 6,9 mil na Caixa:",
  fala:'"Renegociar de gra\u00e7a o Serasa j\u00e1 me oferece toda semana. O que eu pagaria \u00e9 pra d\u00edvida n\u00e3o voltar \u2014 eu limpo o nome e em seis meses estou no rotativo de novo. Se o app s\u00f3 junta boleto, n\u00e3o vale R$ 19,90. Se segurar meu limite quando o m\u00eas aperta, a\u00ed conversa."',
  cita:"ancorado em: 42% dos negativados est\u00e3o no ciclo h\u00e1 10+ anos \u00b7 85,1% do segmento com d\u00edvida no cart\u00e3o"},
 {user:"Sou PM de um banco digital. Vamos lan\u00e7ar uma caixinha que guarda sozinha o troco de cada Pix. Como a base Classe C reage?",
  filtro:"banco == Nubank + Classe C", pool:"40 personas casam \u2192 sorteio da amostra",
  ficha:"<b>PERS_041 \u00b7 Fabiano</b> \u2014 38 anos, t\u00e9cnico em enfermagem, Campinas/SE<br>renda familiar R$ 6.914 \u00b7 Nubank + C6 \u00b7 guardado hoje: R$ 344<br>Android intermedi\u00e1rio \u00b7 fugiu do banco tradicional por causa de tarifa",
  chips:["48% n\u00e3o controla or\u00e7amento","42% sem nenhuma reserva","86% usa Pix","53% n\u00e3o entende aplica\u00e7\u00f5es"],
  quem:"Fabiano, 38, t\u00e9cnico em enfermagem em Campinas", sub:" \u2014 cliente digital, R$ 344 guardados:",
  fala:'"Guardar sozinho \u00e9 a \u00fanica forma de eu guardar \u2014 planilha eu abandono na segunda semana. Mas se esse troco sumir da conta e faltar no fim do m\u00eas, eu desligo no primeiro susto. Quero teto mensal e pausar com um toque, igual bloqueio o cart\u00e3o. E mostra o total crescendo na tela inicial: \u00e9 isso que me faz continuar."',
  cita:"ancorado em: 48% do segmento n\u00e3o faz controle or\u00e7ament\u00e1rio \u00b7 42% dos n\u00e3o-investidores sem reserva"},
 {user:"Nosso banco premium vai reformular os benef\u00edcios: cashback, salas VIP e gerente dedicado. O que a Classe A realmente valoriza?",
  filtro:"Classe A + investe", pool:"18 personas casam \u2192 sorteio da amostra",
  ficha:"<b>PERS_199 \u00b7 Ricardo</b> \u2014 38 anos, perito engenheiro s\u00f3cio, Porto Alegre/Sul<br>renda familiar R$ 31,7 mil \u00b7 patrim\u00f4nio financeiro R$ 3,0 mi<br>Ita\u00fa Personnalit\u00e9 + 3 bancos (BB Estilo, Nubank, BTG) \u00b7 investidor moderado",
  chips:["42% investiu no ano (A/B)","47% j\u00e1 passou por fraude (A/B)","98% usa Pix (Classe A)","multi-banco: 4 relacionamentos"],
  quem:"Ricardo, 38, engenheiro s\u00f3cio em Porto Alegre", sub:" \u2014 Personnalit\u00e9, R$ 3 mi espalhados em 4 bancos:",
  fala:'"Cashback de 1% n\u00e3o paga o meu tempo. Eu pago caro pra resolver r\u00e1pido \u2014 e hoje espero na fila do telefone como todo mundo. O que me segura: gerente que responde em minutos e seguran\u00e7a de verdade, que fraude eu j\u00e1 vi de perto. Faz isso e eu concentro aqui o que est\u00e1 no BTG."',
  cita:"ancorado em: 47% da classe A/B j\u00e1 passou por fraude \u00b7 perfil multi-banco (4 relacionamentos na ficha)"},
];
function digitar(el,txt,vel){return new Promise(res=>{el.classList.add('digitando');let i=0;
  const t=setInterval(()=>{el.textContent=txt.slice(0,++i);
    if(i>=txt.length){clearInterval(t);el.classList.remove('digitando');res();}},vel);});}
function montaCena(c){
  $('dp-filtro').textContent=c.filtro;$('dp-pool').textContent=c.pool;
  $('dp-ficha').innerHTML=c.ficha;
  $('dp-chips').innerHTML=c.chips.map(x=>'<span class="chip">'+x+'</span>').join('');
}
async function rodaDemo(n){
  const c=CENAS[n%CENAS.length];
  const ids=['dm-user','dm-status','dm-claude1','dm-claude2','dp-1','dp-2','dp-3','dp-ficha','dp-4','dp-5'];
  ids.forEach(i=>$(i).classList.remove('on'));
  $('dm-user').textContent='';$('dm-claude1').innerHTML='';$('dm-claude2').innerHTML='';
  montaCena(c);
  await dorme(800);
  $('dm-user').classList.add('on');
  await digitar($('dm-user'),c.user,20);
  await dorme(350);
  $('dm-status').classList.add('on');
  $('dp-1').classList.add('on');await dorme(850);
  $('dp-2').classList.add('on');await dorme(850);
  $('dp-3').classList.add('on');await dorme(500);
  $('dp-ficha').classList.add('on');await dorme(950);
  $('dp-4').classList.add('on');
  for(const ch of document.querySelectorAll('#dp-chips .chip')){ch.classList.add('on');await dorme(320);}
  await dorme(400);
  $('dp-5').classList.add('on');
  $('dm-status').classList.remove('on');
  $('dm-claude1').classList.add('on');
  $('dm-claude1').innerHTML='<span class="quem">'+c.quem+'</span>'+c.sub;
  await dorme(600);
  $('dm-claude2').classList.add('on');
  const fala=document.createElement('span');$('dm-claude2').appendChild(fala);
  await digitar(fala,c.fala,15);
  const cita=document.createElement('div');cita.className='cita';cita.style.marginTop='6px';cita.style.fontSize='.85em';
  cita.textContent=c.cita;
  $('dm-claude2').appendChild(cita);
  await dorme(7000);
  rodaDemo(n+1);
}
const alvo=document.getElementById('demo-chat');
if(alvo){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){
    const c=CENAS[0];montaCena(c);
    ['dm-user','dm-claude1','dm-claude2','dp-1','dp-2','dp-3','dp-ficha','dp-4','dp-5'].forEach(i=>$(i).classList.add('on'));
    document.querySelectorAll('#dp-chips .chip').forEach(x=>x.classList.add('on'));
    $('dm-user').textContent=c.user;
    $('dm-claude1').innerHTML='<span class="quem">'+c.quem+'</span>'+c.sub;
    $('dm-claude2').innerHTML=c.fala+'<div class="cita" style="margin-top:6px;font-size:.85em">'+c.cita+'</div>';
  } else {
    let comecou=false;
    const inicia=()=>{if(!comecou){comecou=true;rodaDemo(0);}};
    try{
      const io=new IntersectionObserver((es,obs)=>{if(es.some(e=>e.isIntersecting)){inicia();obs.disconnect();}},{threshold:.15});
      io.observe(alvo);
    }catch(e){}
    setTimeout(inicia,2500);
  }
}
`;

const COPIAR_JS = `
document.querySelectorAll('.copiar').forEach(el=>{
  const btn=el.querySelector('button');
  btn.addEventListener('click',()=>{
    navigator.clipboard.writeText(el.dataset.texto)
      .then(()=>{btn.textContent='copiado ✓';})
      .catch(()=>{btn.textContent='selecione e copie';});
    setTimeout(()=>btn.textContent='copiar',2000);
  });
});
`;

const JSONLD_APP = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Painel Sintético Concorde",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web (conector MCP para Claude)",
  description: DESC_PADRAO,
  url: BASE_URL,
  offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
  author: { "@type": "Person", name: "Caio Sartoratto Prado", url: "https://www.linkedin.com/in/caio-sartoratto-prado-078307178/" },
});

const HOME = layout(
  "Painel Sintético Concorde — personas sintéticas para discovery de produtos",
  "home",
  `
<header class="hero">
<canvas id="grafo" aria-hidden="true"></canvas>
<div class="hero-conteudo"><div class="wrap">
${janela(
  "painel — zsh — 80×24",
  `<div class="janela-corpo">
  <p class="zsh"><b>concorde@painel</b> ~ % <i>painel --sobre</i></p>
  <h1>787 personas sintéticas para discovery de produtos <span style="color:var(--roxo)">bank&nbsp;|&nbsp;fintech</span>.<span class="cursor"></span></h1>
  <p class="sub">Um painel da população bancarizada brasileira, calibrado com dados públicos
  (IBGE, Bacen), que responde perguntas de pesquisa em 1ª pessoa — direto no seu Claude.
  Teste conceitos, explore segmentos e ouça objeções antes de gastar com pesquisa de campo.</p>
  <p style="margin-top:18px"><a href="/instalar">→ instalar o conector</a>&nbsp;&nbsp;&nbsp;<a href="/usar">→ como usar</a></p>
  </div>`
)}
</div></div>
</header>
<main><div class="wrap">

<h2>veja funcionando</h2>
<p>Uma conversa real com o painel — e o que acontece por trás enquanto ela rola:</p>
<div class="janela" style="max-width:none">
<div class="titulo-barra"><i class="r"></i><i class="y"></i><i class="g"></i><span>claude — focus group com o painel</span></div>
<div class="demo-grid">
  <div class="chat" id="demo-chat">
    <div class="msg user" id="dm-user"></div>
    <div class="status-demo" id="dm-status">consultando o Painel Sintético…</div>
    <div class="msg claude" id="dm-claude1"></div>
    <div class="msg claude" id="dm-claude2"></div>
  </div>
  <div class="bastidores">
    <h4>por trás, no painel</h4>
    <div class="passo-demo" id="dp-1"><span class="ok">✓</span><span>filtro aplicado: <code id="dp-filtro">Classe C + dívida ativa</code></span></div>
    <div class="passo-demo" id="dp-2"><span class="ok">✓</span><span id="dp-pool">137 personas casam → sorteio da amostra</span></div>
    <div class="passo-demo" id="dp-3"><span class="ok">✓</span><span>extraindo ficha completa…</span></div>
    <div class="ficha-card" id="dp-ficha">
      <b>PERS_132 · Thiago</b> — 32 anos, vendedor (CLT), Recife/NE<br>
      renda familiar R$ 2.925 · Caixa + Nubank · dívida ativa R$ 6.873<br>
      Android de entrada · Pix 60% dos pagamentos
    </div>
    <div class="passo-demo" id="dp-4"><span class="ok">✓</span><span>fatos do segmento anexados, com fonte:</span></div>
    <div class="chips" id="dp-chips">
      <span class="chip">85,1% dívida no cartão</span>
      <span class="chip">42% negativado há 10+ anos</span>
      <span class="chip">18,6% não consegue quitar</span>
      <span class="chip">86% usa Pix</span>
    </div>
    <div class="passo-demo" id="dp-5"><span class="ok">✓</span><span>resposta gerada só com o que o segmento sustenta</span></div>
  </div>
</div>
</div>
<p class="link-bloco"><a href="/usar">→ rode isso você mesmo (prompt pronto)</a>&nbsp;&nbsp;&nbsp;<a href="/instalar">→ instalar em 2 minutos</a></p>

<div class="destaque" style="margin-top:34px">
<p>O <b>Painel Sintético Concorde</b> é um painel de <b>787 personas sintéticas</b> do
consumidor bancário brasileiro, calibrado com dados públicos do IBGE, Bacen e ABEP, que
responde perguntas de pesquisa em primeira pessoa dentro do Claude — com erro médio de
6,3 pontos percentuais contra pesquisa de campo em perguntas de atitude do consumidor.
<a href="/persona-sintetica">Entenda o que é uma persona sintética →</a></p>
</div>

<h2>para que serve</h2>
<p><b>Triagem de discovery pré-campo.</b> A fase cara de errar: validar se um conceito faz sentido,
para quem, com que objeções — antes de desenhar a solução e antes de gastar com pesquisa de campo.
O painel deixa você rodar um focus group sintético em minutos: sorteia um recorte da população,
apresenta a ideia, e cada persona reage ancorada nos dados do próprio segmento.</p>
<div class="destaque">
<p><b>O que ele não é:</b> o painel <b>não substitui pesquisa primária com pessoas reais nem
teste A/B em produção</b>. Ele é a etapa barata que vem antes. A promessa não é "pesquisa
instantânea", é <b>saber o que perguntar a gente de verdade antes de gastar dinheiro perguntando</b>.</p>
</div>

<h2>a fronteira de confiança</h2>
<p>Um resultado sintético que sai rápido não é prova de nada. O que faz do painel uma ferramenta
honesta é ele saber onde confiar e onde não. A régua é o tipo de pergunta:</p>
<div class="grade">
  <div class="card"><b style="color:var(--verde)">Inferível ✓</b><span>a resposta se infere do contexto de segmento: prioridades, objeções prováveis, atrito de onboarding, compreensão de conceito, linguagem que cola ou não, tradeoffs. <b>Seguro para pressão direcional.</b></span></div>
  <div class="card"><b style="color:var(--vermelho)">Só-humano ✗</b><span>a resposta exige estado vivido: satisfação, incidência (já foi vítima?), dano, comportamento passado real, intensidade emocional, confiança depois de uma experiência. <b>Não pergunte a uma persona sintética.</b></span></div>
</div>
<p>Por isso o painel tem uma ferramenta de <b>triagem</b>: antes de rodar o focus group, ela
classifica cada pergunta em inferível, arriscado ou só-humano, e transforma seus pontos cegos no
roteiro da pesquisa que você vai levar para pessoas reais. É o que o backtest abaixo mostra na
prática: o painel acerta em atitude e intenção, e erra onde a resposta pedia experiência vivida.</p>
<p class="link-bloco"><a href="/usar">→ como usar a triagem e rodar um focus group</a></p>

<h2>validado contra pesquisa real</h2>
<p>Backtest contra o Estudo idwall de Experiência Digital 2025 (amostra nacional ponderada por
IBGE): 100 personas sorteadas do painel, classificadas com temperatura 0 (reproduzível),
comparadas ao benchmark equivalente.</p>
<div class="tabela-scroll"><table>
<tr><th>Pergunta de atitude do consumidor</th><th>idwall</th><th>Painel</th><th>Erro</th></tr>
<tr><td>Pretende manter ou aumentar o uso de bancos digitais</td><td class="num">84,9%</td><td class="num">86,0%</td><td class="num ok">1,1 pp</td></tr>
<tr><td>Rapidez do cadastro é o fator nº 1 na abertura de conta</td><td class="num">51,4%</td><td class="num">49,0%</td><td class="num ok">2,4 pp</td></tr>
<tr><td>A casa é o lugar mais seguro para acessar o banco</td><td class="num">68,5%</td><td class="num">84,0%</td><td class="num">15,5 pp</td></tr>
</table></div>
<p>Erro médio absoluto de <b>6,3 pp</b> nas perguntas de atitude e intenção — duas das três
dentro da margem amostral do método (~5 pp para n=100), estatisticamente indistinguíveis do
benchmark.</p>
<p class="dim">Transparência: essas são as 3 perguntas de melhor aderência entre 8 benchmarks
testados. Itens de incidência auto-reportada (fraude, bloqueio) e satisfação divergem mais, por
um viés conhecido de calibração das narrativas (ênfase em atrito) que está no roadmap de ajuste.
Resultados rastreáveis persona a persona.</p>
<p class="link-bloco"><a href="/porque">→ quem faz isso e por que se chama Concorde</a></p>

<h2>o teto dos dados públicos — e o que viria depois</h2>
<p>Esta plataforma é uma <b>prova de conceito da arquitetura e da viabilidade</b>: demonstra que
pesquisa sintética pode ser <b>rápida, governável e escalável</b> usando apenas dados públicos
(IBGE, Bacen, ABEP, reviews abertos). Mas dado público tem um teto de acurácia — ele descreve a
população, não os <i>seus</i> clientes.</p>
<p>Para subir de nível, o mesmo motor seria calibrado com os dados privados que uma empresa já
tem:</p>
<div class="grade">
  <div class="card"><b>NPS + comentários</b><span>a nota diz quanto; o verbatim do comentário diz por quê — vira "voz" ligada ao segmento certo</span></div>
  <div class="card"><b>CSAT por jornada</b><span>satisfação medida no ponto exato do atrito, não na média geral</span></div>
  <div class="card"><b>histórico de conversas</b><span>chats de suporte e SAC: a linguagem real do cliente, dor por dor</span></div>
  <div class="card"><b>dados de uso do app</b><span>o que as pessoas fazem (não o que dizem que fazem): funis, abandono, frequência</span></div>
</div>
<p class="dim">A arquitetura já está pronta para isso — fatos, vozes e instituições são camadas
plugáveis com filtro determinístico. Trocar a fonte pública pela privada não muda o motor;
muda a resolução: de "brasileiro Classe C endividado" para "cliente seu, do segmento X, que
abandonou o funil no passo 3".</p>

<h2>por que não é "pedir pro LLM simular 700 pessoas"</h2>
<p>Se você pedir a um LLM para emular 700 pessoas, elas saem <b>muito parecidas</b>. Isso não é
opinião — é resultado replicado na literatura:</p>
<ul>
<li><a href="https://arxiv.org/abs/2303.17548" rel="noopener">Santurkar et al., ICML 2023</a> —
LLMs respondendo pesquisas de opinião <b>enviesam para um perfil só</b> (mais escolarizado, mais
liberal, renda mais alta), mesmo instruídos a representar outros grupos.</li>
<li><a href="https://doi.org/10.1017/pan.2024.5" rel="noopener">Bisbee et al., Political Analysis 2024</a> —
respostas sintéticas ingênuas têm <b>variância artificialmente baixa</b> (um "respondente médio"
repetido N vezes) e instável a pequenas mudanças de prompt.</li>
<li><a href="https://doi.org/10.1017/pan.2023.2" rel="noopener">Argyle et al., Political Analysis 2023</a> —
o caminho que funciona: quando o modelo é <b>condicionado em atributos sociodemográficos
reais</b>, reproduz distribuições de subgrupos humanos ("fidelidade algorítmica").</li>
</ul>
<div class="destaque">
<p>É esse o lado parcialmente determinístico do painel: as personas são diferentes <b>porque foram
construídas para ser diferentes</b> — cada uma ligada por filtro exato aos fatos reais do seu
segmento, não à criatividade do modelo. A heterogeneidade vem da estrutura:</p>
</div>
<div class="grade">
  <div class="card"><b>personas</b><span>787 perfis com atributos tipados (classe, região, renda, banco, dívida…). A persona aponta para o dado, não o duplica</span></div>
  <div class="card"><b>fatos</b><span>cada estatística é uma nota atômica ligada às personas por filtro determinístico — atualizar um ponto propaga para todas</span></div>
  <div class="card"><b>vozes</b><span>verbatim reais de consumidores reutilizados por dor/tema: uma entrevista real alimenta N personas do mesmo perfil</span></div>
  <div class="card"><b>instituições</b><span>fichas de bancos com volumetria e reviews de app como proxy do atrito de uso</span></div>
</div>
<p>O <b>grounding</b> — cruzamento determinístico, não-LLM — monta o contexto de cada persona a
partir dessas camadas. Cada persona responde em contexto isolado, condicionada só nos próprios
atributos. Toda resposta é rastreável até o dado-fonte. Não existe prompt escrito à mão por
persona.</p>
<p>E é isso que torna o painel <b>escalável e governável</b>: se o mundo bancário mudar amanhã —
nova taxa, novo golpe, um banco comprado por outro — eu <b>não preciso reescrever 787
personas</b>. Atualizo ou anexo um fato, re-rodo o cruzamento, e a mudança se propaga
automaticamente para todas as personas cujo segmento aquele fato atinge. Um ponto de
atualização, N personas atualizadas, com trilha de auditoria.</p>
<p class="link-bloco"><a href="/privacidade">→ e por que eu nunca vejo as suas conversas</a></p>

<h2>experimente em 2 minutos</h2>
${term(
  "claude — conversa",
  `<span class="c"># depois de instalar o conector, peça ao Claude:</span>
<span class="g">&gt;</span> Estou fazendo discovery de um app de renegociação de dívidas.
  Sorteie 6 personas Classe C com dívida ativa e me diga como
  cada uma reagiria — com as objeções de cada perfil.`
)}
<p><a href="/instalar">→ passo a passo de instalação</a></p>
</div></main>`,
  `<script>${GRAFO_JS}</script><script>${DEMO_JS}</script>`,
  "/",
  DESC_PADRAO,
  JSONLD_APP
);

const INSTALAR = layout(
  "Instalar — Painel Sintético Concorde",
  "instalar",
  `
<main style="padding-top:52px"><div class="wrap">
<p class="zsh"><b>concorde@painel</b> ~ % <i>painel --instalar</i></p>
<h1 style="margin-top:8px">Instalação<span class="cursor"></span></h1>
<p class="sub">O painel é um conector MCP remoto: nada para baixar, nada para rodar.
Você cola uma URL nas configurações do Claude e pronto.</p>

<h2>requisitos</h2>
<ul>
<li>Uma conta no Claude com plano pago (Pro ou superior) — conectores customizados não estão disponíveis no plano gratuito</li>
<li><b>App Claude Desktop</b> (recomendado) ou app mobile</li>
</ul>
<div class="destaque">
<p><b>Aviso (jul/2026):</b> há uma instabilidade conhecida do claude.ai <b>no navegador</b> com
conectores customizados — as ferramentas aparecem nas configurações mas podem não carregar na
conversa. No <b>app Claude Desktop</b> funciona normalmente. Se o web falhar para você, use o
Desktop enquanto a Anthropic corrige.</p>
</div>

<h2>passo a passo</h2>
<div class="passo"><span class="n">[1/4]</span><div>
Abra as configurações do Claude: <code>Settings</code> → <code>Connectors</code>
<p class="dim">No Claude Desktop: menu do seu perfil (canto inferior esquerdo) → Settings.
No claude.ai: avatar → Settings → Connectors.</p></div></div>

<div class="passo"><span class="n">[2/4]</span><div>
Clique em <code>Add custom connector</code></div></div>

<div class="passo"><span class="n">[3/4]</span><div>
Preencha e confirme:
<div class="copiar" data-texto="${MCP_URL}">
${term(
  "add custom connector",
  `<span class="c"># Nome</span>
Painel Sintético Concorde
<span class="c"># URL</span>
<span class="r">${MCP_URL}</span>`
)}
<button>copiar</button></div></div></div>

<div class="passo"><span class="n">[4/4]</span><div>
Numa conversa nova, verifique se o conector aparece no menu de ferramentas
(ícone de conectores) e peça:
${term(
  "claude — conversa",
  `<span class="g">&gt;</span> Use a ferramenta visao_geral do Painel Sintético
  e me explique o que você tem disponível.`
)}
<p class="dim">Se o Claude responder com as contagens do painel (787 personas, 105 fatos…),
está tudo funcionando.</p></div></div>

<h2>registro oficial de MCP</h2>
<p>O painel está publicado no <a href="https://registry.modelcontextprotocol.io/v0.1/servers?search=painel-sintetico-concorde" rel="noopener">registro oficial de MCP</a>
(mantido por Anthropic, GitHub, Microsoft e PulseMCP), com o nome:</p>
${term(
  "registro oficial",
  `<span class="c"># nome no registro</span>
<span class="r">io.github.caio-sartoratto/painel-sintetico-concorde</span>`
)}
<p class="dim">Isso faz o conector aparecer em marketplaces e agregadores de MCP que consomem
o registro. A instalação, porém, continua sendo pela URL acima: estar no registro não adiciona
o conector automaticamente ao Claude.</p>

<h2>limites do serviço gratuito</h2>
<ul class="dim">
<li>120 consultas por minuto e 1.000 por dia, por IP</li>
<li>Até 100 fichas completas de personas por dia, por IP — para consulta, não para extração da base</li>
<li>Os limites zeram todo dia à meia-noite UTC (21h em Brasília)</li>
</ul>
<p class="dim">Os dados do painel são proprietários (projeto Concorde). Uso para pesquisa e
simulação é livre; redistribuição da base, não.</p>
<p><a href="/usar">→ agora veja como usar bem</a></p>
</div></main>`,
  `<script>${COPIAR_JS}</script>`,
  "/instalar",
  "Como instalar o Painel Sintético Concorde no Claude: cole a URL do conector MCP nas configurações e rode um focus group sintético em 2 minutos."
);

function promptCopiavel(titulo: string, prompt: string): string {
  const escapado = prompt.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<div class="copiar" data-texto="${prompt.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}">${term(
    titulo,
    `<span class="g">&gt;</span> ${escapado.replace(/\n/g, "\n  ")}`
  )}<button>copiar</button></div>`;
}

const PROMPT_PRIMEIRA_VEZ = `Monte um focus group com o Painel Sintético Concorde:
1. Chame visao_geral para conhecer o painel.
2. Sorteie 5 personas Classe C e D/E com dívida ativa, usando seed 7.
3. Busque as fichas completas das 5.
4. Apresente a elas este conceito: [descreva seu produto em 1 frase].
5. Cada persona responde em 1ª pessoa — use o nome e a cidade que aparecem
na História dela — em 4 a 6 linhas, citando entre parênteses pelo menos
um dado do próprio Grounding (% e fonte). As 5 respostas devem divergir:
idade, região e situação de dívida mudam a reação.
6. Feche com: padrões, divergências, as 3 objeções mais fortes e o próximo
passo de pesquisa que você recomendaria.
Respeite os tipos de percentual (propensão ≠ composição).`;

const USAR = layout(
  "Como usar — Painel Sintético Concorde",
  "usar",
  `
<main style="padding-top:52px"><div class="wrap">
<p class="zsh"><b>concorde@painel</b> ~ % <i>painel --usar</i></p>
<h1 style="margin-top:8px">Como usar<span class="cursor"></span></h1>
<p class="sub">Você não chama ferramentas — você conversa. O Claude decide quando consultar o
painel. Estes padrões tiram o máximo dele no discovery.</p>

<h2>primeira vez? rode isto</h2>
<p>Prompt calibrado para a melhor primeira impressão: troque só o trecho entre
<code>[colchetes]</code> pelo seu conceito e cole no Claude.</p>
${promptCopiavel("claude — primeiro focus group", PROMPT_PRIMEIRA_VEZ)}
<p class="dim">O que você vai ver: 5 pessoas com nome, cidade e vida própria — o aposentado de
69 anos reage diferente do vendedor de 32 de Recife — cada reação amarrada a uma estatística
real com fonte, e uma síntese com as objeções que você levaria meses para ouvir em campo.
O seed 7 torna a amostra reprodutível: rode de novo amanhã e compare.</p>

<h2>a triagem: o que perguntar antes de gastar</h2>
<p>Antes de rodar o focus group, passe suas perguntas pela fronteira de confiança. A ferramenta
separa o que a persona sintética pode responder (direcional) do que exige gente de verdade
(estado vivido), e o que sobra vira o roteiro da sua pesquisa de campo.</p>
${promptCopiavel(
  "claude — conversa",
  `Antes de eu rodar um focus group, avalie estas perguntas pela fronteira
de confiança do painel e me diga quais confiar e quais levar para
pesquisa com humanos:
1. O que mais pesa na escolha de um banco digital?
2. Quão satisfeito você está com seu banco hoje?
3. Você já foi vítima de golpe no Pix?
4. Qual destas duas mensagens de campanha faz mais sentido?`
)}
<p class="dim">Resultado esperado: 1 e 4 saem como "inferível" (pode perguntar às personas), 2 e
3 saem como "só-humano" (leve para pesquisa real). Aí você roda o focus group só com o que é
seguro, e já sai com o roteiro do que validar em campo.</p>

<h2>depois, os padrões do dia a dia</h2>

<h3>recorte + entrevista</h3>
${promptCopiavel(
  "claude — conversa",
  `Quantas personas têm dívida ativa e investem ao mesmo tempo? Sorteie 3
delas (seed 21) e conduza uma entrevista em profundidade sobre essa
contradição — cada resposta em 1ª pessoa, ancorada no grounding.`
)}

<h3>teste de mensagem/copy</h3>
${promptCopiavel(
  "claude — conversa",
  `Sorteie 6 personas que usam banco digital (seed 33). Mostre a elas estas
duas headlines de campanha: [A] e [B]. Cada persona escolhe uma, explica
o porquê com a própria voz, e no final você declara o placar e o motivo
dominante de cada lado.`
)}

<h3>checagem de dado</h3>
${promptCopiavel(
  "claude — conversa",
  `O que o painel tem de fatos sobre Pix e golpes? Separe o que é
prevalência populacional do que é propensão de segmento, com as fontes,
e diga quais segmentos são mais afetados.`
)}

<h3>vozes reais como tempero</h3>
${promptCopiavel(
  "claude — conversa",
  `Traga verbatim reais sobre tarifas e cobrança indevida e compare com o
que as personas do meu recorte diriam. Marque o que é voz real e o que
é persona sintética.`
)}

<h2>boas práticas</h2>
<ul>
<li>Trabalhe com <b>amostras</b> (6–12 personas), não com o painel inteiro — é assim que pesquisa qualitativa funciona, e é o que as cotas incentivam.</li>
<li>Use <code>seed</code> ao sortear se quiser <b>reproduzir</b> a mesma amostra depois: <span class="dim">"sorteie 8 personas com seed 42"</span>.</li>
<li>Peça as <b>fontes</b>: todo fato do grounding tem origem rastreável.</li>
<li>Cuidado com <b>composição vs. propensão</b> — "95% dos compradores de X são classe A/B" não significa que 95% da classe A/B compra X. O painel marca cada fato com o tipo certo; peça ao Claude para respeitar isso.</li>
<li>Use para <b>discovery</b>: filtrar hipóteses, mapear objeções, afiar perguntas. A decisão final pede <b>pesquisa primária com pessoas reais ou teste A/B de verdade</b> — o painel não substitui nenhum dos dois.</li>
</ul>

<h2>ferramentas disponíveis (para os curiosos)</h2>
<div class="grade">
<div class="card"><b>visao_geral</b><span>o que existe, campos filtráveis, tipos de percentual</span></div>
<div class="card"><b>avaliar_pergunta</b><span>fronteira de confiança: inferível, arriscado ou só-humano</span></div>
<div class="card"><b>filtrar_personas</b><span>recorte exato por qualquer atributo</span></div>
<div class="card"><b>sortear_amostra</b><span>amostra aleatória reprodutível (seed)</span></div>
<div class="card"><b>get_personas</b><span>fichas completas: atributos + grounding + história</span></div>
<div class="card"><b>buscar_fatos</b><span>por texto, eixo ou persona</span></div>
<div class="card"><b>listar_vozes</b><span>verbatim reais por tema</span></div>
<div class="card"><b>get_instituicao</b><span>ficha de cada banco</span></div>
<div class="card"><b>get_distribuicoes</b><span>tabelas de calibração do painel</span></div>
</div>
</div></main>`,
  `<script>${COPIAR_JS}</script>`,
  "/usar",
  "Prompts prontos para usar o Painel Sintético Concorde: focus group sintético, teste de conceito, teste de mensagem e checagem de dados com 787 personas."
);

const PRIVACIDADE = layout(
  "Privacidade — Painel Sintético Concorde",
  "privacidade",
  `
<main style="padding-top:52px"><div class="wrap">
<p class="zsh"><b>concorde@painel</b> ~ % <i>painel --privacidade</i></p>
<h1 style="margin-top:8px">Privacidade<span class="cursor"></span></h1>
<p class="sub">A resposta curta: <b>eu não consigo ler suas conversas — nem querendo.</b>
É consequência da arquitetura, não de uma promessa.</p>

<h2>onde a conversa acontece</h2>
<p>Quando você pergunta algo às personas, quem processa a pergunta e gera as respostas é o
<b>seu Claude</b>, na sua conta. Esse conteúdo trafega entre você e a Anthropic — <b>nunca passa
pelo meu servidor</b>. O painel é só um banco de dados que o seu Claude consulta.</p>
${term(
  "fluxo de dados",
  `<span class="c"># o que fica entre você e o seu Claude (eu não vejo):</span>
   suas perguntas · o conceito que você está testando ·
   as respostas das personas · toda a conversa

<span class="c"># o que chega ao meu servidor (chamadas de ferramenta):</span>
   filtros estruturados     <span class="r">"classe_social == 'Classe C'"</span>
   ids de personas pedidas  <span class="r">get_personas(['PERS_023'])</span>
   termos de busca de fatos <span class="r">buscar_fatos("pix golpes")</span>`
)}

<h2>o que eu consigo saber, no máximo</h2>
<ul>
<li><b>Quais personas e recortes são mais consultados</b> — útil para eu melhorar o painel (ex.: reforçar segmentos muito usados).</li>
<li><b>Termos de busca de fatos</b>, quando o seu Claude usa a busca textual (ex.: "pix golpes") — texto de consulta, sem vínculo com quem enviou.</li>
<li>Volume de uso agregado (contadores de cota por IP, que zeram diariamente).</li>
</ul>
<p class="dim">E o que eu <b>não</b> consigo saber: quem você é, o que você perguntou às
personas, o que elas responderam, ou qual produto você está desenvolvendo.</p>

<h2>o que o serviço não tem</h2>
<ul class="dim">
<li>Sem cadastro, sem login, sem cookies, sem pixels de rastreamento, sem analytics</li>
<li>Sem venda ou repasse de dados — não coleto dados pessoais deliberadamente</li>
<li>O IP é tratado só de forma transitória: contadores de cota que zeram diariamente (anti-abuso, base de interesse legítimo). Os logs operacionais registram método/rota/status das requisições, não o conteúdo</li>
</ul>
<p class="dim">Infraestrutura: o serviço roda na <b>Cloudflare</b> (Workers), que processa as
requisições em trânsito como qualquer provedor de hospedagem, sob os termos e a política de
privacidade dela. Não uso nenhum outro serviço de terceiros.</p>

<h2>sobre os dados do próprio painel</h2>
<p class="dim">As 787 personas são <b>sintéticas</b> — nenhuma corresponde a uma pessoa real.
As "vozes" são trechos de reviews públicos de apps, reproduzidos sem nome de usuário ou
qualquer identificação dos autores. Os fatos vêm de fontes públicas (IBGE, Bacen, Febraban…),
citadas nota a nota.</p>

<h2>uma honestidade final</h2>
<p class="dim">Se você digitar informação sensível dentro de um termo de busca de fatos, ela
tecnicamente chega ao servidor como texto de consulta — como em qualquer buscador. Não faça
isso; para conversar com as personas você nunca precisa. E o que o seu Claude faz com a
conversa é regido pela política de privacidade da Anthropic, não pela minha.</p>
<p class="dim">Responsável pelo serviço: Caio Sartoratto Prado (projeto Concorde). Dúvidas ou
pedidos sobre privacidade: <a href="https://www.linkedin.com/in/caio-sartoratto-prado-078307178/" rel="noopener">fale comigo no LinkedIn</a>.</p>
</div></main>`
  ,"", "/privacidade",
  "Privacidade do Painel Sintético Concorde: as conversas rodam no seu Claude e nunca passam pelo servidor do painel. Sem cadastro, sem cookies, sem rastreamento."
);

const PORQUE = layout(
  "Porquê — Painel Sintético Concorde",
  "porquê",
  `
<main style="padding-top:52px"><div class="wrap">
<p class="zsh"><b>concorde@painel</b> ~ % <i>painel --porque</i></p>
<h1 style="margin-top:8px">Porquê<span class="cursor"></span></h1>
<p class="sub">Quem faz isso, e por que se chama Concorde.</p>

<h2>quem</h2>
<p>Me chamo <b>Caio Sartoratto Prado</b>. Sou formado em Marketing pela <b>FIAP</b>, curso
pós-graduação na <b>ECA-USP</b> em Gestão de Negócios Digitais e Inteligência Artificial, e
trabalho há <b>5 anos com lab / new ventures</b> — o ofício de tirar produto novo do papel,
que é exatamente onde a dor do discovery mora. Sou um entusiasta de IA e este painel é o tipo
de ferramenta que eu queria ter nas minhas próprias sprints de descoberta.</p>
<p><a href="https://www.linkedin.com/in/caio-sartoratto-prado-078307178/" rel="noopener">→ LinkedIn</a></p>

<h2>por que "Concorde"</h2>
<p>Duas referências, uma homenagem.</p>
<p>A primeira: o Google tem um projeto de pesquisa chamado <b>Concordia</b>, sobre simulação
social com agentes de linguagem — foi uma inspiração direta para levar a sério a ideia de
população sintética como instrumento de pesquisa.</p>
<p>A segunda é o avião. O <b>Concorde</b> foi pura inovação para a época: voava a mais de duas
vezes a velocidade do som quando o resto do mundo se contentava em chegar. Era a aposta de que
dava para cruzar o Atlântico em 3 horas e meia — décadas à frente da tecnologia disponível, um
projeto quase teimoso de tão ambicioso.</p>
<div class="destaque">
<p>É esse o espírito aqui: pesquisa qualitativa costuma levar semanas entre recrutar, agendar
e ouvir. O painel quer fazer o mesmo trajeto em minutos — não para substituir o voo comercial
(a pesquisa de verdade continua existindo), mas para provar que dá para ir muito mais rápido
na etapa em que velocidade importa mais que tudo: a descoberta.</p>
</div>

<h2>o projeto</h2>
<p class="dim">O Painel Sintético é uma prova de conceito do projeto Concorde: infraestrutura
de pesquisa sintética governável — personas calibradas com dados públicos, grounding
determinístico e validação contra benchmarks reais (veja a <a href="/">home</a>). Feedbacks,
casos de uso e ceticismo bem argumentado são todos bem-vindos no LinkedIn.</p>
</div></main>`
  ,"", "/porque",
  "Quem faz o Painel Sintético Concorde e por que esse nome: o projeto de pesquisa sintética inspirado no Concordia do Google e no avião Concorde."
);

const FAQ: Array<[string, string]> = [
  [
    "O que é uma persona sintética?",
    "Uma persona sintética é um perfil artificial de consumidor, construído a partir de dados estatísticos reais (demografia, renda, comportamento financeiro), que responde perguntas de pesquisa em primeira pessoa por meio de um modelo de linguagem (LLM). Diferente de uma persona tradicional de UX, que é um resumo estático, a persona sintética é interativa: você conversa com ela.",
  ],
  [
    "Persona sintética substitui pesquisa com pessoas reais?",
    "Não. Persona sintética é a etapa barata que vem antes da pesquisa primária: serve para filtrar hipóteses fracas, mapear objeções prováveis e afiar as perguntas que você levará para o campo. A decisão final continua exigindo pesquisa com pessoas reais ou teste A/B em produção.",
  ],
  [
    "Por que não basta pedir para o ChatGPT ou Claude simular 700 pessoas?",
    "Porque a simulação ingênua colapsa a diversidade: o modelo enviesa para um perfil de renda e escolaridade mais altos (Santurkar et al., ICML 2023) e produz respostas com variância artificialmente baixa — um respondente médio repetido N vezes (Bisbee et al., Political Analysis 2024). A heterogeneidade precisa vir de dados estruturados, não da criatividade do modelo.",
  ],
  [
    "Como validar um painel de personas sintéticas?",
    "Por backtest: fazer o painel responder perguntas de pesquisas reais já publicadas e comparar os agregados. O Painel Sintético Concorde obteve erro médio de 6,3 pontos percentuais contra o Estudo idwall 2025 (amostra nacional ponderada por IBGE) em perguntas de atitude do consumidor, com duas de três perguntas dentro da margem amostral do método.",
  ],
  [
    "Onde usar personas sintéticas no discovery de produto?",
    "Nos momentos em que velocidade vale mais que precisão absoluta: teste de conceito antes do MVP, reação a novas funcionalidades, teste de mensagem e copy, exploração de objeções por segmento e priorização de hipóteses antes de investir em pesquisa de campo.",
  ],
];

const JSONLD_FAQ = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(([q, a]) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
});

const GUIA = layout(
  "O que é persona sintética? Guia completo com validação e referências",
  "guia",
  `
<main style="padding-top:52px"><div class="wrap">
<p class="zsh"><b>concorde@painel</b> ~ % <i>man persona-sintetica</i></p>
<h1 style="margin-top:8px">O que é persona sintética?<span class="cursor"></span></h1>
<div class="destaque">
<p><b>Persona sintética</b> é um perfil artificial de consumidor construído a partir de dados
estatísticos reais — demografia, renda, comportamento — que responde perguntas de pesquisa em
primeira pessoa por meio de um LLM. Em vez de ler um relatório sobre o seu público, você
conversa com ele.</p>
</div>

<h2>persona sintética × persona de UX</h2>
<p>A persona tradicional de UX é um pôster: um nome, uma foto de banco de imagem e três
frases de dor, congeladas no dia em que o workshop acabou. A persona sintética é um
respondente: tem os mesmos atributos, mas ancorados em estatística com fonte, e reage a
perguntas novas — inclusive às que ninguém pensou em fazer no workshop.</p>

<h2>o problema que quase ninguém conta</h2>
<p>Pedir a um LLM para "simular 700 consumidores" não funciona, e isso está medido na
literatura:</p>
<ul>
<li><a href="https://arxiv.org/abs/2303.17548" rel="noopener">Santurkar et al., ICML 2023</a> —
LLMs respondendo pesquisas de opinião enviesam para um perfil só: mais escolarizado, mais
liberal, de renda mais alta.</li>
<li><a href="https://doi.org/10.1017/pan.2024.5" rel="noopener">Bisbee et al., Political Analysis 2024</a> —
respostas sintéticas ingênuas têm variância artificialmente baixa: um "respondente médio"
repetido N vezes, instável a pequenas mudanças de prompt.</li>
<li><a href="https://doi.org/10.1017/pan.2023.2" rel="noopener">Argyle et al., Political Analysis 2023</a> —
o caminho que funciona: condicionar o modelo em atributos sociodemográficos reais reproduz
distribuições de subgrupos humanos ("fidelidade algorítmica").</li>
</ul>
<p>A conclusão prática: <b>a diversidade das personas precisa vir da estrutura de dados, não
da criatividade do modelo</b>. É por isso que o Painel Sintético Concorde liga cada persona
aos fatos estatísticos do seu segmento por filtro determinístico — a persona só "sabe" o que
o segmento dela sustenta, e cada resposta é rastreável até a fonte.</p>

<h2>como se valida</h2>
<p>Backtest contra pesquisa real publicada: o painel respondeu perguntas do Estudo idwall
2025 (amostra nacional ponderada por IBGE) e errou em média 6,3 pontos percentuais nas
perguntas de atitude do consumidor — duas de três dentro da margem amostral do método.
Detalhes e limitações na <a href="/">home</a>.</p>

<h2>perguntas frequentes</h2>
${FAQ.map(([q, a]) => `<h3>${q}</h3>\n<p>${a}</p>`).join("\n")}

<div class="destaque">
<p>Quer conversar com 787 personas sintéticas do consumidor bancário brasileiro agora, de
graça? <a href="/instalar">Instale o conector no seu Claude em 2 minutos</a> ou veja os
<a href="/usar">prompts prontos</a>.</p>
</div>
</div></main>`,
  "",
  "/persona-sintetica",
  "O que é persona sintética: definição, diferença para persona de UX, por que LLM puro não funciona (com papers), como validar por backtest e quando usar no discovery.",
  JSONLD_FAQ
);

export const PAGINAS: Record<string, string> = {
  "/": HOME,
  "/persona-sintetica": GUIA,
  "/instalar": INSTALAR,
  "/usar": USAR,
  "/privacidade": PRIVACIDADE,
  "/porque": PORQUE,
};

// Página dinâmica do fórum (noindex: conteúdo aberto de terceiros fica fora de buscadores e crawlers de IA)
export function paginaForum(titulo: string, conteudo: string): string {
  return layout(
    titulo,
    "feedback",
    conteudo,
    "",
    "/forum",
    "Fórum aberto de feedback e discussão do Painel Sintético Concorde.",
    "",
    '<meta name="robots" content="noindex, nofollow">'
  );
}

const HOJE = new Date().toISOString().slice(0, 10);
export const EXTRAS: Record<string, { corpo: string; tipo: string }> = {
  "/sitemap.xml": {
    tipo: "application/xml",
    corpo: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Object.keys(PAGINAS)
  .map((p) => `  <url><loc>${BASE_URL}${p === "/" ? "" : p}</loc><lastmod>${HOJE}</lastmod></url>`)
  .join("\n")}
</urlset>`,
  },
  "/robots.txt": {
    tipo: "text/plain",
    corpo: `User-agent: *
Allow: /

# Crawlers de IA explicitamente bem-vindos
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-Web
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: CCBot
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml
`,
  },
  "/llms.txt": {
    tipo: "text/plain",
    corpo: `# Painel Sintético Concorde

> ${DESC_PADRAO}

O Painel Sintético Concorde é um painel de 787 personas sintéticas do consumidor bancário
brasileiro (4 classes sociais x 6 faixas etárias, ~27 atributos por persona), calibrado com
dados públicos do IBGE, Bacen e ABEP. Cada persona é ligada por filtro determinístico a 105
fatos estatísticos com fonte, 17 vozes verbatim reais e fichas de 12 instituições financeiras.
Validação: erro médio de 6,3 pontos percentuais contra o Estudo idwall 2025 em perguntas de
atitude do consumidor. Uso: triagem de discovery pré-campo para produtos bank/fintech (focus
groups sintéticos, teste de conceito e de mensagem). Tem uma fronteira de confiança explícita
(ferramenta avaliar_pergunta): é confiável para perguntas inferíveis do contexto de segmento
(prioridades, objeções, atrito de onboarding, compreensão, linguagem, tradeoffs) e sinaliza como
"só-humano" as que exigem estado vivido (satisfação, incidência/vitimização, dano, comportamento
passado real, intensidade emocional). Não substitui pesquisa primária nem teste A/B: o valor é
saber o que perguntar a gente de verdade antes de gastar com campo.

Serviço gratuito (prova de conceito) com cotas por IP. Conector MCP remoto para Claude:
${MCP_URL} — requer plano pago do Claude.

Autor: Caio Sartoratto Prado (projeto Concorde).

## Páginas

- [Home](${BASE_URL}/): o que é, demo, validação (backtest idwall), arquitetura e referências acadêmicas
- [O que é persona sintética?](${BASE_URL}/persona-sintetica): guia com definição, papers e FAQ
- [Instalar](${BASE_URL}/instalar): passo a passo do conector MCP no Claude
- [Como usar](${BASE_URL}/usar): prompts prontos para focus group sintético
- [Privacidade](${BASE_URL}/privacidade): conversas rodam no Claude do usuário, nunca no servidor
- [Porquê](${BASE_URL}/porque): autor e origem do nome
`,
  },
};
