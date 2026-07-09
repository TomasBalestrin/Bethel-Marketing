// Análise por IA do Perfil de Empresa no Google: gera recomendações priorizadas
// e acionáveis para melhorar visibilidade nas buscas locais e taxa de contato.

import Anthropic from '@anthropic-ai/sdk'
import type { GbpLocationDetails } from './business'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type GbpRecommendation = {
  prioridade: 'alta' | 'media' | 'baixa'
  area: string
  titulo: string
  descricao: string
}

function parseRecs(text: string): GbpRecommendation[] {
  const t = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim()
  const start = t.indexOf('[')
  const end = t.lastIndexOf(']')
  if (start === -1 || end === -1) return []
  try {
    const arr = JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>[]
    return arr
      .filter(x => x && x.titulo)
      .map(x => ({
        prioridade: (['alta', 'media', 'baixa'].includes(String(x.prioridade)) ? String(x.prioridade) : 'media') as GbpRecommendation['prioridade'],
        area: String(x.area || 'Geral'),
        titulo: String(x.titulo),
        descricao: String(x.descricao || ''),
      }))
      .slice(0, 8)
  } catch {
    return []
  }
}

export async function analyzeProfile(det: GbpLocationDetails): Promise<GbpRecommendation[]> {
  const horarios = det.regularHours.length
    ? det.regularHours.map(p => `${p.openDay} ${p.openTime}-${p.closeTime}`).join('; ')
    : '(não informado)'
  const perfil = [
    `Nome: ${det.title || '(vazio)'}`,
    `Categoria principal: ${det.primaryCategory || '(vazia)'}`,
    `Outras categorias: ${det.additionalCategories.join(', ') || '(nenhuma)'}`,
    `Endereço: ${det.address || '(não informado)'}`,
    `Telefone: ${det.phone || '(não informado)'}`,
    `Site: ${det.website || '(não informado)'}`,
    `Descrição (${(det.description || '').length} caracteres): ${det.description || '(vazia)'}`,
    `Horários: ${horarios}`,
  ].join('\n')

  const system = `Você é um especialista em otimização de Perfil de Empresa no Google (Google Business Profile) para negócios locais brasileiros. Objetivo: aumentar a visibilidade nas buscas locais e no Maps e a taxa de contato.

Analise o perfil e gere recomendações CONCRETAS e ACIONÁVEIS (o que fazer, não teoria). Considere: completude dos campos, qualidade e palavras-chave da descrição, adequação das categorias, presença de telefone/site/horários, e boas práticas de ranqueamento local.

Responda APENAS com um array JSON válido, sem markdown e sem texto fora do JSON. Cada item deve ter exatamente: {"prioridade":"alta|media|baixa","area":"<área curta, ex: Descrição, Categorias, Horários, Site, Fotos, Avaliações>","titulo":"<curto>","descricao":"<1 a 2 frases práticas>"}. No máximo 8 itens, ordenados da maior para a menor prioridade. Nunca use travessão longo (—).`

  const user = `Perfil atual:\n${perfil}\n\nGere as recomendações em JSON.`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: [{ type: 'text', text: system }],
    messages: [{ role: 'user', content: user }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Resposta inesperada da IA')
  return parseRecs(content.text)
}
