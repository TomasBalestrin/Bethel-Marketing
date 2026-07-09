// Análise por IA do Perfil de Empresa no Google, focada em RANQUEAR EM 1º LUGAR
// no pacote local (Local Pack) e no Maps: recomendações priorizadas + rotina recorrente.

import Anthropic from '@anthropic-ai/sdk'
import type { GbpLocationDetails } from './business'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type GbpRecommendation = {
  prioridade: 'alta' | 'media' | 'baixa'
  area: string
  titulo: string
  descricao: string
}

export type GbpRoutineItem = {
  frequencia: string   // ex: "2x por semana", "Semanal", "Mensal"
  acao: string
}

export type GbpAnalysis = {
  recomendacoes: GbpRecommendation[]
  rotina: GbpRoutineItem[]
}

function stripFences(text: string): string {
  return text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim()
}

// Extrai o primeiro objeto/array JSON balanceado a partir de um caractere de abertura.
function extractJson(t: string, open: '{' | '['): string | null {
  const close = open === '{' ? '}' : ']'
  const start = t.indexOf(open)
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < t.length; i++) {
    if (t[i] === open) depth++
    else if (t[i] === close) { depth--; if (depth === 0) return t.slice(start, i + 1) }
  }
  return null
}

function normPrioridade(v: unknown): GbpRecommendation['prioridade'] {
  const s = String(v)
  return (['alta', 'media', 'baixa'].includes(s) ? s : 'media') as GbpRecommendation['prioridade']
}

function mapRecs(arr: Record<string, unknown>[]): GbpRecommendation[] {
  return arr
    .filter(x => x && x.titulo)
    .map(x => ({ prioridade: normPrioridade(x.prioridade), area: String(x.area || 'Geral'), titulo: String(x.titulo), descricao: String(x.descricao || '') }))
    .slice(0, 8)
}

function parseAnalysis(text: string): GbpAnalysis {
  const t = stripFences(text)
  let recomendacoes: GbpRecommendation[] = []
  let rotina: GbpRoutineItem[] = []

  const objStr = extractJson(t, '{')
  if (objStr) {
    try {
      const obj = JSON.parse(objStr) as Record<string, unknown>
      const recs = Array.isArray(obj.recomendacoes) ? (obj.recomendacoes as Record<string, unknown>[]) : []
      const rot = Array.isArray(obj.rotina) ? (obj.rotina as Record<string, unknown>[]) : []
      recomendacoes = mapRecs(recs)
      rotina = rot
        .filter(x => x && x.acao)
        .map(x => ({ frequencia: String(x.frequencia || 'Semanal'), acao: String(x.acao) }))
        .slice(0, 6)
    } catch { /* tenta o fallback abaixo */ }
  }

  // Fallback: se não veio objeto válido, tenta um array puro de recomendações
  if (recomendacoes.length === 0 && rotina.length === 0) {
    const arrStr = extractJson(t, '[')
    if (arrStr) {
      try { recomendacoes = mapRecs(JSON.parse(arrStr) as Record<string, unknown>[]) } catch { /* ignora */ }
    }
  }

  return { recomendacoes, rotina }
}

export async function analyzeProfile(det: GbpLocationDetails): Promise<GbpAnalysis> {
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

  const system = `Você é um especialista em SEO local e Perfil de Empresa no Google (Google Business Profile). Sua meta é fazer a empresa RANQUEAR EM 1º LUGAR no pacote local (Local Pack) e no Google Maps para as buscas do seu nicho e cidade.

Baseie-se nos 3 pilares de ranqueamento local do Google e priorize por IMPACTO real na posição:
1) RELEVÂNCIA: categoria principal certa + categorias adicionais, serviços/produtos cadastrados com palavras-chave, descrição otimizada com termos que o cliente busca + cidade.
2) PROEMINÊNCIA (o que mais move o ranking): quantidade e recência de avaliações, RESPONDER todas as avaliações, fotos novas com frequência, Google Posts frequentes, perfil 100% completo e verificado.
3) DISTÂNCIA/CONSISTÊNCIA: NAP (nome, endereço, telefone) idêntico em todo lugar, área de atendimento.

DADOS QUE VOCÊ TEM: os campos do perfil abaixo.
DADOS QUE VOCÊ NÃO TEM (não invente números): quantidade e nota das avaliações, se as avaliações estão sendo respondidas, quantidade de fotos, Google Posts e serviços/produtos cadastrados. Para esses, gere recomendações do tipo "verifique/avalie X e faça Y" e inclua na ROTINA.

Gere DUAS coisas:
- "recomendacoes": até 8 ações priorizadas e concretas (o que fazer, específico ao nicho e cidade do negócio). Ordene da maior para a menor prioridade. Inclua obrigatoriamente, quando fizer sentido: revisar/adicionar SERVIÇOS ou PRODUTOS cadastrados; estratégia para AUMENTAR o número de avaliações; RESPONDER todas as avaliações; publicar FOTOS reais com frequência; usar GOOGLE POSTS; otimizar categorias e descrição com palavras-chave + cidade.
- "rotina": 4 a 6 hábitos recorrentes com frequência clara para manter e subir o ranking. Inclua obrigatoriamente: postar FOTOS reais pelo menos 2x por semana; publicar 1 GOOGLE POST por semana; responder TODAS as avaliações novas em até 24-48h; pedir avaliação a cada cliente satisfeito; revisar mensalmente serviços/categorias.

Responda APENAS com um objeto JSON válido, sem markdown e sem texto fora do JSON, neste formato exato:
{"recomendacoes":[{"prioridade":"alta|media|baixa","area":"<curta ex: Avaliações, Serviços, Descrição, Fotos, Postagens, Categorias>","titulo":"<curto>","descricao":"<1-2 frases práticas>"}],"rotina":[{"frequencia":"<ex: 2x por semana, Semanal, Mensal>","acao":"<o que fazer>"}]}
Nunca use travessão longo (—).`

  const user = `Perfil atual:\n${perfil}\n\nGere o JSON com recomendacoes e rotina.`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: [{ type: 'text', text: system }],
    messages: [{ role: 'user', content: user }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Resposta inesperada da IA')
  return parseAnalysis(content.text)
}
