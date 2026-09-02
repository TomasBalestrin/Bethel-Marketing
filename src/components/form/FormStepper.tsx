'use client'

import { useState } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { formSchema, STEP_FIELDS, type FormData } from '@/types'
import { saveSite } from '@/app/actions/site'
import { Button } from '@/components/ui/button'
import StepIdentidade from './StepIdentidade'
import StepServicos from './StepServicos'
import StepPublico from './StepPublico'
import StepCredibilidade from './StepCredibilidade'
import StepContato from './StepContato'
import StepHero from './StepHero'

const STEPS = [
  { label: 'Identidade', component: StepIdentidade },
  { label: 'Serviços', component: StepServicos },
  { label: 'Público', component: StepPublico },
  { label: 'Credibilidade', component: StepCredibilidade },
  { label: 'Hero', component: StepHero },
  { label: 'Contato', component: StepContato },
]

// Mapa campo -> passo (1-based, na ordem de STEPS) para pular ao erro no submit
const FIELD_STEP: Record<string, number> = {
  nomeNegocio: 1, segmento: 1, cidade: 1, estado: 1, endereco: 1, cep: 1, corPaleta: 1, logoUrl: 1,
  servicos: 2, servicoDestaque: 2, resultadoCliente: 2,
  dorPrincipal: 3,
  anosNoMercado: 4, totalClientes: 4, totalClientesLabel: 4, certificados: 4,
  foto1Url: 4, foto2Url: 4, foto3Url: 4, fotoProfissionalUrl: 4, depoimentos: 4, resultados: 4,
  heroFotoUrl: 5, headline: 5, subheadline: 5, ctaTexto: 5,
  whatsapp: 6, whatsappMensagem: 6, instagram: 6, horarioAtendimento: 6, registros: 6,
}

export function FormStepper({ initialData, siteId }: { initialData: Partial<FormData> | null; siteId?: string }) {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const methods = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      depoimentos: [],
      resultados: [],
      fotosProfissionais: [],
      servicos: [{ nome: '', descricao: undefined, imagemUrl: undefined }],
      registros: [],
      ...initialData
    } as FormData,
    mode: 'onTouched',
  })

  async function handleNext() {
    const valid = await methods.trigger(STEP_FIELDS[step] as (keyof FormData)[])
    if (valid) setStep((s) => s + 1)
  }

  async function handleSubmit(data: FormData) {
    setSaving(true)
    try {
      const result = await saveSite(data, siteId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Dados salvos! Agora gere o site.')
      router.push(`/dashboard/preview?siteId=${result.data.id}`)
    } catch (e) {
      console.error('handleSubmit error:', e)
      toast.error('Não foi possível salvar. Verifique a conexão e tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  function onInvalid(errors: Record<string, unknown>) {
    const firstField = Object.keys(errors)[0]
    const targetStep = firstField ? FIELD_STEP[firstField] : undefined
    if (targetStep) setStep(targetStep)
    toast.error('Revise os campos destacados antes de salvar.')
  }

  const CurrentStep = STEPS[step - 1].component

  return (
    <div className="bg-white rounded-2xl border border-gray-200">
      {/* Step indicators */}
      <div className="px-6 pt-6 pb-5 border-b border-gray-100">
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center flex-1">
              <button
                type="button"
                onClick={() => i + 1 < step && setStep(i + 1)}
                className="flex items-center gap-1.5 group"
                disabled={i + 1 >= step}
              >
                <span
                  className={[
                    'flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold transition-colors flex-shrink-0',
                    i + 1 < step
                      ? 'bg-blue-600 text-white cursor-pointer'
                      : i + 1 === step
                      ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500'
                      : 'bg-gray-100 text-gray-400',
                  ].join(' ')}
                >
                  {i + 1}
                </span>
                <span
                  className={[
                    'text-xs hidden sm:block',
                    i + 1 === step ? 'text-blue-700 font-medium' : 'text-gray-400',
                  ].join(' ')}
                >
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={[
                    'flex-1 h-px mx-2 transition-colors',
                    i + 1 < step ? 'bg-blue-500' : 'bg-gray-200',
                  ].join(' ')}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <FormProvider {...methods}>
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="px-6 py-6">
            <CurrentStep />
          </div>

          <div className="px-6 pb-6 flex justify-between border-t border-gray-100 pt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 1}
            >
              <ChevronLeft />
              Anterior
            </Button>

            {step < STEPS.length ? (
              <Button type="button" onClick={handleNext}>
                Próximo
                <ChevronRight />
              </Button>
            ) : (
              <Button type="button" onClick={() => methods.handleSubmit(handleSubmit, onInvalid)()} disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                {saving ? 'Salvando...' : 'Salvar informações'}
              </Button>
            )}
          </div>
        </form>
      </FormProvider>
    </div>
  )
}
