/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  turbopack: {
    root: __dirname,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Для серверной стороны разрешаем использовать require для xlsx
      config.externals = config.externals || [];
      config.externals.push({
        'xlsx': 'commonjs xlsx',
      });
    }
    return config;
  },
}

module.exports = nextConfig

