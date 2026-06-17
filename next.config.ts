import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // sharp é nativo: precisa ser carregado de node_modules em runtime (não bundlado),
  // senão a extração de cor da logo falha em produção (server action).
  serverExternalPackages: ['sharp'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
}

export default nextConfig
