These fixtures contain only the synthetic cartridge in ares's `tests/gdb-famicom/core-test.cpp`.
No commercial ROM data is included. Set `UTTORI_NES_PPU_FIXTURE` to this directory when running
that native test to regenerate the 3-event ACT2 chunk and the NPP1 storage snapshot.

The chunk records a rendering-restricted OAM write, a mirrored palette write at `$3FFF`, and
a discarded CHR-ROM write. The snapshot includes distinct MMC3 pattern banks, a pending PPU
status flag, read buffer and write latch. Native tests compare machine state before/after the
snapshot and compare captured/uncaptured PPU, OAM DMA and DMC execution.

`ppu-timeline.chunk` and `ppu-irq.chunk` come from the same synthetic native test.
They cover renderer reads, A12 transitions, MMC3 register writes and delayed CPU
IRQ-pin propagation. Neither contains private cartridge data. Set
`UTTORI_NES_PPU_FIXTURE` to a temporary output directory when running `gdb-famicom`
to reproduce the files; copy the intended fixture only after inspecting changes.
