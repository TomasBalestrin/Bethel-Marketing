'use client'

import { useState } from 'react'
import { useFormContext, useFieldArray } from 'react-hook-form'
import { Plus, Trash2, Upload, Loader2, X, ImageIcon, User, Video, ChevronLeft, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { type FormData } from '@/types'

async function uploadFoto(file: File): Promise<string | null> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  const data = await res.json()
  return data.url ?? null
}

// Vídeo vai DIRETO do navegador para o armazenamento (arquivo grande não passa
// pelo servidor). Retorna a URL pública ou uma mensagem de erro.
async function uploadVideo(file: File): Promise<{ url?: string; erro?: string }> {
  const prep = await fetch('/api/upload/video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
  })
  const info = await prep.json().catch(() => ({}))
  if (!prep.ok || !info.signedUrl) return { erro: info.error ?? 'Não foi possível preparar o envio.' }

  const put = await fetch(info.signedUrl, {
    method: 'PUT',
    body: file,
    headers: { 'content-type': file.type || 'video/mp4' },
  })
  if (!put.ok) return { erro: 'Falha ao enviar o vídeo. Tente novamente.' }
  return { url: info.publicUrl }
}

function FotoUpload({
  value,
  onChange,
  label,
  icon: Icon,
}: {
  value?: string
  onChange: (url: string | undefined) => void
  label: string
  icon: React.ElementType
}) {
  const [uploading, setUploading] = useState(false)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const url = await uploadFoto(file)
    if (url) onChange(url)
    setUploading(false)
  }

  if (value) {
    return (
      <div className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-square bg-gray-50">
        <img src={value} alt={label} className="w-full h-full object-cover" />
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <label className="flex flex-col items-center justify-center gap-1.5 cursor-pointer border-2 border-dashed border-gray-200 rounded-lg aspect-square bg-gray-50 hover:bg-gray-100 transition-colors">
      {uploading
        ? <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        : <Icon className="w-5 h-5 text-gray-300" />
      }
      <span className="text-xs text-gray-400 text-center px-1 leading-tight">
        {uploading ? 'Enviando...' : label}
      </span>
      <input type="file" accept="image/*" className="hidden" onChange={handleChange} disabled={uploading} />
    </label>
  )
}

function DepoimentoImagem({ index, onRemove }: { index: number; onRemove: () => void }) {
  const { watch, setValue } = useFormContext<FormData>()
  const [uploading, setUploading] = useState(false)
  const url = watch(`depoimentos.${index}.imagemUrl`)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const uploaded = await uploadFoto(file)
    if (uploaded) setValue(`depoimentos.${index}.imagemUrl`, uploaded)
    setUploading(false)
  }

  if (url) {
    return (
      <div className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-square bg-gray-50">
        <img src={url} alt={`Depoimento ${index + 1}`} className="w-full h-full object-cover" />
        <button type="button" onClick={onRemove}
          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <label className="flex flex-col items-center justify-center gap-1.5 cursor-pointer border-2 border-dashed border-gray-200 rounded-lg aspect-square bg-gray-50 hover:bg-gray-100 transition-colors">
      {uploading
        ? <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        : <ImageIcon className="w-5 h-5 text-gray-300" />
      }
      <span className="text-xs text-gray-400 text-center px-1 leading-tight">
        {uploading ? 'Enviando...' : 'Print'}
      </span>
      <input type="file" accept="image/*" className="hidden" onChange={handleChange} disabled={uploading} />
    </label>
  )
}

function DepoimentoVideo({ index, onRemove }: { index: number; onRemove: () => void }) {
  const { register, watch, setValue } = useFormContext<FormData>()
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const url = watch(`depoimentos.${index}.videoUrl`) ?? ''
  const ehArquivo = Boolean(url) && !/instagram\.com/i.test(url)

  async function enviarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setEnviando(true); setErro('')
    const res = await uploadVideo(file)
    if (res.url) setValue(`depoimentos.${index}.videoUrl`, res.url)
    else setErro(res.erro ?? 'Erro no envio')
    setEnviando(false)
  }

  return (
    <div className="relative rounded-lg border border-gray-200 bg-gray-50 p-2.5 flex flex-col justify-center gap-1.5 aspect-square">
      <button type="button" onClick={onRemove}
        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5">
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="flex items-center gap-1.5 text-gray-500">
        <Video className="w-4 h-4" />
        <span className="text-xs font-medium">Vídeo</span>
      </div>

      {ehArquivo ? (
        <>
          <video src={url} className="w-full rounded max-h-[70px] bg-black" preload="metadata" />
          <p className="text-[10px] text-green-600 leading-tight">✅ Vídeo enviado (toca no site)</p>
          <button type="button" onClick={() => setValue(`depoimentos.${index}.videoUrl`, '')}
            className="text-[10px] text-gray-400 hover:underline">trocar</button>
        </>
      ) : (
        <>
          <Input
            {...register(`depoimentos.${index}.videoUrl`)}
            placeholder="Cole o link do Instagram"
            className="text-xs h-8"
          />
          <label className="text-[10px] text-blue-600 hover:underline cursor-pointer">
            {enviando ? 'Enviando vídeo...' : 'ou enviar arquivo (MP4, até 60MB)'}
            <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden"
              onChange={enviarArquivo} disabled={enviando} />
          </label>
          {erro && <p className="text-[10px] text-red-500 leading-tight">{erro}</p>}
          <p className="text-[10px] text-gray-400 leading-tight">Arquivo toca no site. Link do Instagram pode abrir o app (Reels).</p>
        </>
      )}
    </div>
  )
}

function DepoimentoItem({ index, onRemove }: { index: number; onRemove: () => void }) {
  const { watch } = useFormContext<FormData>()
  const isVideo = watch(`depoimentos.${index}.videoUrl`) !== undefined
  return isVideo
    ? <DepoimentoVideo index={index} onRemove={onRemove} />
    : <DepoimentoImagem index={index} onRemove={onRemove} />
}

function ResultadoVideo({ index, onRemove }: { index: number; onRemove: () => void }) {
  const { register, watch, setValue } = useFormContext<FormData>()
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const url = watch(`resultados.${index}.videoUrl`) ?? ''
  const ehArquivo = Boolean(url) && !/instagram\.com/i.test(url)

  async function enviarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setEnviando(true); setErro('')
    const res = await uploadVideo(file)
    if (res.url) setValue(`resultados.${index}.videoUrl`, res.url)
    else setErro(res.erro ?? 'Erro no envio')
    setEnviando(false)
  }

  return (
    <div className="relative rounded-lg border border-gray-200 bg-gray-50 p-2.5 flex flex-col justify-center gap-1.5 aspect-square">
      <button type="button" onClick={onRemove}
        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5">
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="flex items-center gap-1.5 text-gray-500">
        <Video className="w-4 h-4" />
        <span className="text-xs font-medium">Vídeo</span>
      </div>

      {ehArquivo ? (
        <>
          <video src={url} className="w-full rounded max-h-[70px] bg-black" preload="metadata" />
          <p className="text-[10px] text-green-600 leading-tight">✅ Vídeo enviado (toca no site)</p>
          <button type="button" onClick={() => setValue(`resultados.${index}.videoUrl`, '')}
            className="text-[10px] text-gray-400 hover:underline">trocar</button>
        </>
      ) : (
        <>
          <Input
            {...register(`resultados.${index}.videoUrl`)}
            placeholder="Cole o link do Instagram"
            className="text-xs h-8"
          />
          <label className="text-[10px] text-blue-600 hover:underline cursor-pointer">
            {enviando ? 'Enviando vídeo...' : 'ou enviar arquivo (MP4, até 60MB)'}
            <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden"
              onChange={enviarArquivo} disabled={enviando} />
          </label>
          {erro && <p className="text-[10px] text-red-500 leading-tight">{erro}</p>}
          <p className="text-[10px] text-gray-400 leading-tight">Arquivo toca no site. Link do Instagram pode abrir o app (Reels).</p>
        </>
      )}
    </div>
  )
}

function ResultadoItem({ index, onRemove }: { index: number; onRemove: () => void }) {
  const { watch } = useFormContext<FormData>()
  const isVideo = watch(`resultados.${index}.videoUrl`) !== undefined
  return isVideo
    ? <ResultadoVideo index={index} onRemove={onRemove} />
    : <ResultadoUpload index={index} onRemove={onRemove} />
}

function ResultadoUpload({ index, onRemove }: { index: number; onRemove: () => void }) {
  const { watch, setValue } = useFormContext<FormData>()
  const [uploading, setUploading] = useState(false)
  const url = watch(`resultados.${index}.imagemUrl`)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const uploaded = await uploadFoto(file)
    if (uploaded) setValue(`resultados.${index}.imagemUrl`, uploaded)
    setUploading(false)
  }

  if (url) {
    return (
      <div className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-square bg-gray-50">
        <img src={url} alt={`Resultado ${index + 1}`} className="w-full h-full object-cover" />
        <button type="button" onClick={onRemove}
          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <label className="flex flex-col items-center justify-center gap-1.5 cursor-pointer border-2 border-dashed border-gray-200 rounded-lg aspect-square bg-gray-50 hover:bg-gray-100 transition-colors">
      {uploading
        ? <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        : <ImageIcon className="w-5 h-5 text-gray-300" />
      }
      <span className="text-xs text-gray-400 text-center px-1 leading-tight">
        {uploading ? 'Enviando...' : `Foto ${index + 1}`}
      </span>
      <input type="file" accept="image/*" className="hidden" onChange={handleChange} disabled={uploading} />
    </label>
  )
}

function FotoProfissionalUpload({ index, onRemove }: { index: number; onRemove: () => void }) {
  const { watch, setValue } = useFormContext<FormData>()
  const [uploading, setUploading] = useState(false)
  const url = watch(`fotosProfissionais.${index}.imagemUrl`)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const uploaded = await uploadFoto(file)
    if (uploaded) setValue(`fotosProfissionais.${index}.imagemUrl`, uploaded)
    setUploading(false)
  }

  if (url) {
    return (
      <div className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-square bg-gray-50">
        <img src={url} alt={`Foto profissional ${index + 1}`} className="w-full h-full object-cover" />
        <button type="button" onClick={onRemove}
          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <label className="flex flex-col items-center justify-center gap-1.5 cursor-pointer border-2 border-dashed border-gray-200 rounded-lg aspect-square bg-gray-50 hover:bg-gray-100 transition-colors">
      {uploading
        ? <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        : <User className="w-5 h-5 text-gray-300" />
      }
      <span className="text-xs text-gray-400 text-center px-1 leading-tight">
        {uploading ? 'Enviando...' : 'Sua foto'}
      </span>
      <input type="file" accept="image/*" className="hidden" onChange={handleChange} disabled={uploading} />
    </label>
  )
}

export default function StepCredibilidade() {
  const { register, control, watch, setValue, formState: { errors } } = useFormContext<FormData>()
  const { fields, append, remove, move } = useFieldArray({ control, name: 'depoimentos' })
  const { fields: resFields, append: resAppend, remove: resRemove } = useFieldArray({ control, name: 'resultados' })
  const { fields: fotosProfFields, append: fotoProfAppend, remove: fotoProfRemove } = useFieldArray({
    control,
    name: 'fotosProfissionais'
  })

  const foto1Url = watch('foto1Url')
  const foto2Url = watch('foto2Url')
  const foto3Url = watch('foto3Url')

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="anos">Anos no mercado *</Label>
          <Input id="anos" {...register('anosNoMercado')} type="number" min="0" className="mt-1.5" placeholder="Ex: 8" />
          {errors.anosNoMercado && <p className="text-xs text-red-500 mt-1">{errors.anosNoMercado.message}</p>}
        </div>
        <div>
          <Label htmlFor="clientes">Quantidade (opcional)</Label>
          <Input id="clientes" {...register('totalClientes')} type="number" min="0" className="mt-1.5" placeholder="Ex: 6000" />
        </div>
      </div>

      <div>
        <Label htmlFor="clientesLabel">O que representa esse número</Label>
        <Input
          id="clientesLabel"
          {...register('totalClientesLabel')}
          className="mt-1.5"
          placeholder="Ex: casos revisados, pacientes atendidos, alunos formados"
        />
        <p className="text-xs text-gray-400 mt-1">Deixe em branco para usar "clientes atendidos"</p>
      </div>

      <div>
        <Label htmlFor="certs">Certificados e formações</Label>
        <Input id="certs" {...register('certificados')} className="mt-1.5" placeholder="Ex: CRF 1234, Especialização em Dermato" />
      </div>

      {/* Fotos do espaço */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <ImageIcon className="w-4 h-4 text-gray-400" />
          <Label>Fotos do negócio / espaço (até 3)</Label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <FotoUpload
            value={foto1Url}
            onChange={(url) => setValue('foto1Url', url)}
            label="Foto 1"
            icon={ImageIcon}
          />
          <FotoUpload
            value={foto2Url}
            onChange={(url) => setValue('foto2Url', url)}
            label="Foto 2"
            icon={ImageIcon}
          />
          <FotoUpload
            value={foto3Url}
            onChange={(url) => setValue('foto3Url', url)}
            label="Foto 3"
            icon={ImageIcon}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1.5">Aparecerão em uma galeria no site</p>
      </div>

      {/* Foto do profissional */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            <Label>Foto do profissional / proprietário (até 5)</Label>
          </div>
          {fotosProfFields.length < 5 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fotoProfAppend({ imagemUrl: '' })}
              className="text-blue-600 hover:text-blue-700 h-auto py-0 px-0 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </Button>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Aparecerá na seção "Sobre" do site, ao lado das suas credenciais.
        </p>

        <div className="grid grid-cols-3 gap-2">
          {fotosProfFields.map((field, index) => (
            <FotoProfissionalUpload
              key={field.id}
              index={index}
              onRemove={() => fotoProfRemove(index)}
            />
          ))}
          {fotosProfFields.length === 0 && (
            <div className="col-span-3 text-xs text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">
              Clique em &quot;Adicionar&quot; para incluir fotos do profissional
            </div>
          )}
        </div>
      </div>

      {/* Depoimentos */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label>Depoimentos (até 5)</Label>
          {fields.length < 5 && (
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => append({ imagemUrl: '' })}
                className="text-blue-600 hover:text-blue-700 h-auto py-0 px-0 text-xs"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Print
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => append({ imagemUrl: '', videoUrl: '' })}
                className="text-blue-600 hover:text-blue-700 h-auto py-0 px-0 text-xs"
              >
                <Video className="w-3.5 h-3.5" />
                Vídeo
              </Button>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-3">Prints (WhatsApp, Google, Instagram) ou vídeos do Instagram. Serão exibidos em carrossel no site.</p>

        <div className="grid grid-cols-3 gap-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex flex-col gap-1">
              <DepoimentoItem index={index} onRemove={() => remove(index)} />
              {fields.length > 1 && (
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => move(index, index - 1)}
                    disabled={index === 0}
                    aria-label="Mover para trás"
                    className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[10px] text-gray-400">{index + 1}º</span>
                  <button
                    type="button"
                    onClick={() => move(index, index + 1)}
                    disabled={index === fields.length - 1}
                    aria-label="Mover para frente"
                    className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {fields.length === 0 && (
            <div className="col-span-3 text-xs text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">
              Adicione um &quot;Print&quot; ou &quot;Vídeo do Instagram&quot;
            </div>
          )}
        </div>
      </div>

      {/* Resultados reais */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label>Resultados reais (até 5)</Label>
          {resFields.length < 5 && (
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => resAppend({ imagemUrl: '' })}
                className="text-blue-600 hover:text-blue-700 h-auto py-0 px-0 text-xs"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Foto
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => resAppend({ imagemUrl: '', videoUrl: '' })}
                className="text-blue-600 hover:text-blue-700 h-auto py-0 px-0 text-xs"
              >
                <Video className="w-3.5 h-3.5" />
                Vídeo
              </Button>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-3">Fotos de produtos, serviços ou antes e depois. Serão exibidas em uma galeria no site.</p>

        <div className="grid grid-cols-3 gap-2">
          {resFields.map((field, index) => (
            <ResultadoItem
              key={field.id}
              index={index}
              onRemove={() => resRemove(index)}
            />
          ))}
          {resFields.length === 0 && (
            <div className="col-span-3 text-xs text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">
              Clique em &quot;Adicionar&quot; para incluir resultados (produtos, serviços, antes/depois)
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
