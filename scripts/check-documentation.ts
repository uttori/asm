import * as fs from "node:fs";
import * as path from "node:path";

/** Contributor-facing documents whose local links are release-gated. */
const DOCUMENTS = [
  "README.md",
  "CONTRIBUTING.md",
  "DISASSEMBLER_ROADMAP_V2.md",
  "SECURITY.md",
  "docs/disassembler-architecture.md",
  "docs/disassembler-performance.md",
  "docs/testing-and-release.md",
  "docs/ares-native-runtime-distribution.md",
  "fixtures/external/README.md",
  "packages/cli/README.md",
  "packages/debug-adapter/README.md",
  "packages/debug-sidecar-ares/README.md",
  "packages/debug-sidecar-mesence/README.md",
  "packages/disassembler/README.md",
  "packages/plugin-65xx/README.md",
  "packages/plugin-65xx/THIRD_PARTY_NOTICES.md",
  "packages/plugin-author/README.md",
  "packages/plugin-snes/README.md",
  "packages/vscode-extension/README.md",
] as const;

/** GitHub Actions surfaces whose names and labels are part of the contributor experience. */
const WORKFLOWS = [
  ".github/workflows/debug-sidecar-portability.yml",
  ".github/workflows/external-fixtures.yml",
  ".github/workflows/release-candidate.yml",
] as const;

/**
 * Extracts the destination token from inline Markdown links in linear time.
 *
 * A broad nested-quantifier regular expression makes a documentation gate an avoidable denial-of-
 * service surface when a generated document contains an extremely long malformed link. This small
 * scanner intentionally handles the repository's inline-link subset and ignores reference links.
 * @param {string} markdown Document text.
 * @returns {string[]} Raw destination tokens.
 */
const markdownTargets = (markdown: string): string[] => {
  const targets: string[] = [];
  let cursor = 0;
  while (cursor < markdown.length) {
    const marker = markdown.indexOf("](", cursor);
    if (marker < 0) break;
    const start = marker + 2;
    if (markdown[start] === "<") {
      const end = markdown.indexOf(">", start + 1);
      if (end >= 0) targets.push(markdown.slice(start, end + 1));
      cursor = end >= 0 ? end + 1 : start + 1;
      continue;
    }
    let end = start;
    while (end < markdown.length && markdown[end] !== ")" && !/\s/.test(markdown[end] ?? "")) {
      end++;
    }
    if (end > start) targets.push(markdown.slice(start, end));
    cursor = Math.max(end, start + 1);
  }
  return targets;
};

/**
 * Tests one ASCII URI-scheme character.
 * @param {string} character Candidate scheme character.
 * @returns {boolean} Whether it is valid.
 */
const schemeCharacter = (character: string): boolean => {
  const lower = character.toLowerCase();
  return (
    (lower >= "a" && lower <= "z") ||
    (character >= "0" && character <= "9") ||
    character === "+" ||
    character === "." ||
    character === "-"
  );
};

/**
 * Converts a Markdown link target into a local filesystem path when it should exist in Git.
 * @param {string} document Repository-relative document containing the link.
 * @param {string} rawTarget Raw first token inside the Markdown link destination.
 * @returns {string | undefined} Absolute local target, or undefined for anchors/external schemes.
 */
const localTarget = (document: string, rawTarget: string): string | undefined => {
  const target = rawTarget.replace(/^<|>$/g, "");
  const colon = target.indexOf(":");
  let hasScheme =
    colon > 0 &&
    target[0] !== undefined &&
    target[0].toLowerCase() >= "a" &&
    target[0].toLowerCase() <= "z";
  for (let index = 1; hasScheme && index < colon; index++) {
    hasScheme = schemeCharacter(target[index] ?? "");
  }
  if (target.startsWith("#") || target.startsWith("/") || hasScheme) return undefined;
  const pathname = decodeURIComponent(target.split("#", 1)[0] ?? "");
  if (pathname === "") return undefined;
  return path.resolve(path.dirname(document), pathname);
};

/**
 * Verifies that the documented contributor entry points exist and contain no broken local links.
 * @returns {void}
 */
export const checkDocumentation = (): void => {
  const root = process.cwd();
  const failures: string[] = [];
  for (const document of DOCUMENTS) {
    const absoluteDocument = path.resolve(root, document);
    if (!fs.existsSync(absoluteDocument)) {
      failures.push(`${document}: missing required contributor document`);
      continue;
    }
    const markdown = fs.readFileSync(absoluteDocument, "utf8");
    for (const rawTarget of markdownTargets(markdown)) {
      const target = localTarget(absoluteDocument, rawTarget);
      if (target && !fs.existsSync(target)) {
        failures.push(`${document}: broken local link '${rawTarget}'`);
      }
    }
  }
  if (failures.length > 0) {
    throw new Error(`Documentation validation failed:\n${failures.join("\n")}`);
  }
  console.log(
    `${DOCUMENTS.length} contributor documents and ${WORKFLOWS.length} workflows have valid links and product-facing terminology.`,
  );
};

checkDocumentation();
