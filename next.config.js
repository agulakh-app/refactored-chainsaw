/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Force dynamic rendering for all pages
  output: 'standalone',
}
module.exports = nextConfig
