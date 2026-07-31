/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Must stay above MAX_UPLOAD_BYTES (4 MB) for multipart overhead, but below
    // Vercel's own 4.5 MB request-body cap — which this setting cannot raise.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  // sharp is a native module; keep it external so Next never tries to bundle it.
  serverExternalPackages: ["sharp"],
};
export default nextConfig;
