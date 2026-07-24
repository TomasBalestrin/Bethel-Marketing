import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { StatusBadge } from '@/components/StatusBadge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ExternalLink,
  Pencil,
  Plus,
  Eye,
  AlertTriangle,
} from 'lucide-react'
import { CopyButton } from '@/components/CopyButton'
import { DeleteSiteButton } from '@/components/DeleteSiteButton'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  const isAdmin = dbUser?.role === 'ADMIN'

  if (isAdmin) {
    const sites = await prisma.site.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    return (
      <div className="p-8 max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Meus Sites (Admin)</h1>
            <p className="text-gray-500 text-sm mt-1">{sites.length} site{sites.length !== 1 ? 's' : ''} criado{sites.length !== 1 ? 's' : ''}</p>
          </div>
          <Button asChild>
            <Link href="/dashboard/criar">
              <Plus />
              Criar novo site
            </Link>
          </Button>
        </div>

        {sites.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm mb-4">Nenhum site criado ainda.</p>
                <Button asChild>
                  <Link href="/dashboard/criar">
                    <Plus />
                    Criar primeiro site
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sites.map((site) => (
              <Card key={site.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">{site.nomeNegocio}</h2>
                      <p className="text-sm text-gray-500">{site.cidade} - {site.estado}</p>
                    </div>
                    <StatusBadge status={site.status} />
                  </div>

                  {site.status === 'PUBLISHED' && (site.subdomain || site.vercelUrl) && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-lg mb-4">
                      <ExternalLink className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <a
                        href={site.subdomain || site.vercelUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-green-700 hover:underline font-medium flex-1 truncate"
                      >
                        {site.subdomain || site.vercelUrl}
                      </a>
                      <CopyButton text={site.subdomain || site.vercelUrl!} />
                    </div>
                  )}

                  {site.status === 'ERROR' && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg mb-4">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-sm text-red-600">Erro na última operação. Tente republicar.</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-5">
                    <span>Criado em {new Date(site.createdAt).toLocaleDateString('pt-BR')}</span>
                    <span>·</span>
                    <span>{site.geracoesCount}/3 gerações</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/criar?siteId=${site.id}`}>
                        <Pencil />
                        Editar
                      </Link>
                    </Button>

                    {site.status !== 'DRAFT' && (
                      <Button asChild size="sm">
                        <Link href={`/dashboard/preview?siteId=${site.id}`}>
                          <Eye />
                          {site.status === 'PUBLISHED' ? 'Ver preview' : 'Preview / Publicar'}
                        </Link>
                      </Button>
                    )}

                    {site.status === 'DRAFT' && (
                      <Button asChild size="sm">
                        <Link href={`/dashboard/preview?siteId=${site.id}`}>
                          <Plus />
                          Gerar site
                        </Link>
                      </Button>
                    )}

                    <DeleteSiteButton
                      siteId={site.id}
                      nome={site.nomeNegocio}
                      publicado={site.status === 'PUBLISHED'}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Regular user — single site
  const site = await prisma.site.findFirst({
    where: { userId: user.id },
  })

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Meu Site</h1>
        <p className="text-gray-500 text-sm mt-1">Gerencie seu site profissional</p>
      </div>

      {!site ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Você ainda não tem um site</h3>
              <p className="text-gray-500 text-sm mb-6">
                Responda algumas perguntas sobre o seu negócio e nossa IA vai gerar um site
                profissional em menos de 2 minutos.
              </p>
              <Button asChild>
                <Link href="/dashboard/criar">
                  <Plus />
                  Criar meu site agora
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{site.nomeNegocio}</h2>
                  <p className="text-sm text-gray-500">{site.cidade} - {site.estado}</p>
                </div>
                <StatusBadge status={site.status} />
              </div>

              {site.status === 'PUBLISHED' && (site.subdomain || site.vercelUrl) && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-lg mb-4">
                  <ExternalLink className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <a
                    href={site.subdomain || site.vercelUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-green-700 hover:underline font-medium flex-1 truncate"
                  >
                    {site.subdomain || site.vercelUrl}
                  </a>
                  <CopyButton text={site.subdomain || site.vercelUrl!} />
                </div>
              )}

              {site.status === 'ERROR' && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg mb-4">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-600">Erro na última operação. Tente republicar.</p>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-gray-400 mb-5">
                <span>Criado em {new Date(site.createdAt).toLocaleDateString('pt-BR')}</span>
                <span>·</span>
                <span>Atualizado em {new Date(site.updatedAt).toLocaleDateString('pt-BR')}</span>
                <span>·</span>
                <span>{site.geracoesCount}/3 gerações</span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard/criar">
                    <Pencil />
                    Editar formulário
                  </Link>
                </Button>

                {site.status !== 'DRAFT' && (
                  <Button asChild size="sm">
                    <Link href="/dashboard/preview">
                      <Eye />
                      {site.status === 'PUBLISHED' ? 'Ver preview' : 'Preview / Publicar'}
                    </Link>
                  </Button>
                )}

                {site.status === 'DRAFT' && (
                  <Button asChild size="sm">
                    <Link href="/dashboard/preview">
                      <Plus />
                      Gerar site
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
