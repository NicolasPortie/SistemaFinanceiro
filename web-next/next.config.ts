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
              "img-src 'self' data: blob:",
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://static.cloudflareinsights.com`,
              "style-src 'self' 'unsafe-inline'",
              `connect-src 'self'${isDev ? " ws://localhost:* http://localhost:*" : ""} https://cloudflareinsights.com`,
            ].join("; ") + ";",
          },
        ],
      },
    ];
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
