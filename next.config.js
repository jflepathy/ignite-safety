/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
};

module.exports = nextConfig;

import('@opennextjs/cloudflare').then(({ initOpenNextCloudflareForDev }) => {
  initOpenNextCloudflareForDev();
});
