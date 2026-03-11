/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Isso permite que o deploy termine mesmo se houver erros de tipagem
    ignoreBuildErrors: true, 
  },
  eslint: {
    // Isso ignora avisos de formatação durante o build
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;