'use client'

import { useEffect, useRef } from 'react'
import type * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { GridRankResult } from '@/app/actions/google'

function color(pos: number | null): string {
  if (pos == null) return '#9ca3af'
  if (pos <= 3) return '#16a34a'
  if (pos <= 7) return '#84cc16'
  if (pos <= 10) return '#f59e0b'
  return '#ef4444'
}
function label(pos: number | null): string { return pos == null ? '?' : pos > 20 ? '20+' : String(pos) }

export function RankMap({ data }: { data: GridRankResult }) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const Lmod = (await import('leaflet')).default
      if (cancelled || !ref.current) return

      if (!mapRef.current) {
        mapRef.current = Lmod.map(ref.current, { scrollWheelZoom: false })
        Lmod.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19, attribution: '&copy; OpenStreetMap',
        }).addTo(mapRef.current)
        layerRef.current = Lmod.layerGroup().addTo(mapRef.current)
      }
      const map = mapRef.current
      const grupo = layerRef.current!
      grupo.clearLayers()

      const bounds: [number, number][] = []
      for (const p of data.points) {
        const html = `<div style="width:28px;height:28px;border-radius:50%;background:${color(p.position)};color:#fff;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px #fff,0 1px 4px rgba(0,0,0,.45)">${label(p.position)}</div>`
        const icon = Lmod.divIcon({ html, className: '', iconSize: [28, 28], iconAnchor: [14, 14] })
        Lmod.marker([p.lat, p.lng], { icon }).addTo(grupo)
        bounds.push([p.lat, p.lng])
      }
      if (bounds.length) map.fitBounds(bounds, { padding: [34, 34] })
      setTimeout(() => map.invalidateSize(), 100) // corrige render dentro do modal
    })()
    return () => { cancelled = true }
  }, [data])

  useEffect(() => () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }, [])

  return (
    <div
      ref={ref}
      className="border border-gray-200 rounded-xl overflow-hidden"
      style={{ height: 320, width: '100%', isolation: 'isolate' }}
    />
  )
}
