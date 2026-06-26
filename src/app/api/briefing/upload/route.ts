import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

// Upload PÚBLICO (sem login) para o formulário de briefing dos mentorados.
// Aceita apenas imagens e limita o tamanho para reduzir abuso.
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

export async function POST(request: NextRequest) {
  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 400 })
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Envie apenas imagens' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Imagem muito grande (máx. 10MB)' }, { status: 400 })

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const filename = `briefing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { data, error } = await supabaseAdmin.storage
    .from('logos')
    .upload(filename, buffer, { contentType: file.type, upsert: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { data: { publicUrl } } = supabaseAdmin.storage.from('logos').getPublicUrl(data.path)
  return NextResponse.json({ url: publicUrl })
}
