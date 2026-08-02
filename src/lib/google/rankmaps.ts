// Rank no Google Maps via SerpApi (engine google_maps). Mostra a ordem real dos
// resultados para uma palavra-chave a partir da localização do negócio.

export function serpapiConfigured(): boolean {
  return Boolean(process.env.SERPAPI_KEY)
}

export type MapRankItem = {
  position: number
  title: string
  rating: number | null
  reviews: number
  address: string | null
  placeId: string | null
}

export type BusinessHit = {
  placeId: string | null
  title: string
  address: string | null
  category: string | null
  rating: number | null
  reviews: number
  lat: number | null
  lng: number | null
}

// Busca um negócio pelo nome (para a pessoa selecionar o correto).
export async function searchBusinesses(name: string): Promise<BusinessHit[]> {
  const key = process.env.SERPAPI_KEY
  if (!key) throw new Error('SERPAPI_NOT_CONFIGURED')
  const params = new URLSearchParams({ engine: 'google_maps', type: 'search', q: name, hl: 'pt-br', gl: 'br', api_key: key })
  const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`)
  const data = await res.json().catch(() => ({})) as Record<string, unknown>
  if (!res.ok || data.error) throw new Error(String(data.error || `SerpApi ${res.status}`).slice(0, 200))
  const local = Array.isArray(data.local_results) ? (data.local_results as Record<string, unknown>[]) : []
  const arr = local.length ? local : (data.place_results ? [data.place_results as Record<string, unknown>] : [])
  return arr.slice(0, 8).map(r => {
    const gps = r.gps_coordinates as Record<string, unknown> | undefined
    return {
      placeId: r.place_id ? String(r.place_id) : null,
      title: r.title ? String(r.title) : '(sem nome)',
      address: r.address ? String(r.address) : null,
      category: r.type ? String(r.type) : (Array.isArray(r.types) ? String((r.types as unknown[])[0]) : null),
      rating: typeof r.rating === 'number' ? (r.rating as number) : null,
      reviews: Number(r.reviews ?? 0),
      lat: gps && typeof gps.latitude === 'number' ? (gps.latitude as number) : null,
      lng: gps && typeof gps.longitude === 'number' ? (gps.longitude as number) : null,
    }
  })
}

export async function searchMapsRank(opts: { query: string; lat?: number | null; lng?: number | null }): Promise<MapRankItem[]> {
  const key = process.env.SERPAPI_KEY
  if (!key) throw new Error('SERPAPI_NOT_CONFIGURED')
  const params = new URLSearchParams({
    engine: 'google_maps',
    type: 'search',
    q: opts.query,
    hl: 'pt-br',
    gl: 'br',
    api_key: key,
  })
  if (opts.lat != null && opts.lng != null) params.set('ll', `@${opts.lat},${opts.lng},14z`)

  const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok || (data as Record<string, unknown>).error) {
    const msg = (data as Record<string, unknown>).error || `SerpApi ${res.status}`
    throw new Error(String(msg).slice(0, 220))
  }
  const local = Array.isArray((data as Record<string, unknown>).local_results)
    ? ((data as Record<string, unknown>).local_results as Record<string, unknown>[]) : []
  return local.map((r, i) => ({
    position: typeof r.position === 'number' ? (r.position as number) : i + 1,
    title: r.title ? String(r.title) : '(sem nome)',
    rating: typeof r.rating === 'number' ? (r.rating as number) : null,
    reviews: Number(r.reviews ?? 0),
    address: r.address ? String(r.address) : null,
    placeId: r.place_id ? String(r.place_id) : null,
  }))
}
