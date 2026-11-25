'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft,
  RefreshCw,
  Globe,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Copy,
  Check,
  Pencil,
  Monitor,
  Smartphone,
} from 'lucide-react'
import { generateSite, publishSite } from '@/app/actions/site'
import { Button } from '@/components/ui/button'

type Props = {
  siteId: string
  nomeNegocio: string
  htmlGerado: string | null
  status: string
  geracoesCount: number
  publishedUrl?: string | null
}

export function PreviewContent({
  siteId,
  nomeNegocio,
  htmlGerado,
  status: serverStatus,
  geracoesCount,
  publishedUrl,
}: Props) {
  const router = useRouter()
  const [isPendingGenerate, startGenerateTransition] = useTransition()
  const [isPendingPublish, startPublishTransition] = useTransition()
  const [copied, setCopied] = useState(false)
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop')
  const isGenerating = isPendingGenerate || serverStatus === 'GENERATING'

  // Poll every 3s while GENERATING (handles page reload during generation)
  useEffect(() => {
    if (serverStatus !== 'GENERATING') return
    const interval = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(interval)
  }, [serverStatus, router])

  function handleGenerate() {
    startGenerateTransition(async () => {
      const result = await generateSite(siteId)
      if (!result.success) {
        toast.error(result.error ?? 'Erro ao gerar site')
      } else {
        toast.success('Site gerado com sucesso!')
      }
      router.refresh()
    })
  }

  function handlePublish() {
    startPublishTransition(async () => {
      const result = await publishSite(siteId)
      if (!result.success) {
        toast.error(result.error ?? 'Erro ao publicar')
      } else {
        toast.success('Site publicado!')
        router.refresh()
      }
    })
  }

  async function handleCopyUrl() {
    if (!publishedUrl) return
    await navigator.clipboard.writeText(publishedUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const canRegenerate = !isGenerating && !isPendingPublish

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Toolbar */}
      <div className="flex-shrink-0 bg-gray-800 border-b border-gray-700 px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-white font-medium text-sm truncate">{nomeNegocio}</p>
            <p className="text-gray-400 text-xs">{geracoesCount} {geracoesCount === 1 ? 'geração' : 'gerações'}</p>
          </div>
        </div>

        {/* Viewport toggle */}
        {htmlGerado && !isGenerating && (
          <div className="hidden sm:flex items-center bg-gray-700 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setViewport('desktop')}
              title="Desktop"
              className={`p-1.5 rounded-md transition-colors ${viewport === 'desktop' ? 'bg-gray-500 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewport('mobile')}
              title="Mobile"
              className={`p-1.5 rounded-md transition-colors ${viewport === 'mobile' ? 'bg-gray-500 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          {serverStatus === 'PUBLISHED' && publishedUrl && (
            <>
              <button
                onClick={handleCopyUrl}
                className="flex items-center gap-1.5 text-gray-300 hover:text-white text-xs transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado!' : 'Copiar URL'}
              </button>
              <a
                href={publishedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-green-400 hover:text-green-300 text-xs transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Ver site
              </a>
            </>
          )}

          {canRegenerate && htmlGerado && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              className="border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700 bg-transparent"
            >
              <RefreshCw />
              Regenerar
            </Button>
          )}

          {htmlGerado && serverStatus !== 'PUBLISHED' && !isGenerating && (
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={isPendingPublish}
            >
              {isPendingPublish ? <Loader2 className="animate-spin" /> : <Globe />}
              {isPendingPublish ? 'Publicando...' : 'Publicar site'}
            </Button>
          )}
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 relative overflow-hidden">
        {isGenerating ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-center px-4">
            <Loader2 className="w-10 h-10 text-blue-400 animate-spin mb-4" />
            <p className="text-white font-medium text-lg">Gerando seu site com IA...</p>
            <p className="text-gray-400 text-sm mt-1">Isso pode levar até 3 minutos</p>
          </div>
        ) : serverStatus === 'ERROR' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-center px-4">
            <AlertTriangle className="w-10 h-10 text-red-400 mb-4" />
            <p className="text-white font-medium">Erro ao gerar o site</p>
            <p className="text-gray-400 text-sm mt-1 mb-4">
              Tente novamente.
            </p>
            {canRegenerate && (
              <Button onClick={handleGenerate} variant="outline" className="border-gray-600 text-gray-300 bg-transparent">
                <RefreshCw />
                Tentar novamente
              </Button>
            )}
            <Button asChild variant="outline" className="border-gray-600 text-gray-300 bg-transparent">
              <Link href="/dashboard/criar">
                <Pencil />
                Editar formulário
              </Link>
            </Button>
          </div>
        ) : htmlGerado ? (
          <div className={`h-full flex flex-col items-center transition-all duration-300 ${viewport === 'mobile' ? 'bg-gray-800 py-4' : ''}`}>
            <iframe
              srcDoc={htmlGerado}
              className={`border-0 transition-all duration-300 ${
                viewport === 'mobile'
                  ? 'w-[390px] flex-1 rounded-xl shadow-2xl'
                  : 'w-full h-full'
              }`}
              title="Preview do site"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-center px-4">
            <Globe className="w-10 h-10 text-gray-600 mb-4" />
            <p className="text-white font-medium text-lg mb-1">Pronto para gerar</p>
            <p className="text-gray-400 text-sm mb-6">Clique no botão abaixo para criar seu site com IA</p>
            <Button onClick={handleGenerate} disabled={!canRegenerate}>
              <Globe />
              Gerar site agora
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
