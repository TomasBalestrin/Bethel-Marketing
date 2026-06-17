'use client'

import { useState, useEffect } from 'react'
import { useFormContext } from 'react-hook-form'
import { Loader2, Upload, X, Wand2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type FormData, PALETAS } from '@/types'
import { cn } from '@/lib/utils'


function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

function hslToHex(h: number, s: number, l: number): string {
  const hNorm = h / 360, sNorm = s / 100, lNorm = l / 100
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  let r, g, b
  if (s === 0) {
    r = g = b = lNorm
  } else {
    const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm
    const p = 2 * lNorm - q
    r = hue2rgb(p, q, hNorm + 1/3)
    g = hue2rgb(p, q, hNorm)
    b = hue2rgb(p, q, hNorm - 1/3)
  }
  return `#${Math.round(r * 255).toString(16).padStart(2, '0')}${Math.round(g * 255).toString(16).padStart(2, '0')}${Math.round(b * 255).toString(16).padStart(2, '0')}`
}

function generatePaletteFromHex(hex: string) {
  const [h, s, l] = hexToHsl(hex)
  return {
    primary: hslToHex(h, s, Math.min(Math.max(l, 25), 45)),
    secondary: hslToHex(h, Math.max(s - 10, 40), Math.min(l + 20, 65)),
    light: hslToHex(h, Math.min(s, 40), 95),
    dark: hslToHex(h, s, Math.max(l - 20, 10)),
  }
}

function extractDominantColor(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const size = 64
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, size, size)
      const { data } = ctx.getImageData(0, 0, size, size)
      const colorMap: Record<string, number> = {}
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3]
        if (a < 128) continue
        const r = Math.round(data[i] / 32) * 32
        const g = Math.round(data[i + 1] / 32) * 32
        const b = Math.round(data[i + 2] / 32) * 32
        if (r > 220 && g > 220 && b > 220) continue
        if (r < 30 && g < 30 && b < 30) continue
        const key = `${r},${g},${b}`
        colorMap[key] = (colorMap[key] || 0) + 1
      }
      const top = Object.entries(colorMap).sort((a, b) => b[1] - a[1])[0]
      if (!top) { resolve('#1E40AF'); return }
      const [r, g, b] = top[0].split(',').map(Number)
      resolve(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`)
    }
    img.onerror = () => resolve('#1E40AF')
    img.src = imageUrl
  })
}

const LOGO_PALETTE_ID = 'cor-da-logo'

export default function StepIdentidade() {
  const { register, watch, setValue, formState: { errors } } = useFormContext<FormData>()
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [logoPalette, setLogoPalette] = useState<{ hex: string; primary: string; secondary: string; light: string; dark: string } | null>(null)
  const logoUrl = watch('logoUrl')

  // Ao editar um site que já tem logo, re-extrai a cor pra a opção "Cor da Logo" aparecer
  useEffect(() => {
    if (logoUrl && !logoPalette) {
      extractDominantColor(logoUrl).then(hex => setLogoPalette({ hex, ...generatePaletteFromHex(hex) }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoUrl])
  const corPaleta = watch('corPaleta')

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json()
    if (data.url) {
      setValue('logoUrl', data.url, { shouldValidate: true })
      setExtracting(true)
      const hex = await extractDominantColor(data.url)
      const palette = generatePaletteFromHex(hex)
      setLogoPalette({ hex, ...palette })
      setExtracting(false)
    }
    setUploading(false)
  }

  const allPaletas = [
    ...PALETAS,
    ...(logoPalette ? [{
      id: LOGO_PALETTE_ID,
      label: 'Cor da Logo',
      ...logoPalette,
    }] : []),
  ]

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="nomeNegocio">Nome do negócio *</Label>
        <Input
          id="nomeNegocio"
          {...register('nomeNegocio')}
          className="mt-1.5"
          placeholder="Ex: Clínica da Família Silva"
        />
        {errors.nomeNegocio && <p className="text-xs text-red-500 mt-1">{errors.nomeNegocio.message}</p>}
      </div>

      <div>
        <Label htmlFor="segmento">Segmento / Nicho *</Label>
        <Input
          id="segmento"
          {...register('segmento')}
          className="mt-1.5"
          placeholder="Ex: Estética, Advocacia, Mecânica, Nutrição..."
        />
        {errors.segmento && <p className="text-xs text-red-500 mt-1">{errors.segmento.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="cidade">Cidade *</Label>
          <Input id="cidade" {...register('cidade')} className="mt-1.5" placeholder="São Paulo" />
          {errors.cidade && <p className="text-xs text-red-500 mt-1">{errors.cidade.message}</p>}
        </div>
        <div>
          <Label htmlFor="estado">Estado *</Label>
          <Input id="estado" {...register('estado')} className="mt-1.5" placeholder="SP" maxLength={2} />
          {errors.estado && <p className="text-xs text-red-500 mt-1">{errors.estado.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="endereco">Endereço *</Label>
          <Input id="endereco" {...register('endereco')} className="mt-1.5" placeholder="Rua das Flores, 123" />
          {errors.endereco && <p className="text-xs text-red-500 mt-1">{errors.endereco.message}</p>}
        </div>
        <div>
          <Label htmlFor="cep">CEP *</Label>
          <Input id="cep" {...register('cep')} className="mt-1.5" placeholder="00000-000" maxLength={9} />
          {errors.cep && <p className="text-xs text-red-500 mt-1">{errors.cep.message}</p>}
        </div>
      </div>

      <div>
        <Label>Logo (opcional)</Label>
        <div className="mt-1.5">
          {logoUrl ? (
            <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
              <img src={logoUrl} alt="Logo" className="h-10 w-10 object-contain rounded" />
              <span className="text-sm text-gray-600 flex-1 truncate">
                {extracting ? (
                  <span className="flex items-center gap-1.5 text-blue-600">
                    <Wand2 className="w-3.5 h-3.5 animate-pulse" />
                    Extraindo cor da logo...
                  </span>
                ) : 'Logo carregado'}
              </span>
              <button type="button" onClick={() => { setValue('logoUrl', undefined); setLogoPalette(null) }} className="text-gray-400 hover:text-red-500">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-300 rounded-lg px-4 py-3 hover:bg-gray-50 transition-colors">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <Upload className="w-4 h-4 text-gray-400" />}
              <span className="text-sm text-gray-500">{uploading ? 'Enviando...' : 'Clique para enviar logo'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
            </label>
          )}
        </div>
      </div>

      <div>
        <Label>Paleta de cores *</Label>
        <div className="grid grid-cols-3 gap-2 mt-1.5">
          {allPaletas.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setValue('corPaleta', p.id === LOGO_PALETTE_ID && 'hex' in p ? String(p.hex) : p.id, { shouldValidate: true })}
              className={cn(
                'border-2 rounded-xl p-2.5 text-center transition-all',
                (p.id === LOGO_PALETTE_ID && 'hex' in p ? corPaleta === String(p.hex) : corPaleta === p.id)
                  ? 'border-blue-500 bg-blue-50'
                  : p.id === LOGO_PALETTE_ID
                  ? 'border-dashed border-purple-300 hover:border-purple-400 bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300'
              )}
            >
              <div className="flex justify-center gap-1 mb-1.5">
                <div className="w-4 h-4 rounded-full" style={{ background: p.primary }} />
                <div className="w-4 h-4 rounded-full" style={{ background: p.secondary }} />
                <div className="w-4 h-4 rounded-full border border-gray-200" style={{ background: p.light }} />
              </div>
              <p className="text-xs font-medium text-gray-700 leading-tight">
                {p.id === LOGO_PALETTE_ID && <Wand2 className="w-3 h-3 inline mr-0.5 text-purple-500" />}
                {p.label}
              </p>
            </button>
          ))}
        </div>
        {errors.corPaleta && <p className="text-xs text-red-500 mt-1">{errors.corPaleta.message}</p>}
      </div>
    </div>
  )
}
