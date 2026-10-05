import { pathToFileURL } from "node:url";

import { runAssetCli } from "../packages/cli/src/asset-interchange/cli.js";

/** Compatibility executable delegates to the installed saved-source commands; it contains no game or publication logic. */
export async function runAtlasInterchange(argv: readonly string[]): Promise<number> {
  return runAssetCli(argv);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runAtlasInterchange(process.argv.slice(2));
}
