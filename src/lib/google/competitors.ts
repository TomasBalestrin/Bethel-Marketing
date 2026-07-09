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
  address: string | null
  isSelf?: boolean
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
  return {
    placeId: p.id ? String(p.id) : null,
    name: dn?.text ? String(dn.text) : '(sem nome)',
    rating: typeof p.rating === 'number' ? (p.rating as number) : null,
    reviews: Number(p.userRatingCount ?? 0),
    fotos: photos.length,
    address: p.formattedAddress ? String(p.formattedAddress) : null,
  }
}

const FIELDS = 'places.id,places.displayName,places.rating,places.userRatingCount,places.formattedAddress,places.photos'
const FIELDS_ONE = 'id,displayName,rating,userRatingCount,formattedAddress,photos'

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
