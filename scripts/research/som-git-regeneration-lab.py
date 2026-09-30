#!/usr/bin/env python3
"""Run capture-driven regeneration experiments in a separate, private project.

Original captures and the ROM are read-only. Every command has a retained log and
timing. Pure exports keep their manifests; editable projections omit generated
ownership metadata so source edits cannot masquerade as verified pure output.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import time


REPO = Path(__file__).resolve().parents[2]
LAB = REPO / "experiments/som-git-regeneration-2026-09-30"
ROM = REPO / "secret-of-mana/Secret of Mana (USA).sfc"
CAPTURES = REPO / "secret-of-mana/disassembly/captures"
CLI = REPO / "packages/cli/out/cli.mjs"


def digest(filename):
    """Hash a large input incrementally without retaining its bytes in memory."""
    value = hashlib.sha256()
    with filename.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def save_json(filename, value):
    """Publish readable research metadata after ensuring its parent exists."""
    filename.parent.mkdir(parents=True, exist_ok=True)
    filename.write_text(json.dumps(value, indent=2) + "\n")


def command(label, args, cwd=REPO, expected=(0,)):
    """Retain exact arguments, timing, and output; fail before dependent work."""
    logfile = LAB / "results/logs" / f"{label}.log"
    logfile.parent.mkdir(parents=True, exist_ok=True)
    attempt = 2
    while logfile.exists():
        logfile = LAB / "results/logs" / f"{label}-attempt-{attempt}.log"
        attempt += 1
    start = time.monotonic()
    env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
    env.update(GIT_CONFIG_GLOBAL=os.devnull, GIT_CONFIG_NOSYSTEM="1", GIT_TERMINAL_PROMPT="0")
    print(f"Starting {label}", flush=True)
    with logfile.open("wb") as stream:
        result = subprocess.run(list(map(str, args)), cwd=cwd, env=env, stdout=stream, stderr=subprocess.STDOUT)
    record = {
        "label": label, "args": list(map(str, args)), "cwd": str(cwd),
        "seconds": round(time.monotonic() - start, 3), "exit": result.returncode,
        "log": str(logfile.relative_to(LAB)),
    }
    with (LAB / "results/commands.jsonl").open("a") as stream:
        stream.write(json.dumps(record) + "\n")
    print(f"Finished {label}: exit {result.returncode}, {record['seconds']} seconds", flush=True)
    if result.returncode not in expected:
        raise RuntimeError(logfile.read_text()[-12000:])
    return record


def cli(label, *args):
    """Use the pinned local CLI bundle and preserve its complete diagnostics."""
    return command(label, ["node", CLI, *args])


def git(label, directory, *args, expected=(0,)):
    """Run Git only in the lab, with signing and hooks disabled for fixtures."""
    assert directory.is_relative_to(LAB)
    return command(label, ["git", "-c", f"core.hooksPath={os.devnull}",
                           "-c", "commit.gpgsign=false", *args], directory, expected)


def initialize_git(directory, branch):
    """Create an isolated repository with a local experiment identity."""
    git(f"{directory.name}-init", directory, "init", "-b", branch)
    git(f"{directory.name}-name", directory, "config", "user.name", "Regeneration experiment")
    git(f"{directory.name}-email", directory, "config", "user.email", "experiment@example.invalid")


def verify_manifest(directory):
    """Verify the complete exporter-owned file set without rewriting hashes."""
    manifest = json.loads((directory / "generated-files.json").read_text())
    failures = []
    for entry in manifest["files"]:
        target = (directory / entry["path"]).resolve()
        assert target.is_relative_to(directory.resolve()), entry["path"]
        if not target.is_file() or target.stat().st_size != entry["size"] or digest(target) != entry["sha256"]:
            failures.append(entry["path"])
    assert not failures, failures
    return manifest


def export_generation(name, allow_reviewed_static_regression=False):
    """Regenerate the single pure checkout, verify every file, and snapshot it."""
    directory = LAB / "generator"
    options = []
    if allow_reviewed_static_regression:
        review = json.loads((LAB / "results" / f"regression-{name}.json").read_text())
        assert review["lostSpans"]
        assert all(not any(node.startswith("runtime:") for node in span.get("nodeIds", []))
                   for span in review["lostSpans"])
        options.append("--allow-code-regression")
    cli(f"{name}-export", "export", LAB / "analysis", directory, "--rom", ROM, *options)
    manifest = verify_manifest(directory)
    cli(f"{name}-roundtrip", "verify-roundtrip", directory, "--rom", ROM)
    if not (directory / ".git").exists():
        initialize_git(directory, "codex/generated")
        (directory / ".gitignore").write_text("/build/\n")
    git(f"{name}-stage", directory, "add", "-A")
    git(f"{name}-commit", directory, "commit", "--allow-empty", "-m", name)
    save_json(LAB / "results/generations" / f"{name}.json", {
        "manifestSha256": digest(directory / "generated-files.json"),
        "files": len(manifest["files"]), "romSha256": digest(ROM),
        "rebuiltSha256": digest(directory / "build/rebuilt-content.sfc"),
        "reviewedStaticRegression": allow_reviewed_static_regression,
    })


def import_capture(name, generation):
    """Hash and import one complete capture; preserve source and native identities separately."""
    filename = CAPTURES / name
    context = Path(str(filename) + ".context")
    manifest = json.loads((context / "manifest.json").read_text())
    assert manifest["romContentSha256"] == digest(ROM)
    assert manifest["archive"] == filename.name
    save_json(LAB / "results/captures" / f"{generation}.json", {
        "path": str(filename), "bytes": filename.stat().st_size,
        "sha256": digest(filename), "contextManifestSha256": digest(context / "manifest.json"),
        "context": manifest,
    })
    command(f"{generation}-act2-import", [
        "node", "--conditions=uttori-source", "--import", "tsx",
        REPO / "scripts/research/som-git-lab-native.mjs", "import",
        LAB / "analysis", filename, ROM, LAB / "results/captures" / f"{generation}-receipt.json",
    ])
    cli(f"{generation}-analyze", "analyze", LAB / "analysis", "--rom", ROM)
    cli(f"{generation}-validate", "project-validate", LAB / "analysis", "--rom", ROM)


def prepare():
    """Create a fresh analysis database from the original ROM and first capture."""
    LAB.mkdir(parents=True, exist_ok=False)
    (LAB / "README.md").write_text(
        "# Capture driven Git regeneration experiment\n\n"
        "Private local project. The original ROM and captures remain outside this directory.\n"
        "`analysis/` is a new native project; `generator/` is the verified pure export.\n"
        "Editable source experiments have separate Git history and no generated-file manifest.\n"
        "Commands, provenance, and outcomes are retained in `results/`.\n"
    )
    save_json(LAB / "results/environment.json", {
        "cli": str(CLI), "cliSha256": digest(CLI), "rom": str(ROM), "romSha256": digest(ROM),
        "git": subprocess.check_output(["git", "--version"], text=True).strip(),
        "node": subprocess.check_output(["node", "--version"], text=True).strip(),
    })
    cli("create-project", "disassemble", ROM, LAB / "analysis", "--mapper", "hirom")
    import_capture("chest-bomb.act2", "G0")
    export_generation("G0")


def seed():
    """Prepare bounded native table metadata and a ROM-verified editable palette input."""
    command("seed-native-table", [
        "node", "--conditions=uttori-source", "--import", "tsx",
        REPO / "scripts/research/som-git-lab-native.mjs", "seed",
        LAB / "analysis", ROM, LAB / "results/seed-table.json",
    ])
    # This catalogue contributes one known chest palette, not the old project's metadata set.
    address = 0x82b8a
    rom = ROM.read_bytes()
    words = [f"{int.from_bytes(rom[i:i+2], 'little'):04X}" for i in range(address, address + 30, 2)]
    source_catalog = json.loads((REPO / "secret-of-mana/disassembly/assets/palettes/rom-palettes.json").read_text())
    assert words == source_catalog["palettes"]["C82B8A"]["words"]
    directory = LAB / "generator"
    save_json(directory / "assets/chest-palette.json", {
        "version": 1, "description": "Chest palette fixture, checked against the original ROM.",
        "palettes": {"C82B8A": {"romAddress": "C82B8A", "firstIndex": 1, "words": words, "users": []}},
    })
    save_json(directory / "asset-includes.json", {
        "version": 1, "entries": [{"start": address, "end": address + 30,
        "directive": 'includeAsset("../assets/chest-palette.json", "som.palette.bgr555", palette: "C82B8A")'}],
    })
    config_path = directory / "uttori-asm.config.json"
    config = json.loads(config_path.read_text())
    config["plugins"].append({"module": "@uttori/asm-assets/secret-of-mana/som-asset-plugin"})
    save_json(config_path, config)
    export_generation("G0-seeded")


def project_generation(name):
    """Project source inputs into one Git repository, excluding derived ownership files."""
    directory = LAB / "source"
    generated = LAB / "generator"
    if not directory.exists():
        directory.mkdir()
        initialize_git(directory, "codex/generated")
    else:
        git(f"{name}-switch-generated", directory, "switch", "codex/generated")
    # Only paths copied by the previous projection are replaced; user branches retain their own trees.
    for item in directory.iterdir():
        if item.name == ".git":
            continue
        if item.is_dir():
            shutil.rmtree(item)
        else:
            item.unlink()
    excluded = {".git", "build", "generated-files.json", "source-ownership.json", ".gitignore"}
    for item in generated.iterdir():
        if item.name in excluded:
            continue
        target = directory / item.name
        if item.is_dir():
            shutil.copytree(item, target)
        else:
            shutil.copy2(item, target)
    (directory / ".gitignore").write_text("/build/\n")
    (directory / "README.md").write_text(
        "# Editable source merge experiment\n\n"
        "Files here are user-owned source. Pure generation manifests and verification live in ../generator.\n"
        "Use ordinary Git merges for incoming generations, then assemble with the project config.\n"
    )
    save_json(directory / "generation-provenance.json", {
        "generation": name, "pureManifestSha256": digest(generated / "generated-files.json"),
    })
    git(f"{name}-source-stage", directory, "add", "-A")
    git(f"{name}-source-commit", directory, "commit", "--allow-empty", "-m", f"Pure source {name}")
    git(f"{name}-source-tag", directory, "tag", name)


def review_regression(name):
    """Enumerate all lost code spans in a fresh candidate and verify its full ROM."""
    candidate = LAB / f"review-{name}"
    assert not candidate.exists()
    cli(f"{name}-review-export", "export", LAB / "analysis", candidate, "--rom", ROM)
    before = verify_manifest(LAB / "generator")
    after = verify_manifest(candidate)
    cli(f"{name}-review-roundtrip", "verify-roundtrip", candidate, "--rom", ROM)
    old = {offset for span in before["spans"] if span["role"] == "code"
           for offset in range(span["start"], span["end"])}
    new = {offset for span in after["spans"] if span["role"] == "code"
           for offset in range(span["start"], span["end"])}
    lost = old - new
    spans = [span for span in before["spans"] if span["role"] == "code"
             and any(offset in lost for offset in range(span["start"], span["end"]))]
    review = {
        "lostBytes": len(lost), "addedBytes": len(new - old), "lostSpans": spans,
        "previousManifestSha256": digest(LAB / "generator/generated-files.json"),
        "candidateManifestSha256": digest(candidate / "generated-files.json"),
        "candidateRomSha256": digest(candidate / "build/rebuilt-content.sfc"),
    }
    save_json(LAB / "results" / f"regression-{name}.json", review)
    print(json.dumps(review, indent=2))


def main():
    """Run explicit experiment stages without resetting or overwriting prior work."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stage", choices=["prepare", "resume-G0", "seed", "generations", "review-G1", "resume-G1", "review-G2", "resume-G2", "stress"])
    args = parser.parse_args()
    if args.stage == "prepare":
        prepare()
    elif args.stage == "resume-G0":
        import_capture("chest-bomb.act2", "G0")
        export_generation("G0")
    elif args.stage == "seed":
        seed()
        project_generation("G0")
    elif args.stage == "generations":
        export_generation("G0-noop")
        project_generation("G0-noop")
        for name, capture in [("G1", "enter-witch-castle.act2"), ("G2", "witch-castle-room-2.act2")]:
            import_capture(capture, name)
            export_generation(name)
            project_generation(name)
    elif args.stage == "resume-G1":
        export_generation("G1", allow_reviewed_static_regression=True)
        project_generation("G1")
        import_capture("witch-castle-room-2.act2", "G2")
        export_generation("G2")
        project_generation("G2")
    elif args.stage == "review-G1":
        review_regression("G1")
    elif args.stage == "review-G2":
        review_regression("G2")
    elif args.stage == "resume-G2":
        export_generation("G2", allow_reviewed_static_regression=True)
        project_generation("G2")
    elif args.stage == "stress":
        command("stress-native-metadata", [
            "node", "--conditions=uttori-source", "--import", "tsx",
            REPO / "scripts/research/som-git-lab-native.mjs", "stress", LAB / "analysis",
        ])
        palette = LAB / "generator/assets/chest-palette.json"
        data = json.loads(palette.read_text())
        data["palettes"]["C82B8A"]["name"] = "Chest palette fixture"
        save_json(palette, data)
        export_generation("G3")
        project_generation("G3")
        export_generation("G4-noop")
        project_generation("G4-noop")


if __name__ == "__main__":
    main()
