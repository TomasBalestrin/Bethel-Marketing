'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { googleConfigured } from '@/lib/google/oauth'
import { getValidAccessToken } from '@/lib/google/tokens'
import { listAllLocations, GoogleApiError } from '@/lib/google/business'

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

export type GoogleStatus = {
  configured: boolean   // credenciais do Google presentes no servidor
  connected: boolean    // usuário já autorizou
  scopes: string | null
  locationsCount: number
}

export async function getGoogleStatus(): Promise<Result<GoogleStatus>> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    const conn = await prisma.googleConnection.findUnique({ where: { userId: dbUser.id } })
    const locationsCount = await prisma.gbpLocation.count({ where: { userId: dbUser.id } })
    return {
      success: true,
      data: {
        configured: googleConfigured(),
        connected: Boolean(conn?.refreshToken),
        scopes: conn?.scopes ?? null,
        locationsCount,
      },
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro' }
  }
}

export async function disconnectGoogle(): Promise<Result> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    await prisma.googleConnection.deleteMany({ where: { userId: dbUser.id } })
    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao desconectar' }
  }
}

// ── Locais (perfis GBP) ───────────────────────────────────────────────────────

export type AvailableLocation = {
  accountName: string
  locationName: string
  title: string
  primaryCategory: string | null
  address: string | null
}

// Lista os locais disponíveis na conta Google autorizada (chama a API do Google).
export async function listAvailableLocations(): Promise<Result<AvailableLocation[]> & { apiNaoAprovada?: boolean }> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    const token = await getValidAccessToken(dbUser.id)
    if (!token) return { success: false, error: 'Conta Google não conectada' }
    const locs = await listAllLocations(token)
    return {
      success: true,
      data: locs.map(l => ({
        accountName: l.accountName, locationName: l.locationName, title: l.title,
        primaryCategory: l.primaryCategory, address: l.address,
      })),
    }
  } catch (e) {
    if (e instanceof GoogleApiError && e.status === 403) {
      return { success: false, error: 'Acesso à Business Profile API ainda não aprovado pelo Google.', apiNaoAprovada: true }
    }
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao listar locais' }
  }
}

export async function connectLocation(locationName: string): Promise<Result<{ id: string }>> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    const token = await getValidAccessToken(dbUser.id)
    if (!token) return { success: false, error: 'Conta Google não conectada' }
    const locs = await listAllLocations(token)
    const loc = locs.find(l => l.locationName === locationName)
    if (!loc) return { success: false, error: 'Local não encontrado' }

    const existing = await prisma.gbpLocation.findFirst({ where: { userId: dbUser.id, locationName: loc.locationName } })
    const data = {
      accountName: loc.accountName, locationName: loc.locationName, title: loc.title,
      primaryCategory: loc.primaryCategory, placeId: loc.placeId, address: loc.address,
      phone: loc.phone, website: loc.website, lastSyncedAt: new Date(),
    }
    const saved = existing
      ? await prisma.gbpLocation.update({ where: { id: existing.id }, data })
      : await prisma.gbpLocation.create({ data: { ...data, userId: dbUser.id } })
    return { success: true, data: { id: saved.id } }
  } catch (e) {
    if (e instanceof GoogleApiError && e.status === 403) return { success: false, error: 'Acesso à API ainda não aprovado pelo Google.' }
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao conectar local' }
  }
}

export type ConnectedLocation = {
  id: string; title: string; primaryCategory: string | null; address: string | null; lastSyncedAt: string | null
}

export async function listConnectedLocations(): Promise<Result<ConnectedLocation[]>> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    const rows = await prisma.gbpLocation.findMany({
      where: { userId: dbUser.id }, orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, primaryCategory: true, address: true, lastSyncedAt: true },
    })
    return { success: true, data: rows.map(r => ({ id: r.id, title: r.title ?? '(sem nome)', primaryCategory: r.primaryCategory, address: r.address, lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null })) }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro' }
  }
}

export async function removeLocation(id: string): Promise<Result> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    const row = await prisma.gbpLocation.findUnique({ where: { id } })
    if (!row || row.userId !== dbUser.id) return { success: false, error: 'Local não encontrado' }
    await prisma.gbpLocation.delete({ where: { id } })
    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao remover' }
  }
}
