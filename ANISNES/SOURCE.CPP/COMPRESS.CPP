/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// FILE:    COMPRESS.CPP                                                   //
//                                                                         //
// Class:   Compressor                                                     //
//                                                                         //
// Description:                                                            //
//                                                                         //
// This class provides methods for compressing source animation data. Two  //
// passes are made over the data, once over the even bytes and once over   //
// the odd bytes.                                                          //
//                                                                         //
// A code byte precedes each compressed string. If bit 7 of the code byte  //
// is clear, then bits 0..6 indicate the number of times + 1 that the      //
// following byte are repeated. If bit 7 of the code byte is set, then     //
// bits 0..6 indicate the number + 1 of following different bytes.         //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// Includes                                                                //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

#include <stdio.h>
#include "compress.h"




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// Constants                                                               //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

const BYTE REPEAT_INDICATOR     = 0x00;
const BYTE COLLECTION_INDICATOR = 0x80;




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// NAME:    nothingReadProcessing                                          //
//                                                                         //
// PURPOSE: This method is invoked when no bytes have been read from the   //
//          source data.                                                   //
//                                                                         //
// TYPE:    Private                                                        //
//                                                                         //
// INPUTS:  None                                                           //
//                                                                         //
// OUTPUTS: None                                                           //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

void Compressor::nothingReadProcessing (void)
{
    // get first byte from source data
    previousCode = sourceData[sourceIndex];

    // update index into source data
    sourceIndex += 2;

    // if more source data
    if (sourceIndex < sourceLength)
    {
        // update state
        state = oneCodeRead;
    }
    else
    {
        // write out compressed data
        destinationData[destinationIndex++] = COLLECTION_INDICATOR;
        destinationData[destinationIndex++] = previousCode;

        // indicate compression finished
        state = finished;
    }
}




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// NAME:    oneCodeReadProcessing                                          //
//                                                                         //
// PURPOSE: This method is invoked when one byte has been read from the    //
//          source data.                                                   //
//                                                                         //
// TYPE:    Private                                                        //
//                                                                         //
// INPUTS:  None                                                           //
//                                                                         //
// OUTPUTS: None                                                           //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

void Compressor::oneCodeReadProcessing (void)
{
    // get second byte from source data
    nextCode = sourceData[sourceIndex];

    // update index into source data
    sourceIndex += 2;

    // if more source data
    if (sourceIndex < sourceLength)
    {
        // if bytes are the same
        if (previousCode == nextCode)
        {
            // then start building a repeat string
            repeatCode = previousCode;
            repeatCount = 2;
            state = buildRepeatString;
        }
        else
        {
            // else start building a collection string
            collectionCount = 0;
            collectionCodes[collectionCount++] = previousCode;
            collectionCodes[collectionCount++] = nextCode;
            state = buildCollectionString;
        }
    }
    else
    {
        // if bytes are the same
        if (previousCode == nextCode)
        {
            // then write out a repeat string
            destinationData[destinationIndex++] = REPEAT_INDICATOR | 0x01;
            destinationData[destinationIndex++] = previousCode;
        }
        else
        {
            // else write out a collection string
            destinationData[destinationIndex++] = COLLECTION_INDICATOR | 0x01;
            destinationData[destinationIndex++] = previousCode;
            destinationData[destinationIndex++] = nextCode;
        }

        // indicate compression finished
        state = finished;
    }
}




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// NAME:    buildRepeatStringProcessing                                    //
//                                                                         //
// PURPOSE: This method is invoked when a number of repeated bytes have    //
//          been read from the source data.                                //
//                                                                         //
// TYPE:    Private                                                        //
//                                                                         //
// INPUTS:  None                                                           //
//                                                                         //
// OUTPUTS: None                                                           //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

void Compressor::buildRepeatStringProcessing (void)
{
    // get next byte from source data
    nextCode = sourceData[sourceIndex];

    // if it's the same as the repeat string we're building
    if (repeatCode == nextCode)
    {
        // update count on times byte repeated
        repeatCount++;

        // update index into source data
        sourceIndex += 2;

        // if more source data
        if (sourceIndex < sourceLength)
        {
            // if maximum repeat count
            if (repeatCount == 128)
            {
                // then write out repeat string
                destinationData[destinationIndex++] = REPEAT_INDICATOR |
                                                      (repeatCount-1);
                destinationData[destinationIndex++] = repeatCode;

                // return to nothing read state
                state = nothingRead;
            }
        }
        else
        {
            // else write out repeat string
            destinationData[destinationIndex++] = REPEAT_INDICATOR |
                                                  (repeatCount-1);
            destinationData[destinationIndex++] = repeatCode;

            // indicate compression finished
            state = finished;
        }
    }
    else
    {
        // write out repeat string
        destinationData[destinationIndex++] = REPEAT_INDICATOR |
                                              (repeatCount-1);
        destinationData[destinationIndex++] = repeatCode;

        // return to nothing read state
        state = nothingRead;
    }
}




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// NAME:    buildCollectionStringProcessing                                //
//                                                                         //
// PURPOSE: This method is invoked when a number of different bytes have   //
//          been read from the source data.                                //
//                                                                         //
// TYPE:    Private                                                        //
//                                                                         //
// INPUTS:  None                                                           //
//                                                                         //
// OUTPUTS: None                                                           //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

void Compressor::buildCollectionStringProcessing (void)
{
    // get next byte from source data
    nextCode = sourceData[sourceIndex];

    // if it is the same as the last byte read in the collection string
    if (nextCode == collectionCodes[collectionCount-1])
    {
        // decrement the number of bytes in the collection string
        collectionCount--;

        // if there are some bytes left in the collection string
        if (collectionCount)
        {
            // write out the collection string
            destinationData[destinationIndex++] = COLLECTION_INDICATOR |
                                                  (collectionCount-1);
            for (unsigned int index = 0; index < collectionCount; index++)
                destinationData[destinationIndex++] = collectionCodes[index];
        }

        // start building a repeat string
        repeatCode = nextCode;
        repeatCount = 1;
        state = buildRepeatString;
    }
    else
    {
        // add byte to the collection string
        collectionCodes[collectionCount++] = nextCode;

        // update index into source data
        sourceIndex += 2;

        // if more source data
        if (sourceIndex < sourceLength)
        {
            // if maximum collection count
            if (collectionCount == 128)
            {
                // then write out collection string
                destinationData[destinationIndex++] = COLLECTION_INDICATOR |
                                                      (collectionCount-1);
                for (unsigned int index = 0; index < collectionCount; index++)
                    destinationData[destinationIndex++] = collectionCodes[index];

                // return to nothing read state
                state = nothingRead;
            }
        }
        else
        {
            // else write out collection string
            destinationData[destinationIndex++] = COLLECTION_INDICATOR |
                                                  (collectionCount-1);
            for (unsigned int index = 0; index < collectionCount; index++)
                destinationData[destinationIndex++] = collectionCodes[index];

            // indicate compression finished
            state = finished;
        }
    }
}




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// NAME:    compress                                                       //
//                                                                         //
// PURPOSE: This method will compress the specified source data bytes into //
//          the area pointed to by the destination data pointer.           //
//                                                                         //
// TYPE:    Public                                                         //
//                                                                         //
// INPUTS:  BYTE* sourceDataPtr                                            //
//          A pointer to the source animation data.                        //
//                                                                         //
//          unsigned int sourceDataLength                                  //
//          The number of source animation data bytes.                     //
//                                                                         //
// OUTPUTS: BYTE* destinationDataPtr                                       //
//          A pointer to the destination data.                             //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

unsigned int Compressor::compress(BYTE* sourceDataPtr,
                                  unsigned int sourceDataLength,
                                  BYTE* destinationDataPtr)
{
    // initialise data members
    sourceData = sourceDataPtr;
    sourceLength = sourceDataLength;
    destinationData = destinationDataPtr;
    destinationIndex = 0;

    // make 2 passes over the source data, once over even bytes, once over
    // odd bytes
    for (unsigned int pass = 0; pass < 2; pass++)
    {
        sourceIndex = pass;
        state = nothingRead;

        // while compressing
        while (state != finished)
        {
            switch (state)
            {
                case nothingRead:
                    nothingReadProcessing ();
                    break;

                case oneCodeRead:
                    oneCodeReadProcessing ();
                    break;

                case buildRepeatString:
                    buildRepeatStringProcessing ();
                    break;

                case buildCollectionString:
                    buildCollectionStringProcessing ();
                    break;
            }
        }
    }

    // return the number of bytes the source data was compressed into
    return destinationIndex;
}
