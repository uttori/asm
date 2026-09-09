#!/usr/bin/env sh
set -eu

checkout=$(CDPATH= cd -- "${1:-fixtures/external/ares}" && pwd)
temporary=$(mktemp -d "${TMPDIR:-/tmp}/ares-sdk.XXXXXX")
trap 'rm -rf "$temporary"' EXIT
trap 'exit 1' HUP INT TERM
awk '/^function\(check_sdk_requirements\)/ { copy = 1 } copy { print } copy && /^endfunction\(\)/ { found = 1; exit } END { if (!found) exit 1 }' \
  "$checkout/cmake/macos/compilerconfig.cmake" > "$temporary/function.cmake"
cat > "$temporary/xcrun" <<'SH'
#!/usr/bin/env sh
printf '%s\n' "$*" >> "$ARES_SDK_TEST_LOG"
case "$*" in
  *--show-sdk-platform-version) [ "$ARES_SDK_PRIMARY_FAIL" = 1 ] && exit 1 ;;
  *--show-sdk-version) [ "$ARES_SDK_FALLBACK_FAIL" = 1 ] && exit 1 ;;
  *) exit 2 ;;
esac
printf '%s\n' "$ARES_SDK_VERSION"
SH
chmod +x "$temporary/xcrun"

scenario() {
  name=$1
  export ARES_SDK_PRIMARY_FAIL=$2 ARES_SDK_FALLBACK_FAIL=$3 ARES_SDK_VERSION=$4
  xcode=$5 expected_success=$6 expected_calls=$7
  export ARES_SDK_TEST_LOG="$temporary/calls.txt"
  : > "$ARES_SDK_TEST_LOG"
  cp "$temporary/function.cmake" "$temporary/test.cmake"
  {
    if [ -n "$xcode" ]; then printf 'set(XCODE TRUE)\n'; else printf 'set(XCODE FALSE)\n'; fi
    printf 'set(XCODE_VERSION "%s")\ncheck_sdk_requirements()\n' "$xcode"
  } >> "$temporary/test.cmake"
  success=0
  PATH="$temporary:$PATH" cmake -P "$temporary/test.cmake" > "$temporary/output" 2>&1 && success=1
  calls=$(wc -l < "$ARES_SDK_TEST_LOG" | tr -d ' ')
  if [ "$success" != "$expected_success" ] || [ "$calls" != "$expected_calls" ]; then
    cat "$temporary/output" >&2
    printf 'FAIL %s: success=%s calls=%s\n' "$name" "$success" "$calls" >&2
    exit 1
  fi
  printf 'PASS %s\n' "$name"
}
scenario 'CLT fallback' 1 0 26.0 '' 1 2
scenario 'full Xcode primary SDK' 0 1 26.0 26.0 1 1
scenario 'both xcrun calls fail' 1 1 26.0 '' 0 2
scenario 'old SDK still fails' 1 0 10.15 '' 0 2
scenario 'old Xcode still fails' 0 0 26.0 12.0 0 1
