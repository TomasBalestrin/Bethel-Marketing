'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { googleConfigured } from '@/lib/google/oauth'
import { getValidAccessToken } from '@/lib/google/tokens'
import {
  listAllLocations, getLocationDetails, updateLocationDetails, updateLocationHours, updateLocationAddress,
  searchCategories, updateLocationCategories, updateLocationServices, GoogleApiError,
  type GbpLocationDetails, type GbpCategory,
} from '@/lib/google/business'

import { analyzeProfile } from '@/lib/google/recommendations'
import { getPerformance } from '@/lib/google/performance'
import { placesConfigured, getPlaceById, searchCompetitors, type Competitor } from '@/lib/google/competitors'
import { listReviews, replyToReview, draftReply } from '@/lib/google/reviews'
import { serpapiConfigured, searchMapsRank, type MapRankItem } from '@/lib/google/rankmaps'

export type { GbpLocationDetails, GbpCategory } from '@/lib/google/business'
export type { GbpRecommendation, GbpRoutineItem, GbpAnalysis } from '@/lib/google/recommendations'
export type { PerfResult, PerfMetric } from '@/lib/google/performance'
export type { GbpReview, ReviewsResult } from '@/lib/google/reviews'
export type { MapRankItem } from '@/lib/google/rankmaps'

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

// Salva horários. `dias` = para cada dia, seus intervalos "HH:MM"; dia sem intervalos = fechado.
export async function saveLocationHours(
  id: string, dias: { day: string; intervals: { open: string; close: string }[] }[],
): Promise<Result> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    const row = await prisma.gbpLocation.findUnique({ where: { id } })
    if (!row || row.userId !== dbUser.id) return { success: false, error: 'Perfil não encontrado' }
    const token = await getValidAccessToken(dbUser.id)
    if (!token) return { success: false, error: 'Conta Google não conectada' }

    const hm = (s: string) => {
      const [h, m] = s.split(':').map(Number)
      return { hours: h || 0, minutes: m || 0 }
    }
    const periods = []
    for (const d of dias) {
      for (const iv of d.intervals) {
        if (!iv.open || !iv.close || iv.open >= iv.close) continue
        periods.push({ openDay: d.day, openTime: hm(iv.open), closeDay: d.day, closeTime: hm(iv.close) })
      }
    }
    await updateLocationHours(token, row.locationName, periods)
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof GoogleApiError && e.status === 403) return { success: false, error: 'Sem permissão para editar este perfil (verifique se você é proprietário/gerente).' }
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao salvar horários' }
  }
}

export async function buscarCategorias(term: string): Promise<Result<GbpCategory[]>> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    const token = await getValidAccessToken(dbUser.id)
    if (!token) return { success: false, error: 'Conta Google não conectada' }
    const cats = await searchCategories(token, term)
    return { success: true, data: cats }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao buscar categorias' }
  }
}

export async function saveLocationCategories(
  id: string, primaryName: string, additionalNames: string[],
): Promise<Result> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    const row = await prisma.gbpLocation.findUnique({ where: { id } })
    if (!row || row.userId !== dbUser.id) return { success: false, error: 'Perfil não encontrado' }
    const token = await getValidAccessToken(dbUser.id)
    if (!token) return { success: false, error: 'Conta Google não conectada' }
    if (!primaryName) return { success: false, error: 'Selecione uma categoria principal.' }
    await updateLocationCategories(token, row.locationName, primaryName, additionalNames.slice(0, 9))
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof GoogleApiError && e.status === 403) return { success: false, error: 'Sem permissão para editar este perfil (verifique se você é proprietário/gerente).' }
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao salvar categorias' }
  }
}

export async function saveLocationServices(
  id: string, items: { displayName: string; description: string }[],
): Promise<Result> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    const row = await prisma.gbpLocation.findUnique({ where: { id } })
    if (!row || row.userId !== dbUser.id) return { success: false, error: 'Perfil não encontrado' }
    const token = await getValidAccessToken(dbUser.id)
    if (!token) return { success: false, error: 'Conta Google não conectada' }
    await updateLocationServices(token, row.locationName, items.slice(0, 100))
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof GoogleApiError && e.status === 403) return { success: false, error: 'Sem permissão para editar este perfil (verifique se você é proprietário/gerente).' }
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao salvar serviços' }
  }
}

export async function saveLocationAddress(
  id: string,
  address: { addressLines: string[]; locality: string; administrativeArea: string; postalCode: string; regionCode?: string },
): Promise<Result> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    const row = await prisma.gbpLocation.findUnique({ where: { id } })
    if (!row || row.userId !== dbUser.id) return { success: false, error: 'Perfil não encontrado' }
    const token = await getValidAccessToken(dbUser.id)
    if (!token) return { success: false, error: 'Conta Google não conectada' }
    if (!address.addressLines.some(l => l.trim()) || !address.locality.trim()) {
      return { success: false, error: 'Preencha ao menos o logradouro e a cidade.' }
    }
    await updateLocationAddress(token, row.locationName, {
      regionCode: address.regionCode || 'BR',
      addressLines: address.addressLines,
      locality: address.locality,
      administrativeArea: address.administrativeArea,
      postalCode: address.postalCode,
    })
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof GoogleApiError && e.status === 403) return { success: false, error: 'Sem permissão para editar este perfil (verifique se você é proprietário/gerente).' }
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao salvar endereço' }
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
  lista: Competitor[]     // todos (inclui o próprio, se localizado); ordenação é no cliente
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

    // mantém a ORDEM do Google (relevância/ranking da busca); marca o próprio negócio
    const lista = encontrados.slice(0, 20).map(c =>
      row.placeId && c.placeId === row.placeId ? { ...c, isSelf: true } : c
    )
    let self: Competitor | null = lista.find(c => c.isSelf) ?? null
    if (!self && row.placeId) {
      const fetched = await getPlaceById(row.placeId)
      if (fetched) self = { ...fetched, isSelf: true }
    }

    return { success: true, data: { self, lista, categoria, cidade } }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao buscar concorrentes' }
  }
}

// ── Rank no Mapa (SerpApi) ─────────────────────────────────────────────────────

export type MapRankResult = { query: string; items: MapRankItem[]; minhaPosicao: number | null; cidade: string | null }

export async function rankNoMapa(id: string, query: string): Promise<Result<MapRankResult> & { naoConfigurado?: boolean }> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  if (!serpapiConfigured()) {
    return { success: false, error: 'A chave do SerpApi (SERPAPI_KEY) ainda não foi configurada no servidor.', naoConfigurado: true }
  }
  const termo = query.trim()
  if (!termo) return { success: false, error: 'Digite uma palavra-chave.' }
  try {
    const row = await prisma.gbpLocation.findUnique({ where: { id } })
    if (!row || row.userId !== dbUser.id) return { success: false, error: 'Perfil não encontrado' }
    const token = await getValidAccessToken(dbUser.id)
    if (!token) return { success: false, error: 'Conta Google não conectada' }

    const det = await getLocationDetails(token, row.locationName)
    const raw = await searchMapsRank({ query: termo, lat: det.lat, lng: det.lng })

    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

    // Filtra para a cidade do perfil (remove cidades vizinhas). Fallback: se cortar
    // demais (nome da cidade n\u00e3o bate nos endere\u00e7os), mant\u00e9m a lista completa.
    let items = raw
    if (det.city) {
      const nc = norm(det.city)
      const doMunicipio = raw.filter(it => it.address && norm(it.address).includes(nc))
      if (doMunicipio.length >= 3) items = doMunicipio
    }
    items = items.map((it, i) => ({ ...it, position: i + 1 }))

    const alvo = norm(det.title)
    const idx = items.findIndex(it => (row.placeId && it.placeId === row.placeId) || norm(it.title) === alvo)

    return { success: true, data: { query: termo, items, minhaPosicao: idx >= 0 ? idx + 1 : null, cidade: det.city } }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao consultar o rank' }
  }
}

// ── Avaliações (API v4) ────────────────────────────────────────────────────────

async function reviewLocation(id: string) {
  const dbUser = await getDbUser()
  if (!dbUser) return { ok: false as const, error: 'Não autorizado' }
  const row = await prisma.gbpLocation.findUnique({ where: { id } })
  if (!row || row.userId !== dbUser.id) return { ok: false as const, error: 'Perfil não encontrado' }
  const token = await getValidAccessToken(dbUser.id)
  if (!token) return { ok: false as const, error: 'Conta Google não conectada' }
  if (!row.accountName) return { ok: false as const, error: 'Conta do perfil não identificada. Remova e reconecte este perfil.' }
  return { ok: true as const, row, token, dbUser, accountName: row.accountName, locationName: row.locationName }
}

function reviewApiError(e: unknown): string {
  if (e instanceof GoogleApiError) {
    const detalhe = e.message.replace(/^\d+:\s*/, '').slice(0, 220)
    if (e.status === 403) {
      return `Avaliações bloqueadas (403). Ative a "Google My Business API" (mybusiness.googleapis.com) no Google Cloud e confirme que a conta conectada é gerente/proprietária do perfil. Detalhe do Google: ${detalhe}`
    }
    if (e.status === 404) {
      return `Perfil não encontrado na API v4 (404). Detalhe do Google: ${detalhe}`
    }
    return `Erro nas avaliações (${e.status}). Detalhe: ${detalhe}`
  }
  return e instanceof Error ? e.message : 'Erro nas avaliações'
}

export async function getLocationReviews(id: string): Promise<Result<import('@/lib/google/reviews').ReviewsResult>> {
  const ctx = await reviewLocation(id)
  if (!ctx.ok) return { success: false, error: ctx.error }
  try {
    const data = await listReviews(ctx.token, ctx.accountName, ctx.locationName)
    return { success: true, data }
  } catch (e) {
    return { success: false, error: reviewApiError(e) }
  }
}

export async function draftReviewReply(
  id: string, review: { stars: number; comment: string | null; reviewerName: string },
): Promise<Result<{ texto: string }>> {
  const ctx = await reviewLocation(id)
  if (!ctx.ok) return { success: false, error: ctx.error }
  try {
    const texto = await draftReply({
      businessName: ctx.row.title ?? 'nosso negócio',
      stars: review.stars, comment: review.comment, reviewerName: review.reviewerName,
    })
    return { success: true, data: { texto } }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao gerar resposta' }
  }
}

export async function sendReviewReply(id: string, reviewId: string, comment: string): Promise<Result> {
  const ctx = await reviewLocation(id)
  if (!ctx.ok) return { success: false, error: ctx.error }
  const texto = comment.trim()
  if (!texto) return { success: false, error: 'A resposta está vazia.' }
  try {
    await replyToReview(ctx.token, ctx.accountName, ctx.locationName, reviewId, texto)
    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: reviewApiError(e) }
  }
}
