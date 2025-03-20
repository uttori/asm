#ifndef _CONSTS_H
#define _CONSTS_H

// the number of bytes in a 256x200 pixel 256 colour display
#define NUM_DISPLAY_BYTES      (0xC800)

// the maximum number of bytes that can be updated during the vertical blank
#define MAX_BYTES_PER_FRAME    (0x2800)

// the overhead of performing a DMA operation, expressed in terms of the
// number of bytes which could be transferred in that time
#define OVERHEAD_PER_DMA_XFER  (0x80)

// the maximum number of continuous words that may be tranferred in a single
// DMA operation
#define MAX_WORDS_PER_DMA_XFER (0x400)

// the number of consecutive words that need to be the same in order to
// terminate a DMA transfer
#define NUM_WORDS_SAME         (0x20)

#endif
