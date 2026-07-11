'use client'

import { useState } from 'react'
import { rankNoMapa, type MapRankResult } from '@/app/actions/google'

function fmt(n: number): string { return n.toLocaleString('pt-BR') }

export function RankPanel({ id }: { id: string }) {
  const [termo, setTermo] = useState('')
  const [data, setData] = useState<MapRankResult | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [naoConfig, setNaoConfig] = useState(false)

  async function buscar() {
    if (!termo.trim()) return
    setCarregando(true); setErro(''); setNaoConfig(false); setData(null)
    const res = await rankNoMapa(id, termo)
    if (res.success) setData(res.data)
    else { setErro(res.error); setNaoConfig(Boolean(res.naoConfigurado)) }
    setCarregando(false)
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-2">
        Veja em que posição seu negócio aparece no Google Maps para uma palavra-chave, a partir da sua localização.
      </p>

      <div className="flex gap-2 mb-3">
        <input value={termo} onChange={e => setTermo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && buscar()}
          placeholder="Ex: pizzaria, dentista, estética facial..."
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300" />
        <button onClick={buscar} disabled={carregando || !termo.trim()}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 disabled:opacity-40">
          {carregando ? '...' : 'Buscar'}
        </button>
      </div>

      {naoConfig && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
          <p className="font-semibold">Configuração pendente do SerpApi</p>
          <p>Adicione a variável <code className="bg-amber-100 px-1 rounded">SERPAPI_KEY</code> na Vercel e faça um redeploy.</p>
        </div>
      )}
      {erro && !naoConfig && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{erro}</div>}

      {data && (
        <div className="space-y-3">
          {data.minhaPosicao != null ? (
            <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-100 rounded-lg p-3 text-sm text-gray-700">
              Para <b>{data.query}</b>{data.cidade ? <> em <b>{data.cidade}</b></> : null}, você aparece em{' '}
              <b className="text-blue-700">{data.minhaPosicao}º</b> no Maps.
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              Você <b>não apareceu</b> entre os {data.items.length} primeiros para <b>{data.query}</b>. Sinal de que dá pra otimizar (categoria, avaliações, atividade).
            </div>
          )}

          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <div className="grid grid-cols-[28px_1fr_auto] gap-2 px-3 py-2 bg-gray-50 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              <span>#</span><span>Negócio</span><span className="text-right">Nota / Aval.</span>
            </div>
            {data.items.map((it, i) => {
              const eu = data.minhaPosicao === i + 1
              return (
                <div key={(it.placeId ?? '') + i}
                  className={`grid grid-cols-[28px_1fr_auto] gap-2 px-3 py-2 text-xs items-center border-t border-gray-50 ${eu ? 'bg-blue-50/70 font-semibold' : ''}`}>
                  <span className="text-gray-400">{i + 1}</span>
                  <span className="truncate text-gray-800">{it.title}{eu && <span className="text-blue-600"> (você)</span>}</span>
                  <span className="text-right text-gray-600 whitespace-nowrap">{it.rating != null ? `⭐ ${it.rating.toFixed(1)}` : '–'} · {fmt(it.reviews)}</span>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-gray-400">Dados reais do Google Maps via SerpApi, a partir da localização do seu perfil. É o começo do rank tracking (depois dá pra virar um mapa/grid).</p>
        </div>
      )}
    </div>
  )
}
