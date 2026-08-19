/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      // The QoreX mobile app (≤1.0) links accounts as /account/{addr}; the
      // canonical route is /address/{addr}. Permanent redirect so every
      // already-shipped app resolves instead of 404-ing.
      {
        source: "/account/:path*",
        destination: "/address/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
