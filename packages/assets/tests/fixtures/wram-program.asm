; Synthetic standalone image: org is file offset, base is the WRAM CPU address.
norom
arch 65816
.smart off
org $000000
base $7E8000
incsrc "wram-scene-symbols.asm"

ProgramStart:
  JSL SceneStart
  db $A5, $5A
ProgramEnd:
