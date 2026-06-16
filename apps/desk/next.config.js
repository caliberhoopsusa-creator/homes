/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The desk imports TS source directly from workspace packages
  // (@parcel/types, @parcel/underwriting) which ship .ts as `main`.
  transpilePackages: ["@parcel/types", "@parcel/underwriting"],
  // Those packages use ESM `.js` import suffixes that resolve to `.ts` source.
  // Teach webpack to follow them (TS does this natively; webpack needs the alias).
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
};

module.exports = nextConfig;
