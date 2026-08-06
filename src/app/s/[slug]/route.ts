import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CANONICAL_DOMAIN } from '@/lib/canonical'

function injectTracking(html: string, metaPixelId?: string | null, gtmId?: string | null): string {
  let result = html

  if (gtmId) {
    const gtmHead = `<!-- Google Tag Manager -->\n<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');</script>\n<!-- End Google Tag Manager -->`
    const gtmBody = `<!-- Google Tag Manager (noscript) -->\n<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>\n<!-- End Google Tag Manager (noscript) -->`
    result = result.replace('</head>', `${gtmHead}\n</head>`)
    result = result.replace('<body', `<body`)
    result = result.replace(/(<body[^>]*>)/, `$1\n${gtmBody}`)
  }

  if (metaPixelId) {
    const pixelCode = `<!-- Meta Pixel Code -->\n<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixelId}');fbq('track','PageView');</script>\n<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1"/></noscript>\n<!-- End Meta Pixel Code -->`
    result = result.replace('</head>', `${pixelCode}\n</head>`)
  }

  return result
}

// CSS do carrossel de "Resultados reais" (mesmo visual do carrossel de depoimentos).
// Classes próprias (brescar-*) para não depender de o site ter carrossel de depoimentos.
const RESULTADOS_CAROUSEL_CSS =
  '#resultados .brescar{position:relative;max-width:440px;margin:0 auto;padding:0 48px}' +
  '#resultados .brescar-outer{overflow:hidden}' +
  '#resultados .brescar-track{display:flex;transition:transform .35s ease}' +
  '#resultados .brescar-slide{flex:0 0 100%;box-sizing:border-box;display:flex;justify-content:center;align-items:center}' +
  '#resultados .brescar-slide img,#resultados .brescar-slide video{display:block;margin:0 auto;width:auto;max-width:100%;max-height:480px;height:auto;object-fit:contain;border-radius:12px}' +
  '#resultados .brescar-slide video{background:#000;width:100%}' +
  '#resultados .brescar-slide iframe{display:block;margin:0 auto;width:100%;max-width:360px;height:520px;border:0;border-radius:12px;background:#fff}' +
  '#resultados .brescar-btn{position:absolute;top:50%;transform:translateY(-50%);width:40px;height:40px;border:0;border-radius:50%;cursor:pointer;background:var(--primary,#7d3a3a);color:#fff;font-size:18px;line-height:40px;text-align:center;padding:0;z-index:2}' +
  '#resultados .brescar-btn.prev{left:0}' +
  '#resultados .brescar-btn.next{right:0}' +
  '#resultados .brescar-dots{display:flex;gap:8px;justify-content:center;margin-top:16px}' +
  '#resultados .brescar-dot{width:8px;height:8px;border-radius:50%;border:0;padding:0;cursor:pointer;background:var(--primary,#7d3a3a);opacity:.3}' +
  '#resultados .brescar-dot.active{opacity:1}'

// Transforma a galeria (grade) de #resultados num carrossel. No-op se já for carrossel,
// se houver menos de 2 imagens, ou se a seção não existir.
const RESULTADOS_CAROUSEL_JS =
  '<script>(function(){' +
  "var sec=document.getElementById('resultados');" +
  "if(!sec||sec.querySelector('.brescar')||sec.querySelector('.carousel-track'))return;" +
  "var SEL='img,video,iframe';var SELD=':scope > img, :scope > video, :scope > iframe';" +
  'var all=[].slice.call(sec.querySelectorAll(SEL));if(all.length<2)return;' +
  'var best=null,bestN=0;all.forEach(function(el){var p=el.parentElement;var n=p.querySelectorAll(SELD).length;if(n>bestN){bestN=n;best=p;}});' +
  'if(!best||bestN<2)return;var gal=best;var imgs=[].slice.call(gal.querySelectorAll(SELD));' +
  "var wrap=document.createElement('div');wrap.className='brescar';" +
  "var outer=document.createElement('div');outer.className='brescar-outer';" +
  "var track=document.createElement('div');track.className='brescar-track';" +
  "imgs.forEach(function(im){var s=document.createElement('div');s.className='brescar-slide';s.appendChild(im);track.appendChild(s);});" +
  'outer.appendChild(track);' +
  "var prev=document.createElement('button');prev.className='brescar-btn prev';prev.setAttribute('aria-label','Anterior');prev.innerHTML='&#8592;';" +
  "var next=document.createElement('button');next.className='brescar-btn next';next.setAttribute('aria-label','Próximo');next.innerHTML='&#8594;';" +
  "var dots=document.createElement('div');dots.className='brescar-dots';" +
  'wrap.appendChild(outer);wrap.appendChild(prev);wrap.appendChild(next);wrap.appendChild(dots);' +
  'gal.parentNode.replaceChild(wrap,gal);' +
  'var total=imgs.length,current=0;' +
  "for(var i=0;i<total;i++){(function(idx){var d=document.createElement('button');d.className='brescar-dot'+(idx===0?' active':'');d.setAttribute('aria-label','Slide '+(idx+1));d.addEventListener('click',function(){goTo(idx);});dots.appendChild(d);})(i);}" +
  "function goTo(n){current=(n+total)%total;track.style.transform='translateX(-'+(current*100)+'%)';var ds=dots.querySelectorAll('.brescar-dot');for(var i=0;i<ds.length;i++){ds[i].classList.toggle('active',i===current);}}" +
  "prev.addEventListener('click',function(){goTo(current-1);});next.addEventListener('click',function(){goTo(current+1);});" +
  'var sx=null;' +
  "outer.addEventListener('touchstart',function(e){sx=e.touches[0].clientX;},{passive:true});" +
  "outer.addEventListener('touchend',function(e){if(sx===null)return;var dx=sx-e.changedTouches[0].clientX;if(Math.abs(dx)>40){goTo(dx>0?current+1:current-1);}sx=null;});" +
  '})();</script>'

// Sites em que a barra do topo NÃO deve seguir a cor da logo (ex: logo escura e
// transparente que some no fundo escuro). Chave = slug, valor = cor da barra.
const HEADER_BG_OVERRIDE: Record<string, string> = {
  'marmoraria-beto': '#ffffff',
}

// Sites com logo quadrada/quase-quadrada que fica pequena demais na altura padrão
// (72px). Chave = slug, valor = altura em px para header/footer.
const LOGO_HEIGHT_OVERRIDE: Record<string, number> = {
  'mercaz-planejamento': 104,
  'human-estetic': 104,
  'marmoraria-beto': 104,
  'cr-pilates-e-fisioterapia': 100,
}

function hexEhClaro(hex: string): boolean {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b > 160
}

// Lê a cor de FUNDO real da logo amostrando os cantos da imagem (o fundo).
// Retorna { hex, light } ou null se a logo for transparente/erro.
async function logoBgColor(logoUrl: string): Promise<{ hex: string; light: boolean } | null> {
  try {
    const sharp = (await import('sharp')).default
    const res = await fetch(logoUrl)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const W = 64, H = 64
    const { data } = await sharp(buf).resize(W, H, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    // amostra cantos + meio das bordas superiores (onde costuma ser o fundo)
    const pts: [number, number][] = [
      [0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1],
      [Math.floor(W / 2), 0], [0, Math.floor(H / 2)], [W - 1, Math.floor(H / 2)],
    ]
    // Agrupa cores parecidas (bucket grosso só para CONTAR), mas acumula a cor
    // REAL de cada grupo para usar a média exata depois — sem distorcer o tom.
    const groups: Record<string, { n: number; r: number; g: number; b: number }> = {}
    let transparent = 0
    for (const [x, y] of pts) {
      const i = (y * W + x) * 4
      if (data[i + 3] < 128) { transparent++; continue }
      const r = data[i], g = data[i + 1], b = data[i + 2]
      const key = `${Math.round(r / 24)},${Math.round(g / 24)},${Math.round(b / 24)}`
      const c = (groups[key] ??= { n: 0, r: 0, g: 0, b: 0 })
      c.n++; c.r += r; c.g += g; c.b += b
    }
    if (transparent >= pts.length - 1) return null // logo transparente: não força barra
    const top = Object.values(groups).sort((a, b) => b.n - a.n)[0]
    if (!top) return null
    // cor final = média REAL da cor dominante (tom fiel ao fundo da logo)
    const r = Math.round(top.r / top.n)
    const g = Math.round(top.g / top.n)
    const b = Math.round(top.b / top.n)
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    return { hex, light: lum > 160 }
  } catch {
    return null
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const site = await prisma.site.findFirst({
    where: { slug, status: 'PUBLISHED' },
    select: { htmlGerado: true, metaPixelId: true, gtmId: true, logoUrl: true, registros: { select: { tipo: true, numero: true } } },
  })

  if (!site?.htmlGerado) {
    return new NextResponse('<h1>Site não encontrado</h1>', {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  let html = injectTracking(site.htmlGerado, site.metaPixelId, site.gtmId)

  // Botão de CTA sem exclamação (vale para todos os sites já publicados)
  html = html.split('Entrar em contato agora!').join('Entrar em contato agora')

  // Site com domínio próprio: troca as autorreferências ao subdomínio da
  // plataforma (canonical, og:url, schema) pelo endereço oficial, para o Google
  // indexar só um endereço.
  const canonical = CANONICAL_DOMAIN[slug]
  if (canonical) {
    const appDomain = process.env.MENTOR_DOMAIN
      || (process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname : null)
    if (appDomain) {
      html = html.split(`https://${slug}.${appDomain}`).join(canonical)
    }
  }

  // Remove o card de estatística com o registro profissional (CRO etc.) da seção Sobre,
  // mantendo o registro apenas no rodapé. Só mexe em <div class="...stat...">.
  for (const r of site.registros ?? []) {
    const tipo = (r.tipo ?? '').trim()
    if (!tipo) continue
    const esc = tipo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`<div class="[^"]*(?:stat|num)[^"]*">(?:(?!</div>)[\\s\\S])*?${esc}(?:(?!</div>)[\\s\\S])*?</div>`, 'i')
    html = html.replace(re, '')
  }
  // Remove cards de estatística "filler" com 100% (ex: "100% foco no paciente")
  html = html.replace(/<div class="[^"]*(?:stat|num)[^"]*">(?:(?!<\/div>)[\s\S])*?100\s*%(?:(?!<\/div>)[\s\S])*?<\/div>/gi, '')

  // Ajustes aplicados no serve (corrigem também sites já publicados, sem regenerar):
  // 1) barra do header com a cor REAL do fundo da logo (branca, navy, etc.) +
  //    cor de texto do menu com contraste adequado;
  // 2) serviços (título + descrição) centralizados;
  // 3) botão CTA centralizado.
  if (html.includes('</head>')) {
    let headerRule = ''
    const barraForcada = HEADER_BG_OVERRIDE[slug]
    if (barraForcada) {
      // Exceção por site: logo escura/transparente que sumia no fundo escuro da barra.
      // Força só o HEADER (o rodapé segue como está).
      const claro = hexEhClaro(barraForcada)
      const txt = claro ? '#1a1a1a' : '#ffffff'
      headerRule =
        `header,header .header-inner{background:${barraForcada} !important;background-image:none !important}` +
        `header a,header nav a,header .menu-btn,header button{color:${txt} !important}` +
        (claro ? 'header{border-bottom:1px solid rgba(0,0,0,0.08) !important}' : '')
    } else if (site.logoUrl) {
      const bg = await logoBgColor(site.logoUrl)
      if (bg) {
        // Barra = cor REAL do fundo da logo (combina com o entorno da logo)
        const barColor = bg.hex
        const txt = bg.light ? '#1a1a1a' : '#ffffff'
        const headerBorder = bg.light ? 'header{border-bottom:1px solid rgba(0,0,0,0.08) !important}' : ''
        const footerBorder = bg.light ? 'footer{border-top:1px solid rgba(0,0,0,0.08) !important}' : ''
        headerRule =
          // Header: fundo = cor da logo + texto com contraste
          `header,header .header-inner{background:${barColor} !important;background-image:none !important}` +
          `header a,header nav a,header .menu-btn,header button{color:${txt} !important}` +
          headerBorder +
          // Footer: mesma cor da logo + texto com contraste (logo se integra ao rodapé)
          `footer,footer .footer-inner{background:${barColor} !important;background-image:none !important}` +
          `footer,footer a,footer p,footer span,footer h1,footer h2,footer h3,footer h4{color:${txt} !important}` +
          footerBorder
      }
    }
    const logoHeight = LOGO_HEIGHT_OVERRIDE[slug] ?? 72
    const minHeaderHeight = Math.max(92, logoHeight + 20)
    const fix = `<style id="bethel-fix">${headerRule}header{height:auto !important}header .header-inner{min-height:${minHeaderHeight}px !important;align-items:center !important}header img{height:${logoHeight}px !important;width:auto !important}footer img{height:${logoHeight}px !important;width:auto !important}.service-icon,.service-card .icon,.service-card .card-icon,.servico-icon{display:none !important}a[href*="wa.me"] svg,a[href*="wa.me"] svg *{pointer-events:none !important}#espaco img{aspect-ratio:auto !important;height:auto !important;object-fit:contain !important}#servicos img,.service-card img{object-fit:contain !important;height:180px !important;width:100% !important;background:#f7f7f7 !important;padding:8px !important}#servicos,#servicos *{text-align:center !important}.btn-cta{display:block !important;width:fit-content !important;max-width:100% !important;margin-left:auto !important;margin-right:auto !important}${RESULTADOS_CAROUSEL_CSS}</style>`
    html = html.replace('</head>', `${fix}</head>`)
  }

  // Converte a galeria de "Resultados reais" em carrossel (igual ao de depoimentos)
  if (html.includes('</body>')) {
    html = html.replace('</body>', `${RESULTADOS_CAROUSEL_JS}</body>`)
  }

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
