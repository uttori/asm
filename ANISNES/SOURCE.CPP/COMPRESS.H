#ifndef _COMPRESS_H
#define _COMPRESS_H

// includes
#include "types.h"

// class definition
class Compressor
{
    public:

        // compress the source data
        unsigned int compress(BYTE* sourceDataPtr,
                              unsigned int sourceDataLength,
                              BYTE* destinationDataPtr);


    protected:


    private:

        BYTE* sourceData;
        unsigned int sourceLength;
        unsigned int sourceIndex;

        BYTE* destinationData;
        unsigned int destinationIndex;

        BYTE repeatCode;
        unsigned int repeatCount;

        BYTE collectionCodes[128];
        unsigned int collectionCount;

        BYTE previousCode;
        BYTE nextCode;

        enum
        {
            nothingRead,
            oneCodeRead,
            buildRepeatString,
            buildCollectionString,
            finished
        } state;

        void nothingReadProcessing (void);

        void oneCodeReadProcessing (void);

        void buildRepeatStringProcessing (void);

        void buildCollectionStringProcessing (void);
};

#endif
