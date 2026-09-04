import * as fs from "node:fs";
import * as path from "node:path";

/** Root contributor documents whose local links are release-gated. */
const ROOT_DOCUMENTS = [
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "fixtures/external/README.md",
] as const;

/** Public documentation trees. Generated bundles and dependency trees are excluded. */
const DOCUMENT_DIRECTORIES = ["docs", "packages"] as const;

const SKIPPED_DIRECTORIES = new Set(["dist", "node_modules", "out", "server", "sidecars"]);

/** GitHub Actions surfaces whose names and labels are part of the contributor experience. */
const WORKFLOWS = [
  ".github/workflows/debug-sidecar-portability.yml",
  ".github/workflows/external-fixtures.yml",
  ".github/workflows/release-candidate.yml",
] as const;

/**
 * Discovers the public Markdown surface without pulling in generated or dependency content.
 * @param {string} root Repository root.
 * @returns {string[]} Sorted repository-relative document paths.
 */
const markdownDocuments = (root: string): string[] => {
  const documents: string[] = [...ROOT_DOCUMENTS];
  const visit = (relativeDirectory: string): void => {
    const absoluteDirectory = path.resolve(root, relativeDirectory);
    if (!fs.existsSync(absoluteDirectory)) return;
    for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
      const relative = path.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) visit(relative);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        documents.push(relative);
      }
    }
  };
  for (const directory of DOCUMENT_DIRECTORIES) visit(directory);
  return [...new Set(documents)].sort();
};

/**
 * Extracts the destination token from inline Markdown links in linear time.
 *
 * A broad nested-quantifier regular expression makes a documentation gate an avoidable denial-of-
 * service surface when a generated document contains an extremely long malformed link. This small
 * scanner intentionally handles the repository's inline-link subset without a nested regex.
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
 * Extracts destinations declared by Markdown reference-link definitions.
 * @param {string} markdown Document text.
 * @returns {string[]} Raw destination tokens.
 */
const markdownReferenceTargets = (markdown: string): string[] => {
  const targets: string[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const match = /^ {0,3}\[[^\]]+]:\s*(<[^>]+>|\S+)/.exec(line);
    if (match?.[1]) targets.push(match[1]);
  }
  return targets;
};

/**
 * Removes fenced examples so link-shaped source text is not validated as documentation.
 * @param {string} markdown Document text.
 * @returns {string} Document text without fenced blocks.
 */
const withoutFencedCode = (markdown: string): string => {
  const lines: string[] = [];
  let fence: "```" | "~~~" | undefined;
  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trimStart();
    if (!fence && (trimmed.startsWith("```") || trimmed.startsWith("~~~"))) {
      fence = trimmed.startsWith("```") ? "```" : "~~~";
      continue;
    }
    if (fence && trimmed.startsWith(fence)) {
      fence = undefined;
      continue;
    }
    if (!fence) lines.push(line);
  }
  return lines.join("\n");
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
 * Converts a Markdown link target into a local file and optional heading fragment.
 * @param {string} document Absolute document path containing the link.
 * @param {string} rawTarget Raw first token inside the Markdown link destination.
 * @returns {{ file: string; anchor?: string } | undefined} Local reference, or undefined for an external target.
 */
const localTarget = (
  document: string,
  rawTarget: string,
): { file: string; anchor?: string } | undefined => {
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
  if (target.startsWith("/") || hasScheme) return undefined;
  const hash = target.indexOf("#");
  const pathname = decodeURIComponent(hash < 0 ? target : target.slice(0, hash));
  const anchor = hash < 0 ? undefined : decodeURIComponent(target.slice(hash + 1));
  return {
    file: pathname === "" ? document : path.resolve(path.dirname(document), pathname),
    ...(anchor ? { anchor } : {}),
  };
};

/**
 * Approximates GitHub's stable heading ids for the repository's Markdown subset.
 * @param {string} markdown Document text.
 * @returns {Set<string>} Linkable heading fragments.
 */
const headingAnchors = (markdown: string): Set<string> => {
  const anchors = new Set<string>();
  const duplicates = new Map<string, number>();
  for (const line of withoutFencedCode(markdown).split("\n")) {
    const match = /^ {0,3}#{1,6}[\t ]+(.+?)[\t ]*#*[\t ]*$/.exec(line);
    if (!match?.[1]) continue;
    const base = match[1]
      .replace(/<[^>]*>/g, "")
      .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
      .replace(/[*_`~]/g, "")
      .toLowerCase()
      .replace(/[^\s\w-]/g, "")
      .trim()
      .replace(/\s/g, "-");
    const count = duplicates.get(base) ?? 0;
    duplicates.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
};

/**
 * Verifies that the documented contributor entry points exist and contain no broken local links.
 * @returns {void}
 */
export const checkDocumentation = (): void => {
  const root = process.cwd();
  const failures: string[] = [];
  const documents = markdownDocuments(root);
  const anchorsByFile = new Map<string, Set<string>>();
  for (const document of documents) {
    const absoluteDocument = path.resolve(root, document);
    if (!fs.existsSync(absoluteDocument)) {
      failures.push(`${document}: missing required contributor document`);
      continue;
    }
    const markdown = fs.readFileSync(absoluteDocument, "utf8");
    const linkSource = withoutFencedCode(markdown);
    for (const rawTarget of [
      ...markdownTargets(linkSource),
      ...markdownReferenceTargets(linkSource),
    ]) {
      const target = localTarget(absoluteDocument, rawTarget);
      if (target && !fs.existsSync(target.file)) {
        failures.push(`${document}: broken local link '${rawTarget}'`);
        continue;
      }
      if (
        target?.anchor &&
        fs.existsSync(target.file) &&
        fs.statSync(target.file).isFile() &&
        path.extname(target.file).toLowerCase() === ".md"
      ) {
        let anchors = anchorsByFile.get(target.file);
        if (!anchors) {
          anchors = headingAnchors(fs.readFileSync(target.file, "utf8"));
          anchorsByFile.set(target.file, anchors);
        }
        if (!anchors.has(target.anchor.toLowerCase())) {
          failures.push(`${document}: broken local heading '${rawTarget}'`);
        }
      }
    }
  }
  for (const workflow of WORKFLOWS) {
    if (!fs.existsSync(path.resolve(root, workflow))) {
      failures.push(`${workflow}: missing required contributor workflow`);
    }
  }
  if (failures.length > 0) {
    throw new Error(`Documentation validation failed:\n${failures.join("\n")}`);
  }
  console.log(
    `${documents.length} public documents and ${WORKFLOWS.length} workflows have valid local links.`,
  );
};

checkDocumentation();
