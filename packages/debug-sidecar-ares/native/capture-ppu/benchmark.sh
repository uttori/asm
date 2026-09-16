#!/usr/bin/env sh
set -eu

# Sequential runs keep compilers and competing benchmark processes out of the
# measurement. Each executable emits six samples per case; sample zero warms it.
build_dir=${1:?Usage: benchmark.sh build-dir output-dir [baseline-executable]}
output_dir=${2:?Missing output directory}
executable=${PPU_BENCHMARK_EXECUTABLE:-$build_dir/tests/gdb-capture/gdb-capture-ppu-benchmark}
baseline=${3:-}
mkdir -p "$output_dir"
for round in 0 1; do
  order='before after'
  if [ "$round" = 1 ]; then order='after before'; fi
  for phase in $order; do
    selected=$executable
    argument=''
    if [ "$phase" = before ]; then
      if [ -z "$baseline" ]; then continue; fi
      selected=$baseline
      argument=baseline
    fi
    for ppu in performance accurate; do
      mode=''
      if [ "$ppu" = accurate ]; then mode=accurate; fi
      log="$output_dir/$phase-$ppu-$round.log"
      "$selected" $argument $mode > "$log"
      # GDB diagnostics precede the JSON block. Preserve every timed sample.
      sed -n '/^BENCH_BEGIN$/,/^BENCH_END$/p' "$log" | sed '1d;$d' > "$output_dir/$phase-$ppu-$round.json"
      test -s "$output_dir/$phase-$ppu-$round.json"
    done
  done
done
