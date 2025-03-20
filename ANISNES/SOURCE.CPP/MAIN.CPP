/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// FILE:    MAIN.CPP                                                       //
//                                                                         //
// Description:                                                            //
//                                                                         //
// The main program for ANISNES which converts a series of .PCX files into //
// a format suitable for animated playback on the SNES.                    //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// Includes                                                                //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

#include <stdio.h>
#include <string.h>
// #include <dos.h>
#include "pcxfile.h"
#include "animator.h"
#include "compress.h"
#include "filesave.h"
#include "filename.h"




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// main program                                                            //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

int main(void)
{
    Filename* namer;
    Animator animator;
    Compressor compressor;
    FileSaver* fileSaver;

    char firstFilename[256];
    char filename[8] = "P01.PCX";

    PcxFile* screen1 = NULL;
    PcxFile* screen2 = NULL;

    BYTE* animationData;
    unsigned int animationLength;
    unsigned long totalAnimationLength;

    BYTE* compressedData;
    unsigned int compressedLength;
    unsigned long totalCompressedLength;

    BOOL success;

    // if no filename provided
    // if (_argc < 1)
    // {
        // printf ("Filename> ");
        // scanf ("%s", filename);
        printf ("File: %s\n", filename);
    // }
    // else
    // {
    //     strcpy (filename, _argv[1]);
    // }

    // new object to create filenames
    namer = new Filename(filename);

    // new object to save file data
    fileSaver = new FileSaver(filename);

    // allocate area to hold animation data
    animationData = new BYTE[64000];

    // allocate are to hold compressed data
    compressedData = new BYTE[64000];

    // get first filename
    namer->getNextFilename(firstFilename);

    // try and read first file
    screen1 = new PcxFile(firstFilename, success);

    // FILE* paletteFile = fopen("P01.palette", "wb");
    // fwrite(screen1->snesPalette, sizeof(screen1->snesPalette), 1, paletteFile);
    // fclose(paletteFile);
    //
    // FILE* snesDataFile = fopen("P01.snes_data", "wb");
    // fwrite(screen1->snesData, sizeof(screen1->snesData), 1, snesDataFile);
    // fclose(snesDataFile);

    // if successful
    if (success) {
        // get the data for the first screen
        animationLength = animator.writeOutFirstScreenData(screen1,
                                                           animationData);

        // FILE* animationFile = fopen("P01.animation_data", "wb");
        // fwrite(animationData, animationLength, 1, animationFile);
        // fclose(animationFile);

        // compress it
        compressedLength = compressor.compress(animationData,
                                               animationLength,
                                               compressedData);

        // save the data
        fileSaver->saveData(compressedData,
                            compressedLength,
                            animationLength);

        // inform the user
        printf ("%s : (%u) %u\n", firstFilename,
                                  animationLength,
                                  compressedLength);

        totalAnimationLength = animationLength;
        totalCompressedLength = compressedLength;
    } else {
      printf ("Couldn't read file: %s\n", filename);
    }

    // // while successful
    // while (success)
    // {
    //     // get next filename
    //     namer->getNextFilename(filename);
    //
    //     // try and read next file
    //     screen2 = new PcxFile(filename, success);
    //
    //     // if successful
    //     if (success)
    //     {
    //         // get the animation data
    //         animationLength = animator.evaluateDifferences(screen1,
    //                                                        screen2,
    //                                                        animationData);
    //
    //         // compress it
    //         compressedLength = compressor.compress(animationData,
    //                                                animationLength,
    //                                                compressedData);
    //
    //         // save the data
    //         fileSaver->saveData(compressedData,
    //                             compressedLength,
    //                             animationLength);
    //
    //         // inform the user
    //         printf ("!!! %s : (%u) %u\n", filename,
    //                                   animationLength,
    //                                   compressedLength);
    //
    //         totalAnimationLength += animationLength;
    //         totalCompressedLength += compressedLength;
    //
    //         // delete first screen
    //         delete screen1;
    //
    //         // make second screen the first
    //         screen1 = screen2;
    //
    //         screen2 = NULL;
    //     }
    // }


    // and loop back to first frame
    screen2 = new PcxFile(firstFilename, success);

    // if successful
    if (success)
    {
        // get the number of bytes that are different
        animationLength = animator.evaluateDifferences(screen1,
                                                       screen2,
                                                       animationData);

        // compress it
        compressedLength = compressor.compress(animationData,
                                               animationLength,
                                               compressedData);

        // save the data
        fileSaver->saveData(compressedData,
                            compressedLength,
                            animationLength);

        // inform the user
        printf ("%s : (%u) %u\n", firstFilename,
                                  animationLength,
                                  compressedLength);

        totalAnimationLength += animationLength;
        totalCompressedLength += compressedLength;
    }

    // inform user of total length
    printf ("%lu animation bytes\n", totalAnimationLength);
    printf ("%lu compressed bytes\n", totalCompressedLength);

    // delete objects
    delete namer;
    delete fileSaver;

    // delete screens
    delete screen1;
    delete screen2;
}
