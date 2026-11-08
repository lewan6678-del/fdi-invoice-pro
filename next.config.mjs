/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@prisma/client", "exceljs", "bcryptjs"],
  experimental: { serverActions: { bodySizeLimit: "200mb" } },
  poweredByHeader: false,
};
export default nextConfig;
