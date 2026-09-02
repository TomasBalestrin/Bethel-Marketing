import sharp from 'sharp'
import fs from 'fs'

const url = 'https://xknatuofnzgexxruqtam.supabase.co/storage/v1/object/public/logos/briefing-1785434858339-i205dw.jpeg'
const res = await fetch(url)
const buf = Buffer.from(await res.arrayBuffer())

const img = sharp(buf)
const meta = await img.metadata()
console.log('original:', meta.width + 'x' + meta.height)

// Trabalha em resolução alta (limitada a 1200px no maior lado, já é o tamanho original ~1254)
const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const { width: W, height: H } = info

// Remove o preto (fundo fora do círculo) com uma rampa suave (anti-serrilhado):
// luminância < LOW -> totalmente transparente; > HIGH -> totalmente opaco; entre os dois, gradiente.
const LOW = 12, HIGH = 40
for (let i = 0; i < data.length; i += 4) {
  const r = data[i], g = data[i + 1], b = data[i + 2]
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  if (lum <= LOW) {
    data[i + 3] = 0
  } else if (lum < HIGH) {
    const t = (lum - LOW) / (HIGH - LOW)
    data[i + 3] = Math.round(t * 255)
  }
  // else: mantém alfa 255 (opaco) — já é o padrão do ensureAlpha em JPEG
}

const outBuf = await sharp(data, { raw: { width: W, height: H, channels: 4 } })
  .png()
  .toBuffer()

fs.writeFileSync('/tmp/afya_logo_transparente.png', outBuf)
console.log('salvo em /tmp/afya_logo_transparente.png, bytes:', outBuf.length)

// checa transparência real nos cantos pra confirmar que funcionou
const check = await sharp(outBuf).resize(64, 64, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const px = (x, y) => { const i = (y * 64 + x) * 4; return [check.data[i], check.data[i+1], check.data[i+2], check.data[i+3]] }
console.log('canto top-left agora:', px(0, 0))
console.log('centro do badge agora:', px(32, 32))
