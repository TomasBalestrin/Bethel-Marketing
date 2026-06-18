import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
    const counts: Record<string, number> = {}
    let transparent = 0
    for (const [x, y] of pts) {
      const i = (y * W + x) * 4
      if (data[i + 3] < 128) { transparent++; continue }
      const r = Math.round(data[i] / 16) * 16
      const g = Math.round(data[i + 1] / 16) * 16
      const b = Math.round(data[i + 2] / 16) * 16
      const k = `${r},${g},${b}`
      counts[k] = (counts[k] || 0) + 1
    }
    if (transparent >= pts.length - 1) return null // logo transparente: não força barra
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    if (!top) return null
    const [r, g, b] = top[0].split(',').map(Number)
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
    select: { htmlGerado: true, metaPixelId: true, gtmId: true, logoUrl: true },
  })

  if (!site?.htmlGerado) {
    return new NextResponse('<h1>Site não encontrado</h1>', {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  let html = injectTracking(site.htmlGerado, site.metaPixelId, site.gtmId)

  // Ajustes aplicados no serve (corrigem também sites já publicados, sem regenerar):
  // 1) barra do header com a cor REAL do fundo da logo (branca, navy, etc.) +
  //    cor de texto do menu com contraste adequado;
  // 2) serviços (título + descrição) centralizados;
  // 3) botão CTA centralizado.
  if (html.includes('</head>')) {
    let headerRule = ''
    if (site.logoUrl) {
      const bg = await logoBgColor(site.logoUrl)
      if (bg) {
        // Logo de fundo claro → barra BRANCA (limpa); fundo escuro → cor exata da logo
        const headerColor = bg.light ? '#ffffff' : bg.hex
        const txt = bg.light ? '#1a1a1a' : '#ffffff'
        const border = bg.light ? 'header{border-bottom:1px solid rgba(0,0,0,0.08) !important}' : ''
        headerRule =
          `header,header>div,.header-inner{background:${headerColor} !important;background-image:none !important}` +
          `header a,header nav a,header .menu-btn,header button{color:${txt} !important}` +
          border
      }
    }
    const fix = `<style id="bethel-fix">${headerRule}header{height:auto !important}header>div,header .header-inner{min-height:92px !important;display:flex !important;align-items:center !important}header img{height:72px !important;width:auto !important}#servicos,#servicos *{text-align:center !important}.btn-cta{display:block !important;width:fit-content !important;max-width:100% !important;margin-left:auto !important;margin-right:auto !important}</style>`
    html = html.replace('</head>', `${fix}</head>`)
  }

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
