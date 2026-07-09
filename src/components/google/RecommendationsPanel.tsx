'use client'

import { useState, useEffect, useCallback } from 'react'
import { getLocationRecommendations, type GbpRecommendation } from '@/app/actions/google'

const PRIO: Record<string, { label: string; cls: string }> = {
  alta: { label: 'Alta', cls: 'bg-red-50 text-red-700 border-red-200' },
  media: { label: 'Média', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  baixa: { label: 'Baixa', cls: 'bg-gray-50 text-gray-600 border-gray-200' },
}

export function RecommendationsPanel({ id }: { id: string }) {
  const [recs, setRecs] = useState<GbpRecommendation[] | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(''); setRecs(null)
    const res = await getLocationRecommendations(id)
    if (res.success) setRecs(res.data)
    else setErro(res.error)
    setCarregando(false)
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      {carregando && (
        <div className="text-xs text-gray-500 py-4 flex items-center gap-2">
          <span className="inline-block w-3.5 h-3.5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          Analisando o perfil com IA...
        </div>
      )}

      {erro && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{erro}</div>}

      {recs && (
        <div className="space-y-2">
          {recs.map((r, i) => {
            const p = PRIO[r.prioridade] ?? PRIO.media
            return (
              <div key={i} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${p.cls}`}>{p.label}</span>
                  <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{r.area}</span>
                </div>
                <p className="text-sm font-semibold text-gray-800">{r.titulo}</p>
                <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{r.descricao}</p>
              </div>
            )
          })}
          <div className="flex justify-end pt-1">
            <button onClick={carregar} disabled={carregando}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 disabled:opacity-50">
              🔄 Refazer análise
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
