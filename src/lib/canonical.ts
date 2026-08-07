// Sites que têm domínio próprio: endereço OFICIAL para o Google.
// Efeitos: o subdomínio da plataforma redireciona (301) para cá, e a tag
// canônica/og:url do HTML servido passa a apontar para cá (evita conteúdo
// duplicado e faz o Google indexar apenas um endereço).
// Chave = slug do site, valor = URL oficial (com https e www, se for o caso).
export const CANONICAL_DOMAIN: Record<string, string> = {
  itils: 'https://www.itils.com.br',
  'mercaz-planejamento': 'https://www.mercazplanejamento.com.br',
}
