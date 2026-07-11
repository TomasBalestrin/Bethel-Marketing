// Auditoria objetiva do perfil (nota 0-100 + checklist), a partir dos dados que
// já buscamos (perfil + avaliações). Complementa o plano de ação da IA.

import type { GbpLocationDetails } from './business'
import type { ReviewsResult } from './reviews'

export type AuditStatus = 'ok' | 'parcial' | 'falta'
export type AuditCheck = { label: string; status: AuditStatus; dica: string }
export type AuditResult = { score: number; checks: AuditCheck[] }

export function buildAudit(det: GbpLocationDetails, reviews: ReviewsResult | null): AuditResult {
  const itens: { c: AuditCheck; peso: number }[] = []
  const add = (label: string, status: AuditStatus, peso: number, dica: string) => itens.push({ c: { label, status, dica }, peso })

  add('Categoria principal', det.primaryCategory ? 'ok' : 'falta', 3,
    'Defina a categoria mais específica do seu negócio (fator forte de relevância).')
  add('Categorias adicionais', det.additionalCategories.length > 0 ? 'ok' : 'falta', 1,
    'Adicione categorias secundárias relevantes ao que você faz.')

  const dl = (det.description || '').length
  add('Descrição', dl >= 300 ? 'ok' : dl > 0 ? 'parcial' : 'falta', 2,
    'Escreva 500-750 caracteres com palavras-chave do serviço + cidade.')

  add('Telefone', det.phone ? 'ok' : 'falta', 1, 'Adicione um telefone de contato.')
  add('Site', det.website ? 'ok' : 'falta', 1, 'Vincule o site do negócio (ajuda a proeminência).')

  const dias = new Set(det.regularHours.map(p => p.openDay).filter(Boolean)).size
  add('Horários', dias >= 5 ? 'ok' : dias > 0 ? 'parcial' : 'falta', 2,
    'Preencha os horários de todos os dias de funcionamento.')

  const nServ = det.serviceItems.length
  add('Serviços cadastrados', nServ >= 3 ? 'ok' : nServ > 0 ? 'parcial' : 'falta', 2,
    'Cadastre seus principais serviços com nome e descrição.')

  add('Endereço', det.addressLines.length > 0 && det.locality ? 'ok' : 'falta', 1,
    'Confirme o endereço completo do negócio.')

  if (reviews) {
    add('Quantidade de avaliações', reviews.total >= 50 ? 'ok' : reviews.total >= 10 ? 'parcial' : 'falta', 3,
      `Você tem ${reviews.total}. Peça avaliação a cada cliente satisfeito (peso alto no ranking).`)
    const nota = reviews.averageRating ?? 0
    add('Nota média', nota >= 4.5 ? 'ok' : nota >= 4 ? 'parcial' : 'falta', 2,
      'Busque manter a nota acima de 4,5.')
    const amostra = reviews.reviews.length
    const respondidas = reviews.reviews.filter(r => r.reply).length
    const pct = amostra ? respondidas / amostra : 1
    add('Respostas às avaliações', pct >= 0.9 ? 'ok' : pct >= 0.5 ? 'parcial' : 'falta', 2,
      `Respondidas ${respondidas}/${amostra} recentes. Responda todas em 24-48h.`)
  }

  const totalPeso = itens.reduce((s, x) => s + x.peso, 0)
  const ganho = itens.reduce((s, x) => s + x.peso * (x.c.status === 'ok' ? 1 : x.c.status === 'parcial' ? 0.5 : 0), 0)
  const score = totalPeso ? Math.round((ganho / totalPeso) * 100) : 0

  return { score, checks: itens.map(x => x.c) }
}
