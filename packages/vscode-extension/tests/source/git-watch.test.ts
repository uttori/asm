import { test } from "../../../../tests/ava-helper.js";
import { isGitCacheNoise, isGitIndexEcho } from "../../src/source/git-watch.js";

test("status and client caches do not count as source changes", (t) => {
  for (const relative of [
    ".git",
    ".git/fsmonitor--daemon/cookies",
    ".git/fsmonitor--daemon/cookies/abc",
    ".git/worktrees/candidate/fsmonitor--daemon/cookies",
    ".git/gk",
    ".git/gk/config",
    ".git/objects/pack/pack-1.idx",
    ".git/logs/HEAD",
    ".git/hooks/pre-commit",
    ".git/info/exclude",
  ]) {
    t.true(isGitCacheNoise(relative), relative);
    t.false(isGitIndexEcho(relative), relative);
  }
  for (const relative of [".git/index", ".git/index.lock", ".git/worktrees/candidate/index"]) {
    t.true(isGitIndexEcho(relative), relative);
    t.false(isGitCacheNoise(relative), relative);
  }
  for (const relative of [
    ".git/HEAD",
    ".git/refs/heads/main",
    ".git/MERGE_HEAD",
    "disassembly/main.asm",
  ]) {
    t.false(isGitCacheNoise(relative), relative);
    t.false(isGitIndexEcho(relative), relative);
  }
});
