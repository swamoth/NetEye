/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // globe.gl / three are ESM-heavy; let Next transpile them for the client bundle.
  transpilePackages: ['react-globe.gl', 'globe.gl', 'three-globe'],
  env: {
    NEXT_PUBLIC_APP_VERSION: require('./package.json').version,
  },
  // The social card reads its fonts with fs at request time, which the tracer cannot see, so the
  // files would be missing from the serverless bundle and the card would fail after the first
  // revalidation. Name them here to put them in the bundle.
  outputFileTracingIncludes: {
    '/opengraph-image': ['./assets/**'],
  },
};

module.exports = nextConfig;
