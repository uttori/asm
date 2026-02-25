/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// FILE:    ANIMATOR.CPP                                                   //
//                                                                         //
// Class:   Animator                                                       //
//                                                                         //
// Description:                                                            //
//                                                                         //
// This class provides methods for generating the animation data between   //
// two screen images.                                                      //
//                                                                         //
// The animation data has the following format:                            //
//                                                                         //
// <word> number bytes                                                     //
// <byte> colour register                                                  //
// <byte>...<byte> colour data                                             //
// <word> number bytes                                                     //
// <byte> colour register                                                  //
// <byte>...<byte> colour data                                             //
//   .                                                                     //
//   .                                                                     //
// <word> END_OF_PALETTE                                                   //
// <word> VRAM address                                                     //
// <word> number of bytes                                                  //
// <byte>...<byte> screen data                                             //
// <word> VRAM address                                                     //
// <word> number of bytes                                                  //
// <byte>...<byte> screen data                                             //
//   .                                                                     //
//   .                                                                     //
// <word> INTERMEDIATE_FRAME                                               //
// <word> VRAM address                                                     //
// <word> number of bytes                                                  //
// <byte>...<byte> screen data                                             //
// <word> VRAM address                                                     //
// <word> number of bytes                                                  //
// <byte>...<byte> screen data                                             //
//   .                                                                     //
//   .                                                                     //
// <word> END_OF_FRAME                                                     //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// Includes                                                                //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

#include <stdio.h>
// #include <mem.h>
#include <string.h>
#include "pcxfile.h"
#include "animator.h"
#include "consts.h"




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// NAME:    writeWord                                                      //
//                                                                         //
// PURPOSE: Write the specified word out in low byte, high byte format.    //
//                                                                         //
// TYPE:    Private                                                        //
//                                                                         //
// INPUTS:  unsigned int word                                              //
//          The word to write out.                                         //
//                                                                         //
//          unsigned int& animationIndex                                   //
//          The index into the animation data at which to write the word.  //
//                                                                         //
// OUTPUTS: BYTE*                                                          //
//          The animation data.                                            //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

void Animator::writeWord(unsigned int word, unsigned int& animationIndex, BYTE* animationData) {
    // write out low byte
    animationData[animationIndex++] = word&0x00FF;

    // write out high byte
    animationData[animationIndex++] = word>>8;
}




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// NAME:    writeOutFirstScreenData                                        //
//                                                                         //
// PURPOSE: Write out all the animation data for the very first frame.     //
//          Note that it is assumed the screen will be disabled when the   //
//          first frame is output.                                         //
//                                                                         //
// TYPE:    Public                                                         //
//                                                                         //
// INPUTS:  PcxFile* screen                                                //
//          The first screen.                                              //
//                                                                         //
// OUTPUTS: BYTE* animationData                                            //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

unsigned int Animator::writeOutFirstScreenData(PcxFile* screen, BYTE* animationData) {
    printf("Animator::writeOutFirstScreenData\n");
    unsigned int animationIndex = 0;

    // write out number of colour palette bytes
    writeWord(0x0200, animationIndex, animationData);

    // write out colour register $00
    animationData[animationIndex++] = 0x00;

    // write out value of all colour registers
    for (unsigned int index = 0; index < 256; index++) {
        animationData[animationIndex++] = screen->snesPalette[index] & 0xFF;
        animationData[animationIndex++] = screen->snesPalette[index] >> 8;
    }

    writeWord(END_OF_PALETTE, animationIndex, animationData);

    // write out VRAM address $0000
    writeWord(0x0000, animationIndex, animationData);

    // write out length
    writeWord(NUM_DISPLAY_BYTES, animationIndex, animationData);

    // write out data
    memcpy (&(animationData[animationIndex]), screen->snesData, NUM_DISPLAY_BYTES);

    animationIndex += NUM_DISPLAY_BYTES;

    writeWord(END_OF_FRAME, animationIndex, animationData);

    return animationIndex;
}

/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// NAME:    evaluateDifferences                                            //
//                                                                         //
// PURPOSE: This method writes out all the colour palette differences and  //
//          all the screen data differences between the 2 screens to the   //
//          animation data.                                                //
//                                                                         //
//          Note that because the SNES can only output so much screen      //
//          data during the vertical blank period, a single animation      //
//          frame may be split accross many frames.                        //
//                                                                         //
// TYPE:    Public                                                         //
//                                                                         //
// INPUTS:  PcxFile* screen1                                               //
//          The first screen.                                              //
//                                                                         //
//          PcxFile* screen2                                               //
//          The second screen.                                             //
//                                                                         //
// OUTPUTS: BYTE* animationData                                            //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

unsigned int Animator::evaluateDifferences(PcxFile* screen1, PcxFile* screen2, BYTE* animationData) {
    printf("Animator::evaluateDifferences\n");
    unsigned int index = 0;
    unsigned int animationIndex = 0;
    unsigned int byteCount = 0;
    printf("Animator::evaluateDifferences animationIndex: %u\n", animationIndex);

    // loop over all colour registers
    while (index < 256) {
        // if colour registers are different
        if (screen1->snesPalette[index] != screen2->snesPalette[index]) {
            printf("Animator::evaluateDifferences different at index: %u\n", index);
            unsigned int startIndex = index;

            // find end of colour palette differences
            index = findColourChangeEnd(startIndex, screen1, screen2);

            // update weighted byte count
            byteCount += OVERHEAD_PER_DMA_XFER + (index - startIndex);

            // write out the number of bytes of colour palette data
            writeWord((index-startIndex)<<1,
                      animationIndex,
                      animationData);

            // write out the colour palette number
            animationData[animationIndex++] = startIndex;

            // write out all colour palette data
            for (unsigned int loop = startIndex; loop < index; loop++)
            {
                animationData[animationIndex++] = screen2->snesPalette[loop] & 0xFF;
                animationData[animationIndex++] = screen2->snesPalette[loop] >> 8;
            }
        } else {
            index++;
        }
    }

    printf("Animator::evaluateDifferences END_OF_PALETTE: %u\n", animationIndex);
    writeWord(END_OF_PALETTE, animationIndex, animationData);

    // initialise index into screen data
    index = 0;

    // while more data to check
    while (index < NUM_DISPLAY_BYTES) {
        // if screens are different
        if (screen1->snesData[index] != screen2->snesData[index]) {
            printf("Animator::evaluateDifferences different pixel at index: %u\n", index);
            unsigned int startIndex;

            // if not at a word VRAM boundary
            if (index & 0x0001)
                // position to previous VRAM boundary
                index--;

            // record index at which difference started
            startIndex = index;

            // search until screens no longer different
            index = findAnimateEnd(startIndex, screen1, screen2);

            // update weighted byte count
            byteCount += OVERHEAD_PER_DMA_XFER + (index - startIndex);

            // if too many bytes output
            if (byteCount >= MAX_BYTES_PER_FRAME)
            {
                // then insert an intermediate frame
                writeWord(INTERMEDIATE_FRAME,
                          animationIndex,
                          animationData);

                // and reset byte count
                byteCount = 0;
            }

            // write out VRAM address
            writeWord(startIndex>>1,
                      animationIndex,
                      animationData);

            // write out number of bytes
            writeWord(index - startIndex,
                      animationIndex,
                      animationData);

            // write out changed data
            memcpy (&(animationData[animationIndex]),
                    &(screen2->snesData[startIndex]),
                    index - startIndex);

            // update animation index
            animationIndex += (index - startIndex);
        } else {
            index++;
        }
    }

    printf("Animator::evaluateDifferences END_OF_FRAME: %u\n", animationIndex);
    writeWord(END_OF_FRAME, animationIndex, animationData);

    printf("Animator::evaluateDifferences animationIndex: %u\n", animationIndex);;
    return animationIndex;
}




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// NAME:    findColourChangeEnd                                            //
//                                                                         //
// PURPOSE: This method finds the index position at which the colour       //
//          registers are no longer different.                             //
//                                                                         //
// TYPE:    Private                                                        //
//                                                                         //
// INPUTS:  unsigned int startIndex                                        //
//          The index into the colour registers where the first difference //
//          has been found.                                                //
//                                                                         //
//          PcxFile* screen1                                               //
//          The first screen.                                              //
//                                                                         //
//          PcxFile* screen2                                               //
//          The second screen.                                             //
//                                                                         //
// OUTPUTS: unsigned int                                                   //
//          Returns the index position at which the colour registers are   //
//          no longer different.                                           //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

unsigned int Animator::findColourChangeEnd(unsigned int startIndex, PcxFile* screen1, PcxFile* screen2) {
    printf("Animator::findColourChangeEnd\n");
    unsigned int index = startIndex;
    unsigned int sameCount = 0;
    unsigned int lastIndex;
    BOOL finished = FALSE;

    while (!finished) {
        // if more colour registers
        if (index < 256) {
            // if registers different
            if (screen1->snesPalette[index] != screen2->snesPalette[index]) {
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

                    finished = TRUE;
                }
            }
        } else {
            // if some registers were the same
            if (sameCount) {
                // then return to last different index
                index = lastIndex;
            }

            finished = TRUE;
        }
    }

    return index;
}




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// NAME:    findAnimatedEnd                                                //
//                                                                         //
// PURPOSE: This method finds the index position at which the screen       //
//          data is no longer different.                                   //
//                                                                         //
// TYPE:    Private                                                        //
//                                                                         //
// INPUTS:  unsigned int startIndex                                        //
//          The index into the screen data where the first difference      //
//          has been found.                                                //
//                                                                         //
//          PcxFile* screen1                                               //
//          The first screen.                                              //
//                                                                         //
//          PcxFile* screen2                                               //
//          The second screen.                                             //
//                                                                         //
// OUTPUTS: unsigned int                                                   //
//          Returns the index position at which the screen data is         //
//          no longer different.                                           //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

unsigned int Animator::findAnimateEnd(unsigned int startIndex, PcxFile* screen1, PcxFile* screen2) {
    printf("Animator::findAnimateEnd\n");
    unsigned int index = startIndex;
    unsigned int totalCount = 0;
    unsigned int sameCount = 0;
    unsigned int lastIndex;
    BOOL finished = FALSE;

    while (!finished) {
        // if more screen data
        if (index < NUM_DISPLAY_BYTES) {
            // if screen data is different
            if ((screen1->snesData[index] != screen2->snesData[index]) || (screen1->snesData[index+1] != screen2->snesData[index+1])) {
                // update index
                index += 2;

                // update total number of words
                totalCount++;

                // if too many words
                if (totalCount >= MAX_WORDS_PER_DMA_XFER) {
                    finished = TRUE;
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
                    finished = TRUE;
                } else {
                    // update total number of words
                    totalCount++;

                    // if too many words
                    if (totalCount >= MAX_WORDS_PER_DMA_XFER) {
                        // then return to last different index
                        index = lastIndex;
                        finished = TRUE;
                    }
                }
            }
        } else {
            // if some words were the same
            if (sameCount) {
                // then return to last different index
                index = lastIndex;
            }

            finished = TRUE;
        }
    }

    return index;
}
