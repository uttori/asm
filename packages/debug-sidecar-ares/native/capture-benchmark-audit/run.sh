#!/bin/sh
set -eu
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
output_dir=${1:?Usage: run.sh output-directory}
build_dir=$(mktemp -d "${TMPDIR:-/tmp}/ares-producer-audit.XXXXXX")
trap 'rm -rf "$build_dir"' EXIT HUP INT TERM
mkdir -p "$output_dir"
# Preserve compiler and source identity with every run. Native and forced
# portable builds execute sequentially; assertions stay enabled in both.
"${CXX:-c++}" --version > "$output_dir/compiler.txt"
shasum -a 256 "$script_dir/producer.cpp" "$script_dir/writer.cpp" "$script_dir/../capture-realtime/capture.hpp" "$script_dir/../capture-realtime/capture-file.hpp" > "$output_dir/sources.sha256"
for mode in native portable; do
  define=""
  if [ "$mode" = portable ]; then define=-DARES_CAPTURE_PORTABLE_CRC; fi
  "${CXX:-c++}" -std=c++17 -O2 -march=native -Wall -Wextra -Werror $define "$script_dir/producer.cpp" -o "$build_dir/$mode"
  "$build_dir/$mode" > "$output_dir/$mode.json"
done
mkdir -p "$build_dir/nall/gdb"
cp "$script_dir/../capture-realtime/capture.hpp" "$script_dir/../capture-realtime/capture-file.hpp" "$build_dir/nall/gdb/"
"${CXX:-c++}" -std=c++17 -O2 -march=native -pthread -Wall -Wextra -Werror -DARES_CAPTURE_FILE_TEST -I "$build_dir" "$script_dir/writer.cpp" -o "$build_dir/writer"
"$build_dir/writer" "$build_dir/output" > "$output_dir/writer.json"
