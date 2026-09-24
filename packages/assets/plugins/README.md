# Game asset plugins

Each game plugin lives in its own directory here. Keep game-specific compression,
graphics modes and registration code together; use `@uttori/asm-assets` entry points
for native SNES tiles, palettes, maps, audio and previews.

- [Secret of Mana](secret-of-mana/README.md): `som.lz` boot/graphics compression and
  `som.tile.actor3bpp` indexed actor tiles.

Add a sibling directory for another game's formats. A new codec needs bounded decode,
exact encode/decode verification, a plugin registration and tests against both synthetic
bytes and any available reviewed ROM evidence. Research scripts may retain game-specific
pointer and capture proofs while importing the codec from this directory.
