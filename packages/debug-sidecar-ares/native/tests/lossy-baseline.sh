#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
checkout=$(CDPATH= cd -- "${1:-Local Only/ares-current-port}" && pwd)
temporary=$(mktemp -d "${TMPDIR:-/tmp}/ares-lossy.XXXXXX")
trap 'rm -rf "$temporary"' EXIT
trap 'exit 1' HUP INT TERM
mkdir -p "$temporary/nall/gdb"
awk '
  /instructionTraceCapacity = 65536/ { sub(/instructionTraceCapacity = 65536/, "instructionTraceCapacity = 8"); found++ }
  { print }
  END { if (found != 1) exit 1 }
' "$checkout/nall/nall/gdb/server.hpp" > "$temporary/nall/gdb/server.hpp"
"${CXX:-c++}" -std=c++20 -fno-access-control -pthread -fwrapv -fno-char8_t -UNDEBUG \
  -DNALL_HEADER_ONLY -I "$temporary" -isystem "$checkout/nall" \
  -isystem "$checkout/ares" -isystem "$checkout" -isystem "$checkout/thirdparty" \
  "$script_dir/lossy-baseline.cpp" -o "$temporary/test"
"$temporary/test"
