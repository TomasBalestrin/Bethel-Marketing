'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { googleConfigured } from '@/lib/google/oauth'
import { getValidAccessToken } from '@/lib/google/tokens'
import {
  listAllLocations, getLocationDetails, updateLocationDetails, GoogleApiError,
  type GbpLocationDetails,
} from '@/lib/google/business'

import { analyzeProfile } from '@/lib/google/recommendations'
import { getPerformance } from '@/lib/google/performance'
import { placesConfigured, getPlaceById, searchCompetitors, type Competitor } from '@/lib/google/competitors'

export type { GbpLocationDetails } from '@/lib/google/business'
export type { GbpRecommendation, GbpRoutineItem, GbpAnalysis } from '@/lib/google/recommendations'
export type { PerfResult, PerfMetric } from '@/lib/google/performance'

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

// ── Perfil (ver + editar) ──────────────────────────────────────────────────────

export async function getLocationProfile(id: string): Promise<Result<GbpLocationDetails>> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    const row = await prisma.gbpLocation.findUnique({ where: { id } })
    if (!row || row.userId !== dbUser.id) return { success: false, error: 'Perfil não encontrado' }
    const token = await getValidAccessToken(dbUser.id)
    if (!token) return { success: false, error: 'Conta Google não conectada' }
    const details = await getLocationDetails(token, row.locationName)
    return { success: true, data: details }
  } catch (e) {
    if (e instanceof GoogleApiError && e.status === 403) return { success: false, error: 'Acesso à API ainda não aprovado pelo Google.' }
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao carregar perfil' }
  }
}

export async function saveLocationProfile(
  id: string,
  patch: { title?: string; phone?: string; website?: string; description?: string },
): Promise<Result> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    const row = await prisma.gbpLocation.findUnique({ where: { id } })
    if (!row || row.userId !== dbUser.id) return { success: false, error: 'Perfil não encontrado' }
    const token = await getValidAccessToken(dbUser.id)
    if (!token) return { success: false, error: 'Conta Google não conectada' }
    await updateLocationDetails(token, row.locationName, patch)
    // Atualiza o cache local dos campos que guardamos
    await prisma.gbpLocation.update({
      where: { id },
      data: {
        title: patch.title ?? row.title,
        phone: patch.phone ?? row.phone,
        website: patch.website ?? row.website,
        lastSyncedAt: new Date(),
      },
    })
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof GoogleApiError && e.status === 403) return { success: false, error: 'Sem permissão para editar este perfil (verifique se você é proprietário/gerente).' }
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao salvar' }
  }
}

// ── Recomendações IA ───────────────────────────────────────────────────────────

export async function getLocationRecommendations(id: string): Promise<Result<import('@/lib/google/recommendations').GbpAnalysis>> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    const row = await prisma.gbpLocation.findUnique({ where: { id } })
    if (!row || row.userId !== dbUser.id) return { success: false, error: 'Perfil não encontrado' }
    const token = await getValidAccessToken(dbUser.id)
    if (!token) return { success: false, error: 'Conta Google não conectada' }
    const det = await getLocationDetails(token, row.locationName)
    const analise = await analyzeProfile(det)
    if (analise.recomendacoes.length === 0 && analise.rotina.length === 0) {
      return { success: false, error: 'Não foi possível gerar recomendações agora. Tente novamente.' }
    }
    return { success: true, data: analise }
  } catch (e) {
    if (e instanceof GoogleApiError && e.status === 403) return { success: false, error: 'Acesso à API ainda não aprovado pelo Google.' }
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao gerar recomendações' }
  }
}

// ── Desempenho ─────────────────────────────────────────────────────────────────

export async function getLocationPerformance(id: string, days = 30): Promise<Result<import('@/lib/google/performance').PerfResult>> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    const row = await prisma.gbpLocation.findUnique({ where: { id } })
    if (!row || row.userId !== dbUser.id) return { success: false, error: 'Perfil não encontrado' }
    const token = await getValidAccessToken(dbUser.id)
    if (!token) return { success: false, error: 'Conta Google não conectada' }
    const perf = await getPerformance(token, row.locationName, days)
    return { success: true, data: perf }
  } catch (e) {
    if (e instanceof GoogleApiError && (e.status === 403 || e.status === 404)) {
      return { success: false, error: 'Ative a Business Profile Performance API no Google Cloud e confirme que o perfil está verificado.' }
    }
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao carregar desempenho' }
  }
}

// ── Concorrentes (Places API) ──────────────────────────────────────────────────

export type CompetitorsResult = {
  self: Competitor | null
  ranking: Competitor[]   // inclui o próprio negócio, ordenado por nº de avaliações
  posicao: number | null  // posição (1-based) do próprio negócio no ranking
  total: number
  categoria: string
  cidade: string
}

export async function getLocationCompetitors(id: string): Promise<Result<CompetitorsResult> & { naoConfigurado?: boolean }> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  if (!placesConfigured()) {
    return { success: false, error: 'A chave da Places API (GOOGLE_PLACES_API_KEY) ainda não foi configurada no servidor.', naoConfigurado: true }
  }
  try {
    const row = await prisma.gbpLocation.findUnique({ where: { id } })
    if (!row || row.userId !== dbUser.id) return { success: false, error: 'Perfil não encontrado' }
    const token = await getValidAccessToken(dbUser.id)
    if (!token) return { success: false, error: 'Conta Google não conectada' }

    const det = await getLocationDetails(token, row.locationName)
    const categoria = det.primaryCategory
    const cidade = det.city || (row.address ? row.address.split(' — ')[1] : null) || null
    if (!categoria) return { success: false, error: 'O perfil não tem categoria principal definida para comparar.' }
    if (!cidade) return { success: false, error: 'O perfil não tem cidade/endereço para comparar concorrentes.' }

    const encontrados = await searchCompetitors({ category: categoria, city: cidade, lat: det.lat, lng: det.lng })

    // próprio negócio (por placeId, se tivermos)
    let self: Competitor | null = row.placeId
      ? encontrados.find(c => c.placeId === row.placeId) ?? await getPlaceById(row.placeId)
      : null
    if (self) self = { ...self, isSelf: true }

    // ranking = concorrentes (sem o próprio) + o próprio, por nº de avaliações
    const outros = encontrados.filter(c => !(row.placeId && c.placeId === row.placeId))
    const ranking = [...outros, ...(self ? [self] : [])]
      .sort((a, b) => b.reviews - a.reviews || (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 15)
    const posicao = self ? ranking.findIndex(c => c.isSelf) + 1 : null

    return { success: true, data: { self, ranking, posicao: posicao && posicao > 0 ? posicao : null, total: ranking.length, categoria, cidade } }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao buscar concorrentes' }
  }
}
