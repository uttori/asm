# tests.sh
bun cli.ts ./tests/0x.asm ./tests/0x.sfc
bun cli.ts ./tests/32bitvalues.asm ./tests/32bitvalues.sfc
bun cli.ts ./tests/120freespaces.asm ./tests/120freespaces.sfc
bun cli.ts ./tests/arch-65816.asm ./tests/arch-65816.sfc
bun cli.ts ./tests/advanced-prints.asm /tests/advanced-prints.sfc @ should be empty
bun cli.ts ./tests/bankcross.asm /tests/bankcross.sfc
