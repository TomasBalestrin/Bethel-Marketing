'use client'

import { useState } from 'react'
import { useFormContext, useFieldArray } from 'react-hook-form'
import { Plus, Trash2, Upload, Loader2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { type FormData } from '@/types'

export default function StepServicos() {
  const { register, control, setValue, watch, formState: { errors } } = useFormContext<FormData>()
  const { fields, append, remove } = useFieldArray({ control, name: 'servicos' })
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, index: number) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingIdx(index)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.url) setValue(`servicos.${index}.imagemUrl`, data.url, { shouldValidate: true })
    } finally {
      setUploadingIdx(null)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-5">

      {/* Lista de serviços */}
      <div className="space-y-3">
        {fields.map((field, index) => {
          const imagem = watch(`servicos.${index}.imagemUrl`)
          return (
            <div key={field.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Serviço {index + 1}{index === 0 ? ' *' : ''}
                </p>
                {index > 0 && (
                  <button type="button" onClick={() => remove(index)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex gap-3">
                {/* Foto do serviço (opcional) */}
                <div className="flex-shrink-0">
                  {imagem ? (
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 group">
                      <img src={imagem} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setValue(`servicos.${index}.imagemUrl`, undefined)}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 hover:border-purple-400 flex flex-col items-center justify-center cursor-pointer text-gray-400 hover:text-purple-500 transition-colors">
                      {uploadingIdx === index
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <><Upload className="w-3.5 h-3.5" /><span className="text-[9px] mt-0.5">Foto</span></>}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, index)} disabled={uploadingIdx === index} />
                    </label>
                  )}
                </div>

                {/* Nome + descrição */}
                <div className="flex-1 space-y-2 min-w-0">
                  <div>
                    <Input {...register(`servicos.${index}.nome`)} placeholder="Nome do serviço" />
                    {errors.servicos?.[index]?.nome && (
                      <p className="text-xs text-red-500 mt-1">{errors.servicos[index]?.nome?.message}</p>
                    )}
                  </div>
                  <Input {...register(`servicos.${index}.descricao`)} placeholder="Descrição (opcional)" />
                </div>
              </div>
              <p className="text-[11px] text-gray-400">Foto do serviço é opcional — se não enviar, o card aparece só com texto.</p>
            </div>
          )
        })}

        {fields.length === 0 && (
          <p className="text-xs text-red-500 text-center py-2">Adicione ao menos um serviço</p>
        )}

        <button
          type="button"
          onClick={() => append({ nome: '', descricao: '', imagemUrl: undefined })}
          className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-purple-300 hover:text-purple-600 text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Adicionar serviço
        </button>
      </div>

      {/* Destaque e resultado */}
      <div className="border-t border-gray-100 pt-4 space-y-3">
        <div>
          <Label htmlFor="destaque">Serviço carro-chefe *</Label>
          <Input id="destaque" {...register('servicoDestaque')} className="mt-1.5" placeholder="Qual serviço mais gera resultado?" />
          {errors.servicoDestaque && <p className="text-xs text-red-500 mt-1">{errors.servicoDestaque.message}</p>}
        </div>
        <div>
          <Label htmlFor="resultado">Resultado que o cliente alcança *</Label>
          <Textarea
            id="resultado"
            {...register('resultadoCliente')}
            className="mt-1.5"
            rows={2}
            placeholder="Ex: Eliminar a dor crônica nas costas em até 4 sessões"
          />
          {errors.resultadoCliente && <p className="text-xs text-red-500 mt-1">{errors.resultadoCliente.message}</p>}
        </div>
      </div>
    </div>
  )
}
