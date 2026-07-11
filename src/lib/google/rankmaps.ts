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
