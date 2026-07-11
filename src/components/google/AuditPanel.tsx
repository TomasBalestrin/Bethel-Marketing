'use client'

import { useState, useEffect, useCallback } from 'react'
import { getLocationAudit, type LocationAudit } from '@/app/actions/google'

const PRIO: Record<string, { label: string; cls: string }> = {
  alta: { label: 'Alta', cls: 'bg-red-50 text-red-700 border-red-200' },
  media: { label: 'Média', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  baixa: { label: 'Baixa', cls: 'bg-gray-50 text-gray-600 border-gray-200' },
}

function scoreColor(s: number): string {
  if (s >= 80) return '#16a34a'
  if (s >= 50) return '#f59e0b'
  return '#ef4444'
}
function scoreLabel(s: number): string {
  if (s >= 80) return 'Ótimo'
  if (s >= 50) return 'Precisa melhorar'
  return 'Crítico'
}
const CHECK_ICON: Record<string, string> = { ok: '✅', parcial: '🟡', falta: '❌' }

export function AuditPanel({ id }: { id: string }) {
  const [data, setData] = useState<LocationAudit | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(''); setData(null)
    const res = await getLocationAudit(id)
    if (res.success) setData(res.data)
    else setErro(res.error)
    setCarregando(false)
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  return (
    <div>
      {carregando && (
        <div className="text-xs text-gray-500 py-4 flex items-center gap-2">
          <span className="inline-block w-3.5 h-3.5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          Auditando o perfil...
        </div>
      )}

      {erro && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{erro}</div>}

      {data && (
        <div className="space-y-4">
          {/* Nota */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full grid place-items-center flex-shrink-0"
              style={{ background: `conic-gradient(${scoreColor(data.score)} ${data.score * 3.6}deg, #f1f5f9 0deg)` }}>
              <div className="w-16 h-16 rounded-full bg-white grid place-items-center">
                <span className="text-xl font-bold" style={{ color: scoreColor(data.score) }}>{data.score}</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Nota do perfil: {data.score}/100</p>
              <p className="text-xs font-semibold" style={{ color: scoreColor(data.score) }}>{scoreLabel(data.score)}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Baseado em completude, avaliações e boas práticas de ranqueamento local.</p>
            </div>
          </div>

          {/* Checklist */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">Checklist</p>
            <div className="space-y-1.5">
              {data.checks.map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-sm leading-5">{CHECK_ICON[c.status]}</span>
                  <div className="min-w-0">
                    <p className={`text-sm ${c.status === 'ok' ? 'text-gray-700' : 'text-gray-800 font-medium'}`}>{c.label}</p>
                    {c.status !== 'ok' && <p className="text-[11px] text-gray-500 leading-snug">{c.dica}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rotina */}
          {data.rotina.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">🔁 Rotina para subir e manter o 1º lugar</p>
              <div className="space-y-1.5">
                {data.rotina.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 bg-purple-50/60 border border-purple-100 rounded-lg px-3 py-2">
                    <span className="text-[10px] font-semibold text-purple-700 bg-white border border-purple-200 rounded px-1.5 py-0.5 whitespace-nowrap flex-shrink-0">{r.frequencia}</span>
                    <span className="text-xs text-gray-700 leading-relaxed">{r.acao}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ações priorizadas (IA) */}
          {data.recomendacoes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">🎯 Ações priorizadas</p>
              <div className="space-y-2">
                {data.recomendacoes.map((r, i) => {
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
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={carregar} disabled={carregando}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 disabled:opacity-50">
              🔄 Refazer auditoria
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
