#!/bin/sh
set -eu
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
test_dir=$(mktemp -d "${TMPDIR:-/tmp}/ares-file-wire.XXXXXX")
trap 'rm -rf "$test_dir"' EXIT HUP INT TERM
mkdir -p "$test_dir/nall/gdb" "$test_dir/output"
cp "$script_dir/capture.hpp" "$script_dir/capture-file.hpp" "$test_dir/nall/gdb/"
"${CXX:-c++}" -std=c++17 -O2 -pthread -Wall -Wextra -Werror -DARES_CAPTURE_FILE_TEST -I "$test_dir" "$script_dir/file-test.cpp" -o "$test_dir/test"
"$test_dir/test" "$test_dir/output"
