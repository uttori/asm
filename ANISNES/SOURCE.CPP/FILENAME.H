#ifndef _FILENAME_H
#define _FILENAME_H

// includes
#include "types.h"

// class definition
class Filename
{
    public:

        // constructor
        Filename(char* name);

        // get next filename in series
        void getNextFilename(char* name);


    protected:


    private:

        char baseName[256];

        unsigned int baseNameLength;

        unsigned int count;
};

#endif
