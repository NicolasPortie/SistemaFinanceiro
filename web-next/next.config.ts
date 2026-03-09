import type { NextConfig } from "next";

const apiProxyTarget = (
  process.env.API_PROXY_TARGET ??
  (process.env.NODE_ENV === "production" ? "http://api:5000" : "http://localhost:5000")
).replace(/\/+$/, "");

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "object-src 'none'",
              "frame-ancestors 'none'",
              "form-action 'self'",
              "img-src 'self' data: blob: https://images.unsplash.com",
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://static.cloudflareinsights.com https://accounts.google.com https://appleid.cdn-apple.com`,
              "style-src 'self' 'unsafe-inline'",
              `connect-src 'self'${isDev ? " ws://localhost:* http://localhost:*" : ""} https://cloudflareinsights.com https://appleid.cdn-apple.com`,
              "frame-src 'self' https://accounts.google.com https://appleid.apple.com",
            ].join("; ") + ";",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
