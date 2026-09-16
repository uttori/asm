#!/bin/sh
set -eu
# Run sequentially, reversing order in round two. Each case includes one warmup.
build_dir=${1:?Usage: benchmark.sh build-dir output-dir previous-ppu-benchmark}
output_dir=${2:?Missing output directory}
baseline=${3:?Missing previous PPU benchmark executable}
mode_set=${4:-files}
mkdir -p "$output_dir"
for round in 0 1; do
  order="before after"
  if [ "$round" = 1 ]; then order="after before"; fi
  for phase in $order; do
    executable=$baseline
    argument=""
    if [ "$phase" = after ]; then
      executable=${PPU_BENCHMARK_EXECUTABLE:-$build_dir/tests/gdb-capture/gdb-capture-ppu-benchmark}
      argument=files
    fi
    if [ "$mode_set" = cpu-only ]; then argument=baseline; fi
    for ppu in performance accurate; do
      mode=""
      if [ "$ppu" = accurate ]; then mode=accurate; fi
      log="$output_dir/$phase-$ppu-$round.log"
      "$executable" $argument $mode > "$log"
      sed -n '/^BENCH_BEGIN$/,/^BENCH_END$/p' "$log" | sed '1d;$d' > "$output_dir/$phase-$ppu-$round.json"
      test -s "$output_dir/$phase-$ppu-$round.json"
    done
  done
done
