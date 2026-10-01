/** Kill the real importer around its semantic SQLite commit, without production fault hooks. */
import { DatabaseSync } from "node:sqlite";

const [directory, capture, beforeRevision, boundary] = process.argv.slice(2);
const exec = DatabaseSync.prototype.exec;
DatabaseSync.prototype.exec = function (sql) {
  let publishing = false;
  if (sql === "COMMIT") {
    try {
      publishing =
        Number(this.prepare("SELECT v FROM meta WHERE k='revision'").get()?.v) >
        Number(beforeRevision);
    } catch {
      // A parser's temporary index has no project metadata and is not a publication.
    }
  }
  if (publishing && boundary === "before") {
    process.kill(process.pid, "SIGKILL");
  }
  const result = exec.call(this, sql);
  if (publishing && boundary === "after") {
    process.kill(process.pid, "SIGKILL");
  }
  return result;
};
const { executeSourceOperation } = await import("../../src/source.ts");
await executeSourceOperation({ directory, action: "import", capture });
