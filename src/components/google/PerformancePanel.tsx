'use client'

import { useState, useEffect, useCallback } from 'react'
import { getLocationPerformance, type PerformanceView, type PerfMetric, type DailyPoint } from '@/app/actions/google'

function fmt(n: number): string { return n.toLocaleString('pt-BR') }

const METRICAS_GRAFICO: { key: keyof Pick<DailyPoint, 'views' | 'calls' | 'directions' | 'website'>; label: string }[] = [
  { key: 'views', label: 'Visualizações' },
  { key: 'calls', label: 'Ligações' },
  { key: 'directions', label: 'Rotas' },
  { key: 'website', label: 'Site' },
]

function LineChart({ series, campo }: { series: DailyPoint[]; campo: 'views' | 'calls' | 'directions' | 'website' }) {
  if (series.length < 2) return <p className="text-[11px] text-gray-400 py-4 text-center">Poucos dados para o gráfico.</p>
  const W = 320, H = 90, pad = 4
  const vals = series.map(p => p[campo])
  const max = Math.max(1, ...vals)
  const stepX = (W - pad * 2) / (series.length - 1)
  const pts = vals.map((v, i) => [pad + i * stepX, H - pad - (v / max) * (H - pad * 2)] as [number, number])
  const linha = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = `${linha} L${pts[pts.length - 1][0].toFixed(1)},${H - pad} L${pts[0][0].toFixed(1)},${H - pad} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 100 }} preserveAspectRatio="none">
      <path d={area} fill="#3b82f6" opacity="0.1" />
      <path d={linha} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-[10px] text-gray-400">sem base</span>
  const up = pct >= 0
  const cls = Math.abs(pct) < 0.5 ? 'text-gray-400' : up ? 'text-green-600' : 'text-red-600'
  const arrow = Math.abs(pct) < 0.5 ? '→' : up ? '↑' : '↓'
  return <span className={`text-[11px] font-semibold ${cls}`}>{arrow} {Math.abs(pct).toFixed(0)}%</span>
}

const PERIODOS: { dias: number; label: string }[] = [
  { dias: 7, label: '7 dias' },
  { dias: 30, label: '30 dias' },
  { dias: 90, label: '90 dias' },
  { dias: 180, label: '180 dias' },
]

export function PerformancePanel({ id }: { id: string }) {
  const [perf, setPerf] = useState<PerformanceView | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [dias, setDias] = useState(30)
  const [campoGrafico, setCampoGrafico] = useState<'views' | 'calls' | 'directions' | 'website'>('views')

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(''); setPerf(null)
    const res = await getLocationPerformance(id, dias)
    if (res.success) setPerf(res.data)
    else setErro(res.error)
    setCarregando(false)
  }, [id, dias])

  useEffect(() => { carregar() }, [carregar])

  const cards = perf?.metrics.filter((m: PerfMetric) => m.core || m.total > 0 || m.prev > 0) ?? []
  const totalImpr = perf ? perf.impressionsBreakdown.reduce((a, b) => a + b.value, 0) : 0

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {PERIODOS.map(p => (
          <button key={p.dias} onClick={() => setDias(p.dias)} disabled={carregando}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors disabled:opacity-50 ${
              dias === p.dias
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      {carregando && (
        <div className="text-xs text-gray-500 py-4 flex items-center gap-2">
          <span className="inline-block w-3.5 h-3.5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          Carregando desempenho do Google...
        </div>
      )}

      {erro && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{erro}</div>}

      {perf && (
        <div className="space-y-3">
          <p className="text-[11px] text-gray-400">Últimos {perf.days} dias vs. {perf.days} dias anteriores (dados do Google têm ~2-3 dias de atraso).</p>

          {perf.semDados ? (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Ainda sem dados de desempenho suficientes. Perfis novos ou recém-verificados levam alguns dias para acumular métricas.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {cards.map(m => (
                  <div key={m.key} className="border border-gray-100 rounded-lg p-3">
                    <p className="text-[11px] text-gray-500">{m.label}</p>
                    <div className="flex items-end justify-between gap-1 mt-0.5">
                      <span className="text-lg font-bold text-gray-900 leading-none">{fmt(m.total)}</span>
                      <Delta pct={m.deltaPct} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Gráfico de evolução */}
              {perf.series.length >= 2 && (
                <div className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                    <p className="text-[11px] text-gray-500">Evolução por dia</p>
                    <div className="flex gap-1">
                      {METRICAS_GRAFICO.map(m => (
                        <button key={m.key} onClick={() => setCampoGrafico(m.key)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${campoGrafico === m.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <LineChart series={perf.series} campo={campoGrafico} />
                </div>
              )}

              {totalImpr > 0 && (
                <div className="border border-gray-100 rounded-lg p-3">
                  <p className="text-[11px] text-gray-500 mb-2">Onde te encontraram (visualizações)</p>
                  {perf.impressionsBreakdown.map(b => {
                    const pct = totalImpr > 0 ? Math.round((b.value / totalImpr) * 100) : 0
                    return (
                      <div key={b.label} className="mb-1.5 last:mb-0">
                        <div className="flex justify-between text-[11px] text-gray-600 mb-0.5">
                          <span>{b.label}</span><span>{fmt(b.value)} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-500 to-green-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Avaliações no período */}
              {perf.reviewsResumo && (
                <div className="border border-gray-100 rounded-lg p-3 flex items-center gap-4 text-xs">
                  <div>
                    <p className="text-[11px] text-gray-500">Novas avaliações</p>
                    <p className="text-lg font-bold text-gray-900 leading-none">+{perf.reviewsResumo.novasNoPeriodo}</p>
                    <p className="text-[10px] text-gray-400">no período</p>
                  </div>
                  <div className="h-8 w-px bg-gray-100" />
                  <div>
                    <p className="text-[11px] text-gray-500">Nota atual</p>
                    <p className="text-lg font-bold text-gray-900 leading-none">{perf.reviewsResumo.averageRating != null ? `⭐ ${perf.reviewsResumo.averageRating.toFixed(1)}` : '–'}</p>
                    <p className="text-[10px] text-gray-400">{fmt(perf.reviewsResumo.total)} no total</p>
                  </div>
                </div>
              )}

              {/* Palavras-chave que te encontraram */}
              {perf.keywords.length > 0 && (
                <div className="border border-gray-100 rounded-lg p-3">
                  <p className="text-[11px] text-gray-500 mb-2">🔑 Palavras que te encontraram no Google</p>
                  <div className="space-y-1">
                    {perf.keywords.slice(0, 12).map(k => (
                      <div key={k.keyword} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-gray-700 truncate">{k.keyword}</span>
                        <span className="text-gray-500 whitespace-nowrap">{k.abaixoDe ? '<' : ''}{fmt(k.count)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">Reforce essas palavras na descrição e nos serviços. (Dados mensais do Google.)</p>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end">
            <button onClick={carregar} disabled={carregando}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 disabled:opacity-50">
              🔄 Atualizar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
