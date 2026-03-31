/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: [        // ← add this
    "localhost:8080",
    "127.0.0.1:8080",
  ],
}

export default nextConfig
