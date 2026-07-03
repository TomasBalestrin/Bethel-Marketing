'use client'

import { useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { Wand2, Loader2, X, ImageIcon } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { type FormData } from '@/types'

async function uploadFoto(file: File): Promise<string | null> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  const data = await res.json()
  return data.url ?? null
}

export default function StepHero() {
  const { register, watch, setValue } = useFormContext<FormData>()

  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const formData = watch()
  const heroFotoUrl = watch('heroFotoUrl')

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const url = await uploadFoto(file)
    if (url) setValue('heroFotoUrl', url)
    setUploading(false)
  }

  async function gerarSugestao() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/site/sugerir-headline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomeNegocio: formData.nomeNegocio,
          segmento: formData.segmento,
          cidade: formData.cidade,
          estado: formData.estado,
          dorPrincipal: formData.dorPrincipal,
          resultadoCliente: formData.resultadoCliente,
          servicoDestaque: formData.servicoDestaque,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao gerar sugestão.'); return }
      if (data.headline) setValue('headline', data.headline)
      if (data.subheadline) setValue('subheadline', data.subheadline)
    } catch {
      setError('Erro ao conectar com a IA. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
        <p className="text-sm text-violet-700 font-medium mb-1">Headline e Subheadline do site</p>
        <p className="text-xs text-violet-600 leading-relaxed">
          Adicione uma foto de destaque para aparecer acima da headline no topo do site, depois edite ou gere o texto com IA.
        </p>
      </div>

      {/* Foto do hero */}
      <div>
        <Label>Foto de destaque do hero</Label>
        <p className="text-xs text-gray-400 mb-2 mt-0.5">Aparecerá em primeiro, acima da headline. Use uma imagem impactante do negócio ou do profissional.</p>
        {heroFotoUrl ? (
          <div className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-50 mx-auto" style={{ aspectRatio: '9/16', maxWidth: '220px' }}>
            <img src={heroFotoUrl} alt="Hero" className="w-full h-full object-cover object-top" />
            <button
              type="button"
              onClick={() => setValue('heroFotoUrl', '')}
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 cursor-pointer border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors mx-auto" style={{ aspectRatio: '9/16', maxWidth: '220px' }}>
            {uploading
              ? <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
              : <ImageIcon className="w-6 h-6 text-gray-300" />
            }
            <span className="text-sm text-gray-400">{uploading ? 'Enviando...' : 'Clique para adicionar foto'}</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleFoto} disabled={uploading} />
          </label>
        )}
      </div>

      {/* Botão IA */}
      <button
        type="button"
        onClick={gerarSugestao}
        disabled={loading}
        className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
      >
        {loading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando sugestão...</>
          : <><Wand2 className="w-4 h-4" /> Gerar sugestão com IA</>
        }
      </button>

      {error && <p className="text-xs text-red-500 text-center">{error}</p>}

      <div>
        <Label htmlFor="headline">Headline</Label>
        <Textarea
          id="headline"
          {...register('headline')}
          className="mt-1.5"
          rows={2}
          placeholder="Ex: Elimine a dor crônica e volte a viver bem"
        />
      </div>

      <div>
        <Label htmlFor="subheadline">Subheadline</Label>
        <Textarea
          id="subheadline"
          {...register('subheadline')}
          className="mt-1.5"
          rows={3}
          placeholder="Ex: Sua autoconfiança de volta no espelho. Procedimentos feitos com técnica e cuidado para quem quer resultados reais."
        />
      </div>

      <div>
        <Label htmlFor="ctaTexto">Texto do botão CTA</Label>
        <Input
          id="ctaTexto"
          {...register('ctaTexto')}
          className="mt-1.5"
          placeholder="Ex: Entrar em contato agora"
        />
        <p className="text-xs text-gray-400 mt-1">Deixe em branco para usar "Entrar em contato agora"</p>
      </div>
    </div>
  )
}
