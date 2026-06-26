import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { FormStepper } from '@/components/form/FormStepper'
import type { FormData } from '@/types'

export default async function CriarPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  const isAdmin = dbUser?.role === 'ADMIN'

  const { siteId } = await searchParams

  const include = { depoimentos: true, resultados: true, servicos: { orderBy: { ordem: 'asc' as const } }, registros: true }

  // Admin editing a specific site, or regular user's own site
  const site = siteId
    ? await prisma.site.findUnique({ where: { id: siteId }, include })
    : isAdmin
      ? null
      : await prisma.site.findFirst({ where: { userId: user.id }, include })

  const initialData: Partial<FormData> | null = site
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
        depoimentos: site.depoimentos.map((d) => ({ imagemUrl: d.imagemUrl })),
        resultados: site.resultados.map((r) => ({ imagemUrl: r.imagemUrl })),
        whatsapp: site.whatsapp,
        whatsappMensagem: site.whatsappMensagem,
        instagram: site.instagram ?? undefined,
        horarioAtendimento: site.horarioAtendimento,
        registros: site.registros.map((r) => ({ tipo: r.tipo, numero: r.numero })),
      }
    : null

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
        <FormStepper initialData={initialData} siteId={site?.id} />
      </div>
    </div>
  )
}
