import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // sharp é nativo: precisa ser carregado de node_modules em runtime (não bundlado),
  // senão a extração de cor da logo falha em produção (server action).
  serverExternalPackages: ['sharp'],
  experimental: {
    // O formulário envia muitos campos e URLs de imagens (até 5 fotos do
    // profissional, 3 do espaço, 5 depoimentos, 5 resultados e imagem por
    // serviço). O padrão de 1MB estourava e o Next rejeitava a requisição,
    // fazendo o salvamento falhar com erro genérico de conexão.
    serverActions: { bodySizeLimit: '4mb' },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
}

export default nextConfig
