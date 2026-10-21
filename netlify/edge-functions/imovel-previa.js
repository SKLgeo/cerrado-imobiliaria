// Netlify Edge Function do link do cliente: prévia do "Enviar ao cliente" no WhatsApp com a FOTO e o nome do imóvel.
// O WhatsApp só lê as tags og:* do HTML que o servidor entrega (não roda JavaScript), por isso a troca é feita aqui:
// pega a página estática imovel.html, busca o imóvel no feed da imobiliária (mesmo token e código do link) e
// coloca título, descrição curta e a capa (1200x630, ~100 KB, link assinado do feed) nas tags.
// Sem segredo nenhum aqui: o feed é público com o token que já está no link. Se o feed falhar, sai a página como está.
const FEED = "https://xigwlofqkmiibzbongkn.supabase.co/functions/v1/imobiliaria-feed";

const esc = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const dinheiro = (v) => "R$ " + Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 });

export default async (request, context) => {
  const resposta = await context.next();
  const url = new URL(request.url);
  const token = url.searchParams.get("f") || "", codigo = url.searchParams.get("c") || "";
  if (!token || !codigo) return resposta;
  try {
    const r = await fetch(`${FEED}?t=${encodeURIComponent(token)}&codigo=${encodeURIComponent(codigo)}`);
    const d = await r.json();
    const i = d && d.ok && d.imoveis && d.imoveis[0];
    if (!i) return resposta;
    const e = i.endereco || {};
    const local = [ e.bairro, e.cidade ].filter(Boolean).join(", ");
    const precos = [ i.valor_venda ? "Venda " + dinheiro(i.valor_venda) : "", i.valor_aluguel ? "Aluguel " + dinheiro(i.valor_aluguel) + "/mês" : "" ].filter(Boolean).join(" · ");
    const titulo = `${i.titulo}${d.carteira && d.carteira.nome ? " — " + d.carteira.nome : ""}`;
    const descricao = [ local, precos ].filter(Boolean).join(" · ") || "Veja fotos e detalhes do imóvel.";
    const capa = i.capa_url || (i.fotos_url || [])[0];
    let html = await resposta.clone().text();
    const troca = (prop, valor) => { html = html.replace(new RegExp(`(<meta property="${prop}" content=")[^"]*(")`), (m, a, b) => a + esc(valor) + b); };
    troca("og:title", titulo);
    troca("og:description", descricao);
    if (capa) {
      troca("og:image", capa);
      html = html.replace(`<meta property="og:image"`, `<meta property="og:image:width" content="1200" />\n  <meta property="og:image:height" content="630" />\n  <meta property="og:image"`);
    }
    html = html.replace("<title>Imóvel</title>", `<title>${esc(titulo)}</title>`);
    const cab = new Headers(resposta.headers);
    cab.delete("content-length");
    cab.set("cache-control", "public, max-age=300");
    return new Response(html, { status: resposta.status, headers: cab });
  } catch (_) {
    return resposta;
  }
};

export const config = { path: "/imovel.html" };
