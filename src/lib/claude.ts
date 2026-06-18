import Anthropic from '@anthropic-ai/sdk'
import { PALETAS } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type SiteData = {
  nomeNegocio: string
  segmento: string
  cidade: string
  estado: string
  endereco: string
  cep: string
  corPaleta: string
  logoUrl?: string | null
  servicos: { nome: string; descricao?: string | null }[]
  servicoDestaque: string
  resultadoCliente: string
  dorPrincipal: string
  anosNoMercado: number
  totalClientes?: number | null
  totalClientesLabel?: string | null
  certificados?: string | null
  foto1Url?: string | null
  foto2Url?: string | null
  foto3Url?: string | null
  fotoProfissionalUrl?: string | null
  depoimentos: { imagemUrl: string }[]
  registros: { tipo: string; numero: string }[]
  whatsapp: string
  whatsappMensagem: string
  instagram?: string | null
  horarioAtendimento: string
  heroFotoUrl?: string | null
  headline?: string | null
  subheadline?: string | null
  ctaTexto?: string | null
  siteUrl?: string | null
}

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

function hslToHex(h: number, s: number, l: number): string {
  const hNorm = h / 360, sNorm = s / 100, lNorm = l / 100
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  let r, g, b
  if (s === 0) { r = g = b = lNorm } else {
    const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm
    const p = 2 * lNorm - q
    r = hue2rgb(p, q, hNorm + 1/3); g = hue2rgb(p, q, hNorm); b = hue2rgb(p, q, hNorm - 1/3)
  }
  return `#${Math.round(r * 255).toString(16).padStart(2, '0')}${Math.round(g * 255).toString(16).padStart(2, '0')}${Math.round(b * 255).toString(16).padStart(2, '0')}`
}

function getPaleta(corPaleta: string) {
  const preset = PALETAS.find((p) => p.id === corPaleta)
  if (preset) return preset

  // corPaleta is a raw hex color (from logo extraction)
  if (/^#[0-9a-fA-F]{6}$/.test(corPaleta)) {
    const [h, s, l] = hexToHsl(corPaleta)
    return {
      primary: hslToHex(h, s, Math.min(Math.max(l, 25), 45)),
      secondary: hslToHex(h, Math.max(s - 10, 40), Math.min(l + 20, 65)),
      light: hslToHex(h, Math.min(s, 40), 95),
      dark: hslToHex(h, s, Math.max(l - 20, 10)),
    }
  }

  return { primary: '#1E40AF', secondary: '#3B82F6', light: '#EFF6FF', dark: '#1E3A8A' }
}

// Extrai a cor de fundo real da logo (servidor) para a barra do header bater exatamente.
// Mesmo algoritmo do extrator do formulário, mas usado em RAW (sem clarear).
async function extractLogoColor(logoUrl: string): Promise<string | null> {
  try {
    const sharp = (await import('sharp')).default
    const res = await fetch(logoUrl)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const size = 64
    const { data } = await sharp(buf).resize(size, size, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const colorMap: Record<string, number> = {}
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue // transparente
      const r = Math.round(data[i] / 32) * 32
      const g = Math.round(data[i + 1] / 32) * 32
      const b = Math.round(data[i + 2] / 32) * 32
      if (r > 220 && g > 220 && b > 220) continue // quase branco
      if (r < 30 && g < 30 && b < 30) continue     // quase preto
      const key = `${r},${g},${b}`
      colorMap[key] = (colorMap[key] || 0) + 1
    }
    const top = Object.entries(colorMap).sort((a, b) => b[1] - a[1])[0]
    if (!top) return null
    const [r, g, b] = top[0].split(',').map(Number)
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  } catch {
    return null
  }
}

export async function generateSiteHTML(data: SiteData): Promise<string> {
  const paleta = getPaleta(data.corPaleta)
  // Cor de fundo da barra do header = MESMO tom escuro usado no rodapé (paleta.dark),
  // que comprovadamente casa com a logo. Se a extração da cor real da logo funcionar,
  // usa a cor exata (ainda melhor). NUNCA usa a cor clareada (corPaleta).
  let headerBg = paleta.dark
  if (data.logoUrl) {
    const logoColor = await extractLogoColor(data.logoUrl)
    console.log(`[header] cor da logo extraída: ${logoColor ?? 'FALHOU (usando paleta.dark)'} | headerBg final: ${logoColor ?? headerBg}`)
    if (logoColor) headerBg = logoColor
  }

  const services = data.servicos
    .map((s) => `• ${s.nome}${s.descricao ? ` — DESCRIÇÃO EXATA (copie verbatim): "${s.descricao}"` : ''}`)
    .join('\n')

  const depoimentosImagens = data.depoimentos.map(d => d.imagemUrl)

  // Aceita 1 ou vários @ (ex: 2 profissionais), separados por vírgula/espaço/;
  const instagramHandles = (data.instagram ?? '')
    .split(/[,;\s]+/)
    .map(h => h.replace('@', '').trim())
    .filter(Boolean)

  const whatsappNum = data.whatsapp.replace(/\D/g, '')
  const whatsappLink = `https://wa.me/55${whatsappNum}?text=${encodeURIComponent(data.whatsappMensagem)}`

  const systemPrompt = `Você é um expert em criar sites de alta conversão para pequenos negócios locais brasileiros. Você domina HTML5, CSS3, design responsivo mobile-first e técnicas de copywriting para conversão.

REGRAS ABSOLUTAS DE CÓDIGO:
- Retorne APENAS o código HTML completo, começando com <!DOCTYPE html> e terminando com </html>
- Sem markdown, sem blocos de código (sem \`\`\`html), sem explicações
- CSS embutido em <style> dentro do <head>
- JavaScript mínimo inline em <script> no final do body se necessário
- Sem frameworks externos — apenas Google Fonts via @import no CSS
- CRÍTICO: Gere TODAS as seções antes de encerrar. Não pare no meio. O site deve estar 100% completo com </html> no final.
- Use CSS conciso com variáveis CSS (:root) para não desperdiçar tokens em repetição

PROIBIÇÕES ABSOLUTAS — NUNCA VIOLE ESTAS REGRAS:
1. HEADER COM LOGO: quando há uma logo, o header contém SOMENTE a logo e o menu. ZERO texto com nome da empresa. Nenhum <span>, <p>, <h1> ou qualquer elemento de texto com o nome do negócio ao lado ou perto da logo.
2. SEÇÃO HERO: contém SOMENTE headline, subheadline e botão CTA. ABSOLUTAMENTE PROIBIDO colocar no hero: badges, pills, chips, bullets, ícones de estatística, anos de experiência, número de clientes, cidade, estado, localização ou qualquer outro texto/elemento além da headline e subheadline. Esses dados vão EXCLUSIVAMENTE na seção "sobre".
3. Não invente conteúdo nem adicione elementos além dos especificados na estrutura obrigatória.`

  const userPrompt = `Gere um site completo e profissional de alta conversão para o seguinte negócio local:

NEGÓCIO:
- Nome: ${data.nomeNegocio}
- Segmento: ${data.segmento}
- Localização: ${data.endereco}, ${data.cidade} - ${data.estado}, CEP: ${data.cep}
- Serviço destaque: ${data.servicoDestaque}
- Resultado entregue ao cliente: ${data.resultadoCliente}

SERVIÇOS:
${services}

PÚBLICO E POSICIONAMENTO:
- Dor principal resolvida: ${data.dorPrincipal}

CREDIBILIDADE:
- Anos no mercado: ${data.anosNoMercado}
${data.totalClientes ? `- ${data.totalClientes}+ ${data.totalClientesLabel || 'clientes atendidos'}` : ''}
${data.certificados ? `- Certificações/Formações: ${data.certificados}` : ''}
${data.fotoProfissionalUrl ? `- Foto do profissional: ${data.fotoProfissionalUrl}` : ''}

FOTOS DO NEGÓCIO:
${[data.foto1Url, data.foto2Url, data.foto3Url].filter(Boolean).length > 0
  ? [data.foto1Url, data.foto2Url, data.foto3Url].filter(Boolean).map((url, i) => `- Foto ${i + 1}: ${url}`).join('\n')
  : '- Nenhuma foto fornecida'}

${depoimentosImagens.length > 0 ? `DEPOIMENTOS (imagens — use as URLs exatamente):
${depoimentosImagens.map((url, i) => `• Depoimento ${i + 1}: ${url}`).join('\n')}` : ''}

CONTATO:
- WhatsApp: ${data.whatsapp} | Link: ${whatsappLink}
${data.registros.length > 0 ? `- Registros profissionais: ${data.registros.map((r) => `${r.tipo} ${r.numero}`).join(' | ')}` : ''}
- Mensagem padrão: ${data.whatsappMensagem}
${instagramHandles.length ? `- Instagram (${instagramHandles.length > 1 ? `${instagramHandles.length} perfis — crie um link separado para CADA um` : '1 perfil'}): ${instagramHandles.map(h => `@${h}`).join(', ')}` : ''}
- Horário: ${data.horarioAtendimento}

IDENTIDADE VISUAL:
- Cor primária: ${paleta.primary}
- Cor secundária: ${paleta.secondary}
- Cor de fundo clara: ${paleta.light}
- Cor escura/texto: ${paleta.dark}
${data.logoUrl ? `- Logo: ${data.logoUrl}` : ''}

ESTRUTURA OBRIGATÓRIA (nesta ordem):
1. <header> com esta estrutura EXATA:
<header>
  <div class="header-inner">
    ${data.logoUrl
      ? `<a href="#hero"><img src="${data.logoUrl}" alt="${data.nomeNegocio}" style="height:60px;width:auto;display:block"></a>`
      : `<a href="#hero" class="brand-name">${data.nomeNegocio}</a>`
    }
    <nav><!-- links âncora: Serviços, Sobre, ${[data.foto1Url, data.foto2Url, data.foto3Url].filter(Boolean).length > 0 ? 'Espaço, ' : ''}Contato --></nav>
    <button class="menu-btn" aria-label="Menu">&#9776;</button>
  </div>
</header>
O header deve conter EXATAMENTE os elementos acima — nenhum elemento a mais.
ESTILO DO HEADER (obrigatório): o <header> deve ter EXATAMENTE background:${headerBg} — a MESMA cor da logo e a MESMA cor escura usada no rodapé. NÃO use var(--primary), NÃO use a cor primária, NÃO use gradiente e NÃO use branco no header. Use exatamente ${headerBg}. Assim a logo se integra à barra e não parece um quadrado colado. Os links do <nav> e o ícone do botão de menu devem ser claros/legíveis sobre esse fundo escuro (branco #ffffff). Header fixo no topo (sticky).
2. <section id="hero"> — ${data.heroFotoUrl
  ? `LAYOUT COM FOTO — implemente com CSS responsivo:
  MOBILE (padrão, sem @media): section#hero { position:relative; min-height:100svh; overflow:hidden; padding:0; display:flex; align-items:flex-end }
  A foto ocupa TODO o bloco no mobile: .hero-img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:top center }
  O texto fica sobre a foto na metade inferior: .hero-content { position:relative; z-index:2; width:100%; padding:40px 24px 48px; background:linear-gradient(transparent,rgba(0,0,0,0.75) 35%); color:#fff; text-align:center }
  DESKTOP (@media(min-width:768px)): section#hero { display:flex; align-items:center; gap:48px; padding:80px 48px; min-height:auto; background:var(--color-light) }
  A foto fica vertical ao lado do texto: .hero-img { position:static; width:340px; height:520px; flex-shrink:0; object-fit:cover; object-position:top center; border-radius:16px }
  O texto fica ao lado: .hero-content { position:static; background:none; color:var(--color-dark); flex:1; padding:0 }
  Headline e subheadline no .hero-content com cor adequada para cada breakpoint. URL da foto: ${data.heroFotoUrl}`
  : 'A headline deve ser o PRIMEIRO elemento visível da seção, sem nada acima dela. Todo o conteúdo do hero deve estar centralizado (text-align:center).'}

  O .hero-content deve conter EXATAMENTE esta estrutura HTML, sem adicionar nenhum outro elemento:
  <div class="hero-content">
    <h1>${data.headline || '[headline impactante baseada na dor+resultado do cliente]'}</h1>
    <p class="hero-sub">${data.subheadline || '[subheadline complementar em 1-2 frases]'}</p>
    <a href="${`https://wa.me/55${data.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(data.whatsappMensagem)}`}" class="btn-cta">${data.ctaTexto || 'Entrar em contato agora'}</a>
  </div>
  NENHUM outro elemento dentro de .hero-content além de h1, p.hero-sub e a.btn-cta.
3. <section id="servicos"> — título e subtítulo da seção CENTRALIZADOS (text-align:center), cards dos serviços contendo APENAS o título do serviço e a descrição. NÃO use ícones, emojis, símbolos nem imagens nos cards de serviço — visual limpo e profissional, só texto (título + descrição). TODO o conteúdo de cada card deve ficar CENTRALIZADO (text-align:center no card): tanto o TÍTULO do serviço quanto a descrição centralizados. OBRIGATÓRIO: quando um serviço tiver descrição fornecida, copie o texto EXATAMENTE como está — é terminantemente proibido parafrasear, resumir, reescrever ou alterar a descrição de qualquer serviço.
4. <section id="sobre"> — título CENTRALIZADO criativo e específico ao segmento (PROIBIDO usar frases genéricas como "Atendimento humanizado", "com resultados reais" ou similares — crie um título relevante ao nicho), números destacados (${data.anosNoMercado} anos, ${data.totalClientes ? `${data.totalClientes}+ ${data.totalClientesLabel || 'clientes atendidos'}` : 'experiência'})${data.certificados ? ', certificações' : ''}${data.fotoProfissionalUrl ? `, foto do profissional em destaque com object-fit:cover; object-position:top center; border-radius:12px` : ''}
5. ${[data.foto1Url, data.foto2Url, data.foto3Url].filter(Boolean).length > 0 ? `<section id="espaco"> — título e subtítulo CENTRALIZADOS, galeria com as fotos do negócio. LAYOUT OBRIGATÓRIO: no mobile (padrão, sem @media) as fotos devem ficar em coluna única, cada uma ocupando 100% da largura (display:flex; flex-direction:column; gap:16px). No desktop (@media min-width:768px) pode usar grid de 2 ou 3 colunas. Cada foto: width:100%; aspect-ratio:4/3; object-fit:cover; border-radius:12px. Use as URLs exatas fornecidas.` : '<!-- sem galeria de fotos -->'}
6. ${depoimentosImagens.length > 0 ? `<section id="depoimentos"> — título e subtítulo CENTRALIZADOS, carrossel de imagens de depoimentos. Use as ${depoimentosImagens.length} URLs fornecidas como <img> com estes estilos EXATOS: display:block; margin:0 auto; width:auto; max-width:100%; max-height:480px; height:auto; object-fit:contain; border-radius:12px. O teto de altura (max-height:480px) é OBRIGATÓRIO para os prints não ficarem gigantes — a imagem reduz mantendo a proporção, sem cortar e sem espaços em branco. O carrossel deve ter um wrapper externo com position:relative; max-width:440px; margin:0 auto; padding:0 48px (para reservar espaço lateral às setas) — largura menor porque depoimentos costumam ser prints verticais. As setas prev/next devem ser position:absolute; top:50%; transform:translateY(-50%) FORA da imagem, posicionadas no padding lateral: left:0 e right:0 com width:40px; height:40px. A imagem fica dentro de um container interno sem padding, centralizada. Assim as setas ficam ao lado das fotos, nunca sobre elas. Adicione indicadores de pontos abaixo. Carrossel responsivo e touch-friendly.` : '<!-- sem depoimentos -->'}
7. <section id="cta"> — estrutura obrigatória em duas partes dentro de um container (max-width:600px; margin:0 auto; text-align:center):
   PARTE 1 (centralizada): badge, título h2, subtítulo p, e botão CTA — todos com text-align:center e o botão com display:inline-block ou display:block; margin:0 auto
   PARTE 2 (lista de contato): div separado com text-align:left, contendo os itens de endereço, horário e Instagram, cada item com display:flex; align-items:center; gap:12px; margin-bottom:12px. ${instagramHandles.length > 1 ? `Há ${instagramHandles.length} perfis de Instagram — mostre UM link clicável para CADA um (ex: @${instagramHandles[0]} e @${instagramHandles[1]}), cada link apontando para https://instagram.com/<perfil>.` : 'O Instagram deve ser um link clicável para https://instagram.com/<perfil>.'}
   Use fundo claro (cor light da paleta ou branco) com texto escuro para garantir contraste
8. <footer> — dados de contato, horário, Instagram (se houver)${data.registros.length > 0 ? `, registros profissionais (${data.registros.map((r) => `${r.tipo} ${r.numero}`).join(', ')})` : ''}, copyright. IMPORTANTE: o footer deve ter padding-top mínimo de 48px para não ficar colado no botão da seção CTA acima

REGRA GLOBAL DE LAYOUT: Todo o conteúdo do site deve estar centralizado. Adicione obrigatoriamente no CSS global:
section { text-align: center }
section h1, section h2, section h3, section p, section span, section .badge, section .tag, section .label { text-align: center }
Cada seção deve ter um container interno com max-width:1100px; margin:0 auto; padding:0 24px. Qualquer badge, tag ou label de seção (ex: "O QUE OFERECEMOS") deve ter display:inline-block; margin:0 auto 16px; — nunca alinhado à esquerda.
REGRA GLOBAL DE BOTÕES: NUNCA coloque emojis dentro de botões CTA (hero, seções, footer). Os botões devem conter apenas texto limpo: "${data.ctaTexto || 'Entrar em contato agora'}" — sem 💬, sem ✅, sem nenhum emoji. Todos os botões CTA devem estar CENTRALIZADOS em todas as telas: use display:block; margin:0 auto; text-align:center ou coloque em container com display:flex; justify-content:center.

REQUISITOS TÉCNICOS:
- Mobile-first responsivo (breakpoint principal: 768px)
- Google Font 'Inter' via @import no CSS
- Botão WhatsApp flutuante fixo (canto inferior direito): position:fixed; bottom:24px; right:24px; width:56px; height:56px; border-radius:50%; background:#25D366; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,0.2). Use o SVG oficial do WhatsApp inline: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>. NUNCA use emoji 💬 no botão flutuante.
- Efeito hover nos cards de serviços
- Gradiente suave no hero usando as cores da paleta
- SEO COMPLETO no <head> — implemente TODOS os itens abaixo:
  a) <title>${data.servicoDestaque} em ${data.cidade} | ${data.nomeNegocio}</title>
  b) <meta name="description" content="[150 chars: serviço + cidade + resultado principal + CTA ex: Agende sua avaliação]">
  c) <meta name="keywords" content="${data.servicoDestaque}, ${data.segmento}, ${data.cidade}, ${data.estado}, [3-5 keywords relevantes do nicho]">
  d) <meta name="robots" content="index, follow">
  e) <meta name="geo.region" content="BR-${data.estado}">
  f) <meta name="geo.placename" content="${data.cidade}">
  g) Open Graph: og:type="local.business", og:title, og:description, og:locale="pt_BR", og:site_name="${data.nomeNegocio}"${data.logoUrl ? `, og:image="${data.logoUrl}"` : ''}${data.siteUrl ? `, og:url="${data.siteUrl}"` : ''}
  h) Twitter Card: twitter:card="summary_large_image", twitter:title, twitter:description${data.logoUrl ? `, twitter:image="${data.logoUrl}"` : ''}
  ${data.siteUrl ? `i) <link rel="canonical" href="${data.siteUrl}">` : ''}
- Schema.org JSON-LD completo dentro de <script type="application/ld+json"> com TODOS os campos:
  {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "${data.segmento}"],
    "name": "${data.nomeNegocio}",
    "description": "[descrição do negócio com serviço + cidade + resultado]",
    ${data.siteUrl ? `"url": "${data.siteUrl}",` : ''}
    ${data.logoUrl ? `"logo": "${data.logoUrl}",` : ''}
    ${data.foto1Url ? `"image": "${data.foto1Url}",` : ''}
    "telephone": "+55${data.whatsapp.replace(/\D/g, '')}",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "${data.endereco}",
      "addressLocality": "${data.cidade}",
      "addressRegion": "${data.estado}",
      "postalCode": "${data.cep}",
      "addressCountry": "BR"
    },
    "openingHoursSpecification": [/* converta "${data.horarioAtendimento}" para o formato schema.org */],
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Serviços",
      "itemListElement": [/* liste cada serviço como Offer com name e description */]
    },
    "areaServed": "${data.cidade}, ${data.estado}",
    "priceRange": "$$",
    "foundingDate": "${new Date().getFullYear() - data.anosNoMercado}",
    ${data.totalClientes ? `"aggregateRating": { "@type": "AggregateRating", "ratingValue": "5", "reviewCount": "${data.totalClientes}" },` : ''}
    "sameAs": [${instagramHandles.map(h => `"https://instagram.com/${h}"`).join(', ')}]
  }
- Suave scroll behavior: html { scroll-behavior: smooth }
- Cores de texto com contraste adequado para acessibilidade
- Use as URLs das fotos EXATAMENTE como fornecidas, sem modificar
- Todas as imagens DEVEM ter atributo alt descritivo com keyword + cidade, ex: alt="${data.servicoDestaque} em ${data.cidade} - ${data.nomeNegocio}"

Todos os links de WhatsApp devem usar exatamente: ${whatsappLink}

IMPORTANTE: Certifique-se de gerar TODAS as seções acima e fechar corretamente com </body></html>. Priorize completude sobre detalhamento de CSS.`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Resposta inesperada da IA')

  console.log(`stop_reason: ${message.stop_reason} | tokens usados: ${message.usage.output_tokens} | tamanho HTML: ${content.text.length} chars`)
  if (message.stop_reason === 'max_tokens') {
    console.warn('HTML gerado foi cortado pelo limite de tokens — aumente max_tokens')
  }

  let html = content.text
    .replace(/^```html\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  // Garante que a barra do header tenha exatamente a cor da logo (a IA às vezes
  // usa a cor primária/gradiente). Injeta um override com !important.
  if (data.logoUrl) {
    const override = `<style id="bethel-header-bg">header,header>div,.header-inner,.site-header,.navbar,.topbar{background:${headerBg} !important;background-image:none !important}</style>`
    html = html.includes('</head>') ? html.replace('</head>', `${override}</head>`) : `${override}${html}`
  }

  return html
}
