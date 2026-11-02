; Unsuffixed wide symbol immediates retain both low-word bytes after SEP.
; Literal spelling and explicit .b remain authoritative for byte immediates.
lorom
org $008000
SEP #$30
LDA #Routine
ADC #(Routine&$FFFF)
BIT #Routine
LDX #Routine>>16
LDA.b #Routine
REP #$30
LDA #$12
LDA.w #$12
RTL
Routine = $098000
