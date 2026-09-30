#!/usr/bin/env python3
"""Exercise bounded source edits through the lab's real generation history.

Conflict resolution here is an explicit fixture recipe, not a proposed automatic
merge engine. Record the raw merge/build outcome before applying that recipe, then
verify the complete ROM against an independently constructed expected byte image.
"""

import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys


sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location("lab", Path(__file__).with_name("som-git-regeneration-lab.py"))
lab = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(lab)
SOURCE = lab.LAB / "source"
ROM_BYTES = lab.ROM.read_bytes()
assert ROM_BYTES[0x8e13d:0x8e13f] == bytes([0x29, 0x3f])
assert ROM_BYTES[0x8e259:0x8e25b] == bytes([0x6b, 0xe2])
assert ROM_BYTES[0x82b8a:0x82b8c] == bytes([0x08, 0x21])
assert ROM_BYTES[0x6355:0x635b] == bytes.fromhex("9c8f8d82c800")
CASES = ["instruction", "label", "table", "palette", "binary", "combined"]


def git_read(*args):
    """Inspect only the isolated repository, excluding caller Git overrides."""
    env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
    env.update(GIT_CONFIG_GLOBAL=os.devnull, GIT_CONFIG_NOSYSTEM="1")
    return subprocess.check_output(["git", *args], cwd=SOURCE, env=env)


def members(case):
    """Expand the combined session into exactly the same independently tested edits."""
    if case == "combined":
        return CASES[:-1]
    return [case]


def expected_rom(case):
    """Construct the byte oracle from original ROM offsets, independent of source rendering."""
    image = bytearray(ROM_BYTES)
    offsets = {"instruction": (0x8e13e, 0x1f), "table": (0x8e259, 0x6c),
               "palette": (0x82b8a, 0x09), "binary": (0x6355, 0x9d)}
    for kind in members(case):
        if kind in offsets:
            offset, value = offsets[kind]
            image[offset] = value
    return bytes(image)


def edit_instruction():
    """Change the captured chest reward mask without changing its encoded width."""
    file = SOURCE / "banks/bank-008.asm"
    text = file.read_text()
    pattern = r"(Fn_C8E12C:[\s\S]*?AND\.b #\$)(?:3F|1F)"
    changed, count = re.subn(pattern, r"\g<1>1F", text, count=1)
    assert count == 1
    file.write_text(changed)


def edit_label():
    """Rename the existing definition and every currently present assembly reference."""
    definitions = 0
    for file in SOURCE.rglob("*.asm"):
        text = file.read_text()
        text = re.sub(r"\bFn_C0389C\b", "LocalRandomByte", text)
        definitions += text.count("LocalRandomByte:")
        file.write_text(text)
    assert definitions == 1, definitions


def edit_table():
    """Represent nine bounded pointers as words, retaining the later interior label."""
    file = SOURCE / "banks/bank-008.asm"
    text = file.read_text()
    start = text.index("LabChestEffectPointers:\n") + len("LabChestEffectPointers:\n")
    end = text.index("  RTS\n", start)
    before = text[start:end]
    interior_labels = [line for line in before.splitlines() if re.fullmatch(r"(?:L_)?LabEffectEntry4:", line)]
    # Refuse to overwrite unexpected code or annotations while replacing the fixture's data block.
    for line in before.splitlines():
        assert not line or line.startswith(("  incbin ", "  dw ")) or line in interior_labels, line
    rows = []
    for index, offset in enumerate(range(0x8e259, 0x8e26b, 2)):
        if index == 4 and interior_labels:
            rows.extend(interior_labels)
        value = int.from_bytes(ROM_BYTES[offset:offset + 2], "little")
        if index == 0:
            value = 0xe26c
        rows.append(f"  dw ${value:04X}")
    file.write_text(text[:start] + "\n".join(rows) + "\n" + text[end:])


def edit_palette():
    """Change one BGR555 component through the real SoM palette asset encoder."""
    file = SOURCE / "assets/chest-palette.json"
    data = json.loads(file.read_text())
    word = data["palettes"]["C82B8A"]["words"][0]
    assert word in ("2108", "2109"), word
    data["palettes"]["C82B8A"]["words"][0] = "2109"
    lab.save_json(file, data)


def edit_binary():
    """Replay one guarded text-asset byte into the current raw extent containing it."""
    candidates = []
    referenced = "\n".join(file.read_text() for file in (SOURCE / "banks").glob("*.asm"))
    for file in (SOURCE / "assets").glob("raw-*.bin"):
        match = re.fullmatch(r"raw-([0-9a-f]{6})-([0-9a-f]{6})\.bin", file.name)
        if not match or file.name not in referenced:
            continue
        start, last = (int(value, 16) for value in match.groups())
        if start <= 0x6355 <= last:
            candidates.append((file, start, last))
    assert len(candidates) == 1, candidates
    file, start, last = candidates[0]
    data = bytearray(file.read_bytes())
    assert len(data) == last - start + 1
    assert data[0x6355 - start] in (0x9c, 0x9d)
    data[0x6355 - start] = 0x9d
    file.write_bytes(data)


def apply_edits(case):
    """Apply the known fixture recipe idempotently, including deliberate conflict repairs."""
    actions = {"instruction": edit_instruction, "label": edit_label, "table": edit_table,
               "palette": edit_palette, "binary": edit_binary}
    for kind in members(case):
        actions[kind]()


def build(case, stage):
    """Check assembly, exact expected bytes, and fresh debug-map source/output identities."""
    output = SOURCE / "build/current.sfc"
    result = lab.command(f"{case}-{stage}-build", [
        "node", lab.CLI, "assemble", SOURCE / "main.asm", output,
        "--config", SOURCE / "uttori-asm.config.json", "--debug",
    ], expected=(0, 1))
    record = {"exit": result["exit"], "seconds": result["seconds"], "log": result["log"]}
    if result["exit"]:
        return record
    data = output.read_bytes()
    expected = expected_rom(case)
    changed = [i for i, (old, new) in enumerate(zip(ROM_BYTES, data)) if old != new]
    record.update(sha256=lab.digest(output), bytes=len(data), changedByteCount=len(changed),
                  firstChangedOffsets=changed[:20], exactExpectedBytes=data == expected)
    debug = json.loads(Path(str(output) + ".debug.json").read_text())
    assert debug["output"]["sha256"] == record["sha256"]
    for source in debug["sources"]:
        assert lab.digest(SOURCE / source["path"]) == source["sha256"], source["path"]
    record["debugIdentityVerified"] = True
    return record


def resolve_conflicts(case, generation, paths):
    """Restore incoming conflict paths, then apply only the bounded documented fixture edits."""
    incoming = set(git_read("ls-tree", "-r", "--name-only", generation).decode().splitlines())
    for index, filename in enumerate(paths):
        if filename in incoming:
            lab.git(f"{case}-{generation}-resolve-{index}", SOURCE, "checkout", generation, "--", filename)
        else:
            lab.git(f"{case}-{generation}-remove-{index}", SOURCE, "rm", "-f", "--", filename)
    apply_edits(case)


def run_case(case):
    """Keep one user history across every generation; record raw outcomes before repairs."""
    report = lab.LAB / "results/cases" / f"{case}.json"
    if report.exists():
        results = json.loads(report.read_text())
        if len(results["generations"]) == 5:
            assert git_read("rev-parse", f"codex/{case}").decode().strip() == results["generations"][-1]["acceptedCommit"]
            return results
        assert git_read("branch", "--show-current").decode().strip() == f"codex/{case}"
    else:
        lab.git(f"{case}-branch", SOURCE, "switch", "-c", f"codex/{case}", "G0")
        apply_edits(case)
        initial = build(case, "initial")
        assert initial.get("exactExpectedBytes"), initial
        lab.git(f"{case}-initial-stage", SOURCE, "add", "-A")
        lab.git(f"{case}-initial-commit", SOURCE, "commit", "-m", f"User edit: {case}")
        results = {"case": case, "initial": initial, "generations": []}
        lab.save_json(report, results)
    for generation in ["G0-noop", "G1", "G2", "G3", "G4-noop"]:
        if any(item["generation"] == generation for item in results["generations"]):
            continue
        before = git_read("rev-parse", "HEAD").decode().strip()
        conflict_file = lab.LAB / "results/conflicts" / f"{case}-{generation}.json"
        merge_path = SOURCE / git_read("rev-parse", "--git-path", "MERGE_HEAD").decode().strip()
        if merge_path.exists():
            # Resume an interrupted fixture resolution without losing its original conflict evidence.
            assert merge_path.read_text().strip() == git_read("rev-parse", generation).decode().strip()
            saved = json.loads(conflict_file.read_text())
            assert saved["ours"] == before
            paths = saved["paths"]
            commands = [json.loads(line) for line in (lab.LAB / "results/commands.jsonl").read_text().splitlines()]
            merged = next(row for row in commands if row["label"] == f"{case}-{generation}-merge")
        else:
            merged = lab.git(f"{case}-{generation}-merge", SOURCE, "merge", "--no-ff", "--no-commit", generation,
                             expected=(0, 1))
            paths = git_read("diff", "--name-only", "--diff-filter=U").decode().splitlines()
        result = {"generation": generation, "mergeExit": merged["exit"], "conflicts": paths,
                  "sourceBefore": before, "mergeSeconds": merged["seconds"]}
        if paths:
            if not conflict_file.exists():
                lab.save_json(conflict_file, {
                    "paths": paths, "indexStages": git_read("ls-files", "-u").decode(),
                    "base": git_read("merge-base", "HEAD", generation).decode().strip(),
                    "ours": before, "theirs": git_read("rev-parse", generation).decode().strip(),
                })
            resolve_conflicts(case, generation, paths)
            result["assistance"] = "Explicit fixture resolution of conflicts"
        else:
            result["unassistedBuild"] = build(case, f"{generation}-unassisted")
            if not result["unassistedBuild"].get("exactExpectedBytes"):
                # A clean textual merge can still reintroduce old symbol references or lose an intended byte edit.
                apply_edits(case)
                result["assistance"] = "Reapply the known fixture edits after semantic build/oracle failure"
        if "assistance" in result:
            result["resolvedBuild"] = build(case, f"{generation}-resolved")
            assert result["resolvedBuild"].get("exactExpectedBytes"), result
        lab.git(f"{case}-{generation}-stage", SOURCE, "add", "-A")
        lab.git(f"{case}-{generation}-commit", SOURCE, "commit", "-m", f"Accept {generation} for {case}")
        assert not git_read("status", "--porcelain")
        result["acceptedCommit"] = git_read("rev-parse", "HEAD").decode().strip()
        results["generations"].append(result)
        lab.save_json(lab.LAB / "results/cases" / f"{case}.json", results)
    return results


def layout_observations(name):
    """Inspect bank extents and the grown table using the current build's source mapping."""
    debug = json.loads((SOURCE / "build/current.sfc.debug.json").read_text())
    sources = {source["id"]: source["path"] for source in debug["sources"]}
    bank = [row for row in debug["ranges"] if sources[row["sourceId"]] == "banks/bank-008.asm"]
    report = {
        "case": name, "bank8MaximumOutputEnd": max(row["outputEnd"] for row in bank),
        "bank8Spills": [row for row in bank if row["outputEnd"] > 0x90000],
        "maskNeighborhood": [row for row in debug["instructions"] if 0x8e13b <= row["outputOffset"] <= 0x8e145],
    }
    if name == "table-growth":
        lines = (SOURCE / "banks/bank-008.asm").read_text().splitlines()
        line = next(index + 1 for index, text in enumerate(lines) if text == "  dw $0000")
        report["addedTableWord"] = [row for row in bank if row["line"] == line]
        report["firstTablePointer"] = 0xc8e26c
    return report


def negative_controls():
    """Measure whether assembly itself rejects edits that grow fixed ROM extents."""
    report = lab.LAB / "results/negative-controls.json"
    if report.exists():
        return json.loads(report.read_text())
    results = []
    layouts = []
    for name in ["instruction-width", "table-growth"]:
        lab.git(f"{name}-branch", SOURCE, "switch", "-c", f"codex/{name}", "G0")
        file = SOURCE / "banks/bank-008.asm"
        if name == "instruction-width":
            text = file.read_text()
            assert text.count("AND.b #$3F") == 1
            file.write_text(text.replace("AND.b #$3F", "AND.w #$003F"))
        else:
            edit_table()
            text = file.read_text()
            assert text.count("  dw $E2F6\n") == 1
            file.write_text(text.replace("  dw $E2F6\n", "  dw $E2F6\n  dw $0000\n"))
        result = build(name, "negative-control")
        results.append({"case": name, "build": result})
        if result["exit"] == 0:
            layouts.append(layout_observations(name))
        lab.git(f"{name}-stage", SOURCE, "add", "-A")
        lab.git(f"{name}-commit", SOURCE, "commit", "-m", f"Negative control: {name}")
    lab.save_json(report, results)
    lab.save_json(lab.LAB / "results/layout-controls.json", layouts)
    lab.git("return-combined", SOURCE, "switch", "codex/combined")
    final = build("combined", "final")
    assert final.get("exactExpectedBytes"), final
    return results


def main():
    """Retain independent case reports and finish on the combined editable branch."""
    results = [run_case(case) for case in CASES]
    lab.save_json(lab.LAB / "results/edit-cases.json", results)
    negative_controls()
    print(json.dumps([{ "case": item["case"], "merges": len(item["generations"]),
                        "assisted": sum("assistance" in row for row in item["generations"]) }
                      for item in results], indent=2))


if __name__ == "__main__":
    main()
