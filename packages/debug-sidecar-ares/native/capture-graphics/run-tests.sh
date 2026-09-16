#!/usr/bin/env sh
set -eu

# The optional executable override supports multi-configuration build layouts.
build_dir=${1:?Usage: run-tests.sh /absolute/path/to/ares/build}
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
configuration=${CONFIGURATION:-Release}
executable=${GRAPHICS_TEST_EXECUTABLE:-$build_dir/tests/gdb-capture/gdb-capture-graphics}
cmake --build "$build_dir" --config "$configuration" --target gdb-capture-graphics
ctest --test-dir "$build_dir" --build-config "$configuration" -R '^gdb-capture-graphics(-accurate)?$' --output-on-failure

scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT HUP INT TERM
"$executable" > "$scratch/default.log"
"$executable" accurate > "$scratch/accurate.log"
# GDB connect/disconnect diagnostics precede the JSON fixture. Compare the entire
# JSON suffix; changed accesses, values, memory bytes or extra trailing output fail.
for mode in default accurate; do
  sed -n '/^{"vramBytes"/,$p' "$scratch/$mode.log" > "$scratch/$mode.json"
  cmp "$script_dir/ppu-port-oracle.json" "$scratch/$mode.json"
done
printf '%s\n' 'Both PPU implementations match the 18-scenario graphics oracle.'
