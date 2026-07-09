'use client'

import { useState, useEffect, useCallback } from 'react'
import { getLocationCompetitors, type CompetitorsResult } from '@/app/actions/google'

function fmt(n: number): string { return n.toLocaleString('pt-BR') }

export function CompetitorsPanel({ id }: { id: string }) {
  const [data, setData] = useState<CompetitorsResult | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [naoConfig, setNaoConfig] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(''); setNaoConfig(false); setData(null)
    const res = await getLocationCompetitors(id)
    if (res.success) setData(res.data)
    else { setErro(res.error); setNaoConfig(Boolean(res.naoConfigurado)) }
    setCarregando(false)
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  const ranking = data?.lista ?? []
  const posicao = (() => { const i = ranking.findIndex(c => c.isSelf); return i >= 0 ? i + 1 : null })()

  const Sim = () => <span className="text-green-600">✓</span>
  const Nao = () => <span className="text-gray-300">–</span>

  return (
    <div>
      {carregando && (
        <div className="text-xs text-gray-500 py-4 flex items-center gap-2">
          <span className="inline-block w-3.5 h-3.5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          Buscando concorrentes na sua região...
        </div>
      )}

      {naoConfig && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
          <p className="font-semibold">Configuração pendente da Places API</p>
          <p>Para comparar concorrentes, o servidor precisa de uma chave da <b>Places API (New)</b> com faturamento ativo.</p>
          <p className="text-amber-700">Configure a variável <code className="bg-amber-100 px-1 rounded">GOOGLE_PLACES_API_KEY</code> na Vercel e recarregue.</p>
        </div>
      )}

      {erro && !naoConfig && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{erro}</div>}

      {data && (
        <div className="space-y-3">
          {posicao != null ? (
            <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-100 rounded-lg p-3">
              <p className="text-sm text-gray-700">
                Na busca do Google por <b>{data.categoria}</b> em <b>{data.cidade}</b>, você aparece em{' '}
                <b className="text-blue-700">{posicao}º de {ranking.length}</b>.
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-gray-400">
              Ranking do Google para {data.categoria} em {data.cidade}. (Seu perfil não apareceu entre os primeiros resultados desta busca.)
            </p>
          )}

          <div className="border border-gray-100 rounded-lg overflow-x-auto">
            <div className="min-w-[460px]">
              <div className="grid grid-cols-[24px_1fr_auto_auto_auto_38px_38px_38px] gap-2 px-3 py-2 bg-gray-50 text-[10px] font-semibold text-gray-400 uppercase tracking-wide items-center">
                <span>#</span><span>Negócio</span>
                <span className="text-right">Score</span>
                <span className="text-right">Nota</span>
                <span className="text-right">Aval.</span>
                <span className="text-center" title="Fotos">📷</span>
                <span className="text-center" title="Site">🌐</span>
                <span className="text-center" title="Horários">🕒</span>
              </div>
              {ranking.map((c, i) => (
                <div key={(c.placeId ?? '') + i}
                  className={`grid grid-cols-[24px_1fr_auto_auto_auto_38px_38px_38px] gap-2 px-3 py-2 text-xs items-center border-t border-gray-50 ${c.isSelf ? 'bg-blue-50/70 font-semibold' : ''}`}>
                  <span className="text-gray-400">{i + 1}</span>
                  <span className="truncate text-gray-800">{c.name}{c.isSelf && <span className="text-blue-600"> (você)</span>}</span>
                  <span className="text-right text-gray-800">{c.score}</span>
                  <span className="text-right text-gray-700 whitespace-nowrap">{c.rating != null ? c.rating.toFixed(1) : '–'}</span>
                  <span className="text-right text-gray-700">{fmt(c.reviews)}</span>
                  <span className="text-center text-gray-600">{c.fotos > 0 ? (c.fotos >= 10 ? '10+' : c.fotos) : <Nao />}</span>
                  <span className="text-center">{c.temSite ? <Sim /> : <Nao />}</span>
                  <span className="text-center">{c.temHorarios ? <Sim /> : <Nao />}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-gray-400 leading-relaxed">
            Ordem conforme o ranking do Google para essa busca (Places API). O <b>Score</b> (0-100) indica a otimização de cada perfil pelos sinais públicos, para você comparar quem está mais bem estruturado.
          </p>

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
