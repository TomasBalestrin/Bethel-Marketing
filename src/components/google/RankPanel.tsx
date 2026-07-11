'use client'

import { useState, useMemo } from 'react'
import { gridRank, type GridRankResult } from '@/app/actions/google'
import { RankMap, type MapPoint } from './RankMap'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
const keyOf = (placeId: string | null, title: string) => placeId || norm(title)

export function RankPanel({ id }: { id: string }) {
  const [termo, setTermo] = useState('')
  const [size, setSize] = useState(3)
  const [data, setData] = useState<GridRankResult | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [naoConfig, setNaoConfig] = useState(false)
  const [selKey, setSelKey] = useState<string | null>(null)

  async function buscar() {
    if (!termo.trim()) return
    setCarregando(true); setErro(''); setNaoConfig(false); setData(null)
    const res = await gridRank(id, termo, size)
    if (res.success) { setData(res.data); setSelKey(res.data.selfKey) }
    else { setErro(res.error); setNaoConfig(Boolean(res.naoConfigurado)) }
    setCarregando(false)
  }

  // pontos do mapa para o negócio selecionado (sem custo extra de API)
  const points = useMemo<MapPoint[]>(() => {
    if (!data || !selKey) return []
    return data.cells.map(c => {
      const r = c.results.find(x => keyOf(x.placeId, x.title) === selKey)
      return { lat: c.lat, lng: c.lng, position: r ? r.position : null }
    })
  }, [data, selKey])

  const resumo = useMemo(() => {
    const achados = points.filter(p => p.position != null)
    const media = achados.length ? achados.reduce((s, p) => s + (p.position as number), 0) / achados.length : null
    return { encontrados: achados.length, total: points.length, media }
  }, [points])

  const selBiz = data?.ranking.find(b => b.key === selKey)

  return (
    <div>
      <p className="text-xs text-gray-500 mb-2">
        Posição no Google Maps para uma palavra-chave, medida em vários pontos ao redor do negócio. Clique num concorrente para ver o mapa dele.
      </p>

      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[11px] text-gray-400">Pontos:</span>
        {[3, 5].map(s => (
          <button key={s} onClick={() => setSize(s)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${size === s ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {s}×{s} ({s * s})
          </button>
        ))}
        <span className="text-[10px] text-amber-600 ml-1">usa {size * size} consultas</span>
      </div>

      <div className="flex gap-2 mb-3">
        <input value={termo} onChange={e => setTermo(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscar()}
          placeholder="Ex: pizzaria, estética facial..."
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300" />
        <button onClick={buscar} disabled={carregando || !termo.trim()}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 disabled:opacity-40">
          {carregando ? '...' : 'Buscar'}
        </button>
      </div>

      {carregando && (
        <div className="text-xs text-gray-500 py-4 flex items-center gap-2">
          <span className="inline-block w-3.5 h-3.5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          Consultando {size * size} pontos no mapa...
        </div>
      )}

      {naoConfig && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
          <p className="font-semibold">Configuração pendente do SerpApi</p>
          <p>Adicione a variável <code className="bg-amber-100 px-1 rounded">SERPAPI_KEY</code> na Vercel e faça um redeploy.</p>
        </div>
      )}
      {erro && !naoConfig && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{erro}</div>}

      {data && (
        <div className="space-y-3">
          <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-100 rounded-lg p-3 text-sm text-gray-700">
            Vendo <b>{selBiz?.title ?? 'seu negócio'}</b>{selBiz?.isSelf ? ' (você)' : ''} para <b>{data.query}</b>
            {data.cidade ? <> em <b>{data.cidade}</b></> : null}: aparece em{' '}
            <b className="text-blue-700">{resumo.encontrados} de {resumo.total}</b> pontos
            {resumo.media != null && <> · posição média <b>{resumo.media.toFixed(1)}</b></>}.
          </div>

          {/* Mapa real */}
          <RankMap points={points} />

          {/* Legenda */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center text-[10px] text-gray-500">
            <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#16a34a' }} />1º-3º</span>
            <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#84cc16' }} />4º-7º</span>
            <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#f59e0b' }} />8º-10º</span>
            <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#ef4444' }} />11º+</span>
            <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#9ca3af' }} />fora do top 20</span>
          </div>

          {/* Ranking competitivo */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1">Ranking para &quot;{data.query}&quot; na região <span className="font-normal text-gray-400">(por posição média · clique para ver no mapa)</span></p>
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <div className="grid grid-cols-[28px_1fr_auto_auto] gap-2 px-3 py-2 bg-gray-50 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                <span>#</span><span>Negócio</span><span className="text-right">Pos. média</span><span className="text-right">Cobertura</span>
              </div>
              {data.ranking.map((b, i) => (
                <button key={b.key} onClick={() => setSelKey(b.key)}
                  className={`w-full grid grid-cols-[28px_1fr_auto_auto] gap-2 px-3 py-2 text-xs items-center border-t border-gray-50 text-left hover:bg-gray-50 ${b.key === selKey ? 'bg-blue-50' : ''} ${b.isSelf ? 'font-semibold' : ''}`}>
                  <span className="text-gray-400">{i + 1}</span>
                  <span className="truncate text-gray-800">{b.title}{b.isSelf && <span className="text-blue-600"> (você)</span>}</span>
                  <span className="text-right text-gray-700">{b.avg.toFixed(1)}</span>
                  <span className="text-right text-gray-500">{b.coverage}/{data.total}</span>
                </button>
              ))}
            </div>
            {!data.ranking.some(b => b.isSelf) && (
              <p className="text-[10px] text-amber-600 mt-1">Seu negócio não apareceu em nenhum ponto para essa palavra — sinal forte de que precisa otimizar.</p>
            )}
          </div>

          <p className="text-[10px] text-gray-400">Dados reais do Google Maps (SerpApi). &quot;Cobertura&quot; = em quantos pontos o negócio aparece. Uma só busca já traz todos os concorrentes.</p>
        </div>
      )}
    </div>
  )
}
