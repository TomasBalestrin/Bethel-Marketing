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

// ── Perfis de conteúdo (um por Instagram do mentorado) ────────────────────────

export type ContentProfileInput = {
  id?: string
  instagram?: string
  negocio?: string
  nicho: string
  servicos?: string
  sobre?: string // sobre o negócio + público + foco
}

export type ProfileSummary = { id: string; instagram: string; negocio: string; nicho: string }

export async function listContentProfiles(): Promise<Result<ProfileSummary[]>> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    const rows = await prisma.contentProfile.findMany({
      where: { userId: dbUser.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, instagram: true, negocio: true, nicho: true },
    })
    return {
      success: true,
      data: rows.map(r => ({ id: r.id, instagram: r.instagram ?? '', negocio: r.negocio, nicho: r.nicho })),
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao listar perfis' }
  }
}

export async function getContentProfile(id: string): Promise<Result<ContentProfileInput | null>> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    const p = await prisma.contentProfile.findUnique({ where: { id } })
    if (!p || p.userId !== dbUser.id) return { success: true, data: null }
    return {
      success: true,
      data: {
        id: p.id,
        instagram: p.instagram ?? '',
        negocio: p.negocio ?? '',
        nicho: p.nicho,
        servicos: p.servicos ?? '',
        sobre: p.publico ?? '',
      },
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao carregar perfil' }
  }
}

export async function saveContentProfile(input: ContentProfileInput): Promise<Result<{ id: string }>> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  if (!input.nicho?.trim()) return { success: false, error: 'Informe o nicho.' }
  const data = {
    instagram: input.instagram?.replace('@', '').trim() || null,
    negocio: input.negocio?.trim() || input.nicho.trim(),
    nicho: input.nicho.trim(),
    servicos: input.servicos?.trim() || null,
    publico: input.sobre?.trim() || '',
  }
  try {
    // Atualiza se for dono; senão cria
    if (input.id) {
      const existing = await prisma.contentProfile.findUnique({ where: { id: input.id } })
      if (existing && existing.userId === dbUser.id) {
        await prisma.contentProfile.update({ where: { id: existing.id }, data })
        return { success: true, data: { id: existing.id } }
      }
    }
    const created = await prisma.contentProfile.create({ data: { ...data, userId: dbUser.id } })
    return { success: true, data: { id: created.id } }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao salvar perfil' }
  }
}

export async function deleteContentProfile(id: string): Promise<Result> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    const p = await prisma.contentProfile.findUnique({ where: { id } })
    if (!p || p.userId !== dbUser.id) return { success: false, error: 'Perfil não encontrado' }
    await prisma.contentProfile.delete({ where: { id } })
    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao excluir' }
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

export async function savePlan(args: { quantidade: number; itens: Prisma.InputJsonValue; titulo?: string; profileId?: string; instagram?: string }): Promise<Result<{ id: string }>> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    const created = await prisma.contentPlan.create({
      data: {
        userId: dbUser.id,
        quantidade: args.quantidade,
        itens: args.itens,
        titulo: args.titulo || 'Plano de conteúdo',
        profileId: args.profileId || null,
        instagram: args.instagram?.replace('@', '').trim() || null,
      },
    })
    return { success: true, data: { id: created.id } }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao salvar plano' }
  }
}

export type PlanListItem = { id: string; titulo: string; quantidade: number; instagram: string; createdAt: string }

export async function listPlans(): Promise<Result<PlanListItem[]>> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    const rows = await prisma.contentPlan.findMany({
      where: { userId: dbUser.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, titulo: true, quantidade: true, instagram: true, createdAt: true },
      take: 30,
    })
    return { success: true, data: rows.map(r => ({ id: r.id, titulo: r.titulo, quantidade: r.quantidade, instagram: r.instagram ?? '', createdAt: r.createdAt.toISOString() })) }
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
