; hello-world.asm
; A complete iNES NROM (32 KiB PRG, CHR-RAM) that displays HELLO WORLD.

.segment "CODE"

Reset:
  sei                         ; Mask IRQ during setup.
  cld                         ; Binary arithmetic.
  ldx #$40
  stx $4017                   ; Disable APU frame IRQ.
  ldx #$FF
  txs                         ; Stack at $01FF.
  inx                         ; X = 0.
  stx $2000                   ; PPUCTRL: NMI off, nametable $2000, pattern $0000.
  stx $2001                   ; PPUMASK: rendering off.
  stx $4010                   ; Disable DMC IRQ.

WaitVblank1:
  bit $2002
  bpl WaitVblank1             ; First vblank after reset is not enough.

WaitVblank2:
  bit $2002
  bpl WaitVblank2             ; PPU is now stable.

  bit $2002                   ; Reset the $2006/$2005 address latch.
  lda #$3F
  sta $2006
  lda #$00
  sta $2006                   ; Palette at PPU $3F00.
  lda #$0F
  sta $2007                   ; Color 0: black.
  lda #$30
  sta $2007                   ; Color 1: white.
  lda #$30
  sta $2007
  lda #$30
  sta $2007

  bit $2002
  lda #$00
  sta $2006
  sta $2006                   ; Pattern table 0 at PPU $0000.
  ldx #$00

CopyFont:
  lda FontTiles,x
  sta $2007
  inx
  cpx #FontTilesEnd-FontTiles
  bne CopyFont

  bit $2002
  lda #$20
  sta $2006
  lda #$00
  sta $2006                   ; Nametable 0 at PPU $2000.
  ldx #$00
  lda #$00
  ldy #$04                    ; 4 × 256 = 1024: tiles plus attributes.

ClearName:
  sta $2007
  inx
  bne ClearName
  dey
  bne ClearName

  bit $2002
  lda #$21
  sta $2006
  lda #$CB
  sta $2006                   ; Row 14, column 11 of nametable 0.
  ldx #$00

CopyMessage:
  lda MessageTiles,x
  sta $2007
  inx
  cpx #MessageTilesEnd-MessageTiles
  bne CopyMessage

  lda #$00
  sta $2005
  sta $2005                   ; Scroll 0,0.
  lda #$00
  sta $2000                   ; Keep NMI off; we never need it.
  lda #$0E
  sta $2001                   ; Show background, clip the left 8 pixels.

Forever:
  jmp Forever

EmptyHandler:
  rti

; 0=space, 1=H, 2=E, 3=L, 4=O, 5=W, 6=R, 7=D
MessageTiles:
  .byte $01,$02,$03,$03,$04,$00,$05,$04,$06,$03,$07
MessageTilesEnd:

; NES 2bpp tiles: 8 plane-0 bytes, then 8 plane-1 bytes. Bit 7 is leftmost.
FontTiles:
  ; Tile 0: space
  .byte $00,$00,$00,$00,$00,$00,$00,$00
  .byte $00,$00,$00,$00,$00,$00,$00,$00
  ; Tile 1: H
  .byte %10000001,%10000001,%10000001,%11111111
  .byte %10000001,%10000001,%10000001,%00000000
  .byte $00,$00,$00,$00,$00,$00,$00,$00
  ; Tile 2: E
  .byte %11111111,%10000000,%10000000,%11111110
  .byte %10000000,%10000000,%11111111,%00000000
  .byte $00,$00,$00,$00,$00,$00,$00,$00
  ; Tile 3: L
  .byte %10000000,%10000000,%10000000,%10000000
  .byte %10000000,%10000000,%11111111,%00000000
  .byte $00,$00,$00,$00,$00,$00,$00,$00
  ; Tile 4: O
  .byte %01111110,%10000001,%10000001,%10000001
  .byte %10000001,%10000001,%01111110,%00000000
  .byte $00,$00,$00,$00,$00,$00,$00,$00
  ; Tile 5: W
  .byte %10000001,%10000001,%10000001,%10000001
  .byte %10010001,%10010001,%01101110,%00000000
  .byte $00,$00,$00,$00,$00,$00,$00,$00
  ; Tile 6: R
  .byte %11111110,%10000001,%10000001,%11111110
  .byte %10001000,%10000100,%10000010,%00000000
  .byte $00,$00,$00,$00,$00,$00,$00,$00
  ; Tile 7: D
  .byte %11111100,%10000010,%10000001,%10000001
  .byte %10000001,%10000010,%11111100,%00000000
  .byte $00,$00,$00,$00,$00,$00,$00,$00
FontTilesEnd:

.org $FFFA
.addr EmptyHandler, Reset, EmptyHandler
