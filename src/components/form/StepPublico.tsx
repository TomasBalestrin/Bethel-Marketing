'use client'

import { useFormContext } from 'react-hook-form'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { type FormData } from '@/types'

export default function StepPublico() {
  const { register, formState: { errors } } = useFormContext<FormData>()

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="dorPrincipal">Principal dor que você resolve *</Label>
        <Textarea
          id="dorPrincipal"
          {...register('dorPrincipal')}
          className="mt-1.5"
          rows={3}
          placeholder="Ex: Dor crônica no joelho que impede de trabalhar, praticar esporte e viver com qualidade"
        />
        {errors.dorPrincipal && <p className="text-xs text-red-500 mt-1">{errors.dorPrincipal.message}</p>}
      </div>

      <div>
        <Label htmlFor="duvidasFrequentes">Dúvidas frequentes dos clientes</Label>
        <Textarea
          id="duvidasFrequentes"
          {...register('duvidasFrequentes')}
          className="mt-1.5"
          rows={4}
          placeholder={'Uma por linha. Ex:\nPrecisa de encaminhamento médico?\nQuantas sessões são necessárias?\nAtende por convênio?\nTem estacionamento no local?'}
        />
        <p className="text-xs text-gray-400 mt-1">
          Viram a seção de perguntas frequentes do site. Se deixar em branco, a IA cria as perguntas a partir dos serviços e do horário.
        </p>
      </div>
    </div>
  )
}
