#!/usr/bin/env sh
set -eu

native_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
for script in "$native_dir"/tests/*.sh "$native_dir"/upstream/*.sh; do
  sh -n "$script"
done
printf 'PASS native shell syntax\n'
"$native_dir/tests/macos-sdk.sh" "${1:-$native_dir/../../../fixtures/external/ares}"
