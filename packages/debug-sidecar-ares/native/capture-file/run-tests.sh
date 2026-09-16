#!/bin/sh
set -eu
build_dir=${1:?Usage: run-tests.sh ares-build-directory}
cmake --build "$build_dir" --target gdb-capture-file gdb-capture gdb-capture-bus gdb-capture-graphics gdb-states --parallel "${JOBS:-8}"
ctest --test-dir "$build_dir" -R '^gdb-(capture|states)' --output-on-failure
