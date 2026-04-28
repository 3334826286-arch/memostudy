/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  experimental: {
    optimizePackageImports: []
  }
};

export default nextConfig;
