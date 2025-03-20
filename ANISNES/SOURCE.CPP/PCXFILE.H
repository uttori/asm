#ifndef _PCXFILE_H
#define _PCXFILE_H

// includes
#include "types.h"

// class definition
class PcxFile
{
    public:

        // constructor
        PcxFile(char* filename,
                BOOL& success);

        // destructor
        ~PcxFile();

        // SNES palette data
        unsigned int snesPalette[256];

        // SNES screen representation
        BYTE* snesData;


    protected:


    private:

        // read PCX header
        BOOL readHeader(FILE* filePtr);

        // convert RGB to SNES palette
        void evaluateSnesPalette(void);

        // decode PCX data
        BOOL decode(FILE* filePtr);

        // get a SNES format bit plane from the PC screen data
        BYTE getBitPlane (unsigned int x,
                          unsigned int y,
                          unsigned int line,
			              unsigned int plane);

        // convert PC screen data to SNES screen data
        void convertToSnesData(void);

        // PC screen representation
        BYTE* screenData;

        // colour palette data
        BYTE red[256];
        BYTE green[256];
        BYTE blue[256];
};

#endif
