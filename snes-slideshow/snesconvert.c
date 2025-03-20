// https://raw.githubusercontent.com/Kannagi/SNESConvert/master/main.c

#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <time.h>

#include <SDL/SDL.h>
#include <SDL/SDL_image.h>


#ifdef __MINGW32__
#undef main
#endif

void snes_convert(SDL_Surface *image, char *adresse);

int main(int argc, char** argv) {
    SDL_Init(SDL_INIT_VIDEO);

    SDL_Surface *image,*copy;
    int n = 1, i;
    char adresse[500];

    adresse[0] = 0;

    image = IMG_Load(adresse);

    copy = SDL_CreateRGBSurface(0,image->w,image->h,24,0,0,0,0);
    SDL_BlitSurface(image,NULL,copy,NULL);

    snes_convert(copy, adresse);

    SDL_FreeSurface(copy);
    SDL_FreeSurface(image);
    SDL_Quit();

    return 0;

}

void sort_palette(SDL_Surface *image, int casex, int casey, unsigned char *pixel, unsigned char *palette, int *tiles) {
    int x,y,i,l;
    int n = 0;
    int r,g,b;

    for(y = casey; y < casey + 8; y++) {
        for(x = casex; x < casex + 8; x++) {
            i = (y * image->w * image->format->BytesPerPixel) + x * image->format->BytesPerPixel;
            r = pixel[i + 0];
            g = pixel[i + 1];
            b = pixel[i + 2];

            for(l = 0; l < 768; l += 3) {
                if(palette[l + 0] == r && palette[l + 1] == g && palette[l + 2] == b) {
                    break;
                }
            }
            tiles[n] = l / 3;
            n++;
        }
    }
}

int write_rom(FILE *file, SDL_Surface *image, unsigned char *pixel, unsigned char *palette) {
    int casex, casey;
    int tiles[64];
    int octet4[8];
    int i,l;
    int x,y,size = 0;
    char chaine[500];
    char casm1[500];
    char casm2[500];
    char casm3[500];
    char casm4[500];

    casex = 0;
    casey = 0;

    sprintf(chaine,"\n");
    fputs(chaine,file);

    int npal = 256;
    while(1) {
        sort_palette(image,casex,casey,pixel,palette,tiles);

        // 2, 4, 8pbb
        sprintf(casm1,"    .db ");
        sprintf(casm2,"    .db ");
        sprintf(casm3,"    .db ");
        sprintf(casm4,"    .db ");

        for(y = 0; y < 8; y++) {
            octet4[0] = 0;
            octet4[1] = 0;
            octet4[2] = 0;
            octet4[3] = 0;

            octet4[4] = 0;
            octet4[5] = 0;
            octet4[6] = 0;
            octet4[7] = 0;

            for(x = 0; x < 8; x++) {
                i = tiles[x + (y * 8)] + 1;

                if(i > npal - 1) {
                    i = npal - 1;
                }
                octet4[0] += ((i >> 0) & 0x01) << (7 - x);
                octet4[1] += ((i >> 1) & 0x01) << (7 - x);
                octet4[2] += ((i >> 2) & 0x01) << (7 - x);
                octet4[3] += ((i >> 3) & 0x01) << (7 - x);

                octet4[4] += ((i >> 4) & 0x01) << (7 - x);
                octet4[5] += ((i >> 5) & 0x01) << (7 - x);
                octet4[6] += ((i >> 6) & 0x01) << (7 - x);
                octet4[7] += ((i >> 7) & 0x01) << (7 - x);
            }

            sprintf(chaine,"$%.2x,$%.2x,", octet4[0], octet4[1]);
            strcat(casm1,chaine);

            sprintf(chaine,"$%.2x,$%.2x,", octet4[2], octet4[3]);
            strcat(casm2,chaine);

            sprintf(chaine,"$%.2x,$%.2x,", octet4[4], octet4[5]);
            strcat(casm3,chaine);

            sprintf(chaine,"$%.2x,$%.2x,", octet4[6], octet4[7]);
            strcat(casm4,chaine);
        }

        i = strlen(casm1);
        casm1[i-1] = 0;
        fputs(casm1,file);
        fputs("\n",file);
        size += 16;

        i = strlen(casm2);
        casm2[i-1] = 0;
        fputs(casm2,file);
        fputs("\n",file);
        size += 16;

        i = strlen(casm3);
        casm3[i-1] = 0;
        fputs(casm3,file);
        fputs("\n",file);

        i = strlen(casm4);
        casm4[i-1] = 0;
        fputs(casm4,file);
        fputs("\n",file);
        size += 32;

        casex += 8;
        if(casex + 8 > image->w) {
            casex = 0;
            casey += 8;
        }

        if(casey + 8 > image->h) {
          break;
        }
    }

    // writing palette
    fputs("\n",file);
    fputs("\n",file);
    return size;
}

int write_pal(FILE *file,SDL_Surface *image,char *schaine,unsigned char *palette,unsigned char *pixel,int color, int taille) {
    int i,n;
    int psize = 0;
    char chaine[100];
    unsigned char couleur;
    int octet4[4];

    sprintf(chaine,"pallette_%s:\n",schaine);
    fputs(chaine,file);
    sprintf(chaine,"    .db  ");
    fputs(chaine,file);

    for(i = 0;i < color; i++) {
        n = i * 3;

        if(i != 0) fputs(",", file);

        couleur = palette[n+2] / 8;
        octet4[0] = couleur;

        couleur = palette[n+1] / 8;
        octet4[0] += ( 0x07 & couleur) << 5;
        octet4[1] =  (0x18 & couleur) >> 3;

        couleur = palette[n+0] / 8;
        octet4[1] += couleur << 2;

        sprintf(chaine,"$%.2x,$%.2x",octet4[0],octet4[1]);
        fputs(chaine,file);
        printf("%s %d %d %d\n",chaine ,palette[n+0],palette[n+1],palette[n+2]);
        psize += 2;
    }

    return psize;
}

void snes_convert(SDL_Surface *image, char *adresse) {
    FILE *file;
    int i,l,taille;
    int x,y,size = 0,psize = 0;
    char chaine[200],schaine[200];

    unsigned char palette[768];
    for(i = 0;i < 768;i++) {
        palette[i] = 0;
    }

    unsigned char *pixel = image->pixels;

    taille = image->w*image->h*image->format->BytesPerPixel;

    sprintf(chaine,"%s.asm",schaine);
    file = fopen(chaine,"w");

    size = write_rom(file, image, pixel, palette);

    psize = write_pal(file, image, schaine, palette, pixel, color, taille);

    char chaine[200];

    fputs("\n",file);
    fputs("\n",file);
    fputs("\n",file);
    sprintf(chaine,";palette size octet : %d ,hexa $%.4x",psize,psize);
    fputs(chaine,file);
    fputs("\n",file);
    sprintf(chaine,";size octet : %d ,hexa $%.4x",size,size);
    fputs(chaine,file);
    fputs("\n",file);
    fclose(file);
}
