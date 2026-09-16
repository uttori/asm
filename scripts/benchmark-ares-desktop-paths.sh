#!/bin/sh
set -eu
runtime=${1:?Usage: benchmark-ares-desktop-paths.sh runtime-directory output-directory}
output=${2:?Missing output directory}
mkdir -p "$output"
# Keep complete per-run evidence; zero is the warmup. Launch, capture, validation
# and teardown finish before another emulator starts. Settings/ROMs are disposable.
for scenario in instructions-stream instructions-file bus-stream bus-file transfers-stream transfers-file ppu-stream ppu-file ppu-stream-slow ppu-file-metal frame-file frame-live; do
  case "$scenario" in
    instructions-stream) set -- ;;
    instructions-file) set -- --native-file ;;
    bus-stream) set -- --bus ;;
    bus-file) set -- --bus --native-file ;;
    transfers-stream) set -- --transfers ;;
    transfers-file) set -- --transfers --native-file ;;
    ppu-stream) set -- --ppu ;;
    ppu-file) set -- --ppu --native-file ;;
    ppu-stream-slow) set -- --ppu --slow ;;
    ppu-file-metal) set -- --ppu --native-file --host-video ;;
    frame-file) set -- --ppu --native-file --frame-paced ;;
    frame-live) set -- --ppu --native-file --frame-paced --live ;;
  esac
  duration=500
  case "$scenario" in frame-*) duration=3000 ;; esac
  for sample in 0 1 2 3; do
    node --import=tsx scripts/test-ares-capture-sidecar.ts "$runtime" "$output/$scenario-$sample.json" --profile --duration-ms "$duration" "$@" > "$output/$scenario-$sample.log"
  done
  printf '%s completed (one warmup, three measured runs)\n' "$scenario"
done
