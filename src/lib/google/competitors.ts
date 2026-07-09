// Comparação com concorrentes via Places API (New) do Google Maps Platform.
// Usa uma API KEY (GOOGLE_PLACES_API_KEY), não o OAuth da conta. Requer billing.

const PLACES = 'https://places.googleapis.com/v1'

export function placesConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY)
}

export type Competitor = {
  placeId: string | null
  name: string
  rating: number | null
  reviews: number
  fotos: number
  temSite: boolean
  temTelefone: boolean
  temHorarios: boolean
  temDescricao: boolean
  score: number        // 0-100, otimização do perfil pelos sinais públicos
  address: string | null
  isSelf?: boolean
}

// Score de otimização (0-100) a partir dos sinais públicos da Places API.
function scoreOf(c: Omit<Competitor, 'score'>): number {
  let s = 0
  s += ((c.rating ?? 0) / 5) * 25                                   // nota: até 25
  s += Math.min(1, Math.log10(c.reviews + 1) / Math.log10(201)) * 30 // avaliações (log, ~200 = cheio): até 30
  if (c.temSite) s += 12
  if (c.temTelefone) s += 8
  if (c.temHorarios) s += 10
  s += (Math.min(c.fotos, 10) / 10) * 10                            // fotos (amostra): até 10
  if (c.temDescricao) s += 5
  return Math.round(s)
}

async function placesFetch(path: string, fieldMask: string, init?: RequestInit) {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) throw new Error('PLACES_NOT_CONFIGURED')
  const res = await fetch(`${PLACES}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': fieldMask,
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Places ${res.status}: ${t.slice(0, 300)}`)
  }
  return res.json()
}

function mapPlace(p: Record<string, unknown>): Competitor {
  const dn = p.displayName as Record<string, unknown> | undefined
  const photos = Array.isArray(p.photos) ? (p.photos as unknown[]) : []
  const editorial = p.editorialSummary as Record<string, unknown> | undefined
  const base = {
    placeId: p.id ? String(p.id) : null,
    name: dn?.text ? String(dn.text) : '(sem nome)',
    rating: typeof p.rating === 'number' ? (p.rating as number) : null,
    reviews: Number(p.userRatingCount ?? 0),
    fotos: photos.length,
    temSite: Boolean(p.websiteUri),
    temTelefone: Boolean(p.nationalPhoneNumber),
    temHorarios: Boolean(p.regularOpeningHours),
    temDescricao: Boolean(editorial?.text),
    address: p.formattedAddress ? String(p.formattedAddress) : null,
  }
  return { ...base, score: scoreOf(base) }
}

const BASE_FIELDS = 'id,displayName,rating,userRatingCount,formattedAddress,photos,websiteUri,nationalPhoneNumber,regularOpeningHours,editorialSummary'
const FIELDS = BASE_FIELDS.split(',').map(f => `places.${f}`).join(',')
const FIELDS_ONE = BASE_FIELDS

export async function getPlaceById(placeId: string): Promise<Competitor | null> {
  try {
    const p = await placesFetch(`/places/${encodeURIComponent(placeId)}?languageCode=pt-BR`, FIELDS_ONE, { method: 'GET' })
    return mapPlace(p as Record<string, unknown>)
  } catch {
    return null
  }
}

export async function searchCompetitors(opts: {
  category: string
  city: string
  lat?: number | null
  lng?: number | null
}): Promise<Competitor[]> {
  const body: Record<string, unknown> = {
    textQuery: `${opts.category} em ${opts.city}`,
    languageCode: 'pt-BR',
    maxResultCount: 20,
  }
  if (opts.lat != null && opts.lng != null) {
    body.locationBias = { circle: { center: { latitude: opts.lat, longitude: opts.lng }, radius: 15000 } }
  }
  const data = await placesFetch('/places:searchText', FIELDS, { method: 'POST', body: JSON.stringify(body) })
  const places = Array.isArray((data as Record<string, unknown>).places) ? ((data as Record<string, unknown>).places as Record<string, unknown>[]) : []
  return places.map(mapPlace)
}
