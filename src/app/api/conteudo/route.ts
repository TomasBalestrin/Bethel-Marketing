import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 300

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// sonnet-4-6 cabe no tempo da serverless e tem ótima qualidade de copy
// (opus-4-8 estourava o limite de execução no caminho viral com web search)
const MODEL_GERACAO = 'claude-sonnet-4-6'
const MODEL_BUSCA = 'claude-sonnet-4-6'

type Profile = {
  negocio?: string
  nicho?: string
  servicos?: string
  sobre?: string // sobre o negócio, público e foco
}

// ── Frameworks por categoria (o que faz o roteiro converter) ──────────────────
const FRAMEWORKS: Record<string, string> = {
  conexao: `CONEXÃO (topo/meio de funil — gerar identificação e confiança).
Use um destes ângulos: história de origem, bastidor real, valores/missão, momento vulnerável, ou algo do dia a dia que o público se identifica.
Objetivo: a pessoa pensar "esse profissional é como eu / entende a minha realidade". NÃO venda aqui.`,
  educacional: `EDUCACIONAL (topo/meio — gerar autoridade ensinando).
Use um destes ângulos: "X erros que [público] comete", passo a passo prático, mito vs verdade, "você sabia que…", ou um conceito explicado simples.
Objetivo: entregar valor real e útil que faça a pessoa salvar/compartilhar e ver o profissional como referência.`,
  viral: `VIRAL (topo — parar o scroll e gerar alcance).
Use um destes ângulos: verdade impopular do nicho, contraste/quebra de expectativa, opinião forte do profissional, ou uma tendência atual adaptada ao nicho.
O gancho dos primeiros 3 segundos é tudo. Seja ousado mas verdadeiro. Conecte a tendência ao universo do negócio.`,
  venda: `VENDA DIRETA (fundo de funil — converter).
Use um destes ângulos: quebra de uma objeção específica, caso de sucesso (antes → depois) com prova, demonstração do serviço, ou oferta clara.
Termine com CTA direto e específico (chamar no direct, agendar, link na bio). Use provas reais quando houver.`,
}

// ── Estrutura esperada por formato ────────────────────────────────────────────
const FORMATOS: Record<string, string> = {
  reels: `REELS (vídeo curto, 15-45s).
A "estrutura" deve ser uma sequência de CENAS. Cada item: secao = "Cena 1 (0-3s)", "Cena 2", etc; conteudo = o que falar/mostrar + sugestão de texto na tela.
O "gancho" é a primeira frase/cena (primeiros 3 segundos) que prende. Em "dicas", sugira tipo de áudio/trend e enquadramento.`,
  carrossel: `CARROSSEL (7 a 9 slides — gere um item por SLIDE, no mínimo 7).
REGRA CRÍTICA: o campo "conteudo" de cada slide deve ser o TEXTO EXATO E FINAL que vai aparecer escrito naquele slide — pronto pra copiar e colar na arte. NÃO escreva instruções ("apresente o problema", "fale sobre…") nem descrições; escreva a frase pronta, como ela aparece pro seguidor.
Cada item: secao = "Slide 1", "Slide 2"…; conteudo = a copy literal daquele slide (curta, impactante, 1 ideia só — pode ter um título em destaque + 1 linha de apoio).
Estrutura típica: Slide 1 = capa/gancho que para o scroll; Slides 2 a penúltimo = desenvolvem a ideia, um ponto por slide; último slide = CTA.
Em "dicas", oriente só o visual (cores, imagem, destaque). NÃO repita o texto dos slides nas dicas.`,
  imagem: `POST DE IMAGEM ÚNICA.
A "estrutura" deve ter 1-2 itens: secao = "Headline" e (opcional) "Apoio"; conteudo = o texto que vai na arte.
O "gancho" é a headline principal. A "legenda" aprofunda a ideia. Em "dicas", descreva o conceito visual da arte.`,
}

const FUNIL_LABEL: Record<string, string> = {
  topo: 'Topo de funil (descoberta / alcance)',
  meio: 'Meio de funil (consideração / relacionamento)',
  fundo: 'Fundo de funil (decisão / venda)',
}

function buildSchema() {
  return {
    type: 'object' as const,
    properties: {
      titulo: { type: 'string', description: 'Título curto interno do conteúdo (para o profissional identificar depois)' },
      gancho: { type: 'string', description: 'O gancho principal — primeira frase/cena/slide que prende a atenção' },
      estrutura: {
        type: 'array',
        description: 'A estrutura do conteúdo (cenas do reels, slides do carrossel, ou elementos da imagem)',
        items: {
          type: 'object',
          properties: {
            secao: { type: 'string', description: 'Rótulo da seção (ex: "Cena 1 (0-3s)", "Slide 2", "Headline")' },
            conteudo: { type: 'string', description: 'No carrossel: o TEXTO LITERAL e final que vai escrito no slide (pronto pra colar), nunca uma descrição do que fazer. No reels: a fala + texto na tela daquela cena.' },
          },
          required: ['secao', 'conteudo'],
        },
      },
      legenda: { type: 'string', description: 'Legenda completa pronta para postar no Instagram' },
      cta: { type: 'string', description: 'Chamada para ação clara e específica' },
      hashtags: { type: 'array', items: { type: 'string' }, description: 'De 5 a 12 hashtags relevantes, sem o símbolo #' },
      dicas: { type: 'string', description: 'Dicas práticas de gravação/design/postagem para esse conteúdo' },
    },
    required: ['titulo', 'gancho', 'estrutura', 'legenda', 'cta', 'hashtags'],
  }
}

// Busca tendências atuais via web search (só usada na categoria "viral")
async function buscarTendencias(nicho: string, servico: string, tema: string): Promise<string> {
  try {
    const prompt = `Faça UMA única busca na web e liste 3 ganchos/temas em alta AGORA, relevantes para o nicho "${nicho}"${servico ? ` (foco em "${servico}")` : ''}. Uma linha cada, específicos e recentes. Não faça mais de uma busca.`

    let messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }]
    let texto = ''
    // Loop curto para lidar com pause_turn da ferramenta server-side
    for (let i = 0; i < 2; i++) {
      const res = await client.messages.create({
        model: MODEL_BUSCA,
        max_tokens: 700,
        // web search é enviado no corpo da requisição; o SDK 0.36 não tipa esse tool
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 1 }] as unknown as Anthropic.Tool[],
        messages,
      })
      for (const block of res.content) {
        if (block.type === 'text') texto += block.text + '\n'
      }
      if ((res.stop_reason as string) !== 'pause_turn') break
      messages = [...messages, { role: 'assistant', content: res.content as Anthropic.ContentBlockParam[] }]
    }
    return texto.trim()
  } catch {
    return '' // se a busca falhar, segue sem tendências
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { profile, funil, categoria, formato, servico, tema } = await req.json() as {
      profile: Profile; funil: string; categoria: string; formato: string; servico?: string; tema?: string
    }

    if (!funil || !categoria || !formato) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }
    if (!profile?.nicho) {
      return NextResponse.json({ error: 'Preencha o perfil de conteúdo primeiro.' }, { status: 400 })
    }

    const frameworkDesc = FRAMEWORKS[categoria] ?? FRAMEWORKS.educacional
    const formatoDesc = FORMATOS[formato] ?? FORMATOS.carrossel

    // Busca tendências apenas quando faz sentido (viral)
    let tendencias = ''
    if (categoria === 'viral') {
      tendencias = await buscarTendencias(profile.nicho, servico ?? '', tema ?? '')
    }

    const cerebro = [
      profile.negocio ? `- Negócio: ${profile.negocio}` : '',
      `- Nicho: ${profile.nicho}`,
      profile.servicos ? `- Serviços/produtos: ${profile.servicos}` : '',
      profile.sobre ? `- Sobre o negócio, público e foco: ${profile.sobre}` : '',
    ].filter(Boolean).join('\n')

    const prompt = `Você é um estrategista de conteúdo e copywriter sênior especializado em Instagram para pequenos negócios. Você cria roteiros ÚNICOS, específicos e de altíssima qualidade — nunca genéricos.

PERFIL DO NEGÓCIO (use TUDO isto para personalizar — este é o que torna o conteúdo único):
${cerebro}

PEDIDO:
- Etapa do funil: ${FUNIL_LABEL[funil] ?? funil}
- Categoria: ${frameworkDesc}
- Formato: ${formatoDesc}
${servico ? `- Serviço/produto/procedimento foco: ${servico}` : ''}
${tema ? `- Tema/assunto pedido pelo profissional: ${tema}` : ''}
${tendencias ? `\nTENDÊNCIAS ATUAIS (use como inspiração, adaptando ao nicho — não copie literal):\n${tendencias}` : ''}

REGRAS DE QUALIDADE:
1. Seja ESPECÍFICO ao negócio e ao público — use os dados do perfil, não fale de forma genérica.
2. Use as crenças/opiniões do profissional para dar voz autoral e original.
3. Linguagem natural, no tom de voz definido. Frases curtas. Uma ideia por bloco.
4. O gancho tem que ser forte de verdade (curiosidade, contraste, dor ou desejo real do público).
5. Termine com um CTA coerente com a etapa do funil (topo: salvar/seguir/comentar; fundo: chamar no direct/agendar).
6. Hashtags relevantes ao nicho, misturando amplas e específicas.

Preencha a ferramenta create_content com o roteiro completo.`

    const message = await client.messages.create({
      model: MODEL_GERACAO,
      max_tokens: 4096,
      tools: [{ name: 'create_content', description: 'Cria o roteiro de conteúdo estruturado', input_schema: buildSchema() }],
      tool_choice: { type: 'tool', name: 'create_content' },
      messages: [{ role: 'user', content: prompt }],
    })

    const toolUse = message.content.find(c => c.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      return NextResponse.json({ error: 'A IA não retornou os dados esperados' }, { status: 500 })
    }

    const input = toolUse.input as Record<string, unknown>
    const conteudo = {
      titulo: String(input.titulo ?? ''),
      gancho: String(input.gancho ?? ''),
      estrutura: Array.isArray(input.estrutura)
        ? (input.estrutura as Record<string, unknown>[]).map(s => ({ secao: String(s.secao ?? ''), conteudo: String(s.conteudo ?? '') }))
        : [],
      legenda: String(input.legenda ?? ''),
      cta: String(input.cta ?? ''),
      hashtags: Array.isArray(input.hashtags) ? (input.hashtags as unknown[]).map(h => String(h).replace('#', '').trim()).filter(Boolean) : [],
      dicas: String(input.dicas ?? ''),
      usouTendencias: Boolean(tendencias),
    }

    return NextResponse.json({ conteudo })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
