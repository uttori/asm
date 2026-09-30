#!/usr/bin/env python3
"""Probe regeneration merges in disposable Git repositories, without touching a checkout.

Synthetic cases require only Git. Optional --generation arguments read manifest-owned
files from existing exports, verify their hashes, and probe text merges on copies.
Results contain counts and hashes rather than game source. No generator or assembler
is invoked, so a clean merge is not a claim of ROM correctness.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile


BASE_ASM = "Price:\n    dw 10\n\nRoutine:\n" + "    nop\n" * 8 + "    rts\n"
BASE = {"banks/main.asm": BASE_ASM.encode(), "notes.txt": b"generation zero\n"}


def git_environment():
    """Exclude caller Git overrides and user configuration from the experiment."""
    env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
    env.update(
        GIT_CONFIG_GLOBAL=os.devnull,
        GIT_CONFIG_NOSYSTEM="1",
        GIT_TERMINAL_PROMPT="0",
    )
    return env


class Repository:
    """Own one temporary repository; disable inherited Git configuration and hooks."""

    def __init__(self, root, initialize=True):
        """Initialize a fixture, or configure an existing disposable clone."""
        self.root = root
        self.env = git_environment()
        if initialize:
            self.git("init", "-q", "-b", "codex/user")
        self.git("config", "user.name", "Merge research")
        self.git("config", "user.email", "research@example.invalid")

    def git(self, *args, check=True):
        """Run Git only inside the disposable repository; return captured bytes."""
        result = subprocess.run(
            ["git", "-c", f"core.hooksPath={os.devnull}", "-c", "commit.gpgsign=false", *args],
            cwd=self.root, env=self.env, capture_output=True,
        )
        if check and result.returncode:
            raise RuntimeError(f"git {args}: {result.stderr.decode(errors='replace')}")
        return result

    def write(self, files):
        """Replace tracked files with an exact fixture tree; retain Git's own metadata."""
        for raw in self.git("ls-files", "-z").stdout.split(b"\0"):
            if raw:
                (self.root / os.fsdecode(raw)).unlink(missing_ok=True)
        for name, content in files.items():
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)

    def commit(self, message):
        """Snapshot the fixture, including deliberate empty generation commits."""
        self.git("add", "-A")
        self.git("commit", "-q", "--allow-empty", "-m", message)
        return self.git("rev-parse", "HEAD").stdout.strip().decode()

    def prepare(self, base, ours, incoming):
        """Fork pure generated history and user history from the same exact base."""
        self.write(base)
        base_id = self.commit("G0")
        self.git("branch", "codex/generated")
        self.write(ours)
        self.commit("User edits")
        self.git("switch", "-q", "codex/generated")
        self.write(incoming)
        incoming_id = self.commit("G1")
        self.git("switch", "-q", "codex/user")
        return base_id, incoming_id

    def merge(self):
        """Leave a real merge pending so conflicts, stages and abort can be inspected."""
        return self.git("merge", "--no-ff", "--no-commit", "codex/generated", check=False)


def changed(text):
    """Create a complete synthetic source tree with the requested assembly text."""
    return {**BASE, "banks/main.asm": text.encode()}


def synthetic_cases(root):
    """Check preservation and failure behavior, including genuine index stages."""
    ours = changed(BASE_ASM.replace("dw 10", "dw 20"))
    incoming = {**BASE, "notes.txt": b"generation one\n"}
    cases = [
        ("disjoint_edits", BASE, ours, incoming, False),
        ("no_op_generation", BASE, ours, BASE, False),
        ("same_line_conflict", BASE, ours, changed(BASE_ASM.replace("dw 10", "dw 30")), True),
        ("generated_file_rename", BASE, ours,
         {"banks/renamed.asm": BASE["banks/main.asm"], "notes.txt": BASE["notes.txt"]}, False),
        ("local_delete", BASE, {"notes.txt": BASE["notes.txt"]}, incoming, False),
        ("upstream_delete_local_modify", BASE, ours, {"notes.txt": BASE["notes.txt"]}, True),
        ("both_add_file", BASE, {**BASE, "extra.asm": b"dw 1\n"}, {**BASE, "extra.asm": b"dw 2\n"}, True),
        ("binary_conflict", {**BASE, "asset.bin": b"\0base"},
         {**BASE, "asset.bin": b"\0ours"}, {**BASE, "asset.bin": b"\0theirs"}, True),
        ("semantic_reference_failure", BASE, changed(BASE_ASM.replace("Price:", "ItemPrice:")),
         changed(BASE_ASM.replace("    rts", "    lda Price\n    rts")), False),
    ]
    results = []
    for name, base, local, new, expect_conflict in cases:
        folder = root / name
        folder.mkdir()
        repo = Repository(folder)
        repo.prepare(base, local, new)
        head = repo.git("rev-parse", "HEAD").stdout
        index = repo.git("write-tree").stdout
        preview = repo.git("merge-tree", "--write-tree", "HEAD", "codex/generated", check=False)
        assert repo.git("write-tree").stdout == index
        assert not repo.git("status", "--porcelain").stdout
        result = repo.merge()
        assert result.returncode in (0, 1) and bool(result.returncode) == expect_conflict
        assert preview.returncode == result.returncode
        stages = repo.git("ls-files", "-u").stdout.decode().splitlines()
        details = {
            "case": name, "merge_exit": result.returncode,
            "unmerged_entries": len(stages), "preview_preserved_checkout": True,
        }
        if name in ("disjoint_edits", "no_op_generation"):
            assert (folder / "banks/main.asm").read_bytes() == local["banks/main.asm"]
            assert (folder / "notes.txt").read_bytes() == new["notes.txt"]
            details["user_and_incoming_edits_preserved"] = True
        if name == "same_line_conflict":
            for stage, expected in [(1, base), (2, local), (3, new)]:
                assert repo.git("show", f":{stage}:banks/main.asm").stdout == expected["banks/main.asm"]
            details["base_ours_theirs_correct"] = True
        if name == "generated_file_rename":
            assert (folder / "banks/renamed.asm").read_bytes() == local["banks/main.asm"]
        if name == "local_delete":
            assert not (folder / "banks/main.asm").exists()
        if name == "semantic_reference_failure":
            merged = (folder / "banks/main.asm").read_text()
            assert "ItemPrice:" in merged and "lda Price" in merged and "\nPrice:" not in "\n" + merged
            details["undefined_reference_despite_clean_merge"] = True
        repo.git("merge", "--abort")
        assert repo.git("rev-parse", "HEAD").stdout == head
        assert repo.git("write-tree").stdout == index
        assert not repo.git("status", "--porcelain").stdout
        details["abort_restored_checkout"] = True
        results.append(details)

    # Repeated generations distinguish accepted ancestry from a squashed tree copy.
    for squash in (False, True):
        name = "repeat_after_real_merge"
        if squash:
            name = "repeat_after_squash"
        folder = root / name
        folder.mkdir()
        repo = Repository(folder)
        g1 = {**changed(BASE_ASM.replace("dw 10", "dw 30")), "notes.txt": b"generation one\n"}
        base_id, incoming_id = repo.prepare(BASE, ours, g1)
        if squash:
            result = repo.git("merge", "--squash", "codex/generated", check=False)
        else:
            result = repo.merge()
        assert result.returncode == 1
        (folder / "banks/main.asm").write_bytes(ours["banks/main.asm"])
        repo.commit("Accept G1 retaining the user value")
        repo.git("switch", "-q", "codex/generated")
        repo.write({**g1, "notes.txt": b"generation two\n"})
        repo.commit("G2")
        repo.git("switch", "-q", "codex/user")
        actual_base = repo.git("merge-base", "HEAD", "codex/generated").stdout.strip().decode()
        expected_base = incoming_id
        if squash:
            expected_base = base_id
        assert actual_base == expected_base
        result = repo.merge()
        assert result.returncode == int(squash)
        if not squash:
            assert (folder / "banks/main.asm").read_bytes() == ours["banks/main.asm"]
            assert (folder / "notes.txt").read_bytes() == b"generation two\n"
        results.append({"case": name, "merge_exit": result.returncode, "base_advanced": not squash})
        if not squash:
            repo.commit("Accept G2")
            clone = root / "fresh-clone"
            repo.git("clone", "-q", "--no-local", str(folder), str(clone))
            cloned = Repository(clone, initialize=False)
            assert cloned.git("cat-file", "-t", incoming_id).stdout.strip() == b"commit"
            assert cloned.git("merge-base", "--is-ancestor", incoming_id, "HEAD").returncode == 0
            results.append({"case": "fresh_clone_retains_merged_base", "passed": True})

    folder = root / "dirty-overlap"
    folder.mkdir()
    repo = Repository(folder)
    repo.prepare(BASE, BASE, changed(BASE_ASM.replace("dw 10", "dw 30")))
    (folder / "banks/main.asm").write_bytes(ours["banks/main.asm"])
    result = repo.merge()
    assert result.returncode != 0
    assert (folder / "banks/main.asm").read_bytes() == ours["banks/main.asm"]
    results.append({"case": "dirty_overlapping_file_preserved", "merge_exit": result.returncode})

    folder = root / "rerere"
    folder.mkdir()
    repo = Repository(folder)
    repo.prepare(BASE, ours, changed(BASE_ASM.replace("dw 10", "dw 30")))
    repo.git("config", "rerere.enabled", "true")
    repo.git("config", "rerere.autoupdate", "false")
    assert repo.merge().returncode == 1
    (folder / "banks/main.asm").write_bytes(ours["banks/main.asm"])
    repo.git("rerere")
    repo.git("merge", "--abort")
    assert repo.merge().returncode == 1
    # Reused resolutions should remain unstaged so normal review is still possible.
    assert (folder / "banks/main.asm").read_bytes() == ours["banks/main.asm"]
    assert repo.git("ls-files", "-u").stdout
    results.append({"case": "rerere_reuses_resolution_without_staging", "passed": True})
    return results


def load_generation(directory):
    """Verify every manifest-owned byte; return assembly only for merge probes."""
    manifest_bytes = (directory / "generated-files.json").read_bytes()
    manifest = json.loads(manifest_bytes)
    assembly = {}
    mismatches = []
    for entry in manifest["files"]:
        target = (directory / entry["path"]).resolve()
        if not target.is_relative_to(directory.resolve()):
            raise ValueError(f"Manifest path escapes generation: {entry['path']}")
        if not target.is_file():
            mismatches.append(entry["path"])
            continue
        data = target.read_bytes()
        if len(data) != entry["size"] or hashlib.sha256(data).hexdigest() != entry["sha256"]:
            mismatches.append(entry["path"])
        if entry["path"].endswith(".asm"):
            assembly[entry["path"]] = data
    if mismatches:
        raise ValueError(f"Generation integrity mismatches in {directory}: {mismatches}")
    return assembly, {
        "directory": directory.name,
        "manifest_sha256": hashlib.sha256(manifest_bytes).hexdigest(),
        "files_verified": len(manifest["files"]), "assembly_files": len(assembly),
    }


def historical_cases(directories, root):
    """Sample line insertions against real export pairs; this is not an edit distribution."""
    loaded = [load_generation(directory) for directory in directories]
    results = []
    for (old, old_meta), (new, new_meta) in zip(loaded, loaded[1:]):
        changed_files = [name for name in old.keys() & new.keys() if old[name] != new[name]]
        samples = conflicts = near_samples = near_conflicts = 0
        for name in sorted(changed_files):
            lines = old[name].decode().splitlines(keepends=True)
            # Fixed quantiles make the sample reproducible without selecting friendly hunks.
            for percent in (10, 30, 50, 70, 90):
                index = len(lines) * percent // 100
                edited = "".join(lines[:index] + ["; research probe comment\n"] + lines[index:]).encode()
                for filename, data in [("base.asm", old[name]), ("ours.asm", edited), ("incoming.asm", new[name])]:
                    (root / filename).write_bytes(data)
                result = subprocess.run(
                    ["git", "-c", "merge.conflictStyle=diff3", "merge-file", "-p",
                     str(root / "ours.asm"), str(root / "base.asm"),
                     str(root / "incoming.asm")],
                    cwd=root, env=git_environment(), capture_output=True,
                )
                if result.returncode not in (0, 1):
                    raise RuntimeError(result.stderr.decode(errors="replace"))
                if result.returncode == 0:
                    assert b"; research probe comment\n" in result.stdout
                samples += 1
                conflicts += result.returncode
            # A same-line comment on the first changed old line exercises actual overlap.
            diff = subprocess.run(
                ["git", "diff", "--no-index", "--no-ext-diff", "--no-color", "--unified=0",
                 str(root / "base.asm"), str(root / "incoming.asm")],
                cwd=root, env=git_environment(), capture_output=True,
            )
            if diff.returncode not in (0, 1):
                raise RuntimeError(diff.stderr.decode(errors="replace"))
            hunks = re.finditer(rb"^@@ -(\d+)(?:,(\d+))? \+[^@]+@@", diff.stdout, re.MULTILINE)
            for hunk in hunks:
                if hunk.group(2) == b"0":
                    continue
                index = int(hunk.group(1)) - 1
                overlap = lines.copy()
                overlap[index] = overlap[index].rstrip("\r\n") + " ; research probe comment\n"
                (root / "ours.asm").write_text("".join(overlap))
                result = subprocess.run(
                    ["git", "merge-file", "-p", str(root / "ours.asm"),
                     str(root / "base.asm"), str(root / "incoming.asm")],
                    cwd=root, env=git_environment(), capture_output=True,
                )
                if result.returncode not in (0, 1):
                    raise RuntimeError(result.stderr.decode(errors="replace"))
                near_samples += 1
                near_conflicts += result.returncode
                break
        results.append({
            "previous": old_meta, "incoming": new_meta,
            "changed_assembly_files": len(changed_files),
            "added_assembly_files": len(new.keys() - old.keys()),
            "removed_assembly_files": len(old.keys() - new.keys()),
            "comment_samples": samples, "comment_conflicts": conflicts,
            "changed_line_comment_samples": near_samples,
            "changed_line_comment_conflicts": near_conflicts,
        })
    return results


def history_storage(directories, root):
    """Measure only assembly history, excluding ROMs, assets, maps and build products."""
    if not directories:
        return None
    folder = root / "assembly-history"
    folder.mkdir()
    repo = Repository(folder)
    expanded = 0
    first_packed = 0
    for index, directory in enumerate(directories):
        assembly, metadata = load_generation(directory)
        expanded += sum(len(data) for data in assembly.values())
        repo.write(assembly)
        repo.commit(metadata["manifest_sha256"])
        if index == 0:
            repo.git("gc", "--quiet")
            first_packed = sum(
                file.stat().st_size
                for file in (folder / ".git/objects").rglob("*") if file.is_file()
            )
    repo.git("gc", "--quiet")
    packed = sum(file.stat().st_size for file in (folder / ".git/objects").rglob("*") if file.is_file())
    return {
        "generations": len(directories), "summed_assembly_bytes": expanded,
        "first_generation_packed_bytes": first_packed, "packed_git_object_bytes": packed,
    }


def main():
    """Emit reproducible observations; temporary repositories disappear on completion."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--generation", action="append", type=Path, default=[],
        help="Ordered existing exports; read-only, optional",
    )
    parser.add_argument("--output", type=Path, help="Save result JSON as well as printing it")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="uttori-git-merge-probe-") as temporary:
        root = Path(temporary)
        results = {
            "git": subprocess.check_output(["git", "--version"], text=True).strip(),
            "synthetic": synthetic_cases(root),
            "historical": historical_cases(args.generation, root),
            "assembly_history_storage": history_storage(args.generation, root),
        }
    text = json.dumps(results, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text)
    print(text, end="")


if __name__ == "__main__":
    main()
