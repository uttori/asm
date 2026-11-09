/**
 * Git metadata that status, fsmonitor, and repository clients rewrite without changing HEAD,
 * refs, or the working tree. Watching these retriggers status forever.
 */
export function isGitCacheNoise(relative: string): boolean {
  if (relative === ".git") {
    return true;
  }
  if (!relative.startsWith(".git/")) {
    return false;
  }
  return (
    relative.includes("/fsmonitor--daemon/") ||
    relative === ".git/gk" ||
    relative.startsWith(".git/gk/") ||
    relative.startsWith(".git/objects/") ||
    relative.startsWith(".git/hooks/") ||
    relative.startsWith(".git/logs/") ||
    relative.startsWith(".git/info/")
  );
}

/** Index stat-cache updates from `git status` / `git diff`, including linked worktrees. */
export function isGitIndexEcho(relative: string): boolean {
  if (!relative.startsWith(".git/")) {
    return false;
  }
  const name = relative.slice(relative.lastIndexOf("/") + 1);
  return name === "index" || name === "index.lock" || name === "index.backup";
}
