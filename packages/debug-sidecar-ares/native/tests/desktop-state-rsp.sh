#!/usr/bin/env sh
set -eu
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
temporary=$(mktemp -d "${TMPDIR:-/tmp}/ares-state-rsp.XXXXXX")
trap 'rm -rf "$temporary"' EXIT
trap 'exit 1' HUP INT TERM
"${CXX:-c++}" -std=c++20 -O2 -pthread "$script_dir/desktop-state-rsp.cpp" -o "$temporary/desktop-state-rsp"
"$temporary/desktop-state-rsp" "$@"
