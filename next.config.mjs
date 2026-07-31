/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Photo uploads are posted through a server action, so this ceiling must
    // stay above MAX_UPLOAD_BYTES in src/lib/images.ts (15 MB) with headroom
    // for multipart overhead.
    serverActions: { bodySizeLimit: "20mb" },
  },
  // sharp is a native module; keep it external so Next never tries to bundle it.
  serverExternalPackages: ["sharp"],
};
export default nextConfig;
