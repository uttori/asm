; Run with the standard SNES target. These source-relative inputs are small,
; redistributable inputs for the same API used by projects.
norom
org 0

TitleTiles:
  includeAsset("data/title.png", "snes.tile.4bpp", palette: "data/title.palette.json", layout: { tileOrder: "row-major" })
TitlePalette:
  includeAsset("data/title.png", "4bpp", palette: "data/title.palette.json", output: "palette")
TitleMap:
  includeAsset("data/title.png", "4bpp", palette: "data/title.palette.json", output: "tilemap")

BellSample:
  includeAsset("data/bell.wav", "snes.brr", loop: false, padding: "reject")
BellSampleEnd:
