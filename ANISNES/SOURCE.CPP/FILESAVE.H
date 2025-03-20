#ifndef _FILESAVER_H
#define _FILESAVER_H

// includes
#include "types.h"

// class definitions
class FileSaver
{
    public:

        // constructor
        FileSaver(char* filename);

        // destructor
        ~FileSaver();

        // save the specified data to the .SAF and .SAD files
        void saveData(BYTE* compressedData,
                      unsigned int compressedLength,
                      unsigned int animationLength);


    protected:


    private:

        FILE* animationFile;
        FILE* frameFile;
        unsigned long animationOffset;
};

#endif
