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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const site = await prisma.site.findFirst({
    where: { slug, status: 'PUBLISHED' },
    select: { htmlGerado: true, metaPixelId: true, gtmId: true },
  })

  if (!site?.htmlGerado) {
    return new NextResponse('<h1>Site não encontrado</h1>', {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  let html = injectTracking(site.htmlGerado, site.metaPixelId, site.gtmId)

  // Força a barra do header a usar a cor escura da marca (var(--dark)) — a MESMA
  // do rodapé, que casa com a logo. Aplicado no serve para corrigir também os
  // sites já gerados, sem precisar regenerar.
  if (html.includes('--dark') && html.includes('</head>')) {
    const headerFix = `<style id="bethel-header-fix">header,header>div,.header-inner{background:var(--dark) !important;background-image:none !important}</style>`
    html = html.replace('</head>', `${headerFix}</head>`)
  }

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
