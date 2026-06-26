'use client'

import { useState } from 'react'
import { useFormContext, useFieldArray } from 'react-hook-form'
import { Plus, Trash2, Upload, Loader2, X, ImageIcon, User } from 'lucide-react'
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
          onClick={() => onChange(undefined)}
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

function DepoimentoUpload({ index, onRemove }: { index: number; onRemove: () => void }) {
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
        {uploading ? 'Enviando...' : `Print ${index + 1}`}
      </span>
      <input type="file" accept="image/*" className="hidden" onChange={handleChange} disabled={uploading} />
    </label>
  )
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

export default function StepCredibilidade() {
  const { register, control, watch, setValue, formState: { errors } } = useFormContext<FormData>()
  const { fields, append, remove } = useFieldArray({ control, name: 'depoimentos' })
  const { fields: resFields, append: resAppend, remove: resRemove } = useFieldArray({ control, name: 'resultados' })

  const foto1Url = watch('foto1Url')
  const foto2Url = watch('foto2Url')
  const foto3Url = watch('foto3Url')
  const fotoProfissionalUrl = watch('fotoProfissionalUrl')

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
        <div className="flex items-center gap-2 mb-2">
          <User className="w-4 h-4 text-gray-400" />
          <Label>Foto do profissional / proprietário</Label>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-24">
            <FotoUpload
              value={fotoProfissionalUrl}
              onChange={(url) => setValue('fotoProfissionalUrl', url)}
              label="Sua foto"
              icon={User}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Aparecerá na seção "Sobre" do site, ao lado das suas credenciais.
          </p>
        </div>
      </div>

      {/* Depoimentos */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label>Depoimentos em imagem (até 5)</Label>
          {fields.length < 5 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => append({ imagemUrl: '' })}
              className="text-blue-600 hover:text-blue-700 h-auto py-0 px-0 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </Button>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-3">Print de WhatsApp, Google, Instagram, etc. Serão exibidos em carrossel no site.</p>

        <div className="grid grid-cols-3 gap-2">
          {fields.map((field, index) => (
            <DepoimentoUpload
              key={field.id}
              index={index}
              onRemove={() => remove(index)}
            />
          ))}
          {fields.length === 0 && (
            <div className="col-span-3 text-xs text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">
              Clique em &quot;Adicionar&quot; para incluir depoimentos
            </div>
          )}
        </div>
      </div>

      {/* Resultados reais */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label>Resultados reais (até 5)</Label>
          {resFields.length < 5 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => resAppend({ imagemUrl: '' })}
              className="text-blue-600 hover:text-blue-700 h-auto py-0 px-0 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </Button>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-3">Fotos de produtos, serviços ou antes e depois. Serão exibidas em uma galeria no site.</p>

        <div className="grid grid-cols-3 gap-2">
          {resFields.map((field, index) => (
            <ResultadoUpload
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
