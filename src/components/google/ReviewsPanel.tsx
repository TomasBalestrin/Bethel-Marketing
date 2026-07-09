'use client'

import { useState, useEffect, useCallback } from 'react'
import { getLocationReviews, draftReviewReply, sendReviewReply, type ReviewsResult, type GbpReview } from '@/app/actions/google'

function Stars({ n }: { n: number }) {
  return <span className="text-amber-500 text-xs whitespace-nowrap">{'★'.repeat(n)}<span className="text-gray-200">{'★'.repeat(5 - n)}</span></span>
}

function quando(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function ReviewCard({ id, review, onReplied }: { id: string; review: GbpReview; onReplied: (reviewId: string, texto: string) => void }) {
  const [texto, setTexto] = useState(review.reply ?? '')
  const [editando, setEditando] = useState(!review.reply)
  const [gerando, setGerando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState('')

  async function gerar() {
    setGerando(true); setMsg('')
    const res = await draftReviewReply(id, { stars: review.stars, comment: review.comment, reviewerName: review.reviewerName })
    if (res.success) setTexto(res.data.texto)
    else setMsg('❌ ' + res.error)
    setGerando(false)
  }

  async function enviar() {
    if (!texto.trim()) { setMsg('Escreva ou gere uma resposta primeiro.'); return }
    setEnviando(true); setMsg('')
    const res = await sendReviewReply(id, review.reviewId, texto)
    if (res.success) { onReplied(review.reviewId, texto); setEditando(false); setMsg('✅ Resposta publicada!') }
    else setMsg('❌ ' + res.error)
    setEnviando(false)
  }

  return (
    <div className="border border-gray-100 rounded-lg p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-gray-800 truncate">{review.reviewerName}</span>
          <Stars n={review.stars} />
        </div>
        <span className="text-[10px] text-gray-400 flex-shrink-0">{quando(review.createTime)}</span>
      </div>
      {review.comment && <p className="text-xs text-gray-600 leading-relaxed mb-2">{review.comment}</p>}

      {review.reply && !editando ? (
        <div className="bg-gray-50 rounded-lg p-2.5 text-xs text-gray-700">
          <p className="text-[10px] font-semibold text-gray-400 mb-0.5">Sua resposta</p>
          {review.reply}
          <button onClick={() => setEditando(true)} className="block mt-1.5 text-[11px] text-blue-600 hover:underline">Editar resposta</button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={texto} onChange={e => setTexto(e.target.value)}
            placeholder="Escreva a resposta ou gere com a IA..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs resize-y min-h-[68px] focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={gerar} disabled={gerando || enviando}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 disabled:opacity-50">
              {gerando ? '⏳ Gerando...' : '✨ Gerar com IA'}
            </button>
            <button onClick={enviar} disabled={enviando || gerando || !texto.trim()}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 disabled:opacity-40">
              {enviando ? 'Publicando...' : review.reply ? 'Atualizar resposta' : 'Publicar resposta'}
            </button>
            {review.reply && <button onClick={() => { setTexto(review.reply ?? ''); setEditando(false); setMsg('') }} className="text-[11px] text-gray-400 hover:underline">Cancelar</button>}
          </div>
        </div>
      )}
      {msg && <p className="text-[11px] mt-1.5 text-gray-600">{msg}</p>}
    </div>
  )
}

export function ReviewsPanel({ id }: { id: string }) {
  const [data, setData] = useState<ReviewsResult | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(''); setData(null)
    const res = await getLocationReviews(id)
    if (res.success) setData(res.data)
    else setErro(res.error)
    setCarregando(false)
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  function onReplied(reviewId: string, texto: string) {
    setData(prev => {
      if (!prev) return prev
      const reviews = prev.reviews.map(r => r.reviewId === reviewId ? { ...r, reply: texto } : r)
      return { ...prev, reviews, semResposta: reviews.filter(r => !r.reply).length }
    })
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      {carregando && (
        <div className="text-xs text-gray-500 py-4 flex items-center gap-2">
          <span className="inline-block w-3.5 h-3.5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          Carregando avaliações...
        </div>
      )}

      {erro && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{erro}</div>}

      {data && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">
              {data.averageRating != null ? `⭐ ${data.averageRating.toFixed(1)}` : '—'}
              <span className="text-xs font-normal text-gray-400"> · {data.total} avaliação(ões)</span>
            </span>
            {data.semResposta > 0 && (
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                {data.semResposta} sem resposta
              </span>
            )}
          </div>

          {data.reviews.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">Nenhuma avaliação ainda.</p>
          ) : (
            <div className="space-y-2">
              {data.reviews.map(r => <ReviewCard key={r.reviewId} id={id} review={r} onReplied={onReplied} />)}
            </div>
          )}

          <p className="text-[10px] text-gray-400">Mostrando as 50 avaliações mais recentes. Responder todas (em 24-48h) ajuda no ranking.</p>

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
