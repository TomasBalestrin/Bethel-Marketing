import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { FormStepper } from '@/components/form/FormStepper'
import type { FormData } from '@/types'
import type { Briefing } from '@prisma/client'

// Converte um briefing enviado pelo cliente em dados iniciais do formulário.
// O que o briefing não tem (cidade, estado, paleta, dor, resultado) fica em branco
// para o admin completar.
function briefingParaForm(b: Briefing): Partial<FormData> {
  const num = (s: string | null) => {
    const n = parseInt(String(s ?? '').replace(/\D/g, ''), 10)
    return isNaN(n) ? undefined : n
  }
  const servicos = (b.servicos ?? '')
    .split(/[\n;,]+/).map(s => s.trim()).filter(Boolean).slice(0, 12)
    .map(nome => ({ nome, descricao: undefined, imagemUrl: undefined }))

  return {
    nomeNegocio: b.nomeEmpresa,
    endereco: b.endereco ?? '',
    whatsapp: b.whatsapp,
    instagram: b.instagram ?? undefined,
    horarioAtendimento: b.horario ?? '',
    servicos: servicos.length ? servicos : [{ nome: '', descricao: undefined, imagemUrl: undefined }],
    servicoDestaque: b.servicoCarroChefe ?? '',
    anosNoMercado: num(b.anosMercado) ?? 0,
    totalClientes: num(b.clientesAtendidos),
    logoUrl: b.logoUrl ?? undefined,
    fotoProfissionalUrl: b.fotoProfissionalUrl ?? undefined,
    fotosProfissionais: b.fotoProfissionalUrl ? [{ imagemUrl: b.fotoProfissionalUrl }] : [],
    foto1Url: b.fotosEmpresa[0] ?? undefined,
    foto2Url: b.fotosEmpresa[1] ?? undefined,
    foto3Url: b.fotosEmpresa[2] ?? undefined,
    depoimentos: b.fotosDepoimento.map(u => ({ imagemUrl: u })),
    resultados: b.fotosAntesDepois.map(u => ({ imagemUrl: u })),
    whatsappMensagem: `Olá! Vim pelo site e gostaria de saber mais sobre ${b.servicoCarroChefe || 'os serviços'}.`,
  }
}

export default async function CriarPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string; briefingId?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  const isAdmin = dbUser?.role === 'ADMIN'

  const { siteId, briefingId } = await searchParams

  const include = { depoimentos: true, resultados: true, servicos: { orderBy: { ordem: 'asc' as const } }, registros: true, fotosProfissionais: true }

  // Admin editing a specific site, or regular user's own site
  const site = siteId
    ? await prisma.site.findUnique({ where: { id: siteId }, include })
    : isAdmin
      ? null
      : await prisma.site.findFirst({ where: { userId: user.id }, include })

  let initialData: Partial<FormData> | null = site
    ? {
        nomeNegocio: site.nomeNegocio,
        segmento: site.segmento,
        cidade: site.cidade,
        estado: site.estado,
        endereco: site.endereco,
        cep: site.cep,
        corPaleta: site.corPaleta,
        logoUrl: site.logoUrl ?? undefined,
        servicos: site.servicos.length > 0
          ? site.servicos.map((s) => ({ nome: s.nome, descricao: s.descricao ?? undefined, imagemUrl: s.imagemUrl ?? undefined }))
          : [{ nome: '', descricao: undefined, imagemUrl: undefined }],
        servicoDestaque: site.servicoDestaque,
        resultadoCliente: site.resultadoCliente,
        dorPrincipal: site.dorPrincipal,
        heroFotoUrl: site.heroFotoUrl ?? undefined,
        headline: site.headline ?? undefined,
        subheadline: site.subheadline ?? undefined,
        ctaTexto: site.ctaTexto ?? undefined,
        anosNoMercado: site.anosNoMercado,
        totalClientes: site.totalClientes ?? undefined,
        totalClientesLabel: site.totalClientesLabel ?? undefined,
        certificados: site.certificados ?? undefined,
        foto1Url: site.foto1Url ?? undefined,
        foto2Url: site.foto2Url ?? undefined,
        foto3Url: site.foto3Url ?? undefined,
        fotoProfissionalUrl: site.fotoProfissionalUrl ?? undefined,
        depoimentos: site.depoimentos.map((d) =>
          d.videoUrl ? { imagemUrl: '', videoUrl: d.videoUrl } : { imagemUrl: d.imagemUrl }
        ),
        resultados: site.resultados.map((r) => ({ imagemUrl: r.imagemUrl })),
        // Sites antigos guardavam uma única foto em fotoProfissionalUrl. Quando o
        // array novo ainda está vazio, migramos essa foto para dentro dele.
        fotosProfissionais: site.fotosProfissionais?.length
          ? site.fotosProfissionais.map((f) => ({ imagemUrl: f.imagemUrl }))
          : site.fotoProfissionalUrl
            ? [{ imagemUrl: site.fotoProfissionalUrl }]
            : [],
        whatsapp: site.whatsapp,
        whatsappMensagem: site.whatsappMensagem,
        instagram: site.instagram ?? undefined,
        horarioAtendimento: site.horarioAtendimento,
        registros: site.registros.map((r) => ({ tipo: r.tipo, numero: r.numero })),
      }
    : null

  // Novo site a partir de um briefing enviado pelo cliente (só admin)
  let briefing: Briefing | null = null
  if (!site && briefingId && isAdmin) {
    briefing = await prisma.briefing.findUnique({ where: { id: briefingId } })
    if (briefing) initialData = briefingParaForm(briefing)
  }

  return (
    <div className="py-10 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {site ? 'Editar site' : 'Criar novo site'}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Preencha as informações do negócio para gerar o site com IA
          </p>
        </div>

        {briefing && (
          <div className="mb-5 bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-1.5">
            <p className="text-sm font-semibold text-indigo-900">
              ✨ Preenchido com o briefing de {briefing.nomeEmpresa}
            </p>
            <p className="text-xs text-indigo-700">
              Falta completar: <b>cidade, estado, segmento, paleta de cores, dor principal e resultado para o cliente</b>. Revise também os serviços e o endereço.
            </p>
            {briefing.observacoes && (
              <p className="text-xs text-indigo-700 pt-1">
                <b>Observações do cliente:</b> {briefing.observacoes}
              </p>
            )}
          </div>
        )}
        <FormStepper initialData={initialData} siteId={site?.id} />
      </div>
    </div>
  )
}
