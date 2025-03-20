const process = require('process');
const fs = require('fs');
const path = require('path');
const PNG = require('pngjs').PNG;

// PCXFILE
class SNESImage {
  constructor(data) {
    this.data = data;
    this.snesPalette = Buffer.alloc(1024, 0);
    this.outputData = [];
    this.snesData = Buffer.alloc(64000); // width * height

    this.parsePixelData();
    this.convertToSnesData8bpp();

    fs.writeFileSync('test.palette', this.snesPalette);
    fs.writeFileSync('test.snes_data', Buffer.from(this.outputData));
  }

  parsePixelData() {
    const indexedColors = new Array(256);// [];
    const indexedPixelData = [];

    let index = 0;
    let colors = 0;
    for (index = 0; index < this.data.data.length; index += 4) {
      // convert from 8-bit RGB to 5-bit RGB
      const color = (this.data.data[index] >> 3)
                | ((this.data.data[index + 1] >> 3) << 5)
                | ((this.data.data[index + 2] >> 3) << 10);

      // Is this a new color?
      if (!indexedColors.includes(color)) {
        indexedColors[colors] = color;// (color);
        colors++;
      }

      const key = indexedColors.indexOf(color);
      indexedPixelData.push(key);
    }

    this.snesPalette = Uint32Array.from(indexedColors);
    this.snesData = Uint8ClampedArray.from(indexedPixelData);
  }

  // Toinvert: PCColor = ((SNESColor << 19) & 0xF80000) | ((SNESColor << 6) & 0xF800) | ((SNESColor >> 7) & 0xF8);
  static convertRGBtoSNES(red, green, blue) {
    // Convert RGB to integer
    const rgb = ((red & 0x0ff) << 16) | ((green & 0x0ff) << 8) | (blue & 0x0ff);

    // Convert integer to SNES RGB integer
    const snes_r = (rgb & 0xF80000) >> 19;
    const snes_g = (rgb & 0x00F800) >> 6;
    const snes_b = (rgb & 0x0000F8) << 7;
    const snes_int = snes_b | snes_g | snes_r;

    return [Math.floor(blue / 8), Math.floor(green / 8), Math.floor(red / 8), snes_int];
  }

  getBitPlane(x, y, line, plane) {
    let bitPlane = 0;
    const offset = 320 * ((y << 3) + line) + (x << 3) + 32;
    const displayPtr = this.snesData.slice(offset, offset + 8);
    /* loop over 8 pixels */
    let index = 0;
    for (index = 0; index < 8; index++) {
      /* if the bit in this plane is set */
      if (displayPtr[index] & (0x01 << plane)) {
        /* then set it in our character's bit plane */
        bitPlane |= (0x80 >> index);
      }
    }
    return bitPlane;
  }

  convertToSnesData8bpp() {
    let index = 0;
    let y = 0;
    let x = 0;
    let pass = 0;
    let line = 0;
    let plane = 0;

    // allocate memory to hold SNES screen data
    this.outputData = []; // new BYTE[51200];
    // loop over every row of characters
    for (y = 0; y < 25; y++) {
      // loop over every character in the row
      for (x = 0; x < 32; x++) {
        // make 4 passes over 256 colour data
        for (pass = 0; pass < 4; pass++) {
          // loop over 8 scan lines per character
          for (line = 0; line < 8; line++) {
            // loop over 2 colour planes on each pass
            for (plane = 0; plane < 2; plane++) {
              this.outputData[index++] = this.getBitPlane(x, y, line, (pass << 1) + plane);
            }
          }
        }
      }
    }
  }
}

// the number of bytes in a 256x200 pixel 256 colour display
const NUM_DISPLAY_BYTES = 0xC800;

// the maximum number of bytes that can be updated during the vertical blank
const MAX_BYTES_PER_FRAME = 0x2800;

// the overhead of performing a DMA operation, expressed in terms of the number of bytes which could be transferred in that time
const OVERHEAD_PER_DMA_XFER = 0x80;

// the maximum number of continuous words that may be tranferred in a single DMA operation
const MAX_WORDS_PER_DMA_XFER = 0x400;

// the number of consecutive words that need to be the same in order to terminate a DMA transfer
const NUM_WORDS_SAME = 0x20;

const END_OF_PALETTE = 0xFFFF;
const END_OF_FRAME = 0xFFFF;
const INTERMEDIATE_FRAME = 0xFFFE;

class Animator {
  constructor() {
    this.animationData = [];
    this.animationIndex = 0;
  }

  writeWord(value, index) {
    // write out low byte
    this.animationData[index++] = value & 0x00FF;
    // write out high byte
    this.animationData[index++] = value >> 8;

    return index;
  }

  writeOutFirstScreenData(screen) {
    // write out number of colour palette bytes
    this.animationIndex = this.writeWord(0x0200, this.animationIndex);

    // write out colour register $00
    this.animationData[this.animationIndex++] = 0x00;

    // write out value of all colour registers
    let index = 0;
    for (index = 0; index < 256; index++) {
      this.animationData[this.animationIndex++] = screen.snesPalette[index] & 0xFF;
      this.animationData[this.animationIndex++] = screen.snesPalette[index] >> 8;
    }

    this.animationIndex = this.writeWord(END_OF_PALETTE, this.animationIndex);

    // write out VRAM address $0000
    this.animationIndex = this.writeWord(0x0000, this.animationIndex);

    // write out length
    this.animationIndex = this.writeWord(NUM_DISPLAY_BYTES, this.animationIndex);

    // write out data
    // memcpy(&(animationData[animationIndex]), screen->snesData, NUM_DISPLAY_BYTES);
    if (screen.outputData.length !== NUM_DISPLAY_BYTES) {
      console.error(`Screen SNES Data incorrect length! ${screen.outputData.length} !== ${NUM_DISPLAY_BYTES}`);
    }
    // this.animationData[this.animationIndex] = screen.outputData.slice(0, NUM_DISPLAY_BYTES);
    screen.outputData.forEach(value => {
      this.animationData[this.animationIndex++] = value;
    });

    // this.animationIndex += NUM_DISPLAY_BYTES;

    this.animationIndex = this.writeWord(END_OF_FRAME, this.animationIndex);

    return [this.animationIndex, this.animationData];
  }

  evaluateDifferences(screen1, screen2) {
    let index = 0;
    // TODO: Is this really local?
    let animationIndex = 0;
    let byteCount = 0;

    // loop over all colour registers
    while (index < 256) {
      // if colour registers are different
      if (screen1.snesPalette[index] !== screen2.snesPalette[index]) {
        const startIndex = index;

        // find end of colour palette differences
        index = this.findColourChangeEnd(startIndex, screen1, screen2);

        // update weighted byte count
        byteCount += OVERHEAD_PER_DMA_XFER + (index - startIndex);

        // write out the number of bytes of colour palette data
        animationIndex = this.writeWord((index - startIndex) << 1, animationIndex);

        // write out the colour palette number
        this.animationData[animationIndex++] = startIndex;

        // write out all colour palette data
        let loop;
        for (loop = startIndex; loop < index; loop++) {
          this.animationData[animationIndex++] = screen2.snesPalette[loop] & 0xFF;
          this.animationData[animationIndex++] = screen2.snesPalette[loop] >> 8;
        }
      } else index++;
    }

    animationIndex = this.writeWord(END_OF_PALETTE, animationIndex);

    // initialise index into screen data
    index = 0;

    // while more data to check
    while (index < NUM_DISPLAY_BYTES) {
      // if screens are different
      if (screen1.outputData[index] !== screen2.outputData[index]) {
        // if not at a word VRAM boundary
        if (index & 0x0001) {
          // position to previous VRAM boundary
          index--;
        }

        // record index at which difference started
        const startIndex = index;

        // search until screens no longer different
        index = this.findAnimateEnd(startIndex, screen1, screen2);

        // update weighted byte count
        byteCount += OVERHEAD_PER_DMA_XFER + (index - startIndex);

        // if too many bytes output
        if (byteCount >= MAX_BYTES_PER_FRAME) {
          // then insert an intermediate frame
          animationIndex = this.writeWord(INTERMEDIATE_FRAME, animationIndex);

          // and reset byte count
          byteCount = 0;
        }

        // write out VRAM address
        animationIndex = this.writeWord(startIndex >> 1, animationIndex);

        // write out number of bytes
        animationIndex = this.writeWord(index - startIndex, animationIndex);

        // write out changed data
        // memcpy (&(animationData[animationIndex]), &(screen2->snesData[startIndex]), index - startIndex);
        // this.animationData[animationIndex] = screen2.outputData[startIndex];
        let i = startIndex;
        for (i = startIndex; i < index - startIndex; i++) {
          this.animationData[animationIndex++] = screen2.outputData[startIndex + index];
        }
        // screen.outputData.forEach(value => {
        //   this.animationData[this.animationIndex++] = value;
        // });

        // update animation index
        // this.animationIndex += (index - startIndex);
      } else {
        index++;
      }
    }

    animationIndex = this.writeWord(END_OF_FRAME, animationIndex);

    return [animationIndex, this.animationData];
  }

  findColourChangeEnd(startIndex, screen1, screen2) {
    let index = startIndex;
    let sameCount = 0;
    let lastIndex;
    let finished = false;

    while (!finished) {
      // if more colour registers
      if (index < 256) {
        // if registers different
        if (screen1.snesPalette[index] !== screen2.snesPalette[index]) {
          // update index
          index++;

          // indicate registers different at this position
          sameCount = 0;
          lastIndex = index;
        } else {
          // update index
          index++;

          // update number of registers that are the same
          sameCount++;

          // if enough registers are the same
          if (sameCount >= NUM_WORDS_SAME) {
            // then return index to the last different index
            index = lastIndex;

            finished = true;
          }
        }
      } else {
        // if some registers were the same
        if (sameCount) {
          // then return to last different index
          index = lastIndex;
        }

        finished = true;
      }
    }

    return index;
  }

  findAnimateEnd(startIndex, screen1, screen2) {
    let index = startIndex;
    let totalCount = 0;
    let sameCount = 0;
    let lastIndex;
    let finished = false;

    while (!finished) {
      // if more screen data
      if (index < NUM_DISPLAY_BYTES) {
        // if screen data is different
        if ((screen1.outputData[index] !== screen2.outputData[index]) || (screen1.outputData[index + 1] !== screen2.outputData[index + 1])) {
          // update index
          index += 2;

          // update total number of words
          totalCount++;

          // if too many words
          if (totalCount >= MAX_WORDS_PER_DMA_XFER) {
            finished = true;
          } else {
            // indicate screen data different at this position
            sameCount = 0;
            lastIndex = index;
          }
        } else {
          // update index
          index += 2;

          // update number of words that are the same
          sameCount++;

          // if enough screen data words are the same
          if (sameCount >= NUM_WORDS_SAME) {
            // then return to last different index
            index = lastIndex;
            finished = true;
          } else {
            // update total number of words
            totalCount++;

            // if too many words
            if (totalCount >= MAX_WORDS_PER_DMA_XFER) {
              // then return to last different index
              index = lastIndex;
              finished = true;
            }
          }
        }
      } else {
        // if some words were the same
        if (sameCount) {
          // then return to last different index
          index = lastIndex;
        }

        finished = true;
      }
    }

    return index;
  }
}

class Compressor {
  constructor() {
    this.REPEAT_INDICATOR = 0x00;
    this.COLLECTION_INDICATOR = 0x80;

    this.sourceData = new Uint8ClampedArray();
    this.sourceLength = 0;
    this.sourceIndex = 0;

    this.destinationData = [];
    this.destinationIndex = 0;

    this.repeatCode = new Uint8ClampedArray(1);
    this.repeatCount = 0;

    this.collectionCodes = new Uint8ClampedArray(128);
    this.collectionCount = 0;

    this.previousCode = new Uint8ClampedArray(1);
    this.nextCode = new Uint8ClampedArray(1);

    this.state = '';
    // enum {
    //   nothingRead,
    //   oneCodeRead,
    //   buildRepeatString,
    //   buildCollectionString,
    //   finished
    // } state;
  }

  // This method is invoked when no bytes have been read from the source data.
  nothingReadProcessing() {
    // get first byte from source data
    this.previousCode = this.sourceData[this.sourceIndex];

    // update index into source data
    this.sourceIndex += 2;

    // if more source data
    if (this.sourceIndex < this.sourceLength) {
      // update state
      this.state = 'oneCodeRead';
    } else {
      // write out compressed data
      this.destinationData[this.destinationIndex++] = this.COLLECTION_INDICATOR;
      this.destinationData[this.destinationIndex++] = this.previousCode;

      // indicate compression finished
      this.state = 'finished';
    }
  }

  // This method is invoked when one byte has been read from the source data.
  oneCodeReadProcessing() {
    // get second byte from source data
    this.nextCode = this.sourceData[this.sourceIndex];

    // update index into source data
    this.sourceIndex += 2;

    // if more source data
    if (this.sourceIndex < this.sourceLength) {
      // if bytes are the same
      if (this.previousCode === this.nextCode) {
        // then start building a repeat string
        this.repeatCode = this.previousCode;
        this.repeatCount = 2;
        this.state = 'buildRepeatString';
      } else {
        // else start building a collection string
        this.collectionCount = 0;
        this.collectionCodes[this.collectionCount++] = this.previousCode;
        this.collectionCodes[this.collectionCount++] = this.nextCode;
        this.state = 'buildCollectionString';
      }
    } else {
      // if bytes are the same
      if (this.previousCode === this.nextCode) {
        // then write out a repeat string
        this.destinationData[this.destinationIndex++] = this.REPEAT_INDICATOR | 0x01;
        this.destinationData[this.destinationIndex++] = this.previousCode;
      } else {
        // else write out a collection string
        this.destinationData[this.destinationIndex++] = this.COLLECTION_INDICATOR | 0x01;
        this.destinationData[this.destinationIndex++] = this.previousCode;
        this.destinationData[this.destinationIndex++] = this.nextCode;
      }

      // indicate compression finished
      this.state = 'finished';
    }
  }

  // This method is invoked when a number of repeated bytes have been read from the source data.
  buildRepeatStringProcessing() {
    // get next byte from source data
    this.nextCode = this.sourceData[this.sourceIndex];

    // if it's the same as the repeat string we're building
    if (this.repeatCode === this.nextCode) {
      // update count on times byte repeated
      this.repeatCount++;

      // update index into source data
      this.sourceIndex += 2;

      // if more source data
      if (this.sourceIndex < this.sourceLength) {
        // if maximum repeat count
        if (this.repeatCount === 128) {
          // then write out repeat string
          this.destinationData[this.destinationIndex++] = this.REPEAT_INDICATOR | (this.repeatCount - 1);
          this.destinationData[this.destinationIndex++] = this.repeatCode;

          // return to nothing read state
          this.state = 'nothingRead';
        }
      } else {
        // else write out repeat string
        this.destinationData[this.destinationIndex++] = this.REPEAT_INDICATOR | (this.repeatCount - 1);
        this.destinationData[this.destinationIndex++] = this.repeatCode;

        // indicate compression finished
        this.state = 'finished';
      }
    } else {
      // write out repeat string
      this.destinationData[this.destinationIndex++] = this.REPEAT_INDICATOR | (this.repeatCount - 1);
      this.destinationData[this.destinationIndex++] = this.repeatCode;

      // return to nothing read state
      this.state = 'nothingRead';
    }
  }

  // This method is invoked when a number of different bytes have been read from the source data.
  buildCollectionStringProcessing() {
    // get next byte from source data
    this.nextCode = this.sourceData[this.sourceIndex];

    // if it is the same as the last byte read in the collection string
    if (this.nextCode === this.collectionCodes[this.collectionCount - 1]) {
      // decrement the number of bytes in the collection string
      this.collectionCount--;

      // if there are some bytes left in the collection string
      if (this.collectionCount) {
        // write out the collection string
        this.destinationData[this.destinationIndex++] = this.COLLECTION_INDICATOR | (this.collectionCount - 1);
        let index = 0;
        for (index = 0; index < this.collectionCount; index++) {
          this.destinationData[this.destinationIndex++] = this.collectionCodes[index];
        }
      }

      // start building a repeat string
      this.repeatCode = this.nextCode;
      this.repeatCount = 1;
      this.state = 'buildRepeatString';
    } else {
      // add byte to the collection string
      this.collectionCodes[this.collectionCount++] = this.nextCode;

      // update index into source data
      this.sourceIndex += 2;

      // if more source data
      if (this.sourceIndex < this.sourceLength) {
        // if maximum collection count
        if (this.collectionCount === 128) {
          // then write out collection string
          this.destinationData[this.destinationIndex++] = this.COLLECTION_INDICATOR | (this.collectionCount - 1);
          let index = 0;
          for (index = 0; index < this.collectionCount; index++) {
            this.destinationData[this.destinationIndex++] = this.collectionCodes[index];
          }

          // return to nothing read state
          this.state = 'nothingRead';
        }
      } else {
        // else write out collection string
        this.destinationData[this.destinationIndex++] = this.COLLECTION_INDICATOR | (this.collectionCount - 1);
        let index = 0;
        for (index = 0; index < this.collectionCount; index++) {
          this.destinationData[this.destinationIndex++] = this.collectionCodes[index];
        }

        // indicate compression finished
        this.state = 'finished';
      }
    }
  }

  // This method will compress the specified source data bytes into the area pointed to by the destination data pointer.
  compress(data) {
    this.sourceData = Uint8Array.from(data);
    this.sourceLength = this.sourceData.byteLength;

    // make 2 passes over the source data, once over even bytes, once over odd bytes
    let pass = 0;
    for (pass = 0; pass < 2; pass++) {
      this.sourceIndex = pass;
      this.state = 'nothingRead';

      // while compressing
      while (this.state !== 'finished') {
        switch (this.state) {
          case 'nothingRead':
            this.nothingReadProcessing();
            break;

          case 'oneCodeRead':
            this.oneCodeReadProcessing();
            break;

          case 'buildRepeatString':
            this.buildRepeatStringProcessing();
            break;

          case 'buildCollectionString':
            this.buildCollectionStringProcessing();
            break;
          default:
            console.error('Unknown State:', this.state);
            break;
        }
      }
    }

    // return the number of bytes the source data was compressed into
    return [this.destinationIndex, this.destinationData];
  }
}

class FileWriter {
  constructor() {
    this.frameFileData = [];
    this.animationOffset = 0;
  }

  closeFile(compressedData) {
    // write out FF FF FF FF FF FF to indicate end of animation
    let value = new Uint8ClampedArray(1);
    value = 0xFF;
    this.frameFileData.push(value); // fwrite(value, 1, 1, frameFile);
    this.frameFileData.push(value); // fwrite(value, 1, 1, frameFile);
    this.frameFileData.push(value); // fwrite(value, 1, 1, frameFile);
    this.frameFileData.push(value); // fwrite(value, 1, 1, frameFile);
    this.frameFileData.push(value); // fwrite(value, 1, 1, frameFile);
    this.frameFileData.push(value); // fwrite(value, 1, 1, frameFile);

    console.log('frameFileData', Uint16Array.from(this.frameFileData));
    fs.writeFileSync('test.saf', Buffer.from(Uint8ClampedArray.from(this.frameFileData)));

    // write out compressed data to animation file
    // fwrite(compressedData, compressedLength, 1, animationFile);
    fs.writeFileSync('test.sad', Buffer.from(compressedData));
  }

  saveData(compressedLength, animationLength) {
    let value = new Uint8ClampedArray(1);

    // if gone over a bank boundary
    if ((this.animationOffset & 0xFFFF) >= 0x8000) {
      // then adjust to next bank
      this.animationOffset += 0x8000;
    }

    // write out offset of compressed data to frame file
    value = this.animationOffset & 0xFF;
    this.frameFileData.push(value); // fwrite(value, 1, 1, frameFile);
    console.log(`animationOffset & 0xFF = ${value.toString(16)}`);

    value = (this.animationOffset >> 8) & 0xFF;
    this.frameFileData.push(value); // fwrite(value, 1, 1, frameFile);
    console.log(`(animationOffset >> 8) & 0xFF = ${value.toString(16)}`);

    value = (this.animationOffset >> 16) & 0xFF;
    this.frameFileData.push(value); // fwrite(value, 1, 1, frameFile);
    console.log(`(animationOffset >> 16) & 0xFF = ${value.toString(16)}`);

    value = (this.animationOffset >> 24) & 0xFF;
    this.frameFileData.push(value); // fwrite(value, 1, 1, frameFile);
    console.log(`(animationOffset >> 24) & 0xFF = ${value.toString(16)}`);

    // write out length of animation data to frame file
    value = animationLength & 0xFF;
    this.frameFileData.push(value); // fwrite(value, 1, 1, frameFile);
    console.log(`animationLength & 0xFF = ${value.toString(16)}`);

    value = animationLength >> 8;
    this.frameFileData.push(value); // fwrite(value, 1, 1, frameFile);
    console.log(`animationLength >> 8 = ${value.toString(16)}`);

    // if gone over a bank boundary
    while (compressedLength >= 0x8000) {
      // then adjust to next bank
      this.animationOffset += 0x10000;
      compressedLength -= 0x8000;
    }

    // update animation offset
    this.animationOffset += compressedLength;
  }
}

// Read Folder
fs.readdir(process.argv[2], (err, items) => {
  for (let i = 0; i < items.length; i++) {
    const file = path.join(process.argv[2], items[i]);
    console.log('File:', file);
    const data = fs.readFileSync(file);
    const png = PNG.sync.read(data);


    const fileSaver = new FileWriter();
    const compressor = new Compressor();
    const animator = new Animator();
    const screen = new SNESImage(png);
    // const screenLast = new SNESImage(png);

    // Animation Data
    let compressedLength = 0;
    let compressedData = [];
    let animationData = []; // unsigned char* animationData;
    let animationLength = 0; // unsigned int animationLength;
    // const totalAnimationLength = 0; // unsigned long totalAnimationLength;

    [animationLength, animationData] = animator.writeOutFirstScreenData(screen, animationData);

    [compressedLength, compressedData] = compressor.compress(animationData);

    fileSaver.saveData(compressedLength, animationLength);

    // Loop through next files

    // Last File
    // [animationLength, animationData] = animator.evaluateDifferences(screen, screenLast);
    //
    // [compressedLength, compressedData] = compressor.compress(animationData);

    fileSaver.saveData(compressedLength, animationLength);

    fileSaver.closeFile(compressedData);

    // animationData = Uint32Array.from(animationData);
    // fs.writeFileSync('test.animation_data', Buffer.from(animator.animationData));
  }
});
