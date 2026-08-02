'use client'

import { useState } from 'react'
import {
  buscarNegocios, sugerirPalavras, analisarMercado,
  type BusinessHit, type AnaliseMercadoResult,
} from '@/app/actions/google'

function fmt(n: number): string { return n.toLocaleString('pt-BR') }
function cidadeDe(address: string | null): string {
  if (!address) return ''
  const partes = address.split(' - ')
  return partes.length > 1 ? partes[partes.length - 2]?.split(',').pop()?.trim() ?? '' : ''
}

export function AnaliseMercadoPanel() {
  const [nome, setNome] = useState('')
  const [candidatos, setCandidatos] = useState<BusinessHit[] | null>(null)
  const [selecionado, setSelecionado] = useState<BusinessHit | null>(null)
  const [sugestoes, setSugestoes] = useState<string[]>([])
  const [keyword, setKeyword] = useState('')
  const [resultado, setResultado] = useState<AnaliseMercadoResult | null>(null)

  const [buscando, setBuscando] = useState(false)
  const [analisando, setAnalisando] = useState(false)
  const [erro, setErro] = useState('')

  async function buscar() {
    if (nome.trim().length < 3) return
    setBuscando(true); setErro(''); setCandidatos(null); setSelecionado(null); setResultado(null)
    const res = await buscarNegocios(nome)
    if (res.success) { setCandidatos(res.data); if (res.data.length === 0) setErro('Nenhum negócio encontrado. Tente incluir a cidade no nome.') }
    else setErro(res.error)
    setBuscando(false)
  }

  async function escolher(b: BusinessHit) {
    setSelecionado(b); setCandidatos(null); setResultado(null); setKeyword(''); setSugestoes([])
    const res = await sugerirPalavras(b.category ?? '', cidadeDe(b.address))
    if (res.success) setSugestoes(res.data)
  }

  async function analisar(kw?: string) {
    const termo = (kw ?? keyword).trim()
    if (!selecionado || !termo) return
    setKeyword(termo); setAnalisando(true); setErro(''); setResultado(null)
    const res = await analisarMercado({
      keyword: termo, lat: selecionado.lat, lng: selecionado.lng, placeId: selecionado.placeId, title: selecionado.title,
    })
    if (res.success) setResultado(res.data)
    else setErro(res.error)
    setAnalisando(false)
  }

  const input = 'flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300'

  return (
    <div className="space-y-4">
      {/* Passo 1 — negócio */}
      <div>
        <p className="text-[11px] font-semibold text-gray-500 mb-1">1. Negócio</p>
        {selecionado ? (
          <div className="flex items-center justify-between gap-2 border border-gray-200 rounded-lg p-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{selecionado.title}</p>
              <p className="text-[11px] text-gray-400 truncate">{[selecionado.category, selecionado.address].filter(Boolean).join(' • ')}</p>
            </div>
            <button onClick={() => { setSelecionado(null); setResultado(null) }} className="text-[11px] text-blue-600 hover:underline flex-shrink-0">trocar</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input className={input} value={nome} onChange={e => setNome(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscar()}
              placeholder="Nome do negócio (ex: Clínica X, cidade)" />
            <button onClick={buscar} disabled={buscando || nome.trim().length < 3}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 disabled:opacity-40">
              {buscando ? '...' : 'Buscar'}
            </button>
          </div>
        )}

        {candidatos && candidatos.length > 0 && (
          <div className="mt-2 space-y-1">
            {candidatos.map((c, i) => (
              <button key={(c.placeId ?? '') + i} onClick={() => escolher(c)}
                className="w-full text-left border border-gray-100 rounded-lg px-3 py-2 hover:bg-blue-50">
                <p className="text-sm text-gray-800 truncate">{c.title}</p>
                <p className="text-[11px] text-gray-400 truncate">{[c.category, c.address].filter(Boolean).join(' • ')}{c.rating != null ? ` • ⭐ ${c.rating.toFixed(1)}` : ''}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Passo 2 — palavra-chave */}
      {selecionado && (
        <div>
          <p className="text-[11px] font-semibold text-gray-500 mb-1">2. Palavra-chave</p>
          {sugestoes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {sugestoes.map(s => (
                <button key={s} onClick={() => analisar(s)}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100">
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input className={input} value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && analisar()}
              placeholder="ou digite a palavra-chave (ex: harmonização facial)" />
            <button onClick={() => analisar()} disabled={analisando || !keyword.trim()}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 disabled:opacity-40">
              {analisando ? '...' : 'Analisar'}
            </button>
          </div>
        </div>
      )}

      {erro && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{erro}</div>}
      {analisando && (
        <div className="text-xs text-gray-500 py-2 flex items-center gap-2">
          <span className="inline-block w-3.5 h-3.5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          Consultando o ranking no Google...
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div className="space-y-3">
          <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-100 rounded-lg p-3">
            {resultado.minhaPosicao != null ? (
              <p className="text-sm text-gray-700">
                <b>{selecionado?.title}</b> está em <b className="text-blue-700">{resultado.minhaPosicao}º lugar</b> para <b>{resultado.keyword}</b>.
              </p>
            ) : (
              <p className="text-sm text-amber-800">
                <b>{selecionado?.title}</b> <b>não apareceu</b> entre os primeiros para <b>{resultado.keyword}</b> — grande oportunidade de otimização.
              </p>
            )}
          </div>

          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <div className="grid grid-cols-[24px_1fr_auto] gap-2 px-3 py-2 bg-gray-50 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              <span>#</span><span>Negócio</span><span className="text-right">Nota / Aval.</span>
            </div>
            {resultado.ranking.map((r, i) => {
              const eu = resultado.minhaPosicao === i + 1
              return (
                <div key={(r.placeId ?? '') + i}
                  className={`grid grid-cols-[24px_1fr_auto] gap-2 px-3 py-2 text-xs items-center border-t border-gray-50 ${eu ? 'bg-blue-50/70 font-semibold' : ''}`}>
                  <span className="text-gray-400">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-gray-800">{r.title}{eu && <span className="text-blue-600"> (você)</span>}</span>
                    {r.address && <span className="block truncate text-[10px] text-gray-400">{r.address}</span>}
                  </span>
                  <span className="text-right text-gray-600 whitespace-nowrap">{r.rating != null ? `⭐ ${r.rating.toFixed(1)}` : '–'} · {fmt(r.reviews)}</span>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-gray-400">Ranking real do Google Maps para essa busca (SerpApi). Cada consulta usa 1 crédito.</p>
        </div>
      )}
    </div>
  )
}
