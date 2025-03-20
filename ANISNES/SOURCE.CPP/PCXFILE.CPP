/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// FILE:    PCXFILE.CPP                                                    //
//                                                                         //
// Class:   PcxFile                                                        //
//                                                                         //
// Description:                                                            //
//                                                                         //
// This class provides methods for reading in a .PCX format file and       //
// converting it to SNES display format.                                   //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// Includes                                                                //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

#include <stdio.h>
#include "pcxfile.h"




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// NAME:    PcxFile Constructor                                            //
//                                                                         //
// PURPOSE: Open the specified .PCX and convert it to SNES display format. //
//                                                                         //
// TYPE:    Public                                                         //
//                                                                         //
// INPUTS:  char* filename                                                 //
//          The name of the .PCX file.                                     //
//                                                                         //
// OUTPUTS: BOOL& success                                                  //
//          Success indication.                                            //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

PcxFile::PcxFile(char* filename, BOOL& success) {
    FILE* filePtr;

    // indicate PC screen data and SNES screen data not yet allocated
    screenData = NULL;
    snesData = NULL;

    // assume failure
    success = FALSE;

    // attempt to open file
    filePtr = fopen (filename, "rb");

    // if successfully opened file
    if (filePtr != NULL)
    {
        // if able to read PCX header
        if (readHeader(filePtr))
        {
            // if able to decode PCX data
            if (decode(filePtr))
            {
                // convert to SNES data
                convertToSnesData();

                // delete the PC format screen data
                delete [] screenData;

                // indicate PC format screen data deallocated
                screenData = NULL;

                // indicate success
                success = TRUE;
            }
        }

        // close the file
        fclose(filePtr);
    }
}




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// NAME:    PcxFile Destructor                                             //
//                                                                         //
// PURPOSE: Delete any allocated memory.                                   //
//                                                                         //
// TYPE:    Public                                                         //
//                                                                         //
// INPUTS:  None                                                           //
//                                                                         //
// OUTPUTS: None                                                           //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////


PcxFile::~PcxFile()
{
    if (screenData != NULL)
        delete [] screenData;

    if (snesData != NULL)
        delete [] snesData;
}




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// NAME:    readHeader                                                     //
//                                                                         //
// PURPOSE: Read the header information from the specified file and check  //
//          that it is a 320 pixel wide, 256 colour image.                 //
//                                                                         //
// TYPE:    Private                                                        //
//                                                                         //
// INPUTS:  FILE* filePtr                                                  //
//          The .PCX file.                                                 //
//                                                                         //
// OUTPUTS: BOOL                                                           //
//          Indicates success of reading header.                           //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

BOOL PcxFile::readHeader(FILE* filePtr) {
    BYTE header[128];

    // if able to read header from file
    if (fread(header, 128, 1, filePtr) == 1) {
        // extract format from header
        unsigned int bitsPerPixel = header[3];
        unsigned int numberPlanes = header[65];
        unsigned int bytesPerLine = header[66] + 256 * header[67];

        // if expected format
        if ((bitsPerPixel == 8) && (numberPlanes == 1) && (bytesPerLine == 320)) {
            // indicate header successfully read
            return TRUE;
        } else {
            printf ("Wrong size: %d\n", bytesPerLine);
        }
    }
    // indicate error reading header
    return FALSE;
}




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// NAME:    evaluateSnesPalette                                            //
//                                                                         //
// PURPOSE: Converts the red, green, blue colour palette data into SNES    //
//          format.                                                        //
//                                                                         //
// TYPE:    Private                                                        //
//                                                                         //
// INPUTS:  None                                                           //
//                                                                         //
// OUTPUTS: None                                                           //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

void PcxFile::evaluateSnesPalette(void) {
    printf ("evaluateSnesPalette\n");
    // loop over all colour registers
    for (unsigned int index = 0; index < 256; index++) {
        // convert from 8-bit RGB to 5-bit RGB
        snesPalette[index] = (red[index] >> 3) | ((green[index] >> 3) << 5) | ((blue[index] >> 3) << 10);
        // printf("index %u color %u\n", index, snesPalette[index]);
    }
}




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// NAME:    decode                                                         //
//                                                                         //
// PURPOSE: This method reads in and decodes the .PCX file.                //
//                                                                         //
// TYPE:    Private                                                        //
//                                                                         //
// INPUTS:  FILE* filePtr                                                  //
//          The .PCX file.                                                 //
//                                                                         //
// OUTPUTS: BOOL                                                           //
//          Indicates success of reading in .PCX file.                     //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

BOOL PcxFile::decode(FILE* filePtr) {
    printf ("decode\n");
    BOOL error = FALSE;
    unsigned long screenIndex = 0;

    // allocate memory to hold PC screen image
    screenData = new BYTE[64000];

    // while more screen data to read and no errors
    while ((screenIndex < 64000) && (!error)) {
        BYTE code;

        // if able to read a data code from the file
        if (fread(&code, 1, 1, filePtr) == 1) {
            // if code indicates a repeated byte value
            if (code >= 0xC0) {
                BYTE value;

                // if able to read repeated byte value from the file
                if (fread(&value, 1, 1, filePtr) == 1) {
                    // evaluate repeat count
                    code &= 0x3F;

                    // duplicate the repeated byte value
                    while (code--) {
                        screenData[screenIndex++] = value;
                    }
                }
                else {
                    printf("error able to read repeated byte value from the file\n");
                    error = TRUE;
                }
            }
            else {
                // then data is code value
                screenData[screenIndex++] = code;
            }
        }
        else {
            printf("error able to read a data code from the file\n");
            error = TRUE;
        }
    }


    // if so far successful
    if (!error) {
        BYTE paletteIndicator;

        // if able to read the 256 colour palette indicator from the file
        if (fread(&paletteIndicator, 1, 1, filePtr) == 1) {
            // if the 256 colour palette indicator
            if (paletteIndicator == 0x0C) {
                unsigned int paletteIndex = 0;

                // while more palette data to read and no errors
                while ((paletteIndex < 256) && (!error)) {
                    BYTE rgb[3];

                    // if able to read colour value from the file
                    if (fread(&rgb, 3, 1, filePtr) == 1) {
                        // split into rgb values
                        red[paletteIndex] = rgb[0];
                        green[paletteIndex] = rgb[1];
                        blue[paletteIndex++] = rgb[2];
                    }
                    else {
                        printf("error read colour value from the file\n");
                        error = TRUE;
                    }
                }
            }
            else {
                printf("error 256 colour palette indicator\n");
                error = TRUE;
            }
        }
        else {
            printf("error able to read the 256 colour palette indicator from the file\n");
            error = TRUE;
        }
    }

    // if successful
    if (!error) {
        // convert colour palette to SNES format
        evaluateSnesPalette();
    }

    // indicate whether decode was successful
    return !error;
}




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// NAME:    getBitPlane                                                    //
//                                                                         //
// PURPOSE: Returns the SNES format bitplane for the specified part of the //
//          tile at the specified screen map position.                     //
//                                                                         //
// TYPE:    Private                                                        //
//                                                                         //
// INPUTS:  unsigned int x                                                 //
//          unsigned int y                                                 //
//          This is the (x, y) screen map position of the required tile.   //
//                                                                         //
//          unsigned int line                                              //
//          The scan line of the tile required.                            //
//                                                                         //
//          unsigned int plane                                             //
//          The colour plane of the tile required.                         //
//                                                                         //
// OUTPUTS: BYTE                                                           //
//          The SNES format bitplane.                                      //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

BYTE PcxFile::getBitPlane (unsigned int x, unsigned int y, unsigned int line, unsigned int plane) {
    BYTE bitPlane = 0;
    BYTE* displayPtr = &(screenData[320 * ((y << 3) + line) + (x << 3) + 32]);

    /* loop over 8 pixels */
    for (unsigned int index = 0; index < 8; index++) {
        /* if the bit in this plane is set */
        if (displayPtr[index] & (0x01 << plane)) {
            /* then set it in our character's bit plane */
            bitPlane |= (0x80 >> index);
        }
    }

    return bitPlane;
}




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// NAME:    convertToSnesData                                              //
//                                                                         //
// PURPOSE: Converts the screen data into SNES format.                     //
//                                                                         //
// TYPE:    Private                                                        //
//                                                                         //
// INPUTS:  None                                                           //
//                                                                         //
// OUTPUTS: None                                                           //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

void PcxFile::convertToSnesData(void) {
    printf ("convertToSnesData\n");
    unsigned int index = 0;

    // allocate memory to hold SNES screen data
    snesData = new BYTE[64000];

    // loop over every row of tiles
    for (unsigned int y = 0; y < 25; y++) {
        // loop over every tiles in the row
        for (unsigned int x = 0; x < 32; x++) {
            // make 4 passes over 256 colour data
            for (unsigned int pass = 0; pass < 4; pass++) {
                // loop over 8 scan lines per character
                for (unsigned int line = 0; line < 8; line++) {
                    // loop over 2 colour planes on each pass
                    for (unsigned int plane = 0; plane < 2; plane++) {
                        snesData[index++] = getBitPlane(x, y, line, (pass << 1) + plane);
                    }
                }
            }
        }
    }
}
