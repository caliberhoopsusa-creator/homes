/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The desk imports TS source directly from workspace packages which ship
  // .ts as `main` (incl. the inbound-webhook route's @parcel/db + @parcel/intake,
  // and the service interfaces @parcel/db pulls in). All must be transpiled.
  transpilePackages: [
    "@parcel/types",
    "@parcel/underwriting",
    "@parcel/sourcing",
    "@parcel/skiptrace",
    "@parcel/outreach",
    "@parcel/intake",
    "@parcel/db",
  ],
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
