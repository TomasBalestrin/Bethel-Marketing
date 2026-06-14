'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

type Result<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

async function getDbUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return (
    (await prisma.user.findFirst({ where: { OR: [{ id: user.id }, { email: user.email! }] } })) ??
    (await prisma.user.create({ data: { id: user.id, email: user.email!, name: user.user_metadata?.name || user.email! } }))
  )
}

// ── Perfil de conteúdo (entrada simples do mentorado) ─────────────────────────

export type ContentProfileInput = {
  negocio?: string
  nicho: string
  servicos?: string
  sobre?: string // sobre o negócio + público + foco que ela quer seguir
}

export async function getContentProfile(): Promise<Result<ContentProfileInput | null>> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    const p = await prisma.contentProfile.findUnique({ where: { userId: dbUser.id } })
    // O gerador de roteiros é independente do criador de sites: o mentorado
    // preenche o próprio perfil; não puxamos dados do Site.
    if (!p) return { success: true, data: null }
    return {
      success: true,
      data: {
        negocio: p.negocio ?? '',
        nicho: p.nicho,
        servicos: p.servicos ?? '',
        sobre: p.publico ?? '', // reutiliza a coluna publico como "sobre o negócio/público/foco"
      },
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao carregar perfil' }
  }
}

export async function saveContentProfile(input: ContentProfileInput): Promise<Result> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  if (!input.nicho?.trim()) return { success: false, error: 'Informe o nicho.' }
  const data = {
    negocio: input.negocio?.trim() || input.nicho,
    nicho: input.nicho.trim(),
    servicos: input.servicos?.trim() || null,
    publico: input.sobre?.trim() || '',
  }
  try {
    await prisma.contentProfile.upsert({
      where: { userId: dbUser.id },
      create: { ...data, userId: dbUser.id },
      update: data,
    })
    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao salvar perfil' }
  }
}

// ── Planos de conteúdo (calendário de 30 dias) ────────────────────────────────

export type PlanItemRoteiro = {
  gancho: string
  estrutura: { secao: string; conteudo: string; fala?: string; imagem?: string }[]
  legenda: string
  cta: string
  hashtags: string[]
  dicas?: string
  usouTendencias?: boolean
}
export type PlanItem = {
  ordem: number
  dia: number
  formato: string
  funil: string
  categoria: string
  titulo: string
  objetivo: string
  gancho: string
  roteiro?: PlanItemRoteiro
}

export async function savePlan(quantidade: number, itens: Prisma.InputJsonValue, titulo?: string): Promise<Result<{ id: string }>> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    const created = await prisma.contentPlan.create({
      data: { userId: dbUser.id, quantidade, itens, titulo: titulo || 'Plano de conteúdo' },
    })
    return { success: true, data: { id: created.id } }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao salvar plano' }
  }
}

export type PlanListItem = { id: string; titulo: string; quantidade: number; createdAt: string }

export async function listPlans(): Promise<Result<PlanListItem[]>> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    const rows = await prisma.contentPlan.findMany({
      where: { userId: dbUser.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, titulo: true, quantidade: true, createdAt: true },
      take: 30,
    })
    return { success: true, data: rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })) }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao listar' }
  }
}

export async function getPlan(id: string): Promise<Result<{ id: string; titulo: string; quantidade: number; itens: PlanItem[] }>> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    const row = await prisma.contentPlan.findUnique({ where: { id } })
    if (!row || row.userId !== dbUser.id) return { success: false, error: 'Plano não encontrado' }
    return { success: true, data: { id: row.id, titulo: row.titulo, quantidade: row.quantidade, itens: (row.itens as unknown as PlanItem[]) ?? [] } }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao carregar' }
  }
}

// Grava o roteiro completo de um item específico do plano (gerado sob demanda)
export async function savePlanItemRoteiro(planId: string, ordem: number, roteiro: PlanItemRoteiro): Promise<Result> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    const row = await prisma.contentPlan.findUnique({ where: { id: planId } })
    if (!row || row.userId !== dbUser.id) return { success: false, error: 'Plano não encontrado' }
    const itens = (row.itens as unknown as PlanItem[]) ?? []
    const idx = itens.findIndex(i => i.ordem === ordem)
    if (idx === -1) return { success: false, error: 'Item não encontrado' }
    itens[idx] = { ...itens[idx], roteiro }
    await prisma.contentPlan.update({ where: { id: planId }, data: { itens: itens as unknown as Prisma.InputJsonValue } })
    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao salvar roteiro' }
  }
}

export async function deletePlan(id: string): Promise<Result> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    const row = await prisma.contentPlan.findUnique({ where: { id } })
    if (!row || row.userId !== dbUser.id) return { success: false, error: 'Plano não encontrado' }
    await prisma.contentPlan.delete({ where: { id } })
    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao excluir' }
  }
}
