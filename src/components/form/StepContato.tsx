'use client'

import { useFormContext, useFieldArray } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { type FormData } from '@/types'

export default function StepContato() {
  const { register, control, formState: { errors } } = useFormContext<FormData>()

  const { fields, append, remove } = useFieldArray({ control, name: 'registros' })

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="whatsapp">WhatsApp *</Label>
        <Input
          id="whatsapp"
          {...register('whatsapp')}
          type="tel"
          className="mt-1.5"
          placeholder="11999999999 (apenas números)"
        />
        {errors.whatsapp && <p className="text-xs text-red-500 mt-1">{errors.whatsapp.message}</p>}
      </div>

      <div>
        <Label htmlFor="mensagem">Mensagem pré-preenchida do WhatsApp *</Label>
        <Textarea
          id="mensagem"
          {...register('whatsappMensagem')}
          className="mt-1.5"
          rows={2}
          placeholder="Ex: Olá! Vi seu site e gostaria de agendar uma consulta."
        />
        {errors.whatsappMensagem && <p className="text-xs text-red-500 mt-1">{errors.whatsappMensagem.message}</p>}
      </div>

      <div>
        <Label htmlFor="instagram">Instagram (opcional)</Label>
        <div className="relative mt-1.5">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
          <Input id="instagram" {...register('instagram')} className="pl-7" placeholder="perfil1, perfil2" />
        </div>
        <p className="text-xs text-gray-400 mt-1">Tem mais de um profissional? Separe os @ por vírgula (ex: drafulana, drbeltrano) — cada um vira um link no site.</p>
      </div>

      <div>
        <Label htmlFor="horario">Horário de atendimento *</Label>
        <Input
          id="horario"
          {...register('horarioAtendimento')}
          className="mt-1.5"
          placeholder="Ex: Seg a Sex das 8h às 18h | Sáb 8h às 12h"
        />
        {errors.horarioAtendimento && <p className="text-xs text-red-500 mt-1">{errors.horarioAtendimento.message}</p>}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Registros profissionais (opcional)</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ tipo: '', numero: '' })}
            className="text-xs gap-1"
          >
            <Plus className="w-3 h-3" /> Adicionar
          </Button>
        </div>
        <p className="text-xs text-gray-400 mb-3">CRO, CRM, CREFITO, COREN, CRN, CREA, etc.</p>

        {fields.length === 0 && (
          <p className="text-xs text-gray-400 italic text-center py-3 border border-dashed border-gray-200 rounded-xl">
            Nenhum registro adicionado
          </p>
        )}

        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex gap-2 items-start">
              <Input
                {...register(`registros.${index}.tipo`)}
                placeholder="Ex: CRO"
                className="w-28 shrink-0"
              />
              <Input
                {...register(`registros.${index}.numero`)}
                placeholder="Ex: SP-12345"
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => remove(index)}
                className="mt-2 text-gray-400 hover:text-red-500 transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
