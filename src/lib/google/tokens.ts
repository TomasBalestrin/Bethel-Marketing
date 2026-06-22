import { prisma } from '@/lib/prisma'
import { decryptToken, encryptToken } from './crypto'
import { refreshAccessToken } from './oauth'

// Retorna um access_token válido para o usuário, renovando via refresh_token quando expirado.
// Use isto em qualquer chamada às APIs do Google. Retorna null se não houver conexão.
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const conn = await prisma.googleConnection.findUnique({ where: { userId } })
  if (!conn?.refreshToken) return null

  const now = Date.now()
  if (conn.accessToken && conn.tokenExpiry && conn.tokenExpiry.getTime() > now + 60_000) {
    try { return decryptToken(conn.accessToken) } catch { /* cai pro refresh */ }
  }

  const refresh = decryptToken(conn.refreshToken)
  const t = await refreshAccessToken(refresh)
  await prisma.googleConnection.update({
    where: { userId },
    data: {
      accessToken: encryptToken(t.access_token),
      tokenExpiry: new Date(now + t.expires_in * 1000),
      ...(t.scope ? { scopes: t.scope } : {}),
    },
  })
  return t.access_token
}
