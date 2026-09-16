#!/bin/sh
set -eu
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
test_dir=$(mktemp -d "${TMPDIR:-/tmp}/ares-realtime-wire.XXXXXX")
trap 'rm -rf "$test_dir"' EXIT HUP INT TERM
mkdir -p "$test_dir/nall/gdb"
cp "$script_dir/capture.hpp" "$script_dir/capture-file.hpp" "$test_dir/nall/gdb/"
# Both variants use the independent bitwise reader, including unaligned CRC tails.
for mode in native portable; do
  define=""
  if [ "$mode" = portable ]; then define=-DARES_CAPTURE_PORTABLE_CRC; fi
  "${CXX:-c++}" -std=c++17 -O2 -march=native -pthread -Wall -Wextra -Werror -DARES_CAPTURE_FILE_TEST $define -I "$test_dir" "$script_dir/file-test.cpp" -o "$test_dir/test-$mode"
  "$test_dir/test-$mode" "$test_dir/output-$mode"
done
