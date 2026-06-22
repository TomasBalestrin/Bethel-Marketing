import crypto from 'crypto'

// Criptografia simétrica (AES-256-GCM) para os tokens OAuth em repouso.
// A chave vem de TOKEN_ENCRYPTION_KEY (qualquer string; derivamos 32 bytes via SHA-256).

function getKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY
  if (!secret) throw new Error('TOKEN_ENCRYPTION_KEY não configurada')
  return crypto.createHash('sha256').update(secret).digest()
}

export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // formato: iv.tag.ciphertext (base64)
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`
}

export function decryptToken(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.')
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Token criptografado inválido')
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8')
}
