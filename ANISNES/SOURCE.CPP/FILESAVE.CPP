/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// FILE:    FILESAVE.CPP                                                   //
//                                                                         //
// Class:   FileSaver                                                      //
//                                                                         //
// Description:                                                            //
//                                                                         //
// This class provides the functionality to generate .SAF and .SAD         //
// animation files.                                                        //
//                                                                         //
// The .SAF file contains an entry for each animation frame. Each entry    //
// consists of an offset (4 bytes) from the start of the .SAD file data    //
// which points to the compressed data for that frame. Each entry also     //
// contains the length the uncompressed animation data (2 bytes).          //
//                                                                         //
// The .SAD file contains the compressed animation data for all animation  //
// frames.                                                                 //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// Includes                                                                //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

#include <stdio.h>
#include <string.h>
#include "filesave.h"




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// NAME:    FileSaver Constructor                                          //
//                                                                         //
// PURPOSE: Open .SAF and .SAD files using the first 4 characters from     //
//          the specified filename.                                        //
//                                                                         //
// TYPE:    Public                                                         //
//                                                                         //
// INPUTS:  char* filename                                                 //
//          This is the filename from which the first 4 characters are     //
//          extracted to form the .SAF and .SAD filenames.                 //
//                                                                         //
// OUTPUTS: None                                                           //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

FileSaver::FileSaver(char* filename)
{
    unsigned int length = 0;
    char extendedFilename[256];

    // search for end of filename or begining of extender
    while (filename[length] && (filename[length] != '.'))
    {
        // copy to extended filename
        extendedFilename[length] = filename[length];

        length++;
    }

    // if too long
    if (length > 4)
    {
        length = 4;
    }

    // .SAF == Snes Animation Frames
    strncpy(&(extendedFilename[length]), ".SAF", 5);

    // open frame file
    frameFile = fopen(extendedFilename, "wb");

    // check for error
    if (frameFile == NULL)
        printf ("Error: opening file %s\n", extendedFilename);

    // .SAD == Snes Animation Data
    strncpy(&(extendedFilename[length]), ".SAD", 5);

    // open animation file
    animationFile = fopen(extendedFilename, "wb");

    // check for error
    if (animationFile == NULL)
        printf ("Error: opening file %s\n", extendedFilename);

    // initialise animation offset
    animationOffset = 0;
}




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// NAME:    FileSaver Destructor                                           //
//                                                                         //
// PURPOSE: Write end of animation indicator to frame file and close both  //
//          .SAF and .SAD files.                                           //
//                                                                         //
// TYPE:    Public                                                         //
//                                                                         //
// INPUTS:  None                                                           //
//                                                                         //
// OUTPUTS: None                                                           //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

FileSaver::~FileSaver()
{
    BYTE value = 0xFF;

    // write out FF FF FF FF FF FF to indicate end of animation
    fwrite(&value, 1, 1, frameFile);
    fwrite(&value, 1, 1, frameFile);
    fwrite(&value, 1, 1, frameFile);
    fwrite(&value, 1, 1, frameFile);
    fwrite(&value, 1, 1, frameFile);
    fwrite(&value, 1, 1, frameFile);

    // close files
    fclose (frameFile);
    fclose (animationFile);
}




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// NAME:    saveData                                                       //
//                                                                         //
// PURPOSE: Write the frame pointers to the .SAF file and write the        //
//          specified compressed animation data to the .SAD file.          //
//                                                                         //
// TYPE:    Public                                                         //
//                                                                         //
// INPUTS:  BYTE* compressedData                                           //
//          A pointer to the compressed animation data.                    //
//                                                                         //
//          unsigned int compressedLength                                  //
//          The number of compressed bytes.                                //
//                                                                         //
//          unsigned int animationLength                                   //
//          The decompressed size of the animation data.                   //
//                                                                         //
//                                                                         //
// OUTPUTS: None                                                           //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

void FileSaver::saveData(BYTE* compressedData,
                         unsigned int compressedLength,
                         unsigned int animationLength)
{
    BYTE value;

    // if gone over a bank boundary
    if ((animationOffset & 0xFFFF) >= 0x8000)
        // then adjust to next bank
        animationOffset += 0x8000;

    // write out offset of compressed data to frame file
    value = animationOffset & 0xFF;
    printf("animationOffset & 0xFF = %02x\n", value);
    fwrite(&value, 1, 1, frameFile);

    value = (animationOffset >> 8) & 0xFF;
    printf("(animationOffset >> 8) & 0xFF = %02x\n", value);
    fwrite(&value, 1, 1, frameFile);

    value = (animationOffset >> 16) & 0xFF;
    printf("(animationOffset >> 16) & 0xFF = %02x\n", value);
    fwrite(&value, 1, 1, frameFile);

    value = (animationOffset >> 24) & 0xFF;
    printf("(animationOffset >> 24) & 0xFF = %02x\n", value);
    fwrite(&value, 1, 1, frameFile);

    // write out length of animation data to frame file
    value = animationLength & 0xFF;
    printf("animationLength & 0xFF = %02x\n", value);
    fwrite(&value, 1, 1, frameFile);

    value = animationLength >> 8;
    printf("animationLength >> 8 = %02x\n", value);
    fwrite(&value, 1, 1, frameFile);

    // write out compressed data to animation file
    fwrite(compressedData, compressedLength, 1, animationFile);

    // if gone over a bank boundary
    while (compressedLength >= 0x8000)
    {
        // then adjust to next bank
        animationOffset += 0x10000;
        compressedLength -= 0x8000;
    }

    // update animation offset
    animationOffset += compressedLength;
}
