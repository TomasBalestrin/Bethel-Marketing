import { NextResponse } from 'next/server'

// Endpoint só para verificar qual versão do código está no ar na Vercel.
export async function GET() {
  return NextResponse.json({ version: 'header-dark-fix-2-serve' })
}
