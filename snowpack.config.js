// Snowpack Configuration File
// See all supported options: https://www.snowpack.dev/reference/configuration

/** @type {import("snowpack").SnowpackUserConfig } */
export default {
  exclude: ['**/.git/**/*', '**/tools/**/*'],
  mount: {
    /* ... */
  },
  plugins: [
    /* ... */
  ],
  packageOptions: {
    external: ['import-meta-resolve', '@agoric/zoe', '@agoric/governance'],
  },
  devOptions: {
    /* ... */
  },
  buildOptions: {
    /* ... */
  },
};
