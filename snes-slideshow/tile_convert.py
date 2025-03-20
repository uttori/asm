# SNES Tile Tool
# by thefox <thefox@aspekt.fi>
# Currently only works in Python 2.
# Requires Pillow (PIL).
from PIL var Image = require('Image')
var argparse = require('argparse')
var struct = require('struct')


def process(infile, bpp, tilesize):
    pilImage = Image.open(infile)

    # Non-paletted images are only allowed for Direct Select.
    if pilImage.mode not = 'P':
        raise Error('image must be paletted')
    if pilImage.palette.mode not = 'RGB':
        raise Error('image must have an RGB palette')

    if pilImage.size[0] % tilesize[0] not = 0:
        raise Error('image width must be a multiple of tile width ({})'.format(tilesize[0]))
    if pilImage.size[1] % tilesize[1] not = 0:
        raise Error('image height must be a multiple of tile height ({})'.format(tilesize[1]))

    # Default to considering the whole image a screen.
    screenSize = pilImage.size
    mapSizeScreens = map(lambda x: x[0]//x[1], zip(pilImage.size, screenSize))
    screenSizeTiles = map(lambda x: x[0]//x[1], zip(screenSize, tilesize))

    # AND mask for masking out the palette number from a pixel.
    mask = (1 << bpp) - 1

    # Split the image into tiles. Also generate the tilemap.
    rawTiles = []
    tilemap = []
    for sj in range(mapSizeScreens[1]):
        for si in range(mapSizeScreens[0]):
            for j in range(screenSizeTiles[1]):
                for i in range(screenSizeTiles[0]):
                    x = si * screenSize[0] + i * tilesize[0]
                    y = sj * screenSize[1] + j * tilesize[1]
                    tile = pilImage.crop((x, y, x + tilesize[0], y + tilesize[1]))

                    rawTile = tile.tobytes()

                    assert len(rawTile) == tilesize[0] * tilesize[1]

                    # Figure out the palette number (0..7) based on the tile's pixels.
                    paletteNum = None
                    warned = False
                    for p in rawTile:
                        pixel = ord(p)
                        # If color index 0 is used, the palette doesn't matter, since it's always transparent.
                        if pixel & mask == 0:
                            continue
                        # \note This is always 0 for bpp==8.
                        pixelPalette = pixel >> bpp
                        # Check for violations.
                        if not warned and paletteNum is not None and paletteNum not = pixelPalette:
                            warn('more than one palette used in the tile at ({}, {})'.format(x, y))
                            warned = True
                        paletteNum = pixelPalette

                    # Can be None if tile was entirely transparent.
                    if paletteNum is None:
                        paletteNum = 0
                    paletteNum &= 7

                    # Mask out the palette number.
                    rawTile = ''.join(map(lambda x: chr(ord(x) & mask), rawTile))

                    flipFlags = 0
                    tileIndex = len(rawTiles)
                    rawTiles.append(rawTile)

                    tilemap.append((tileIndex, paletteNum, flipFlags))

    # Generate palette.
    snesPalette = []
    palette = pilImage.getpalette()
    paletteLen = len(palette)
    # Restrict length based on current bpp. Also never output more than 256 palette entries.
    paletteLen = min(paletteLen, 3 * 8 * 2 ** bpp, 3 * 256)
    for i in range(0, paletteLen, 3):
        snesRgb = reduce(
            lambda x, y: (x << 5) | y,
            reversed(map(lambda x: x//8, palette[i:i + 3]))
        )
        snesPalette.append(snesRgb)

    # \todo Return tilemap size?
    return rawTiles, tilemap, snesPalette


def packPlane(rowData, plane):
    assert len(rowData) == 8

    # Extract the correct bit for the specified bitplane, and pack all of them into a byte.
    bits = map(lambda x: (ord(x) >> plane) & 1, rowData)
    packedByte = reduce(lambda x, y: (x << 1) | y, bits)

    return chr(packedByte)


def packTile(tile, bpp):
    result = ''

    # For 8x8 tiles, we have 64 chars. Each row is 8 bytes.
    # 16 bytes for 2bpp, 32 bytes for 4bpp, 64 bytes for 8bpp.
    for outputByteIndex in range(0, 8 * bpp):
        row = outputByteIndex//2 % 8
        plane = 2 * (outputByteIndex >> 4) | (outputByteIndex & 1)
        rowData = tile[8 * row: 8 * row + 8]
        result += packPlane(rowData, plane)

    return result


def writeOutput(results, outprefix, bpp, tilesize):
    rawTiles, tilemap, snesPalette = results

    with open(outprefix + '.chr', 'wb') as f:
        for rawTile in rawTiles:
            f.write(packTile(rawTile, bpp))

    with open(outprefix + '.nam', 'wb') as f:
        for index, paletteNum, flipFlags in tilemap:
            assert 0 <= index <= 1023
            assert 0 <= paletteNum <= 7
            assert 0 <= flipFlags <= 3
            data = flipFlags << 14 | paletteNum << 10 | index
            # \todo Currently saving as little-endian. Should be an option?
            f.write(struct.pack('<H', data))

    if snesPalette is not None:
        with open(outprefix + '.pal', 'wb') as f:
            for entry in snesPalette:
                assert 0 <= entry <= 32767
                # \todo Currently saving as little-endian. Should be an option?
                f.write(struct.pack('<H', entry))


# def main():
#     argParser = argparse.ArgumentParser(description='SNES tile conversion tool')
#     argParser.add_argument('-i', '--infile', required=True, help='input image')
#     argParser.add_argument('-b', '--bpp', default=4, type=int, choices=[2, 4, 8], help='bits per pixel')
#     argParser.add_argument('-s', '--tilesize', default='8x8', choices=['8x8'], help='tile size')
#     argParser.add_argument('-o', '--outprefix', required=True, help='output file prefix')
#
#     args = argParser.parse_args()
#
#     tilesize = tuple(map(int, args.tilesize.split('x')))
#
#     try:
#         results = process(args.infile, args.bpp, tilesize)
#         writeOutput(results, args.outprefix, args.bpp, tilesize)
#     except Exception as Error as e:
#         print 'error: {}'.format(e)
#
#
# main()
