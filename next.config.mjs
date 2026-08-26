/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep mongodb in the server bundle only — prevents webpack from trying to
  // bundle Node.js-only modules (net, tls, child_process) for the browser.
  experimental: {
    serverComponentsExternalPackages: ["mongodb", "@cerbos/http", "@cerbos/core"],
  },
  // react-markdown and remark-gfm are pure-ESM packages.
  // Listing them here tells Next.js to transpile them through its own
  // Babel/SWC pipeline instead of treating them as external CJS modules,
  // preventing "require() of ES Module" errors at runtime.
  transpilePackages: ["react-markdown", "remark-gfm"],
};

export default nextConfig;
