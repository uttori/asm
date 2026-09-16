#!/bin/sh
# Standalone native framing check; stdout is a protocol transcript for decoder interoperability.
set -eu
capture_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
capture_build=$(mktemp -d "${TMPDIR:-/tmp}/ares-ppu-wire.XXXXXX")
trap 'rm -rf "$capture_build"' EXIT HUP INT TERM

# Apple Command Line Tools may not supply the libc++ search path to standalone c++.
if [ "$(uname -s)" = Darwin ] && [ -z "${CPLUS_INCLUDE_PATH:-}" ]; then
  CPLUS_INCLUDE_PATH="$(xcrun --show-sdk-path)/usr/include/c++/v1"
  export CPLUS_INCLUDE_PATH
fi
"${CXX:-c++}" -std=c++17 -Wall -Wextra -Werror "$capture_root/wire-test.cpp" -o "$capture_build/wire-test"
"$capture_build/wire-test"
