'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { googleConfigured } from '@/lib/google/oauth'

type Result<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

async function getDbUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return (
    (await prisma.user.findFirst({ where: { OR: [{ id: user.id }, { email: user.email! }] } })) ??
    (await prisma.user.create({ data: { id: user.id, email: user.email!, name: user.user_metadata?.name || user.email! } }))
  )
}

export type GoogleStatus = {
  configured: boolean   // credenciais do Google presentes no servidor
  connected: boolean    // usuário já autorizou
  scopes: string | null
  locationsCount: number
}

export async function getGoogleStatus(): Promise<Result<GoogleStatus>> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    const conn = await prisma.googleConnection.findUnique({ where: { userId: dbUser.id } })
    const locationsCount = await prisma.gbpLocation.count({ where: { userId: dbUser.id } })
    return {
      success: true,
      data: {
        configured: googleConfigured(),
        connected: Boolean(conn?.refreshToken),
        scopes: conn?.scopes ?? null,
        locationsCount,
      },
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro' }
  }
}

export async function disconnectGoogle(): Promise<Result> {
  const dbUser = await getDbUser()
  if (!dbUser) return { success: false, error: 'Não autorizado' }
  try {
    await prisma.googleConnection.deleteMany({ where: { userId: dbUser.id } })
    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao desconectar' }
  }
}
