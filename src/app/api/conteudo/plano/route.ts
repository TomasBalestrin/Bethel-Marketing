import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type Profile = { negocio?: string; nicho?: string; servicos?: string; sobre?: string }

function buildSchema(qtd: number) {
  return {
    type: 'object' as const,
    properties: {
      titulo: { type: 'string', description: 'Um título curto para este plano (ex: "Plano de conteúdo — Outubro")' },
      itens: {
        type: 'array',
        description: `Exatamente ${qtd} ideias de conteúdo distribuídas ao longo de 30 dias`,
        items: {
          type: 'object',
          properties: {
            dia: { type: 'integer', description: 'Dia do mês sugerido para postar (1 a 30), distribuído de forma espaçada' },
            formato: { type: 'string', enum: ['reels', 'carrossel', 'imagem'], description: 'Formato ideal para esta ideia' },
            funil: { type: 'string', enum: ['topo', 'meio', 'fundo'], description: 'Etapa do funil' },
            categoria: { type: 'string', enum: ['conexao', 'educacional', 'viral', 'venda'], description: 'Categoria do conteúdo' },
            titulo: { type: 'string', description: 'Título/ideia central do conteúdo (curto e específico)' },
            objetivo: { type: 'string', description: 'Em 1 frase, o objetivo estratégico deste conteúdo' },
            gancho: { type: 'string', description: 'O gancho/abertura que para o scroll' },
          },
          required: ['dia', 'formato', 'funil', 'categoria', 'titulo', 'objetivo', 'gancho'],
        },
      },
    },
    required: ['titulo', 'itens'],
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { profile, quantidade } = await req.json() as { profile: Profile; quantidade: number }
    const qtd = Math.min(30, Math.max(1, Number(quantidade) || 12))

    if (!profile?.nicho) {
      return NextResponse.json({ error: 'Preencha o perfil (nicho) primeiro.' }, { status: 400 })
    }

    const cerebro = [
      profile.negocio ? `- Negócio: ${profile.negocio}` : '',
      `- Nicho: ${profile.nicho}`,
      profile.servicos ? `- Serviços/produtos: ${profile.servicos}` : '',
      profile.sobre ? `- Sobre o negócio, público e foco: ${profile.sobre}` : '',
    ].filter(Boolean).join('\n')

    const prompt = `Você é um estrategista de social media sênior. Monte um PLANO DE CONTEÚDO de Instagram para 30 dias para o negócio abaixo, com ${qtd} conteúdos.

NEGÓCIO:
${cerebro}

OBJETIVO: fazer o Instagram desse negócio crescer e gerar clientes. Pense como um estrategista montando um calendário equilibrado.

REGRAS DE DISTRIBUIÇÃO (você decide tudo — não há seleção do usuário):
1. Distribua os ${qtd} conteúdos pelas etapas do funil de forma equilibrada e estratégica: a MAIORIA em topo (alcance/atração), uma boa parte em meio (relacionamento/autoridade) e alguns em fundo (venda). Ex.: ~50% topo, ~30% meio, ~20% fundo.
2. Varie os formatos (reels, carrossel, imagem) — priorize reels para alcance, carrossel para autoridade/educação, imagem para mensagens rápidas.
3. Varie as categorias: conexao, educacional, viral, venda — coerentes com a etapa do funil (viral/conexão no topo, educacional no meio, venda no fundo).
4. Distribua os dias (1 a 30) de forma espaçada e realista (não todos no mesmo dia).
5. Cada ideia deve ser ESPECÍFICA ao negócio e aos serviços — nada genérico. Use o que sabe sobre o público e o foco.
6. Ganchos fortes (curiosidade, dor, desejo, contraste).

Preencha a ferramenta create_plan com exatamente ${qtd} itens.`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      tools: [{ name: 'create_plan', description: 'Cria o plano de conteúdo do mês', input_schema: buildSchema(qtd) }],
      tool_choice: { type: 'tool', name: 'create_plan' },
      messages: [{ role: 'user', content: prompt }],
    })

    const toolUse = message.content.find(c => c.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      return NextResponse.json({ error: 'A IA não retornou os dados esperados' }, { status: 500 })
    }
    const input = toolUse.input as Record<string, unknown>
    const rawItens = Array.isArray(input.itens) ? (input.itens as Record<string, unknown>[]) : []

    const itens = rawItens.map((it, i) => ({
      ordem: i + 1,
      dia: Number(it.dia) || (i + 1),
      formato: String(it.formato ?? 'carrossel'),
      funil: String(it.funil ?? 'topo'),
      categoria: String(it.categoria ?? 'educacional'),
      titulo: String(it.titulo ?? ''),
      objetivo: String(it.objetivo ?? ''),
      gancho: String(it.gancho ?? ''),
    })).sort((a, b) => a.dia - b.dia).map((it, i) => ({ ...it, ordem: i + 1 }))

    if (itens.length === 0) {
      return NextResponse.json({ error: 'A IA não gerou itens' }, { status: 500 })
    }

    return NextResponse.json({ titulo: String(input.titulo ?? 'Plano de conteúdo'), itens })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
