// Business Profile Performance API — métricas de desempenho do perfil
// (visualizações, ligações, rotas, cliques no site, conversas, agendamentos).
// Compara os últimos 30 dias com os 30 dias anteriores.

import { GoogleApiError } from './business'

const PERF = 'https://businessprofileperformance.googleapis.com/v1'

const IMPRESSION_METRICS = [
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
]
const ACTION_METRICS = ['CALL_CLICKS', 'WEBSITE_CLICKS', 'BUSINESS_DIRECTION_REQUESTS', 'BUSINESS_CONVERSATIONS', 'BUSINESS_BOOKINGS']
const ALL_METRICS = [...IMPRESSION_METRICS, ...ACTION_METRICS]

// Dados do Google têm atraso de ~2-3 dias; ignoramos os dias mais recentes
// para comparar duas janelas "fechadas" de 30 dias.
const LAG = 3
const DAY = 86400000

async function gget(url: string, accessToken: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) {
    const b = await res.text()
    throw new GoogleApiError(res.status, `${res.status}: ${b.slice(0, 300)}`)
  }
  return res.json()
}

// converte Date/objeto {year,month,day} para inteiro comparável AAAAMMDD
function gdDate(d: Date): number { return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate() }
function gdObj(o: Record<string, unknown>): number { return Number(o.year) * 10000 + Number(o.month) * 100 + Number(o.day) }

export const PERIODOS_VALIDOS = [7, 30, 90, 180] as const

export type PerfMetric = { key: string; label: string; core: boolean; total: number; prev: number; deltaPct: number | null }
export type PerfResult = {
  days: number
  metrics: PerfMetric[]
  impressionsBreakdown: { label: string; value: number }[]
  semDados: boolean
}

export async function getPerformance(accessToken: string, locationName: string, days = 30): Promise<PerfResult> {
  // aceita só os períodos suportados (a Performance API tem ~18 meses de histórico)
  const janela = (PERIODOS_VALIDOS as readonly number[]).includes(days) ? days : 30

  const now = Date.now()
  const lastEnd = gdDate(new Date(now - LAG * DAY))
  const lastStart = gdDate(new Date(now - (LAG + janela) * DAY))
  const prevStart = gdDate(new Date(now - (LAG + 2 * janela) * DAY))

  const reqStart = new Date(now - (LAG + 2 * janela) * DAY)
  const reqEnd = new Date(now) // pede até hoje (dias sem dado simplesmente não vêm)
  const params = new URLSearchParams()
  for (const m of ALL_METRICS) params.append('dailyMetrics', m)
  params.set('dailyRange.startDate.year', String(reqStart.getUTCFullYear()))
  params.set('dailyRange.startDate.month', String(reqStart.getUTCMonth() + 1))
  params.set('dailyRange.startDate.day', String(reqStart.getUTCDate()))
  params.set('dailyRange.endDate.year', String(reqEnd.getUTCFullYear()))
  params.set('dailyRange.endDate.month', String(reqEnd.getUTCMonth() + 1))
  params.set('dailyRange.endDate.day', String(reqEnd.getUTCDate()))

  const url = `${PERF}/${locationName}:fetchMultiDailyMetricsTimeSeries?${params.toString()}`
  const data = await gget(url, accessToken) as Record<string, unknown>

  const sumLast: Record<string, number> = {}
  const sumPrev: Record<string, number> = {}
  let anyData = false

  const blocks = Array.isArray(data.multiDailyMetricTimeSeries) ? (data.multiDailyMetricTimeSeries as Record<string, unknown>[]) : []
  for (const b of blocks) {
    const series = Array.isArray(b.dailyMetricTimeSeries) ? (b.dailyMetricTimeSeries as Record<string, unknown>[]) : []
    for (const dm of series) {
      const metric = String(dm.dailyMetric ?? '')
      const ts = dm.timeSeries as Record<string, unknown> | undefined
      const values = Array.isArray(ts?.datedValues) ? (ts!.datedValues as Record<string, unknown>[]) : []
      for (const point of values) {
        const v = Number(point.value ?? 0)
        const dObj = point.date as Record<string, unknown> | undefined
        if (!dObj) continue
        const di = gdObj(dObj)
        if (v > 0) anyData = true
        if (di > lastStart && di <= lastEnd) sumLast[metric] = (sumLast[metric] || 0) + v
        else if (di > prevStart && di <= lastStart) sumPrev[metric] = (sumPrev[metric] || 0) + v
      }
    }
  }

  const sumOf = (keys: string[], bag: Record<string, number>) => keys.reduce((a, k) => a + (bag[k] || 0), 0)
  const mk = (key: string, label: string, keys: string[], core: boolean): PerfMetric => {
    const total = sumOf(keys, sumLast)
    const prev = sumOf(keys, sumPrev)
    return { key, label, core, total, prev, deltaPct: prev > 0 ? ((total - prev) / prev) * 100 : null }
  }

  const metrics: PerfMetric[] = [
    mk('views', 'Visualizações', IMPRESSION_METRICS, true),
    mk('calls', 'Ligações', ['CALL_CLICKS'], true),
    mk('directions', 'Rotas (Maps)', ['BUSINESS_DIRECTION_REQUESTS'], true),
    mk('website', 'Cliques no site', ['WEBSITE_CLICKS'], true),
    mk('conversations', 'Conversas', ['BUSINESS_CONVERSATIONS'], false),
    mk('bookings', 'Agendamentos', ['BUSINESS_BOOKINGS'], false),
  ]

  const impressionsBreakdown = [
    { label: 'Busca (Search)', value: sumOf(['BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH'], sumLast) },
    { label: 'Mapas (Maps)', value: sumOf(['BUSINESS_IMPRESSIONS_DESKTOP_MAPS', 'BUSINESS_IMPRESSIONS_MOBILE_MAPS'], sumLast) },
  ]

  return { days: janela, metrics, impressionsBreakdown, semDados: !anyData }
}
