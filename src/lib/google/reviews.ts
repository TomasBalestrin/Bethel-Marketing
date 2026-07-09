// Avaliações do Google via API v4 legada (mybusiness.googleapis.com/v4) — única
// fonte de reviews. Lista, responde e gera rascunho de resposta com IA.

import Anthropic from '@anthropic-ai/sdk'
import { GoogleApiError } from './business'

const GMB_V4 = 'https://mybusiness.googleapis.com/v4'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const STAR: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }

export type GbpReview = {
  reviewId: string
  reviewerName: string
  reviewerPhoto: string | null
  stars: number
  comment: string | null
  createTime: string
  reply: string | null
  replyTime: string | null
}

export type ReviewsResult = {
  reviews: GbpReview[]
  averageRating: number | null
  total: number
  semResposta: number
}

async function gfetch(url: string, accessToken: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const b = await res.text()
    throw new GoogleApiError(res.status, `${res.status}: ${b.slice(0, 300)}`)
  }
  return res.json()
}

export async function listReviews(accessToken: string, accountName: string, locationName: string): Promise<ReviewsResult> {
  const url = `${GMB_V4}/${accountName}/${locationName}/reviews?pageSize=50&orderBy=${encodeURIComponent('updateTime desc')}`
  const data = await gfetch(url, accessToken) as Record<string, unknown>
  const raw = Array.isArray(data.reviews) ? (data.reviews as Record<string, unknown>[]) : []
  const reviews: GbpReview[] = raw.map(r => {
    const reviewer = r.reviewer as Record<string, unknown> | undefined
    const reply = r.reviewReply as Record<string, unknown> | undefined
    return {
      reviewId: String(r.reviewId ?? ''),
      reviewerName: reviewer?.displayName ? String(reviewer.displayName) : 'Cliente do Google',
      reviewerPhoto: reviewer?.profilePhotoUrl ? String(reviewer.profilePhotoUrl) : null,
      stars: STAR[String(r.starRating)] ?? 0,
      comment: r.comment ? String(r.comment) : null,
      createTime: String(r.createTime ?? ''),
      reply: reply?.comment ? String(reply.comment) : null,
      replyTime: reply?.updateTime ? String(reply.updateTime) : null,
    }
  })
  return {
    reviews,
    averageRating: typeof data.averageRating === 'number' ? (data.averageRating as number) : null,
    total: typeof data.totalReviewCount === 'number' ? (data.totalReviewCount as number) : reviews.length,
    semResposta: reviews.filter(r => !r.reply).length,
  }
}

export async function replyToReview(
  accessToken: string, accountName: string, locationName: string, reviewId: string, comment: string,
): Promise<void> {
  const url = `${GMB_V4}/${accountName}/${locationName}/reviews/${reviewId}/reply`
  await gfetch(url, accessToken, { method: 'PUT', body: JSON.stringify({ comment }) })
}

// Rascunho de resposta com IA (o mentorado aprova/edita antes de enviar).
export async function draftReply(opts: { businessName: string; stars: number; comment: string | null; reviewerName: string }): Promise<string> {
  const system = `Você responde avaliações do Google em nome do negócio "${opts.businessName}", em português do Brasil. Tom cordial, humano e profissional. Regras:
- Agradeça de forma genuína e seja específico ao que a pessoa escreveu (não use resposta genérica).
- Curto: 2 a 4 frases.
- Avaliação positiva: agradeça, reforce o vínculo e convide a voltar.
- Avaliação negativa ou crítica: seja empático, mostre que se importa, assuma o cuidado em melhorar (sem admitir culpa jurídica) e convide a resolver em particular (ex: chamar no WhatsApp/telefone).
- Não invente fatos, nomes, descontos ou promessas específicas.
- Não use travessão longo (—). Escreva apenas o texto da resposta, sem aspas e sem assinatura de e-mail.`
  const user = `Avaliação de ${opts.reviewerName} (${opts.stars} estrela${opts.stars === 1 ? '' : 's'}):\n"${opts.comment || '(sem texto, só nota)'}"\n\nEscreva a resposta.`
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: [{ type: 'text', text: system }],
    messages: [{ role: 'user', content: user }],
  })
  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Resposta inesperada da IA')
  return content.text.trim().replace(/^["']|["']$/g, '')
}
