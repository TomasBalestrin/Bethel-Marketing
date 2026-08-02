// Volume de busca mensal via DataForSEO (dados do Google Ads / Keyword Planner).
// Credenciais em variáveis de ambiente (Basic auth login:senha). Nunca no código.
// DATAFORSEO_SANDBOX=1 usa o sandbox (dados fictícios, grátis) para testes.

export function dataforseoConfigured(): boolean {
  return Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD)
}

export async function getSearchVolume(keywords: string[]): Promise<Record<string, number | null>> {
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  const out: Record<string, number | null> = {}
  const termos = [...new Set(keywords.map(k => k.trim().toLowerCase()).filter(Boolean))].slice(0, 700)
  if (!login || !password || termos.length === 0) return out

  const base = process.env.DATAFORSEO_SANDBOX === '1' ? 'https://sandbox.dataforseo.com' : 'https://api.dataforseo.com'
  const auth = Buffer.from(`${login}:${password}`).toString('base64')

  const res = await fetch(`${base}/v3/keywords_data/google_ads/search_volume/live`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ keywords: termos, location_name: 'Brazil', language_name: 'Portuguese' }]),
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new Error(`DataForSEO ${res.status}`)

  const tasks = Array.isArray(data.tasks) ? (data.tasks as Record<string, unknown>[]) : []
  const result = Array.isArray(tasks[0]?.result) ? (tasks[0].result as Record<string, unknown>[]) : []
  for (const r of result) {
    const kw = String(r.keyword ?? '').toLowerCase()
    if (!kw) continue
    out[kw] = typeof r.search_volume === 'number' ? (r.search_volume as number) : null
  }
  return out
}
