/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Turbopack отключен через флаг --webpack в package.json
  // Это обеспечивает совместимость с AI SDK
  
  // Оптимизации для ускорения компиляции
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // Ускоряем компиляцию в режиме разработки
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
  
  // Указываем корневую директорию для устранения предупреждения
  outputFileTracingRoot: require('path').join(__dirname),
}

module.exports = nextConfig

