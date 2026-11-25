import { NextRequest, NextResponse } from 'next/server'

// Muitas logos chegam em JPEG, formato que não tem transparência: o fundo
// branco faz parte do arquivo e aparece como um retângulo sobre a foto do
// hero. Esta rota devolve a mesma logo em PNG, tornando transparente o fundo
// uniforme das bordas. Se o fundo não for uniforme (foto, degradê), devolve a
// imagem original sem alterar.

const TOLERANCIA = 26 // distância máxima da cor de fundo para virar transparente

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return new NextResponse('url obrigatória', { status: 400 })

  // Só processa imagens do nosso próprio storage, para a rota não virar um
  // proxy aberto para qualquer endereço da internet.
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    return new NextResponse('url inválida', { status: 400 })
  }
  if (!host.endsWith('.supabase.co')) {
    return new NextResponse('origem não permitida', { status: 403 })
  }

  try {
    const sharp = (await import('sharp')).default
    const res = await fetch(url)
    if (!res.ok) return NextResponse.redirect(url)
    const entrada = Buffer.from(await res.arrayBuffer())

    const { data, info } = await sharp(entrada)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const { width: w, height: h, channels: ch } = info
    const px = (x: number, y: number) => {
      const i = (y * w + x) * ch
      return [data[i], data[i + 1], data[i + 2]] as const
    }

    // A cor de fundo é a dos cantos. Se os quatro não combinarem, a imagem não
    // tem fundo chapado e mexer nela faria estrago.
    const cantos = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)]
    const [r0, g0, b0] = cantos[0]
    const uniforme = cantos.every(
      ([r, g, b]) => Math.abs(r - r0) + Math.abs(g - g0) + Math.abs(b - b0) < 18
    )
    if (!uniforme) return NextResponse.redirect(url)

    // Pinta de transparente tudo que for parecido com a cor de fundo.
    for (let i = 0; i < data.length; i += ch) {
      const dist =
        Math.abs(data[i] - r0) + Math.abs(data[i + 1] - g0) + Math.abs(data[i + 2] - b0)
      if (dist < TOLERANCIA) data[i + 3] = 0
    }

    const png = await sharp(data, { raw: { width: w, height: h, channels: ch } })
      .png()
      .toBuffer()

    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    // Qualquer falha no processamento: devolve a logo original.
    return NextResponse.redirect(url)
  }
}
