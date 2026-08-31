; hello-world.asm
; A complete, headerless 32 KiB LoROM that displays HELLO WORLD.

lorom                                  ; Map CPU $00:8000-$00:FFFF to this ROM.

org $008000                            ; The reset routine begins at CPU $00:8000.

Reset:
  sei                                  ; Mask IRQ while the machine is being prepared.
  cld                                  ; Binary arithmetic, please-no decimal surprises.
  clc                                  ; Clear carry so XCE will select native mode.
  xce                                  ; Leave 6502 emulation mode for 65C816 native mode.
  rep #$30                             ; Make A, X, and Y 16-bit for setup and long loops.

  ldx #$1FFF                           ; Give the stack a quiet corner of low RAM.
  txs                                  ; Transfer X to S (stack pointer).
  lda #$0000                           ; Direct page starts at $0000.
  tcd                                  ; Transfer A to D (direct page register).
  phk                                  ; Copy the program bank ($00) into the data bank.
  plb                                  ; Absolute reads below can now reach our font data.

  sep #$20                             ; PPU registers are byte-wide, so make A 8-bit.
  lda #$80                             ; Force blank while changing VRAM/CGRAM.
  sta $2100                            ; INIDISP: force blank while changing VRAM/CGRAM.
  stz $4200                            ; NMITIMEN: disable NMI, IRQ, and auto joypad reads.
  stz $420B                            ; MDMAEN: make sure no general DMA channel is active.
  stz $420C                            ; HDMAEN: make sure no H-DMA channel is active.

  ; Configure one modest background layer.
  ; Mode 0 gives BG1 four colors per tile, which is plenty for white letters on black.
  stz $2105                            ; BGMODE: Mode 0, every background uses 8x8 tiles.
  stz $2107                            ; BG1SC: 32x32 tilemap at VRAM word address $0000.
  lda #$01                             ; BG1 tiles begin at VRAM word address $1000.
  sta $210B                            ; BG12NBA: BG1 tiles begin at VRAM word address $1000.
  stz $210D                            ; BG1HOFS is write-twice; set horizontal scroll to 0.
  stz $210D
  stz $210E                            ; BG1VOFS is write-twice; set vertical scroll to 0.
  stz $210E

  ; Clear all 64 KiB of VRAM. $2115=$80 increments the word address after a write to $2119.
  ; With A in 16-bit mode, STA $2118 writes both $2118 and $2119,
  ; so one loop iteration clears one complete VRAM word.
  lda #$80
  sta $2115                            ; VMAIN: increment after the high-byte write.
  stz $2116                            ; VMADDL: start at VRAM word address $0000.
  stz $2117                            ; VMADDH: high byte of that address.
  rep #$20                             ; Make A 16-bit for paired $2118/$2119 writes.
  lda #$0000                           ; Every VRAM word receives zero.
  ldx #$8000                           ; 32,768 words make the SNES's 64 KiB VRAM.

.clear_vram:
  sta $2118                            ; VMDATAL/VMDATAH: write one zero word.
  dex
  bne .clear_vram
  sep #$20                             ; Return A to 8-bit PPU-register duty.

  ; Install palette 0: color 0 is black and color 1 is white.
  ; CGRAM colors are 15-bit BGR values, written low byte and then high byte through $2122.
  stz $2121                            ; CGADD: begin with CGRAM color 0.
  stz $2122                            ; Color 0 low byte:  $00
  stz $2122                            ; Color 0 high byte: $00 -> black ($0000)
  lda #$FF
  sta $2122                            ; Color 1 low byte:  $FF
  lda #$7F
  sta $2122                            ; Color 1 high byte: $7F -> white ($7FFF)

  ; Upload eight 2-bits-per-pixel tiles to VRAM word address $1000.
  ; Each row is two bitplane bytes.
  ; Plane 0 draws color 1; plane 1 stays zero throughout.
  stz $2116                            ; VMADDL: low byte of tile-data address $1000.
  lda #$10
  sta $2117                            ; VMADDH: high byte of tile-data address $1000.
  ldx #$0000                           ; X walks over the ROM-resident font bytes.

.copy_font:
  lda FontTiles,x
  sta $2118                            ; Send the row's plane-0 byte to VMDATAL.
  inx
  lda FontTiles,x
  sta $2119                            ; Send plane 1 to VMDATAH, then advance VRAM.
  inx
  cpx.w #FontTilesEnd-FontTiles        ; `.w` matches the 16-bit X register explicitly.
  bne .copy_font

  ; Put eleven tile numbers on row 13, column 10 of the 32x32 BG1 tilemap.
  ; 13 * 32 + 10 = 426 = $01AA.
  ; A tilemap entry is a two-byte word: tile number first, then palette/priority/flip flags.
  ; Zero selects palette 0.
  lda #$AA
  sta $2116                            ; VMADDL: low byte of tilemap position $01AA.
  lda #$01
  sta $2117                            ; VMADDH: high byte of tilemap position $01AA.
  ldx #$0000                           ; Begin with the H in MessageTiles.

.copy_message:
  lda MessageTiles,x
  sta $2118                            ; Tile number: H, E, L, L, O, space, and so on.
  stz $2119                            ; Palette 0, normal priority, no flipping.
  inx                                  ; Increment X.
  cpx.w #MessageTilesEnd-MessageTiles  ; Keep this immediate 16-bit as well.
  bne .copy_message                    ; Branch if not equal to the end of the message tiles.

  lda #$01
  sta $212C                            ; TM: show BG1 on the main screen.
  stz $212D                            ; TS: show nothing on the sub screen.
  lda #$0F
  sta $2100                            ; INIDISP: leave forced blank at full brightness.

Forever:
  bra Forever                          ; The picture is static; the CPU may loiter forever.

EmptyHandler:
  rti                                  ; Safe landing for any vector we did not enable.

; The message is expressed as indices into the tiny font below:
;   0=space, 1=H, 2=E, 3=L, 4=O, 5=W, 6=R, 7=D.
MessageTiles:
  db $01,$02,$03,$03,$04,$00,$05,$04,$06,$03,$07
MessageTilesEnd:

; Eight 8x8, 2bpp tiles. Each visual row has a plane-0 byte followed by $00 for plane 1.
; In the binary drawings, bit 7 is the leftmost pixel.
FontTiles:
  ; Tile 0: space
  db %00000000,$00
  db %00000000,$00
  db %00000000,$00
  db %00000000,$00
  db %00000000,$00
  db %00000000,$00
  db %00000000,$00
  db %00000000,$00

  ; Tile 1: H
  db %10000001,$00
  db %10000001,$00
  db %10000001,$00
  db %11111111,$00
  db %10000001,$00
  db %10000001,$00
  db %10000001,$00
  db %00000000,$00

  ; Tile 2: E
  db %11111111,$00
  db %10000000,$00
  db %10000000,$00
  db %11111110,$00
  db %10000000,$00
  db %10000000,$00
  db %11111111,$00
  db %00000000,$00

  ; Tile 3: L
  db %10000000,$00
  db %10000000,$00
  db %10000000,$00
  db %10000000,$00
  db %10000000,$00
  db %10000000,$00
  db %11111111,$00
  db %00000000,$00

  ; Tile 4: O
  db %01111110,$00
  db %10000001,$00
  db %10000001,$00
  db %10000001,$00
  db %10000001,$00
  db %10000001,$00
  db %01111110,$00
  db %00000000,$00

  ; Tile 5: W
  db %10000001,$00
  db %10000001,$00
  db %10000001,$00
  db %10000001,$00
  db %10010001,$00
  db %10010001,$00
  db %01101110,$00
  db %00000000,$00

  ; Tile 6: R
  db %11111110,$00
  db %10000001,$00
  db %10000001,$00
  db %11111110,$00
  db %10001000,$00
  db %10000100,$00
  db %10000010,$00
  db %00000000,$00

  ; Tile 7: D
  db %11111100,$00
  db %10000010,$00
  db %10000001,$00
  db %10000001,$00
  db %10000001,$00
  db %10000010,$00
  db %11111100,$00
  db %00000000,$00
FontTilesEnd:

; A LoROM internal header occupies CPU $00:FFC0-$00:FFDF.
org $00FFC0
db "HELLO WORLD          "             ; Exactly 21 title bytes.
db $20                                 ; Map mode: slow LoROM.
db $00                                 ; Cartridge type: ROM only.
db $05                                 ; ROM size: 2^(5+10) = 32 KiB.
db $00                                 ; SRAM size: none.
db $01                                 ; Destination: North America.
db $00                                 ; Old-style licensee code.
db $00                                 ; Mask ROM version 0.
dw $0000, $0000                        ; Complement/checksum; the SNES target fills these.

; Native vectors at $FFE0-$FFEF.
; Reserved words remain zero;
; every real interrupt points at the harmless RTI above.
org $00FFE0
dw $0000, $0000                        ; reserved, reserved
dw EmptyHandler, EmptyHandler          ; COP, BRK
dw EmptyHandler, EmptyHandler          ; ABORT, NMI
dw $0000, EmptyHandler                 ; reserved, IRQ

; Emulation-mode vectors at $FFF0-$FFFF.
; RESET is the one that starts the show.
dw $0000, $0000                        ; reserved, reserved
dw EmptyHandler, $0000                 ; COP, reserved
dw EmptyHandler, EmptyHandler          ; ABORT, NMI
dw Reset, EmptyHandler                 ; RESET, IRQ/BRK
