/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // globe.gl / three are ESM-heavy; let Next transpile them for the client bundle.
  transpilePackages: ['react-globe.gl', 'globe.gl', 'three-globe'],
  env: {
    NEXT_PUBLIC_APP_VERSION: require('./package.json').version,
  },
};

module.exports = nextConfig;
