'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { generateSiteHTML } from '@/lib/claude'
import { deleteVercelProject } from '@/lib/vercel-deploy'
import { formSchema } from '@/types'
import slugify from 'slugify'

type Result<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Prisma ignora campos `undefined` no update (não altera a coluna). Para que
// remover uma foto/campo opcional realmente limpe o valor salvo, convertemos
// undefined -> null (todas as colunas opcionais do Site são anuláveis).
function nullifyUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v === undefined ? null : v])
  ) as T
}

async function ensureUniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = base
  let count = 0
  while (true) {
    const existing = await prisma.site.findUnique({ where: { slug } })
    if (!existing || existing.id === excludeId) break
    count++
    slug = `${base}-${count}`
  }
  return slug
}

export async function saveSite(data: unknown, siteId?: string): Promise<Result<{ id: string }>> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  const parsed = formSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Dados do formulário inválidos' }

  const { depoimentos, resultados, servicos, registros, ...siteFields } = parsed.data
  const dbUser =
    (await prisma.user.findFirst({ where: { OR: [{ id: user.id }, { email: user.email! }] } })) ??
    (await prisma.user.create({ data: { id: user.id, email: user.email!, name: user.user_metadata?.name || user.email! } }))
  const isAdmin = dbUser?.role === 'ADMIN'

  try {
    // Edit existing site (by siteId)
    if (siteId) {
      const existing = await prisma.site.findUnique({ where: { id: siteId } })
      if (existing) {
        await prisma.depoimento.deleteMany({ where: { siteId: existing.id } })
        await prisma.resultado.deleteMany({ where: { siteId: existing.id } })
        await prisma.servico.deleteMany({ where: { siteId: existing.id } })
        await prisma.registroProfissional.deleteMany({ where: { siteId: existing.id } })
        await prisma.site.update({
          where: { id: existing.id },
          data: {
            ...nullifyUndefined(siteFields),
            status: 'DRAFT',
            htmlGerado: null,
            geracoesCount: 0,
            depoimentos: { create: depoimentos },
            resultados: { create: resultados },
            servicos: { create: servicos.map((s, i) => ({ ...s, ordem: i })) },
            registros: { create: registros },
          },
        })
        revalidatePath('/dashboard')
        return { success: true, data: { id: existing.id } }
      }
    }

    // Regular user: upsert by userId
    if (!isAdmin) {
      const existing = await prisma.site.findFirst({ where: { userId: user.id } })
      if (existing) {
        await prisma.depoimento.deleteMany({ where: { siteId: existing.id } })
        await prisma.resultado.deleteMany({ where: { siteId: existing.id } })
        await prisma.servico.deleteMany({ where: { siteId: existing.id } })
        await prisma.registroProfissional.deleteMany({ where: { siteId: existing.id } })
        await prisma.site.update({
          where: { id: existing.id },
          data: {
            ...nullifyUndefined(siteFields),
            status: 'DRAFT',
            htmlGerado: null,
            geracoesCount: 0,
            depoimentos: { create: depoimentos },
            resultados: { create: resultados },
            servicos: { create: servicos.map((s, i) => ({ ...s, ordem: i })) },
            registros: { create: registros },
          },
        })
        revalidatePath('/dashboard')
        return { success: true, data: { id: existing.id } }
      }
    }

    // Admin without siteId, or new regular user: create
    const site = await prisma.site.create({
      data: {
        ...nullifyUndefined(siteFields),
        userId: user.id,
        depoimentos: { create: depoimentos },
        resultados: { create: resultados },
        servicos: { create: servicos.map((s, i) => ({ ...s, ordem: i })) },
        registros: { create: registros },
      },
    })

    revalidatePath('/dashboard')
    return { success: true, data: { id: site.id } }
  } catch (e) {
    console.error('saveSite error:', e)
    return { success: false, error: 'Erro ao salvar dados' }
  }
}

export async function generateSite(siteId: string): Promise<Result> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { depoimentos: true, resultados: true, servicos: { orderBy: { ordem: 'asc' } }, registros: true },
  })

  if (!site) return { success: false, error: 'Site não encontrado' }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  const isAdmin = dbUser?.role === 'ADMIN'
  if (!isAdmin && site.userId !== user.id) return { success: false, error: 'Acesso negado' }

  if (site.geracoesCount >= 3) {
    return { success: false, error: 'Limite de 3 gerações atingido. Edite o formulário para continuar.' }
  }

  await prisma.site.update({ where: { id: siteId }, data: { status: 'GENERATING' } })

  try {
    const html = await generateSiteHTML({ ...site, depoimentos: site.depoimentos, resultados: site.resultados, servicos: site.servicos, registros: site.registros, totalClientesLabel: site.totalClientesLabel ?? null, siteUrl: site.subdomain ?? null })

    await prisma.site.update({
      where: { id: siteId },
      data: {
        htmlGerado: html,
        status: 'PREVIEW',
        geracoesCount: { increment: 1 },
      },
    })

    revalidatePath('/dashboard/preview')
    return { success: true, data: undefined }
  } catch (e) {
    console.error('generateSite error:', e)
    await prisma.site.update({ where: { id: siteId }, data: { status: 'ERROR' } })
    return { success: false, error: 'Erro ao gerar site com IA. Tente novamente.' }
  }
}

export async function publishSite(siteId: string): Promise<Result<{ url: string }>> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  const site = await prisma.site.findUnique({ where: { id: siteId } })
  if (!site) return { success: false, error: 'Site não encontrado' }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  const isAdmin = dbUser?.role === 'ADMIN'
  if (!isAdmin && site.userId !== user.id) return { success: false, error: 'Acesso negado' }

  if (!site.htmlGerado) return { success: false, error: 'Gere o site antes de publicar' }

  const baseSlug = slugify(site.nomeNegocio, { lower: true, strict: true })
  const slug = site.slug ?? (await ensureUniqueSlug(baseSlug, siteId))
  const appDomain = process.env.MENTOR_DOMAIN
    || (process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname : null)
  const subdomain = appDomain ? `https://${slug}.${appDomain}` : null

  await prisma.site.update({
    where: { id: siteId },
    data: {
      status: 'PUBLISHED',
      slug,
      subdomain,
    },
  })

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/preview')
  revalidatePath('/admin')

  return { success: true, data: { url: subdomain ?? `/${slug}` } }
}

export async function resetSiteForTesting(siteId: string): Promise<void> {
  const user = await getAuthUser()
  if (!user) return

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (dbUser?.role !== 'ADMIN') return

  // Delete only the DB record — Vercel project stays live
  await prisma.depoimento.deleteMany({ where: { siteId } })
  await prisma.site.delete({ where: { id: siteId } })

  revalidatePath('/dashboard')
}

export async function removeSite(siteId: string): Promise<Result> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (dbUser?.role !== 'ADMIN') return { success: false, error: 'Acesso negado' }

  const site = await prisma.site.findUnique({ where: { id: siteId } })
  if (!site) return { success: false, error: 'Site não encontrado' }

  if (site.vercelProjectId) {
    try {
      await deleteVercelProject(site.vercelProjectId)
    } catch (e) {
      console.warn('Aviso: não foi possível deletar projeto no Vercel', e)
    }
  }

  await prisma.site.update({
    where: { id: siteId },
    data: {
      status: 'DRAFT',
      slug: null,
      subdomain: null,
      vercelProjectId: null,
      vercelUrl: null,
      htmlGerado: null,
      geracoesCount: 0,
    },
  })

  revalidatePath('/admin')
  return { success: true, data: undefined }
}

export async function saveRastreamento(siteId: string, data: {
  metaPixelId?: string
  metaPixelToken?: string
  gtmId?: string
}): Promise<Result> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  const site = await prisma.site.findUnique({ where: { id: siteId } })
  if (!site) return { success: false, error: 'Site não encontrado' }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  const isAdmin = dbUser?.role === 'ADMIN'
  if (!isAdmin && site.userId !== user.id) return { success: false, error: 'Acesso negado' }

  await prisma.site.update({
    where: { id: siteId },
    data: {
      metaPixelId: data.metaPixelId?.trim() || null,
      metaPixelToken: data.metaPixelToken?.trim() || null,
      gtmId: data.gtmId?.trim() || null,
    },
  })

  revalidatePath('/dashboard/rastreamento')
  return { success: true, data: undefined }
}
