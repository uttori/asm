export default {
  concurrency: 1,
  extensions: ["ts"],
  failFast: false,
  files: ["tests/**/*.external.test.ts", "plugins/*/tests/**/*.external.test.ts"],
  nodeArguments: ["--import=tsx"],
  serial: true,
  tap: false,
  timeout: "1800000",
  verbose: true,
};
