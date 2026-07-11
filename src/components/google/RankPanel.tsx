'use client'

import { useState } from 'react'
import { gridRank, type GridRankResult } from '@/app/actions/google'

function cellStyle(pos: number | null): { bg: string; texto: string } {
  if (pos == null) return { bg: '#d1d5db', texto: '?' }        // cinza
  if (pos <= 3) return { bg: '#16a34a', texto: String(pos) }   // verde forte
  if (pos <= 7) return { bg: '#84cc16', texto: String(pos) }   // lima
  if (pos <= 10) return { bg: '#f59e0b', texto: String(pos) }  // laranja
  return { bg: '#ef4444', texto: pos > 20 ? '20+' : String(pos) } // vermelho
}

export function RankPanel({ id }: { id: string }) {
  const [termo, setTermo] = useState('')
  const [size, setSize] = useState(3)
  const [data, setData] = useState<GridRankResult | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [naoConfig, setNaoConfig] = useState(false)

  async function buscar() {
    if (!termo.trim()) return
    setCarregando(true); setErro(''); setNaoConfig(false); setData(null)
    const res = await gridRank(id, termo, size)
    if (res.success) setData(res.data)
    else { setErro(res.error); setNaoConfig(Boolean(res.naoConfigurado)) }
    setCarregando(false)
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-2">
        Sua posição no Google Maps para uma palavra-chave, medida em vários pontos ao redor do negócio (mapa de calor).
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
            Para <b>{data.query}</b>{data.cidade ? <> em <b>{data.cidade}</b></> : null}: aparece em{' '}
            <b className="text-blue-700">{data.encontrados} de {data.total}</b> pontos
            {data.media != null && <> · posição média <b>{data.media.toFixed(1)}</b></>}.
          </div>

          {/* Mapa de calor */}
          <div className="mx-auto" style={{ maxWidth: data.size === 5 ? 300 : 220 }}>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${data.size}, 1fr)` }}>
              {data.points.map(p => {
                const s = cellStyle(p.position)
                const centro = p.row === (data.size - 1) / 2 && p.col === (data.size - 1) / 2
                return (
                  <div key={`${p.row}-${p.col}`}
                    className="aspect-square rounded-full grid place-items-center text-xs font-bold text-white"
                    style={{ background: s.bg, boxShadow: centro ? '0 0 0 2px #1f2937' : undefined }}
                    title={centro ? 'Sua localização' : undefined}>
                    {s.texto}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legenda */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center text-[10px] text-gray-500">
            <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#16a34a' }} />1º-3º</span>
            <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#84cc16' }} />4º-7º</span>
            <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#f59e0b' }} />8º-10º</span>
            <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#ef4444' }} />11º+</span>
            <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#d1d5db' }} />fora do top 20</span>
          </div>

          <p className="text-[10px] text-gray-400 text-center">Cada círculo é um ponto ~1,5 km ao redor do negócio. Verde = você está bem posicionado ali; vermelho/cinza = mal posicionado.</p>
        </div>
      )}
    </div>
  )
}
