import sharp from 'sharp'
import fs from 'fs'

const url = 'https://xknatuofnzgexxruqtam.supabase.co/storage/v1/object/public/logos/briefing-1785434858339-i205dw.jpeg'
const res = await fetch(url)
const buf = Buffer.from(await res.arrayBuffer())

const img = sharp(buf)
const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const { width: W, height: H } = info

// Distingue PRETO PURO (moldura fora do círculo, r≈g≈b≈0) do AZUL-MARINHO do
// badge (escuro mas com canal azul bem mais alto) usando o CANAL MÁXIMO, não
// luminância — luminância confundia os dois por ambos serem "escuros".
const LOW = 16, HIGH = 34
let transparentes = 0, opacos = 0, rampa = 0
for (let i = 0; i < data.length; i += 4) {
  const r = data[i], g = data[i + 1], b = data[i + 2]
  const maxC = Math.max(r, g, b)
  if (maxC <= LOW) { data[i + 3] = 0; transparentes++ }
  else if (maxC < HIGH) { data[i + 3] = Math.round(((maxC - LOW) / (HIGH - LOW)) * 255); rampa++ }
  else { opacos++ }
}
console.log('pixels transparentes:', transparentes, '| rampa:', rampa, '| opacos:', opacos)

const outBuf = await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer()
fs.writeFileSync('/tmp/afya_logo_transparente.png', outBuf)
console.log('salvo, bytes:', outBuf.length)

const check = await sharp(outBuf).resize(64, 64, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const px = (x, y) => { const i = (y * 64 + x) * 4; return [check.data[i], check.data[i+1], check.data[i+2], check.data[i+3]] }
console.log('canto top-left:', px(0, 0), '(deve ser alfa 0)')
console.log('centro do badge:', px(32, 32), '(deve ser alfa 255)')
console.log('meio-caminho canto->centro:', px(8, 8), px(16,16))
