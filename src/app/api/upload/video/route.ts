import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Vídeo é arquivo grande demais para passar pelo servidor (limite de corpo da
// requisição). Aqui geramos uma URL assinada e o navegador envia DIRETO para o
// armazenamento; o servidor só autoriza e devolve a URL pública final.

const MAX_BYTES = 60 * 1024 * 1024 // 60 MB
const TIPOS_OK = ['video/mp4', 'video/webm', 'video/quicktime']

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { filename, contentType, size } = await request.json().catch(() => ({}))
  if (!filename) return NextResponse.json({ error: 'Arquivo inválido' }, { status: 400 })
  if (contentType && !TIPOS_OK.includes(contentType)) {
    return NextResponse.json({ error: 'Formato não suportado. Use MP4 (recomendado), WebM ou MOV.' }, { status: 400 })
  }
  if (typeof size === 'number' && size > MAX_BYTES) {
    return NextResponse.json({ error: 'Vídeo muito grande. O limite é 60 MB.' }, { status: 400 })
  }

  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const ext = (String(filename).split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `videos/${user.id}-${Date.now()}.${ext}`

  const { data, error } = await supabaseAdmin.storage.from('logos').createSignedUploadUrl(path)
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Falha ao preparar o envio' }, { status: 400 })

  const { data: { publicUrl } } = supabaseAdmin.storage.from('logos').getPublicUrl(path)
  return NextResponse.json({ signedUrl: data.signedUrl, publicUrl })
}
