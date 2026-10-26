import type { NextConfig } from "next";

/**
 * CSP em modo Report-Only (achado S5 de docs/SECURITY_AUDIT.md): não bloqueia nada ainda,
 * só reporta violações no console do navegador. Depois de um período observando sem
 * ruído de falso positivo, trocar o header para "Content-Security-Policy" (enforce).
 * `'unsafe-inline'` em style-src é necessário hoje por causa de estilos inline do React/
 * Tailwind; script-src não precisa de unsafe-inline (Next não usa inline script por padrão
 * fora de hashes que o próprio framework já gerencia).
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
