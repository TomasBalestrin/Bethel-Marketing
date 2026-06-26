'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

type Result<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

export type BriefingInput = {
  nomeEmpresa: string
  email?: string
  whatsapp: string
  endereco?: string
  instagram?: string
  horario?: string
  servicos?: string
  servicoCarroChefe?: string
  anosMercado?: string
  clientesAtendidos?: string
  logoUrl?: string
  fotosEmpresa?: string[]
  fotosDepoimento?: string[]
  fotosAntesDepois?: string[]
  observacoes?: string
}

// PÚBLICO — qualquer mentorado com o link pode enviar.
export async function submitBriefing(input: BriefingInput): Promise<Result> {
  if (!input.nomeEmpresa?.trim()) return { success: false, error: 'Informe o nome da empresa.' }
  if (!input.whatsapp?.trim()) return { success: false, error: 'Informe o WhatsApp de contato.' }
  try {
    await prisma.briefing.create({
      data: {
        nomeEmpresa: input.nomeEmpresa.trim(),
        email: input.email?.trim() || null,
        whatsapp: input.whatsapp.trim(),
        endereco: input.endereco?.trim() || null,
        instagram: input.instagram?.replace('@', '').trim() || null,
        horario: input.horario?.trim() || null,
        servicos: input.servicos?.trim() || null,
        servicoCarroChefe: input.servicoCarroChefe?.trim() || null,
        anosMercado: input.anosMercado?.trim() || null,
        clientesAtendidos: input.clientesAtendidos?.trim() || null,
        logoUrl: input.logoUrl || null,
        fotosEmpresa: (input.fotosEmpresa ?? []).filter(Boolean),
        fotosDepoimento: (input.fotosDepoimento ?? []).filter(Boolean),
        fotosAntesDepois: (input.fotosAntesDepois ?? []).filter(Boolean),
        observacoes: input.observacoes?.trim() || null,
      },
    })
    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao enviar briefing' }
  }
}

// ── Admin ─────────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const dbUser = await prisma.user.findFirst({ where: { OR: [{ id: user.id }, { email: user.email! }] } })
  return dbUser?.role === 'ADMIN' ? dbUser : null
}

export async function updateBriefingStatus(id: string, status: string): Promise<Result> {
  const admin = await requireAdmin()
  if (!admin) return { success: false, error: 'Não autorizado' }
  try {
    await prisma.briefing.update({ where: { id }, data: { status } })
    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro' }
  }
}

export async function deleteBriefing(id: string): Promise<Result> {
  const admin = await requireAdmin()
  if (!admin) return { success: false, error: 'Não autorizado' }
  try {
    await prisma.briefing.delete({ where: { id } })
    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao excluir' }
  }
}
