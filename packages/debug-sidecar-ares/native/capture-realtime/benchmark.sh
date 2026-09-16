#!/bin/sh
set -eu
build_dir=${1:?Usage: benchmark.sh build-dir output-dir}
output_dir=${2:?Missing output directory}
mkdir -p "$output_dir"
# Run sequentially: each executable includes one warmup and five measured samples.
for ppu in performance accurate; do
  argument=""
  if [ "$ppu" = accurate ]; then argument=accurate; fi
  for mode in plain profile; do
    profile=""
    if [ "$mode" = profile ]; then profile=profile; fi
    "$build_dir/tests/gdb-capture/gdb-capture-ppu-benchmark" files $argument $profile > "$output_dir/$ppu-$mode.log"
    sed -n '/^BENCH_BEGIN$/,/^BENCH_END$/p' "$output_dir/$ppu-$mode.log" | sed '1d;$d' > "$output_dir/$ppu-$mode.json"
    test -s "$output_dir/$ppu-$mode.json"
  done
done
