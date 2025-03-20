#ifndef _ANIMATOR_H
#define _ANIMATOR_H

// includes
#include "types.h"

// forward class declarations
class PcxFile;

// class definition
class Animator
{
    public:

        // write out the data for the first screen
        unsigned int writeOutFirstScreenData(PcxFile* screen,
                                             BYTE* animationData);

        // evaluate the differences between the 2 screens
        unsigned int evaluateDifferences(PcxFile* screen1,
                                         PcxFile* screen2,
                                         BYTE* animationData);


    protected:


    private:

        // write out a word in low byte, high byte format to the data file
        void writeWord(unsigned int word,
                       unsigned int& animationIndex,
                       BYTE* animationData);

        // find end of colour palette change
        unsigned int findColourChangeEnd(unsigned int startIndex,
                                         PcxFile* screen1,
                                         PcxFile* screen2);

        // find end of an animation series
        unsigned int findAnimateEnd(unsigned int startIndex,
                                    PcxFile* screen1,
                                    PcxFile* screen2);
};

#endif
