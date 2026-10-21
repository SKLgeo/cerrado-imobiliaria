// Prévias do WhatsApp (link do cliente em hospedagem sem servidor, ex.: GitHub Pages): uma página fixa por imóvel em
// i/<código>.html com título, preço e a 1ª foto (i/<código>.jpg, 1200x630). O WhatsApp lê essas tags do HTML; a página
// leva para imovel.html com o token do link. Imóvel sem página cai no 404.html e abre igual, só sem a foto na prévia.
//
// Roda em dois lugares, com o mesmo código:
//  - no gerar.js (publicação do link): node previas.mjs <pasta do site> <config.json>
//  - sozinho no GitHub (.github/workflows/previas.yml, a cada 15 min): refaz só o que mudou — imóvel novo, 1ª foto trocada,
//    título/preço mudados — e apaga a página de quem saiu da vitrine. Assim o cliente não depende de ninguém.
// config: { nome, link, feed, token }. Sem segredo: o token é o mesmo que já vai em todo link enviado ao cliente.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const [ , , pastaSite, arqConfig ] = process.argv;
const cfg = JSON.parse(fs.readFileSync(arqConfig, "utf8"));
const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_PATH || "sharp");

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const dinheiro = (v) => "R$ " + Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const pasta = path.join(pastaSite, "i");
const arqIndice = path.join(pasta, "_indice.json");

const r = await fetch(`${cfg.feed}?t=${encodeURIComponent(cfg.token)}`);
const d = await r.json();
if (!d || !d.ok) { console.error("prévias: o feed recusou o token (" + ((d && d.erro) || r.status) + ")"); process.exit(1); }
fs.mkdirSync(pasta, { recursive: true });
const indice = fs.existsSync(arqIndice) ? JSON.parse(fs.readFileSync(arqIndice, "utf8")) : {};
const novo = {};
const lista = (d.imoveis || []).filter((i) => i.codigo && /^[A-Za-z0-9_-]+$/.test(i.codigo));
let feitas = 0, comFoto = 0;

function pagina(i, img, desc) {
  const imagem = img ? `${cfg.link}i/${i.codigo}.jpg?v=${img}` : `${cfg.link}assets/icons/icon-512.png`;
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${esc(i.titulo)} — ${esc(cfg.nome)}</title>
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${esc(cfg.nome)}" />
<meta property="og:title" content="${esc(i.titulo)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:image" content="${esc(imagem)}" />${img ? `
<meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />` : ""}
<meta property="og:url" content="${esc(cfg.link)}i/${i.codigo}.html" />
<meta name="twitter:card" content="summary_large_image" />
<script>location.replace("../imovel.html" + (location.search ? location.search + "&" : "?") + "c=${i.codigo}");</script>
</head><body style="font-family:Arial,sans-serif;text-align:center;padding:40px"><p>Abrindo o imóvel…</p>
<p><a href="../imovel.html?c=${i.codigo}">Toque aqui se não abrir</a></p></body></html>
`;
}

for (let k = 0; k < lista.length; k += 6) {
  await Promise.all(lista.slice(k, k + 6).map(async (i) => {
    const foto = (i.fotos_url || [])[0] || "";
    const fotoChave = foto.split("?")[0];          // o link assinado muda a cada leitura; o caminho da foto não
    const e = i.endereco || {};
    const precos = [ i.valor_venda ? "Venda " + dinheiro(i.valor_venda) : "", i.valor_aluguel ? "Aluguel " + dinheiro(i.valor_aluguel) + "/mês" : "" ].filter(Boolean).join(" · ");
    const desc = [ [ e.bairro, e.cidade ].filter(Boolean).join(", "), precos ].filter(Boolean).join(" · ") || "Veja fotos e detalhes do imóvel.";
    const antes = indice[i.codigo] || {};
    const html = path.join(pasta, i.codigo + ".html"), jpg = path.join(pasta, i.codigo + ".jpg");
    let img = antes.foto === fotoChave && fs.existsSync(jpg) ? antes.img : null;
    if (foto && !img) {
      try {
        const b = Buffer.from(await (await fetch(foto)).arrayBuffer());
        await sharp(b).resize(1200, 630, { fit: "cover" }).jpeg({ quality: 70, mozjpeg: true }).toFile(jpg);
        img = Date.now().toString(36);              // muda o endereço da imagem quando a foto muda (o WhatsApp guarda a antiga)
      } catch (err) { console.warn("prévia sem foto:", i.codigo, err.message); }
    }
    if (!foto && fs.existsSync(jpg)) fs.rmSync(jpg);
    if (img) comFoto++;
    const texto = pagina(i, img, desc);
    if (!fs.existsSync(html) || fs.readFileSync(html, "utf8") !== texto) { fs.writeFileSync(html, texto); feitas++; }
    novo[i.codigo] = { foto: fotoChave, img };
  }));
}
// quem saiu da vitrine perde a página (o link cai no 404.html e mostra "não está mais disponível")
for (const c of Object.keys(indice)) if (!novo[c]) { fs.rmSync(path.join(pasta, c + ".html"), { force: true }); fs.rmSync(path.join(pasta, c + ".jpg"), { force: true }); feitas++; }
fs.writeFileSync(arqIndice, JSON.stringify(novo, null, 1) + "\n");
fs.writeFileSync(path.join(pastaSite, "404.html"), `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="robots" content="noindex" />
<title>${esc(cfg.nome)}</title>
<script>(function(){var p=location.pathname,k=p.lastIndexOf("/i/");if(k<0||p.slice(-5)!==".html")return;var c=p.slice(k+3,-5);if(c&&c.indexOf("/")<0)location.replace(p.slice(0,k+1)+"imovel.html"+(location.search?location.search+"&":"?")+"c="+encodeURIComponent(c));})();</script>
</head><body style="font-family:Arial,sans-serif;text-align:center;padding:40px"><p>Página não encontrada.</p><p><a href="${esc(cfg.link)}">Abrir ${esc(cfg.nome)}</a></p></body></html>
`);
console.log(`prévias do WhatsApp: ${lista.length} imóveis (${comFoto} com foto), ${feitas} página(s) nova(s) ou mudada(s)`);
