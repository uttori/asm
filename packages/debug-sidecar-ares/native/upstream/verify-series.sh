#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo=$(CDPATH= cd -- "${1:-fixtures/external/ares}" && pwd)
temporary=$(mktemp -d "${TMPDIR:-/tmp}/ares-series.XXXXXX")
cleanup() {
  git -C "$repo" worktree remove --force "$temporary" >/dev/null 2>&1 || :
  rm -rf "$temporary"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
cmake "-DREPO=$repo" "-DSERIES_DIR=$script_dir" "-DVERIFY_WORKTREE=$temporary" \
  -P "$script_dir/verify-series.cmake"
