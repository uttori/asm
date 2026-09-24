; The second image references a symbol in the first without a linker.
norom
arch 65816
.smart off
org $000000
base $7E5000
incsrc "wram-program-symbols.asm"

SceneStart:
  dl ProgramStart
  db $C2, $20, $A9, $34, $12, $6B
SceneEnd:
