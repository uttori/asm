/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// FILE:    FILENAME.CPP                                                   //
//                                                                         //
// Class:   Filename                                                       //
//                                                                         //
// Description:                                                            //
//                                                                         //
// This class provides methods for generating filenames for the .PCX       //
// animation files.                                                        //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// Includes                                                                //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

#include <stdio.h>
#include <string.h>
#include "filename.h"




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// NAME:    Filename Constructor                                           //
//                                                                         //
// PURPOSE: The first 4 characters of the specified filename are extracted //
//          and recorded as the base name for subsequent filenames.        //
//                                                                         //
// TYPE:    Public                                                         //
//                                                                         //
// INPUTS:  char* name                                                     //
//          The name of the series of .PCX files.                          //
//                                                                         //
// OUTPUTS: None                                                           //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

Filename::Filename(char* name)
{
    baseNameLength = 0;

    // find end of filename or begining of extender
    while (name[baseNameLength] && (name[baseNameLength] != '.'))
    {
        baseNameLength++;
    }

    // if too long
    if (baseNameLength > 4)
    {
        baseNameLength = 4;
    }

    // copy to base name
    strncpy(baseName, name, baseNameLength);

    // initialise file count
    count = 1;
}




/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// NAME:    getNextFilename                                                //
//                                                                         //
// PURPOSE: This method returns the next .PCX filename.                    //
//                                                                         //
// TYPE:    Public                                                         //
//                                                                         //
// INPUTS:  None                                                           //
//                                                                         //
// OUTPUTS: char* name                                                     //
//          Returns the next .PCX filename.                                //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////

void Filename::getNextFilename(char* name)
{
    // copy base filename
    strncpy(name, baseName, baseNameLength);

    // add sequence number
    sprintf(&name[baseNameLength], "%04d.pcx", count++);
}
